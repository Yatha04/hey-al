// Mints a LiveKit token for the browser and dispatches the Al worker into a new room, with earlier calls' summaries.
// The response shape matches LiveKit's frontend starters.
import { randomUUID } from "node:crypto";
import { serializeSessionMetadata } from "@mastra/livekit";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { EARLIER_CALLS_KEY } from "@/agent/mastra";
import { AGENT_NAME } from "@/lib/agent-name";
import { DEMO_RESOURCE_ID, describeEarlierCalls } from "@/lib/calls";

export async function POST() {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return Response.json({ error: "LiveKit is not configured" }, { status: 500 });
  }
  const roomName = `al-${randomUUID()}`;
  const participantName = "user";
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: `user-${randomUUID()}`,
    name: participantName,
    ttl: "15m",
  });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
  // The worker's memory mapping reads resourceId; requestContext reaches the agent's instructions every turn.
  const metadata = serializeSessionMetadata({
    resourceId: DEMO_RESOURCE_ID,
    requestContext: { [EARLIER_CALLS_KEY]: await describeEarlierCalls(DEMO_RESOURCE_ID) },
  });
  token.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: AGENT_NAME, metadata })] });
  return Response.json({
    serverUrl: LIVEKIT_URL,
    roomName,
    participantName,
    participantToken: await token.toJwt(),
  });
}
