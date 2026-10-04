---
name: test-audit
description: Test value gate — given a scope (--diff, PR number, or a test path), checks that every new or changed Vitest test protects real behavior, and in audit mode finds existing tests that restate source, duplicate stronger proof, couple to implementation, or keep test-only production seams alive. Run before every PR that adds or changes tests, or periodically per test suite.
---

# /test-audit — Does This Test Earn Its Place?

Two modes, one value bar. **Authoring mode** gates every new or changed test (the default for `--diff` and PR scopes). **Audit mode** sweeps existing tests under a path. Optimize for confidence, not deletion count. Report first; edit only after the user approves.

Read `AGENTS.md` first. This skill complements `/audit-fallbacks`, which owns mock doubles (typed `vi.fn`/`vi.mock`) and clock-relative test dates. Do not re-report its findings here.

## Scope

- `--diff` (default): tests added or changed in `git diff HEAD`, plus untracked test files.
- `PR#<n>`: `git diff origin/main...HEAD` in a detached worktree of the PR branch. Every later read runs inside that worktree.
- A path (`tests/integration/`, one test file): audit mode for that area only.

## Protected tests

These are contracts, not junk, even when they look like source checks. Report a real defect in one (for example a negative control that passes for the wrong reason), but do not delete or weaken it without explicit user approval:

- migration checks and schema tests;
- e2e flows in `tests/e2e/` that prove a complete user outcome;
- tests that pin a contract other code or a provider depends on: a Mastra tool id and its zod input schema, a stored status value, a provider wire format (AgentMail, Kernel, Exa), the `app/api/connection-details` response shape.

## Authoring gate

Before adding a test, answer four questions. A missing answer means do not add it yet.

1. What observable behavior, invariant, or independent contract does it protect?
2. What credible regression makes it fail?
3. Why does existing coverage not already catch that failure? Each contract has one primary test at the strongest boundary. Here that is usually the `lib/` function, not the agent tool or a private helper. Another layer needs its own risk, such as a DB transaction, provider wire format, or agent tool-use failure the owner cannot reach. Prefer a new `it.each` case over a near-duplicate test.
4. Does it need a production seam (export, flag, wrapper, injection hook, an exported internal helper) that no production caller needs? If yes, test at the real boundary instead.

Then check the test against every [junk pattern](#junk-patterns). A match fails the gate unless the [retention bar](#retention-bar) names the contract it guards. A test that breaks under a behavior-preserving refactor asserts implementation; rewrite it at the owning boundary.

**A regression test must fail on the pre-fix code for the intended reason.** Prove it: set aside only the fix with a temporary WIP commit (never bare `git stash`), run the test, record the failure line, then restore. One regression at the owner boundary covers the bug; do not replay it at every layer.

Cross-module test inputs come from the producing module (its function or a real run), not hand-built objects that restate what the producer should emit.

## Junk patterns

- assertion-free coverage probes (the test only calls the code, or asserts `toBeDefined()` on a value that can never be undefined);
- self-comparisons: the expected value comes from the function or renderer under test;
- copied inventories, enum lists, or prompt text that restate the source instead of checking a consumer;
- exact source, import, or string greps that guard no contract;
- call-shape tests (`toHaveBeenCalledWith` on an internal helper) that a real-boundary test already covers;
- the same contract tested twice (same function, same inputs, same assertion in two files);
- tests whose only purpose is to keep a test-only export, global, or wrapper alive, and production code whose only callers are tests;
- mocks that implement the asserted behavior (a `mockImplementation` that does the computation the test then checks), or one mock that stands in for different APIs;
- fixtures that supply the rows, IDs, or ordering the code under test should produce, or persistence asserted against a table the path never writes;
- negative controls that pass for an unrelated reason (a failure from a different guard, a missing row before the permission check);
- e2e or LLM tests that assert exact model wording instead of the tool call or conversation outcome (AGENTS.md: evaluate outcomes, not wording);
- tests that rely on arbitrary sleeps instead of a controlled clock (`vi.useFakeTimers`) or synchronization;
- names that promise more than the input exercises.

## Retention bar

Keep a test when it independently enforces a DB schema or migration, a user-isolation or permission rule, an agent tool contract, a provider wire format, a timezone or clock rule, or a default the product depends on. Also keep:

- everything on the [protected list](#protected-tests);
- call ordering when order is observable behavior (the result is persisted before the agent says it is paid);
- regressions with a credible failure mode, especially duplicate requests, restarts, and races;
- a source check when it is the cheapest independent guard and survives an identifier-only rename.

Slow or static is not a deletion reason. A retained test that fails on the baseline is a possible product bug: reproduce it and fix the owner.

## Discovery (audit mode)

Stay read-only. Before judging a candidate, read the whole test, the production owner, its callers, overlapping tests, and history (`git log -S`, the PR that added it). When the test claims dependency behavior (Postgres, LiveKit, Mastra, Neon driver), check the dependency source or docs. For a broad path, split read-only lanes by suite (`tests/unit`, `tests/integration`, `tests/e2e`) or by one cross-cutting pattern. Prefer a few high-confidence candidates over a large speculative list.

Record for each deletion candidate; a missing field means it is not ready:

- test name and `file:line`;
- the failure it can actually detect;
- non-test callers of the covered code (`grep` outside `tests/`);
- the stronger test that remains, or why no proof is needed;
- why the test or seam exists (history);
- the production or support code the deletion unlocks;
- risk and the focused validation command.

## Edit shape

After approval, take one coherent batch. Delete obsolete test-only exports and dead production paths instead of keeping aliases. Move kept regressions to the owner's test file. Merge repeated assertions into one `it.each` case. Do not add replacement tests that restate the same implementation.

## Validation

Do not edit tests while a test run is active in the same checkout.

1. Run the changed and sibling test files: `npx vitest run <files>`.
2. For a changed regression test, show that it fails with the fix reverted.
3. Run the full suite: `npx vitest run`. Say which e2e tests skipped for missing LiveKit or provider credentials.
4. Run `git diff --check` and `git diff --numstat`. Report production lines separately from test lines.
5. Run `npx tsc --noEmit` and `npm run lint`, plus any other checks `AGENTS.md` lists as configured.

## Output

Authoring mode: one line per new or changed test, `PASS` or `FAIL <pattern or unanswered question>`, with `file:line` and the fix (move to owner, merge into an `it.each` case, delete). Say explicitly when all tests pass the gate.

Audit mode, then after edits:

- removed low-value categories and the root cause;
- production simplifications;
- kept false positives and why they stay;
- the checks actually run, with results;
- production versus test lines;
- follow-ups.

Do not commit, push, or open a PR unless the user asks.
