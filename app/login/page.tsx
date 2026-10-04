// Sign-in: a name for Al to use, and a city for local search. No password: this is a demo.
import { redirect } from "next/navigation";
import { Orb } from "@/components/orb";
import { getCurrentUser } from "@/lib/session";
import { TimezoneInput } from "./timezone-input";

export default async function Login({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="login">
      <div className="login-orb"><Orb energy={0} active={false} /></div>
      <h1>Hello, I&apos;m Al</h1>
      <p className="login-lead">A voice assistant for everyday questions. Tell me a little about you, then just talk.</p>
      <form method="post" action="/api/login" className="login-card">
        {error && <p role="alert" className="login-error">Please fill in your name, city, and state.</p>}
        <label>
          <span>Your first name</span>
          <input name="name" required autoComplete="given-name" placeholder="Jacob" />
        </label>
        <div className="login-row">
          <label>
            <span>City</span>
            <input name="city" required autoComplete="address-level2" placeholder="San Francisco" />
          </label>
          <label className="login-state">
            <span>State</span>
            <input name="state" required autoComplete="address-level1" placeholder="CA" />
          </label>
        </div>
        <label>
          <span>ZIP code <em>optional</em></span>
          <input name="zip" inputMode="numeric" autoComplete="postal-code" placeholder="94122" />
        </label>
        <TimezoneInput />
        <button type="submit" className="start-control login-submit">Continue</button>
      </form>
    </main>
  );
}
