// Mints a LiveKit token for the browser and dispatches the Al worker into a new room.
// The response shape matches LiveKit's frontend starters.
import { randomUUID } from "node:crypto";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { AGENT_NAME } from "@/lib/agent-name";

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
  token.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })] });
  return Response.json({
    serverUrl: LIVEKIT_URL,
    roomName,
    participantName,
    participantToken: await token.toJwt(),
  });
}
