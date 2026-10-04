---
name: audit-domain
description: Detective tool — given a domain name (sessions, activity, tasks, email), maps where its rules are answered across mastra/ (domain module, agents, tools, voice worker), lib/integrations, app/api, app/dashboard, and tests. Use before cross-cutting work in the domain, or periodically to find pre-existing duplication.
---

# /audit-domain — Detect Pre-Existing Duplication in a Domain

When the user invokes `/audit-domain <name>` (e.g. `/audit-domain tasks`), produce a duplication map for that domain. Report only; propose no code changes.

## Procedure

1. **Identify the brain.** AGENTS.md puts a domain's rules in one module named for it under `mastra/` (`mastra/calls.ts`, `mastra/tasks.ts`); that module is the brain. If none exists, say so — that is the first finding. Record: path + key functions.

2. **Enumerate concept questions** the domain answers at runtime. Examples for `tasks`:
   - "Is task T finished, failed, or still running?"
   - "Which receipt belongs to task T?"
   - "Has the bill for task T already been paid, so a retry must not pay again?"
   - "Which task_results row, if any, does the dashboard show for task T?"

   Examples for `sessions`: "Which user owns room R?", "Is a session already active for this participant?". If unsure, ask the user to confirm or extend the list before searching.

3. **For each question, find every answer site.** Grep:
   - `mastra/tools/`, `mastra/voice-worker.ts`, `app/api/`, `app/dashboard/` for direct `memory`/storage calls, inline predicates, and calls into the brain.
   - The instructions in `mastra/agents/` and tool descriptions in `mastra/tools/` for the rule restated in prose — a prompt that tells the model how to decide "the bill is paid" is an answer site too.
   - `tests/` for parallel fixtures, mocked computations, and assertions of the concept.

4. **Mark each site:** ✓ goes through brain | ✗ computes locally | ? unclear (needs human review).

5. **Output:**

   ```
   ## /audit-domain: <name>

   Brain: <path> (<key functions>)

   ### Concept questions
   Question: "<text>"
     Canonical answer site: <brain.function>
     Sites found:
       ✓ <file:line> — uses brain
       ✗ <file:line> — computes locally; should call <brain.function>
       ? <file:line> — unclear; review

   ### Consolidation moves (prioritized)
   1. <highest leverage> — affects <N> sites

   ### Brain gaps
   - <question with no canonical site> — propose <function> in <brain>

   ### Schema-level duplication (flag only)
   - <split storage, if any>
   ```

## When to use

- Before cross-cutting work in the domain; feeds `/pipeline-sweep <feature> --plan`.
- Periodically as a standing health check.
- When a review finds duplication that looks pre-existing rather than introduced by the diff.

## Discipline

- Always `file:line`. Cap at ~600 words. If the domain is huge, ask the user to narrow first.
- Do not resolve schema-level duplication; flag it.
