// The LiveKit worker: runs the voice pipeline and answers each turn with the Mastra agent.
import { fileURLToPath } from "node:url";
import { voice } from "@livekit/agents";
import { createLiveKitWorker, runLiveKitWorker } from "@mastra/livekit/worker";
import { AGENT_NAME } from "../lib/agent-name";
import { endSession, saveTurn, startSession } from "../lib/sessions";
import { mastra } from "./mastra";

// ponytail: one demo user (seeded by 0001_init.sql) until there is sign-in.
const DEMO_USER_ID = 1;

export default createLiveKitWorker({
  mastra,
  agent: "al",
  stt: "deepgram/nova-3",
  // Saath chose this over cartesia/sonic-3 after a listening test: half the price, similar time to first audio.
  tts: "inworld/inworld-tts-2",
  turnDetection: "multilingual",
  // Turns are persisted to Postgres below; the full LiveKit context goes to the agent each turn.
  memory: false,
  configuration: {
    greeting: { text: "Hello, this is Al. How can I help?" },
    endCall: {},
  },
  onSessionStart: async ({ session, ctx }) => {
    // Not awaited: the listener must attach now, or turns committed during the insert (the greeting) are lost.
    const sessionId = startSession(DEMO_USER_ID, ctx.job.room!.name);
    const pending = new Set<Promise<void>>();

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, ({ item }) => {
      if (item.type !== "message" || (item.role !== "user" && item.role !== "assistant")) return;
      const text = item.textContent;
      if (!text) return;
      const { role, interrupted, createdAt } = item;
      const write = sessionId.then((id) => saveTurn(id, role, text, interrupted, new Date(createdAt))).catch((e) => {
        // A lost transcript line must not end the live conversation. Error name only: the row is personal content.
        console.error("saveTurn failed", { roomName: ctx.job.room!.name, error: e instanceof Error ? e.name : typeof e });
      });
      pending.add(write);
      void write.finally(() => pending.delete(write));
    });

    ctx.addShutdownCallback(async () => {
      await Promise.all(pending);
      await endSession(await sessionId);
    });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: AGENT_NAME });
}
