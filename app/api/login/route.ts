// Signs the tester in as a new user with their own Mastra memory.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SESSION_COOKIE, sessionSecret, signSession } from "@/lib/session";

const formSchema = z.object({
  name: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(40),
  zip: z.string().trim().max(10),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }),
});

export async function POST(req: Request) {
  const form = formSchema.safeParse(Object.fromEntries(await req.formData()));
  if (!form.success) return Response.redirect(new URL("/login?error=form", req.url), 303);

  const { name, city, state, zip, timezone } = form.data;
  // ponytail: a new id per login, so the same tester on a second device starts fresh. Add accounts if that matters.
  const user = { id: `user-${randomUUID()}`, name, city, state, zip, timezone };
  const cookie = [
    `${SESSION_COOKIE}=${signSession(user, sessionSecret())}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`,
    ...(new URL(req.url).protocol === "https:" ? ["Secure"] : []),
  ].join("; ");
  // Not Response.redirect: its headers are immutable, so it cannot carry the cookie.
  return new Response(null, { status: 303, headers: { Location: new URL("/", req.url).href, "Set-Cookie": cookie } });
}
