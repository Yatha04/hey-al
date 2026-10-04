import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchWeb } from "../../lib/integrations/exa";

export const searchWebTool = createTool({
  id: "searchWeb",
  description:
    "Search the web for current, local, or factual information: opening hours, nearby places, phone numbers, " +
    "service providers and their reviews, local events, and whether a call or message is a known scam.",
  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .describe('A specific web search query. For local questions include the city and state, and the ZIP code for "near me" or "nearest", e.g. "Walgreens pharmacy hours Irving Street San Francisco CA". ' +
          'Search for hours, never "open now": pages that say "open now" are stale.'),
  }),
  execute: async ({ query }) => ({ results: await searchWeb(query) }),
});
