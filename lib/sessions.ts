// Conversation session records and their finalized turns.
import { db } from "./db";

export async function startSession(userId: number, roomName: string): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO sessions (user_id, room_name) VALUES ($1, $2) RETURNING id",
    [userId, roomName],
  );
  return Number(rows[0].id);
}

export async function saveTurn(
  sessionId: number,
  role: "user" | "assistant",
  content: string,
  interrupted: boolean,
  spokenAt: Date,
): Promise<void> {
  await db.query(
    "INSERT INTO turns (session_id, role, content, interrupted, spoken_at) VALUES ($1, $2, $3, $4, $5)",
    [sessionId, role, content, interrupted, spokenAt],
  );
}

export async function endSession(sessionId: number): Promise<void> {
  await db.query("UPDATE sessions SET ended_at = now() WHERE id = $1 AND ended_at IS NULL", [sessionId]);
}
