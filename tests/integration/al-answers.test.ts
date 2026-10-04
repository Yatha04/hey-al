// Asks Al real questions through the real model, Exa, and Open-Meteo, then prints each answer and its time.
// Read the printed answers: the asserts only catch broken spoken-answer rules, not wrong facts.
// No memory thread is passed, so nothing is saved to Neon.
import { afterAll, expect, it, vi } from "vitest";

process.loadEnvFile(".env");

// Time each Exa call on its own, apart from the model's time.
const searchMs: number[] = [];
vi.mock("../../lib/integrations/exa", async (importOriginal) => {
  const exa = await importOriginal<typeof import("../../lib/integrations/exa")>();
  return {
    searchWeb: async (query: string) => {
      const start = performance.now();
      try {
        return await exa.searchWeb(query);
      } finally {
        searchMs.push(performance.now() - start);
      }
    },
  };
});

const { al } = await import("../../mastra/agents/al");

// tool: the tool Al must call. Well-known scams have none: Al answered them right, and faster, without a search.
const QUESTIONS: { question: string; tool?: string; mustSay?: RegExp }[] = [
  { question: "Is the Walgreens on Irving Street open right now?", tool: "searchWeb" }, // the demo question
  { question: "What time does the CVS pharmacy on 19th Avenue close today?", tool: "searchWeb" },
  { question: "Is there a pharmacy open now near me?", tool: "searchWeb" },
  { question: "Where is the nearest pharmacy?", tool: "searchWeb" },
  { question: "Is Safeway on Noriega open on Sundays?", tool: "searchWeb" },
  { question: "Can you find a good Chinese restaurant near me?", tool: "searchWeb" },
  { question: "What time does Park Chow on 9th Avenue open?", tool: "searchWeb", mustSay: /closed/i }, // closed in 2024
  { question: "Is the San Francisco Public Library Sunset branch open today?", tool: "searchWeb" },
  { question: "What is the phone number for the Sunset branch library?", tool: "searchWeb", mustSay: /\d{3}/ },
  { question: "My kitchen sink is leaking. Can you find me a plumber?", tool: "searchWeb", mustSay: /pay/i },
  { question: "I need an electrician to fix an outlet. Who can I call?", tool: "searchWeb", mustSay: /pay/i },
  { question: "Where is the nearest urgent care?", tool: "searchWeb" },
  { question: "Where is the Social Security office in San Francisco?", tool: "searchWeb" },
  { question: "Someone called saying they are from Medicare and need my Medicare number to send a new card. Is that a scam?", mustSay: /official|back/i },
  { question: "I got a text that says my USPS package is held and I need to pay a fee at a link. Is that real?", mustSay: /scam|official|not/i },
  { question: "Someone says my grandson is in jail and needs bail money in gift cards. What should I do?", mustSay: /scam/i },
  { question: "Are there any free events for seniors this week in my neighborhood?", tool: "searchWeb" },
  { question: "When is the Golden Gate Park farmers market?", tool: "searchWeb" },
  { question: "What's the weather like today?", tool: "getWeather" },
  { question: "Will it rain tomorrow?", tool: "getWeather" },
  { question: "Do I need a jacket this evening?", tool: "getWeather" },
];

const rows: { question: string; turnMs: number; queries: string[]; answer: string }[] = [];
// Length varies from run to run, so it is flagged in the printout, not asserted.
const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length;

it.each(QUESTIONS)("$question", { timeout: 60_000 }, async ({ question, tool, mustSay }) => {
  const start = performance.now();
  const result = await al.generate(question);
  const turnMs = performance.now() - start;
  const calls = result.toolCalls.map((c) => c.payload);
  rows.push({
    question,
    turnMs,
    queries: calls.map((c) => (c.toolName === "searchWeb" ? (c.args as { query: string }).query : c.toolName)),
    answer: result.text,
  });

  if (tool) expect(calls.map((c) => c.toolName)).toContain(tool);
  expect(result.text).not.toMatch(/https?:|www\.|\.com\b/); // no web addresses aloud
  expect(result.text).not.toMatch(/would you like|anything else|let me know/i); // no follow-up offers
  if (mustSay) expect(result.text).toMatch(mustSay);
});

afterAll(() => {
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  for (const r of rows) console.log(`\n[${s(r.turnMs)}${sentences(r.answer) > 3 ? ", LONG" : ""}] ${r.question}\n  query: ${r.queries.join(" | ")}\n  Al: ${r.answer}`);
  const turns = rows.map((r) => r.turnMs);
  console.log(`\nWhole turn: median ${s(median(turns))}, slowest ${s(Math.max(...turns))}`);
  console.log(`Exa search: median ${s(median(searchMs))}, slowest ${s(Math.max(...searchMs))} (${searchMs.length} calls)`);
});
