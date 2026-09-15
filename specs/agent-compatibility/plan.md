# Plan: agent compatibility

## Files touched

| File | Change |
| :--- | :--- |
| `workflow.ai.yml` | new `agents` section (api-surface.md); `guidance` references point at skills and rules |
| `scripts/check-workflow.mjs` | size limits per file from `agents`; refuse `.agents/workflows/` and references into it |
| `scripts/sync-agent-docs.mjs` | a short `AGENTS.md` block, plus a generated `.agents/rules/workflow_cycle.md` with the tables; `GEMINI.md` imports `AGENTS.md`; the precedence list stops ranking GEMINI.md over AGENTS.md |
| `.agents/workflows/*.md` | each becomes `.agents/skills/<name>/SKILL.md`; `release.md` merges into the `release` skill |
| `.agents/rules/*.md` | activation frontmatter, once Q1 is answered |
| `scripts/validate-skills.mjs` | ignores rule frontmatter it does not understand, if rules are ever validated |
| `docs/agent-compatibility.md` | the matrix (AC-08) and the manual check (AC-09) |
| `CLAUDE.md`, `CONTRIBUTING.md`, `docs/spec-driven-development.md` | references to `.agents/workflows/` |

## Seams

- **One text, several deliveries.** Every agent-facing file stays generated from `workflow.ai.yml`
  or points at the canonical skill. A tool-specific file is a generated pointer or nothing.
- **Limits are data.** The character limits live in `workflow.ai.yml` next to the source that
  states them, so a vendor changing a limit is a one-line edit, checked like every other claim.

## Trade-offs

- **Splitting `AGENTS.md`** means Codex-like tools that read only `AGENTS.md` see the tables through
  a link rather than inline. They are larger agents with larger limits, and the link is one read
  away; Antigravity getting nothing is worse.
- **Skills instead of workflows** puts procedures in the skill list of every tool, where before they
  were Antigravity-only slash commands. Claude Code gains them as `/verification`, `/branching` and
  so on. The names must not collide with the existing sixteen.
