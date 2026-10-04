// Exa web search over its REST API. fetch rather than exa-js: exa-js has no request timeout.

// Al is silent while this runs (after "Let me look that up"), so fail fast.
const TIMEOUT_MS = 8000;

export type SearchResult = { title: string; url: string; publishedDate?: string; highlights: string[] };

type ExaResponse = { results: { title: string | null; url: string; publishedDate?: string; highlights?: string[] }[] };

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY is not set");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    // "fast" trades a little recall for latency; highlights are the relevant snippets, not whole pages.
    body: JSON.stringify({ query, type: "fast", numResults: 5, userLocation: "US", contents: { highlights: true } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Exa search failed: ${res.status}`);
  const { results } = (await res.json()) as ExaResponse;
  return results.map((r) => ({
    title: r.title ?? r.url,
    url: r.url,
    publishedDate: r.publishedDate,
    highlights: r.highlights ?? [],
  }));
}
