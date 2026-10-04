---
name: audit-fallbacks
description: Error-tolerance validity sweep — given a scope (folder, PR number, or --diff), judges every try/catch, .catch(), Promise.allSettled, error-only `??`/`||` default, and unawaited `void` promise (valid tolerance or swallowed error?), every `as any`/double cast or optional access on a field the type says is present, every server-clock calendar-day derivation, and in tests every mock double (internal modules must be typed mocks) and every pinned date compared against a clock-stamped value. Use before merging error handling, timezone logic, or tests, or periodically per domain module.
---

# /audit-fallbacks — Is This Tolerance Valid, or a Swallowed Error?

When the user invokes `/audit-fallbacks <scope>` (`mastra/calls.ts`, `PR#12`, `--diff`), judge every tolerance site in scope. Report only; do not apply fixes.

Doctrine (AGENTS.md): never swallow failures or report success without evidence. A keep needs an articulable reason that the degraded result is correct product behavior for a specific expected failure. The tie-breaker is remove — let it throw. `null`/`undefined` means genuine absence, never "an error happened". The agent speaks about an outcome only from an application result, so a swallowed failure inside a tool becomes a spoken lie.

## Procedure

1. **Resolve scope.** Path → every `.ts`/`.tsx` under it. `PR#<n>` → `git worktree add /tmp/<pr>-wt origin/<branch>`, diff = `git diff origin/main...HEAD`, and every later read/grep runs inside that worktree. `--diff` → `git diff HEAD`. Diff scopes cover only added/modified sites; an edit inside a catch body or to a test double's type re-opens that site.

2. **Enumerate sites.** Grep for:
   - Tolerance: `catch {`, `catch (`, `.catch(`, `Promise.allSettled(` whose rejections are not inspected, `?? <default>` / `|| <default>` on a value that is absent only on error, `void <promise>` with no catch, and any catch whose body only logs or returns a default.
   - Unchecked access: `as any`, `as unknown as`, `(x as any).field`, `obj?.["literal"]`, and optional chaining on a field the type says is always present.
   - Server-clock days: `new Date()` / `Date.now()` used as a user-local day, `.toISOString().slice(0, 10)`, `.toDateString()`, `new Date('YYYY-MM-DD')` (parsed as UTC midnight) written to a timestamptz column.
   - In test files: `vi.fn(`, `vi.mock(`, `vi.spyOn(`, `as any` on a double; pinned dates `new Date('20`, `new Date(20`, `"20\d\d-\d\d-\d\d"`.

   More than ~10 tolerance sites → one subagent per file with its site list; merge into the final report.

3. **Classify each tolerance body — what can actually throw in there?** Trace one hop into called functions. Record `body_kind`: `db_read | db_write | provider_call | llm_call | pure_compute | mixed`. A body that calls a `mastra/` function that touches Neon is DB-touching even if no query appears at the site.

4. **Check breadth.** Every JS catch is untyped, so breadth is what the body rethrows: does it test the error and `throw err` for anything unexpected? Name the driver's error class by reading the imports in `mastra/memory.ts` and `mastra/` (`DatabaseError` from pg via `@mastra/pg`, or a Mastra storage error); do not prescribe a class you have not confirmed is importable here. A DB-touching body that rethrows nothing is presumptively wrong. A catch that swallows an `AbortError` from barge-in leaves a cancelled turn running in the agent.

5. **Verdict per site.** Name the expected error class(es); "Error" is not an answer.
   - **VALID_KEEP** — specific expected failure; degraded result is correct behavior; DB/transient errors cannot be silently absorbed.
   - **NEEDS_NARROWING** — real business case, catches everything. Prescribe the exact guard: `if (!(err instanceof <Class>)) throw err`.
   - **SHOULD_TRANSLATE** — callers cannot tolerate hiding it; log with context, then `throw err`.
   - **SHOULD_REMOVE** — no articulable reason. A pure-DB body has nothing to narrow to.

   Every non-VALID verdict carries a concrete failure scenario: input/state → swallowed error → wrong downstream behavior (e.g. "Neon blip on insert → tool returns ok → agent says 'bill paid' → no task_results row on the dashboard").

6. **Get the polarity right.** Default: DB-touching → surface DB errors. It inverts at post-action bookkeeping: the AgentMail send is already accepted and the body only records the message id — there the DB hiccup is the tolerable failure, and rethrowing would make the caller retry an action that already happened. Ask: which failure is this business case tolerating? Absorb exactly that. Before prescribing a narrowing, trace where the new throw lands; if it rejects a `Promise.all` and drops sibling work with no outer boundary, a deliberately broad logging-only keep may be right — mark it `// fallback-ok: <reason>`.

