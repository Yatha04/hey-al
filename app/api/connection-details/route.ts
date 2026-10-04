// Mints a LiveKit token for the browser and dispatches the Al worker into a new room, with earlier calls' summaries.
// With ?reminder=due it first claims a due reminder and starts a reminder call, or answers 204 when none is due:
// the voice page polls this while idle. The response shape matches LiveKit's frontend starters.
import { randomUUID } from "node:crypto";
import { serializeSessionMetadata } from "@mastra/livekit";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { AGENT_NAME } from "@/lib/agent-name";
import { getCurrentUser } from "@/lib/session";
import { EARLIER_CALLS_KEY, describeEarlierCalls } from "@/mastra/calls";
import { REMINDER_KEY, claimDueReminder, toCallReminder } from "@/mastra/reminders";
import { USER_KEY } from "@/mastra/users";

export async function POST(request: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return Response.json({ error: "LiveKit is not configured" }, { status: 500 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
  // Token minting below is local signing, so a claimed reminder reaches the browser without another network call.
  // A claim whose call never starts is retried by a later claim (see CLAIM_TIMEOUT).
  let reminder = null;
  if (new URL(request.url).searchParams.get("reminder") === "due") {
    reminder = await claimDueReminder(user.id);
    if (!reminder) return new Response(null, { status: 204 });
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
    resourceId: user.id,
    requestContext: {
      [USER_KEY]: user,
      [EARLIER_CALLS_KEY]: await describeEarlierCalls(user.id),
      ...(reminder && { [REMINDER_KEY]: toCallReminder(reminder) }),
    },
  });
  token.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: AGENT_NAME, metadata })] });
  return Response.json({
    serverUrl: LIVEKIT_URL,
    roomName,
    participantName,
    participantToken: await token.toJwt(),
  });
}
