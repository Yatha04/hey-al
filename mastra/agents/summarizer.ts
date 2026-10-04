import { Agent } from "@mastra/core/agent";

// Runs after each call; no memory, so it never adds to a thread.
export const summarizer = new Agent({
  id: "summarizer",
  name: "Summarizer",
  instructions: `You get a person's current profile and the transcript of their voice call with Al, their assistant.
Return two things.
summary: for their family, two or three plain sentences: what they talked about, what Al did in the call, and anything left open. Do not mention the profile. No greeting, no lists.
profile: the full updated profile. Keep every existing fact unless the person corrected it. Add only lasting facts the person stated about themselves, their family, or their preferences; ignore passing remarks and anything Al said that the person did not confirm.`,
  model: "openai/gpt-4.1-mini",
});
