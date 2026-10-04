// Family dashboard: what Al did. Reads Postgres on the server for every request.
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SessionRow = { id: string; started_at: Date; ended_at: Date | null; summary: string | null; turns: string };
type ActivityRow = { id: string; kind: string; title: string; created_at: Date };
type TaskRow = { id: string; kind: string; status: string; summary: string | null; receipt_url: string | null; started_at: Date };

// ponytail: the demo user's timezone; read users.timezone when there is more than one user.
const time = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

export default async function Dashboard() {
  const [sessions, activity, tasks] = await Promise.all([
    db.query<SessionRow>(
      `SELECT s.id, s.started_at, s.ended_at, s.summary, count(t.id) AS turns
       FROM sessions s LEFT JOIN turns t ON t.session_id = s.id
       GROUP BY s.id ORDER BY s.started_at DESC LIMIT 20`,
    ),
    db.query<ActivityRow>("SELECT id, kind, title, created_at FROM activity ORDER BY created_at DESC LIMIT 50"),
    db.query<TaskRow>(
      "SELECT id, kind, status, summary, receipt_url, started_at FROM task_results ORDER BY started_at DESC LIMIT 20",
    ),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-6">
      <h1 className="text-3xl font-semibold">Al — family dashboard</h1>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Conversations</h2>
        {sessions.rows.length === 0 && <p>No conversations yet.</p>}
        <ul className="flex flex-col gap-3">
          {sessions.rows.map((s) => (
            <li key={s.id} className="rounded-lg border p-4">
              <p className="text-sm opacity-70">
                {time(s.started_at)} · {s.turns} turns{s.ended_at ? "" : " · in progress"}
              </p>
              <p>{s.summary ?? "No summary yet."}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Tasks</h2>
        {tasks.rows.length === 0 && <p>No tasks yet.</p>}
        <ul className="flex flex-col gap-3">
          {tasks.rows.map((t) => (
            <li key={t.id} className="rounded-lg border p-4">
              <p className="text-sm opacity-70">
                {time(t.started_at)} · {t.kind} · {t.status}
              </p>
              <p>{t.summary}</p>
              {t.receipt_url && (
                <a className="underline" href={t.receipt_url}>
                  Receipt
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Recent activity</h2>
        {activity.rows.length === 0 && <p>No activity yet.</p>}
        <ul className="flex flex-col gap-2">
          {activity.rows.map((a) => (
            <li key={a.id}>
              <span className="text-sm opacity-70">{time(a.created_at)} · {a.kind}</span> — {a.title}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
