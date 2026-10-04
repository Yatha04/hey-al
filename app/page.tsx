import Link from "next/link";
import { redirect } from "next/navigation";
import { VoiceApp } from "@/components/voice-app";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <>
    <header className="top-bar">
      <span>Hi, {user.name}</span>
      <nav>
        <Link href="/dashboard">Dashboard</Link>
        <form method="post" action="/api/logout"><button type="submit">Sign out</button></form>
      </nav>
    </header>
    <VoiceApp />
  </>;
}
