# Agent compatibility

`workflow.ai.yml` is written for every coding agent, but an agent only follows what it reads, and the
tools differ in what they read, how much of it, and where they look for skills. This page says which
of those facts were **tested** (run in the product), which are **documented** (the vendor's page,
not run) and which are **not known**. Nothing here that says "documented" has been run.

What does not depend on the agent: the pre-commit hook, CI and `scripts/check-workflow.mjs` stop a
bad commit whichever agent wrote it. What differs is whether the agent ever *sees* the tracks, the
stages and the review-only rules, which nothing enforces.

## The matrix

| Agent | Reads | Skills from | Size limit | Status |
| :--- | :--- | :--- | :--- | :--- |
| Claude Code | `CLAUDE.md`, which imports `AGENTS.md` with `@AGENTS.md` | `.claude/skills/`, generated pointers | none known | tested 2026-10-01 |
| Antigravity | `AGENTS.md`, `GEMINI.md`, `.agents/rules/*.md` | `.agents/skills/` | 12,000 characters per rules file | documented 2026-09-15; not run |
| Gemini CLI | `GEMINI.md`, which imports `AGENTS.md` with `@AGENTS.md` | none | none known | not tested |
| Codex, Cursor, Windsurf, Copilot | `AGENTS.md` | not researched | not researched | not tested |

The limits that `scripts/check-workflow.mjs` enforces are the `max_chars` in the `agents` section of
`workflow.ai.yml`, which is also where each fact's source and date live. A file is held to the
smallest limit among the agents that load it.

## What was done about it

- **`AGENTS.md` is under 12,000 characters.** It carries the precedence, the tracks, the blocking
  gates and one line per architectural rule. The stage table, the skill table and what each track
  delivers are in `.agents/rules/workflow_cycle.md`, and every rule in full with what enforces it is
  in `.agents/rules/workflow_rules.md`. All three are generated from the YAML by
  `node scripts/sync-agent-docs.mjs`, and the check fails when one is stale or too long.
- **The workflows directory under `.agents` is gone.** Antigravity stops reading it on 2026-11-01. The six procedures
  are skills: `spec_driven_development`, `verification`, `branching`, `create_plugin`,
  `create_data_source`, and the release procedure folded into the existing `release` skill. The
  check fails if the directory, or a reference to it outside `specs/` and the changelogs, returns.
- **`GEMINI.md` carries no rule and imports `AGENTS.md`.** Google documents no order between the
  two files, so neither may hold a rule the other lacks; with the import, the order is harmless.
  The earlier claim that Antigravity lets `GEMINI.md` win was from a third party, not the vendor, and
  is withdrawn.

## Still open

- **Rule activation.** Antigravity activates a rule as always-on, by glob, by model decision or by
  @mention. None of `.agents/rules/*.md` declares one, and the frontmatter syntax and the default
  for a file without it are unverified (`specs/agent-compatibility/research.md`, Q1). Writing
  frontmatter from a third-party description would be a guess that could silence a rule, so it
  waits for a run in the product.
- **Whether Antigravity truncates, rejects or reports an over-limit file** (Q2), and whether an
  `@file` reference counts toward the limit (Q3). Every file is under the limit either way.
- **The other agents' limits and skill discovery**, listed above as not researched.

## The manual check

Per agent, repeatable. Open the repository cold, with no chat history, and ask:

> Which track is a documentation-only change, and which gates will block its commit?

The expected answer is `chore`, with the eight pre-commit gates in `AGENTS.md`. A tool fails the
check if its agent cannot answer from the files alone, or answers from memory of some other project.

| Agent | Result | Date |
| :--- | :--- | :--- |
| Claude Code | answered from the files: `chore`, the eight gates | 2026-10-01 |
| Antigravity | not run | |
| Gemini CLI | not run | |
