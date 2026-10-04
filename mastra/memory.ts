import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";

// The person's profile, kept across calls (working memory is resource-scoped by default).
// Calls read it only; the summarizer rewrites it after each call (see mastra/calls.ts).
export const profileSchema = z.object({
  name: z.string().optional(),
  preferredName: z.string().optional().describe("How they like to be addressed"),
  home: z.string().optional().describe("Town or city"),
  family: z.array(z.string()).optional().describe('One entry per person, e.g. "Priya, daughter, lives in Austin"'),
  preferences: z.array(z.string()).optional(),
});

// Memory gets the store directly: calls.ts uses it outside any agent call (routes, dashboard).
export const storage = new PostgresStore({ id: "al", connectionString: process.env.DATABASE_URL! });

export const memory = new Memory({
  storage,
  options: {
    // One thread per call, so this covers a whole call; earlier calls arrive as summaries.
    lastMessages: 40,
    workingMemory: { enabled: true, schema: profileSchema },
  },
});
