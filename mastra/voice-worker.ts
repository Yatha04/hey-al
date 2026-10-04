// The LiveKit worker: runs the voice pipeline and answers each turn with the Mastra agent.
// Memory is read-only during a call: no tool calls slow a turn, and preemptive generation is safe.
// The worker saves committed turns itself; the profile and summary are written after the call.
import { fileURLToPath } from "node:url";
import { voice } from "@livekit/agents";
import { createLiveKitWorker, runLiveKitWorker } from "@mastra/livekit/worker";
import { AGENT_NAME } from "../lib/agent-name";
import { saveTurn, summarizeCall } from "./calls";
import { mastra } from "./index";

// Live calls in this process, by thread id, so onCallEnd can wait for their turn writes.
const calls = new Map<string, { session: voice.AgentSession; pending: Set<Promise<void>> }>();

export default createLiveKitWorker({
  mastra,
  agent: "al",
  stt: "deepgram/nova-3",
  // Saath chose this over cartesia/sonic-3 after a listening test: half the price, similar time to first audio.
  tts: "inworld/inworld-tts-2",
  turnDetection: "multilingual",
  // thread = room (one per call); resource = the user the connection route dispatched.
  memory: ({ metadata, roomName }) => ({
    thread: metadata.threadId ?? roomName,
    resource: metadata.resourceId ?? roomName,
    options: { readOnly: true },
  }),
  turnHandling: { preemptiveGeneration: { enabled: true } },
  // Spoken as soon as the tool call starts, so the person is not left in silence.
  toolFeedback: ({ toolName }) => (toolName === "searchWeb" ? "Let me look that up." : undefined),
  configuration: {
    greeting: { text: "Hello, this is Al. How can I help?" },
    endCall: {},
  },
  // Runs after the greeting is spoken and saved by the worker, so the greeting is not saved twice.
  onSessionStart: ({ session, agent }) => {
    const mapping = agent.memory;
    if (!mapping) return;
    const { thread, resource = thread } = mapping;
    const pending = new Set<Promise<void>>();
    calls.set(thread, { session, pending });

    // Fires only for items the session committed, never for discarded preemptive replies.
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, ({ item }) => {
      if (item.type !== "message" || (item.role !== "user" && item.role !== "assistant")) return;
      const text = item.textContent;
      if (!text) return;
      const turn = { id: item.id, role: item.role, text, createdAt: new Date(item.createdAt) };
      const write = saveTurn(thread, resource, turn).catch((e) => {
        // A lost transcript line must not end the live conversation. Error name only: the turn is personal content.
        console.error("saveTurn failed", { thread, error: e instanceof Error ? e.name : typeof e });
      });
      pending.add(write);
      void write.finally(() => pending.delete(write));
    });
  },
  // Awaited inside LiveKit's shutdown window. Close first so the last (often interrupted) turn is committed.
  onCallEnd: async ({ memory }) => {
    if (!memory) return;
    const call = calls.get(memory.thread);
    calls.delete(memory.thread);
    if (call) {
      await call.session.close();
      await Promise.all(call.pending);
    }
    await summarizeCall(memory.thread, memory.resource ?? memory.thread);
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: AGENT_NAME });
}