7. **Red flags that override a plausible reason:**
   - Inside an agent tool whose return value the agent will speak ("paid", "sent", "found"). This is the central-boundary violation.
   - Around a claim or dedup gate: task claim, Kernel run or AgentMail idempotency key, webhook event id, session/room id. A transient failure manufactures "not done yet" and the effect re-fires.
   - Around a write whose caller then reports success.
   - Around user resolution (room/participant → user). A silent `null` leaks into another user's data or into nobody's.
   - Loop continuation used to justify breadth — it justifies keep, never breadth.

8. **Attempt the defense before flagging.** Check callers (would a throw crash something that must continue? is there already an outer handler that surfaces it?) and pre-change parity (`git log -p` on the site). Parity defends keep-vs-remove, never broad absorb over DB ops. Record the strongest defense and why it fails, or flip the verdict.

## Side judgments

**Unchecked casts and literal access.** If the field name is a literal, it should not hide behind `as any`, a double cast, `?.["x"]`, or optional chaining the type does not need. Each turns a renamed field into a manufactured `undefined`. Find the real type first.
- **DEFENSIVE_TYPED** — the type statically has it. Fix: `x.field`; make it optional in the type if absence is real.
- **DICT_OBJECT_CONFUSION** — code does not know which shape it holds (raw row vs mapped object, JSON vs class). Fix upstream normalization (a zod parse at the boundary).
- **LEGIT_DYNAMIC** — runtime keys, shape-varying SDK objects, version probing. Mark `// cast-ok: <reason>`.

**Mock doubles (test files).** Our own code (anything under `mastra/`, `lib/`, `app/`) is doubled with a typed signature: `vi.fn<typeof fn>()`, and `vi.mock` of an internal module uses `importOriginal` or a factory typed against the real module. A bare `vi.fn()` or an `as any` double accepts any call shape, so drift passes.
- **NEEDS_AUTOSPEC** — internal module/function doubled untyped. Give the exact rewrite.
- **LEGIT_OPAQUE** — SDK primitive (LiveKit room/participant, fetch `Response`, Neon pool) whose fields the test never asserts. Waive deliberate exceptions with `// mock-ok: <reason>`.

**Server-clock days.** The server runs UTC; a user's calendar day is the user's IANA timezone. For each site: does the value stand for a user-local day (the "today" the LLM resolves against, a bill due date, the dashboard's "today" grouping) or a pure instant (created_at, ordering, TTL)? Trace one hop forward to where it becomes a date.
- **SERVER_DAY_BUG** — user-day semantics from the server clock. Fix: resolve the user's timezone, then convert the instant (`Intl.DateTimeFormat` with `timeZone`). Scenario: "user calls at 9 PM local → UTC day already rolled → dashboard files the call under tomorrow".
- **NAIVE_WRITE** — date-only string or `new Date('YYYY-MM-DD')` into a timestamptz column. Fix at the writer.
- **LEGIT_INSTANT** — not reported. **LEGIT_UTC_DAY** — waive with `// utc-day-ok: <reason>`.

**Pinned test dates.** Pinning is correct; the bug is pinning one side of a comparison whose other side the clock stamps (a `created_at` defaulted by Postgres on a row the test wrote). `vi.setSystemTime` does not help; the moving timestamp comes from Postgres.
- **CLOCK_RELATIVE_TEST** — fix: derive the day from the row (format `row.created_at` in the user's timezone) or stamp the row explicitly. Never `new Date()`. Give the expiry date.
- **LEGIT_PINNED** — all sides pinned; not reported. **LEGIT_DATE_BOUND** — a DST or month edge is the subject; waive with `// clock-day-ok: <reason>`.

## Report

```
## /audit-fallbacks: <scope>

Sites: <N> tolerance, <M> casts, <j> mocks, <t> server-day, <p> pinned dates, <k> needs-trace
Verdicts: <a> VALID_KEEP | <b> NEEDS_NARROWING | <c> SHOULD_TRANSLATE | <d> SHOULD_REMOVE

### Flagged tolerance sites (ordered by blast radius)
<file:line> [body_kind] → VERDICT
  Why: <one sentence>
  Failure: <concrete scenario>
  Fix: <exact instanceof guard, rethrow, or "delete the try, let it throw">
  Defense checked: <callers/parity — why it fails>

### Casts · ### Mocks · ### Server-day · ### Clock-relative test dates
<file:line> VERDICT — <note; fix or waiver>

### Valid keeps (file:line, one clause why)
### Needs trace (one-hop limit hit — unresolved, not cleared)
```

## Discipline

- Always `file:line`. Every flag carries a prescription. If everything is valid, say so and list the keeps.
- One-hop tracing only; deeper indirection goes under "Needs trace", counted not dropped.
- Cap at ~700 words for path scopes; PR scopes lead with the tally.
