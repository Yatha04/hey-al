// Mints a LiveKit token for the browser and dispatches the Al worker into a new room, with earlier calls' summaries.
// The response shape matches LiveKit's frontend starters.
import { randomUUID } from "node:crypto";
import { serializeSessionMetadata } from "@mastra/livekit";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { AGENT_NAME } from "@/lib/agent-name";
import { getCurrentUser } from "@/lib/session";
import { EARLIER_CALLS_KEY, describeEarlierCalls } from "@/mastra/calls";
import { USER_KEY } from "@/mastra/users";

export async function POST() {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return Response.json({ error: "LiveKit is not configured" }, { status: 500 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
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
    resourceId: user.id,
    requestContext: { [USER_KEY]: user, [EARLIER_CALLS_KEY]: await describeEarlierCalls(user.id) },
  });
  token.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: AGENT_NAME, metadata })] });
  return Response.json({
    serverUrl: LIVEKIT_URL,
    roomName,
    participantName,
    participantToken: await token.toJwt(),
  });
}
