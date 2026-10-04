// The LiveKit worker: runs the voice pipeline and answers each turn with the Mastra agent.
// Mastra memory stores the call: thread = room name, resource = the resourceId the connection route dispatched.
import { fileURLToPath } from "node:url";
import { createLiveKitWorker, runLiveKitWorker } from "@mastra/livekit/worker";
import { AGENT_NAME } from "../lib/agent-name";
import { summarizeCall } from "../lib/calls";
import { mastra } from "./mastra";

export default createLiveKitWorker({
  mastra,
  agent: "al",
  stt: "deepgram/nova-3",
  // Saath chose this over cartesia/sonic-3 after a listening test: half the price, similar time to first audio.
  tts: "inworld/inworld-tts-2",
  turnDetection: "multilingual",
  configuration: {
    greeting: { text: "Hello, this is Al. How can I help?" },
    endCall: {},
  },
  // Awaited inside LiveKit's shutdown window, so the summary is written before the job exits.
  onCallEnd: async ({ memory }) => {
    if (memory) await summarizeCall(memory.thread);
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: AGENT_NAME });
}
