// What onboarding records about a person. Authoritative: the summarizer never writes these.

export type User = {
  id: string; // the Mastra memory resource id
  name: string;
  city: string;
  state: string;
  zip: string;
  timezone: string; // IANA
};

// The connection route puts the signed-in user in the call's requestContext under this key.
export const USER_KEY = "user";

// Mastra Studio has no signed-in user, so Al falls back to this one there.
export const DEMO_USER: User = {
  id: "demo-user",
  name: "Jacob",
  city: "San Francisco",
  state: "CA",
  zip: "94122",
  timezone: "America/Los_Angeles",
};

/** The signed-in user the connection route put in the call's requestContext; DEMO_USER in Mastra Studio, which has none. */
export function currentUser(requestContext: { get(key: string): unknown } | undefined): User {
  return (requestContext?.get(USER_KEY) as User | undefined) ?? DEMO_USER;
}

/** The person and the current local time, for the agent's instructions. */
export function describeUser(user: User, now: Date): string {
  const localTime = now.toLocaleString("en-US", {
    timeZone: user.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  // From the date alone, Saath's model picked a Friday that had already passed, so each coming day gets its date.
  // Calendar math on the local date at UTC noon, so daylight-saving days do not skip or repeat a day.
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: user.timezone }).split("-").map(Number);
  const week = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d + i + 1, 12)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }),
  ).join("; ");
  const place = [`${user.city}, ${user.state}`, user.zip].filter(Boolean).join(" "); // zip is optional at login
  return `The person's name is ${user.name}. They live in ${place}. It is now ${localTime}, their local time. The coming days are ${week}.`;
}
