// Calls are Mastra memory threads: one per LiveKit room, all owned by the user's resource id.
import { memory, summarizer } from "../agent/mastra";

// ponytail: one demo user until there is sign-in; then derive it from the signed-in user.
export const DEMO_RESOURCE_ID = "demo-user";
// How many earlier calls Al hears about at the start of a call.
const EARLIER_CALLS = 3;

export type Call = { id: string; startedAt: Date; summary: string | null };

export async function listCalls(resourceId: string, limit: number): Promise<Call[]> {
  const { threads } = await memory.listThreads({
    filter: { resourceId },
    perPage: limit,
    orderBy: { field: "createdAt", direction: "DESC" },
  });
  return threads.map((t) => ({
    id: t.id,
    startedAt: t.createdAt,
    summary: typeof t.metadata?.summary === "string" ? t.metadata.summary : null,
  }));
}

/** The latest summaries, oldest first, one line each; empty when there are none. */
export async function describeEarlierCalls(resourceId: string): Promise<string> {
  const calls = await listCalls(resourceId, EARLIER_CALLS);
  return calls
    .filter((c) => c.summary)
    .reverse()
    .map((c) => `${c.startedAt.toISOString()}: ${c.summary}`)
    .join("\n");
}

/** Summarizes a finished call into its thread's metadata. Does nothing for a call with no messages. */
export async function summarizeCall(threadId: string): Promise<void> {
  const thread = await memory.getThreadById({ threadId });
  if (!thread) return;
  const { messages } = await memory.recall({ threadId, perPage: false });
  const transcript = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = m.content.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join(" ");
      return text && `${m.role === "user" ? "Person" : "Al"}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
  if (!transcript) return;
  const { text } = await summarizer.generate(transcript);
  await memory.updateThread({ id: threadId, title: thread.title ?? "Voice call", metadata: { ...thread.metadata, summary: text } });
}

/** The person's working-memory profile as JSON text, or null before Al has saved anything. */
export async function getProfile(resourceId: string): Promise<string | null> {
  const [latest] = await listCalls(resourceId, 1);
  if (!latest) return null;
  return memory.getWorkingMemory({ threadId: latest.id, resourceId });
}
