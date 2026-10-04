// One-time reminders in Neon. Al saves them during a call; when one is due, the voice page starts a call that opens with it.
// The voice page is the reminder "device": it claims a due reminder by polling, so nothing fires while no page is open.
// Times cross two boundaries: the model speaks local wall-clock times, the table stores timestamptz (UTC).
import { z } from "zod";
import { storage } from "./memory";
import type { User } from "./users";

// The connection route puts the reminder a call was started for under this request-context key.
export const REMINDER_KEY = "reminder";

const MAX_DAYS_AHEAD = 366;
// A claimed reminder whose call never started (page closed, microphone denied, worker down) is retried after this.
// It only needs to outlast the page's 30-second wait for Al to join.
const CLAIM_TIMEOUT = "2 minutes";
const MAX_ATTEMPTS = 3;

// delivering: claimed, the page is starting the call. delivered: Al said it in a call; the person has not answered.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS reminders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id text NOT NULL,
  text text NOT NULL CHECK (text <> ''),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'delivering', 'delivered', 'acknowledged', 'missed')),
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_status_due_at ON reminders (status, due_at);
-- A repeated request (a retried tool call, or the person saying it twice) lands on the existing reminder.
CREATE UNIQUE INDEX IF NOT EXISTS reminders_resource_id_text_due_at ON reminders (resource_id, text, due_at) WHERE status = 'scheduled';
`;

// Mastra creates its own tables on start; this one is created on first use, once per process (routes and worker).
let schemaReady: Promise<unknown> | undefined;
async function db() {
  schemaReady ??= storage.db.none(SCHEMA).catch((e) => {
    schemaReady = undefined;
    throw e;
  });
  await schemaReady;
  return storage.db;
}

export type Reminder = { id: number; text: string; dueAt: Date; status: string };
type Row = { id: string; text: string; due_at: Date; status: string };
const COLUMNS = "id, text, due_at, status";
// bigint arrives as a string; reminder ids stay far below 2^53.
const toReminder = (r: Row): Reminder => ({ id: Number(r.id), text: r.text, dueAt: r.due_at, status: r.status });

/** A time as the person's local wall-clock time, for speech and the prompt. */
export function describeTime(date: Date, timezone: string): string {
  return date.toLocaleString("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export type CreateResult = { status: "saved"; reminder: Reminder } | { status: "clarify"; message: string };

/** Saves a reminder for a local time such as "2026-10-05T09:00", or returns the identical one already scheduled. */
export async function createReminder(user: User, text: string, localTime: string): Promise<CreateResult> {
  const client = await db();
  let dueAt: Date;
  try {
    // Postgres turns the wall-clock time into an instant in the person's timezone, daylight saving included.
    ({ due_at: dueAt } = await client.one<{ due_at: Date }>("SELECT ($1::timestamp AT TIME ZONE $2) AS due_at", [localTime, user.timezone]));
  } catch {
    return { status: "clarify", message: "That date does not exist." };
  }
  const now = Date.now();
  if (dueAt.getTime() <= now) return { status: "clarify", message: "That time has already passed." };
  if (dueAt.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) return { status: "clarify", message: "That time is more than a year away." };
  // The no-op update makes the duplicate row come back through RETURNING.
  const row = await client.one<Row>(
    `INSERT INTO reminders (resource_id, text, due_at) VALUES ($1, $2, $3)
     ON CONFLICT (resource_id, text, due_at) WHERE status = 'scheduled' DO UPDATE SET text = EXCLUDED.text
     RETURNING ${COLUMNS}`,
    [user.id, text.trim(), dueAt],
  );
  return { status: "saved", reminder: toReminder(row) };
}

/**
 * Claims the earliest due reminder for a call, one call at a time per person, after settling stale claims.
 * SKIP LOCKED keeps two pages off the same row. ponytail: the one-at-a-time check cannot see another page's
 * uncommitted claim, so two open pages could both call; one page runs in the demo. Lock a per-person row if that changes.
 */
export async function claimDueReminder(resourceId: string): Promise<Reminder | null> {
  const client = await db();
  await client.none(
    `UPDATE reminders SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'missed' ELSE 'scheduled' END, claimed_at = NULL
     WHERE resource_id = $1 AND status = 'delivering' AND claimed_at < now() - interval '${CLAIM_TIMEOUT}'`,
    [resourceId],
  );
  const row = await client.oneOrNone<Row>(
    `UPDATE reminders SET status = 'delivering', claimed_at = now(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM reminders WHERE resource_id = $1 AND status = 'scheduled' AND due_at <= now()
         AND NOT EXISTS (SELECT 1 FROM reminders WHERE resource_id = $1 AND status = 'delivering')
       ORDER BY due_at, id FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING ${COLUMNS}`,
    [resourceId],
  );
  return row && toReminder(row);
}

/** The call started and Al is saying the reminder. Says nothing about whether the person heard it. */
export async function markDelivered(id: number): Promise<void> {
  const client = await db();
  await client.none("UPDATE reminders SET status = 'delivered', claimed_at = NULL WHERE id = $1 AND status = 'delivering'", [id]);
}

/** The person said they heard or did it. False when the reminder is no longer active. */
export async function acknowledgeReminder(id: number): Promise<boolean> {
  const client = await db();
  const row = await client.oneOrNone(
    "UPDATE reminders SET status = 'acknowledged', acknowledged_at = now() WHERE id = $1 AND status IN ('delivering', 'delivered') RETURNING id",
    [id],
  );
  return row !== null;
}

/** Schedules the reminder again in `minutes`, with fresh attempts. Null when the reminder is no longer active. */
export async function snoozeReminder(id: number, minutes: number): Promise<Reminder | null> {
  const client = await db();
  const row = await client.oneOrNone<Row>(
    `UPDATE reminders SET status = 'scheduled', due_at = now() + make_interval(mins => $2), attempts = 0, claimed_at = NULL
     WHERE id = $1 AND status IN ('delivering', 'delivered') RETURNING ${COLUMNS}`,
    [id, minutes],
  );
  return row && toReminder(row);
}

// What a reminder call carries in its request context: plain JSON, so dueAt is an ISO string.
const callReminderSchema = z.object({ id: z.number().int(), text: z.string(), dueAt: z.string() });
export type CallReminder = z.infer<typeof callReminderSchema>;

export const toCallReminder = (r: Reminder): CallReminder => ({ id: r.id, text: r.text, dueAt: r.dueAt.toISOString() });

/** The reminder a call was started for, read from its request context; null for an ordinary call. */
export function readCallReminder(value: unknown): CallReminder | null {
  const parsed = callReminderSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
