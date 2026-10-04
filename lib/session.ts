// Login for testers: the signed-in user lives in one signed cookie, no users table.
// The HMAC stops a tester from editing the cookie to read someone else's calls.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import type { User } from "@/mastra/users";

export const SESSION_COOKIE = "al_session";

const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string(),
  timezone: z.string().min(1),
});

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/** Cookie value: base64url(JSON user) + "." + HMAC of that payload. */
export function signSession(user: User, secret: string): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** The user in a cookie value, or null when it is missing, malformed, or tampered with. */
export function readSession(value: string | undefined, secret: string): User | null {
  const [payload, mac] = value?.split(".") ?? [];
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = userSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

/** The signed-in user for this request, or null. */
export async function getCurrentUser(): Promise<User | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
}
