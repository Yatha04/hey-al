---
name: pipeline-sweep
description: Completeness tool — given a feature (search, email, bill-pay), walks the Al pipeline (agent tool → lib → integrations → api → dashboard / voice page → tests) and reports which layers the feature wired versus left as gaps. Run at plan time (--plan) to enumerate the work before building, or post-hoc against merged code to find stranded bolt-ons.
---

# /pipeline-sweep — Detect Pipeline Gaps for a Feature

When the user invokes `/pipeline-sweep <feature>` (e.g. `/pipeline-sweep bill-pay --plan`), produce a coverage matrix of that feature against the pipeline below. A feature that adds a user-facing capability must reach every layer where it matters, or record why not. Unexplained gaps are bolt-ons waiting to happen.

## Two modes

- **`--plan` (primary).** No code to grep yet. Walk the matrix against the plan's intent and its work items. Each required cell is ✅ (covered by an item), 🕒 (deferred with reason), or ⬜ (N/A with reason). A required cell in none of those is 🟥 — close it before build.
- **default (post-hoc).** Grep for actual wiring. ✅ needs `file:line` proof; 🕒 collapses to 🟥 until built. Works only once the layer's folder exists.

## The oracle

Do not invent layers. Extending the pipeline is an edit to this table.

| cell | layer | asks |
|---|---|---|
| agent.tool | `mastra/tools/` | Does the user trigger this by voice? Is there an explicit `createTool` with a zod input schema that calls the domain module and speaks only from its result? |
| agent.prompt | `mastra/agents/al.ts` | Do the agent's instructions need to mention this? Only if the tool description cannot carry it; the prompt never restates a rule the domain module owns. |
| domain.rules | `mastra/<domain>.ts` | Is the validation and persistence rule in one domain function that every entry point calls? |
| domain.commit | `mastra/<domain>.ts` | Is the record and its follow-up written in one transaction, before any caller can claim success? |
| integrations.client | `lib/integrations/` | Is the provider call in one thin client with a timeout and an idempotency key where the provider supports one? |
| api.route | `app/api/` | Does the browser or another service call this? Is the route thin, input validated, and the work delegated to the domain module? |
| api.webhook | `app/api/` | Does a provider call back? Is the event verified and stored deduplicated before processing? |
| dashboard.view | `app/dashboard/` | Does the family see the outcome? Is it read from its own activity/task_results row, not inferred? |
| voice.ui | `app/page.tsx` | Does the voice page need to show anything new? Is the state reflected on screen? |
| tests.restart | `tests/` | Is there a test that restarts the worker or app at the commitment boundary and checks the outcome once? |
| tests.duplicate | `tests/` | Is there a test that repeats the request or callback and checks no second effect? |

Cross-cutting (prefix `×`):

| cell | asks |
|---|---|
| ×isolation | Is the user derived from authenticated context (session, LiveKit participant), never from tool arguments, message bodies, or search results? |
| ×confirmation | Does the agent claim "saved" only after the domain write, and "paid/sent" only after provider evidence (Kernel receipt, AgentMail message id)? |
| ×timezone | Does any calendar-day rule use the user's IANA timezone, not the server's UTC day? |
| ×secrets | Are provider keys server-side only, never in `NEXT_PUBLIC_*`, and never logged? |

## Procedure

1. **Map the footprint.** `--plan`: read the plan's intent and work items; name the new entity or capability. Post-hoc: grep the repo for the feature name; record `file:line` per touch.
2. **Walk the matrix.** Answer each cell's `asks` and mark it. Be honest about ✅: a domain function with no caller is 🟥, not ✅; a required cell mentioned nowhere in the plan is 🟥, not ⬜.
3. **Output.** One row per cell, including every `×` row, so a cross-cutting gap cannot be dropped. Each 🟥 names the missing work item (plan) or shows evidence of absence plus a suggested fix (post-hoc).

```
## /pipeline-sweep: <feature> [--plan]

| cell | required? | mark → ref / reason |
|---|---|---|
| agent.tool | yes | ✅ item 2 |
| ×confirmation | yes | 🟥 not in plan — tool says "paid" before the Kernel receipt is stored |

Verdict: GREEN | GAPS: <n>
```

## The gate

Green only with zero 🟥. At plan time, `GAPS` means the plan is not ready to build. 🕒 and ⬜ are decisions, not gaps.

## What this skill does not do

- Does not propose or apply code changes.
- Does not catch duplication (`/audit-domain`) or tolerance validity (`/audit-fallbacks`).
- Does not validate that a ✅ cell is correct, only that it is planned or wired.

## Discipline

- Every ✅ needs an item or `file:line`; every 🕒/⬜ a reason; every 🟥 the missing item or evidence of absence.
- Cap at ~700 words. If clean, say `GREEN` and list the 🕒/⬜ reasons.
