// Family dashboard: what Al knows and recent calls, read from Mastra memory on every request.
import { DEMO_RESOURCE_ID, getProfile, listCalls } from "@/mastra/calls";

export const dynamic = "force-dynamic";

// ponytail: the demo user's timezone; store one per user when there is more than one.
const time = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

export default async function Dashboard() {
  const [profile, calls] = await Promise.all([getProfile(DEMO_RESOURCE_ID), listCalls(DEMO_RESOURCE_ID, 20)]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-6">
      <h1 className="text-3xl font-semibold">Al — family dashboard</h1>

      <section>
        <h2 className="mb-3 text-xl font-semibold">What Al knows</h2>
        {profile ? <pre className="whitespace-pre-wrap rounded-lg border p-4">{profile}</pre> : <p>Nothing saved yet.</p>}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Calls</h2>
        {calls.length === 0 && <p>No calls yet.</p>}
        <ul className="flex flex-col gap-3">
          {calls.map((c) => (
            <li key={c.id} className="rounded-lg border p-4">
              <p className="text-sm opacity-70">{time(c.startedAt)}</p>
              <p>{c.summary ?? "No summary yet."}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
