// What onboarding records about a person. Authoritative: the summarizer never writes these.

export type User = {
  id: string; // the Mastra memory resource id
  name: string;
  city: string;
  state: string;
  zip: string;
  timezone: string; // IANA
};

// ponytail: one seeded demo user until onboarding exists; then load the signed-in user's record.
export const DEMO_USER: User = {
  id: "demo-user",
  name: "Asha",
  city: "Cincinnati",
  state: "OH",
  zip: "45208",
  timezone: "America/New_York",
};

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
  return `The person's name is ${user.name}. They live in ${user.city}, ${user.state} ${user.zip}. It is now ${localTime}, their local time.`;
}
