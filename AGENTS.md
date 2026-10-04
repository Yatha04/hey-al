# Working on Al

Al is a voice companion for older adults: a browser voice page (LiveKit), one Mastra agent and its tools, and a family dashboard. Mastra memory stores calls and the user profile in Neon Postgres.

## Commands

Node 22, npm. Copy `.env.example` to `.env` and fill it. Next.js reads `.env`; the worker loads it with `--env-file`. Mastra creates its own tables on first start.

```bash
npm install
npm run agent:download     # once: turn detector and VAD model files
npm run agent              # LiveKit worker with the Mastra agent, hot reload
npm run dev                # web app: / (voice) and /dashboard
npm run studio             # Mastra Studio: test Al and tools by text, no voice
npm run typecheck && npm run lint
npm test                   # Vitest unit tests in tests/unit
npm run site:login -- amazon|duke   # once per user and site: sign in on a Kernel live view, saved to a profile
npm run flows -- both "AA batteries"   # Amazon to the checkout review page and Duke's bill open, in parallel; nothing is ordered or paid
```

Vitest tests live in `tests/unit`; add `tests/integration` and `tests/e2e` when a feature needs them, and list the command here.

## Layout

- `mastra/` — everything Mastra; `npm run studio` opens Mastra Studio on it (chat with Al by text, run tools, inspect threads and the profile).
  - `index.ts` — the Mastra instance: agents and Neon storage.
  - `memory.ts` — Memory (`@mastra/pg` on Neon) and the profile schema.
  - `agents/al.ts` — Al's prompt, model, and tools. `agents/summarizer.ts` — end-of-call summary and profile update.
  - `tools/` — one file per tool (Mastra `createTool` with zod input); thin: validate, call `lib/integrations/`, return the result.
  - `calls.ts` — calls are memory threads: list, save turns, summarize, earlier-call summaries.
  - `sites.ts` — sites Al acts on with a saved Kernel login (Amazon, Duke Energy): login check and bot wall. `amazon-order.ts` — add an item and stop on the checkout review page; `duke-bill.ts` — open the current bill (a PDF tab), scripted. Amazon drives `agents/browser.ts`, an LLM that acts on the page; code guards refuse the final order or payment click. Not yet tools.
  - `voice-worker.ts` — the LiveKit worker (`createLiveKitWorker`); memory is read-only during a call.
- `lib/integrations/` — thin external API clients (Exa, AgentMail, Kernel, …); `kernel.ts` opens a Kernel cloud browser and connects Playwright. `lib/agent-name.ts` — the LiveKit agent name.
- `app/` — Next.js: `page.tsx` voice page, `dashboard/`, `api/connection-details` (LiveKit token plus earlier-call summaries).
- `.claude/skills/` — review sweeps: `/audit-fallbacks <scope>`, `/audit-domain <name>`, `/pipeline-sweep <feature> --plan`, `/test-audit`.

## Scope and simplicity

- Build the smallest complete change for the current demo. Preserve unrelated work; avoid speculative features, dependencies, abstractions, and unrelated cleanup.
- Reuse the platform, framework, and existing helpers before adding custom machinery. Create files and layers only when they have a current purpose.
- Add a feature's prompt lines in `mastra/agents/al.ts` together with its tool, not before.
- Before finishing, review the whole diff: does each new concept serve the outcome? Prefer delete → simplify → optimize → automate.

## Code structure and habits

- Keep API routes, tools, and the worker thin. Put a domain's rules in one module named for it, `mastra/<domain>.ts` (`mastra/calls.ts`), and external clients in `lib/integrations/`.
- Prefer clear functions, explicit dependencies, typed boundaries, and meaningful result states. Validate external inputs with zod; do not pass framework objects through application logic.
- Handle errors where recovery or useful translation is possible. Never swallow failures or report success without evidence; the agent speaks about an outcome only from a tool result.
- Use network timeouts. Clean up cancelled work and resources.
- Explain non-obvious constraints in comments. Remove stale code made obsolete by a change.

## Reliability and trust

- Persist a commitment and its record atomically. Keep database transactions short and outside external network calls.
- External providers (email, browser tasks, orders): make retries identifiable and safe. A timeout does not mean an action failed; reconcile before resubmitting.
- Never commit secrets, real transcripts, or recordings. Provider keys stay server-side, never in `NEXT_PUBLIC_*`. Log IDs and outcomes, not tokens or personal content.

## Naming and git

- Branches: `<type>/<short-kebab-topic>` (`feat/exa-search`). Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. One branch per PR.
- Commits: an imperative subject of 72 characters or fewer, no type prefix, no trailing period. Use the body for why.
- Never add `Co-Authored-By` or any AI or tool attribution to commits or PRs.
- PRs: the title is the main commit subject. Body sections: What this does, Testing (what ran and what did not), Known limits. Squash-merge into `main`.
- TypeScript: files `kebab-case.ts`, functions `camelCase` starting with a verb (`saveTurn`), types `PascalCase`, constants `UPPER_SNAKE`. Tool ids match the function they call.
- Database: tables plural `snake_case`; foreign keys `<singular>_id`; timestamps `timestamptz` named `<event>_at`; statuses are `text` with a `CHECK` list; indexes `<table>_<columns>`.
- Environment variables: `UPPER_SNAKE`; provider variables keep the provider's names (`LIVEKIT_API_KEY`).
