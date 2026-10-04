import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  return new Response(null, {
    status: 303,
    headers: { Location: new URL("/login", req.url).href, "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` },
  });
}
