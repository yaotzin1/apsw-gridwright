# Self-review: agent compatibility

Reviewed 2026-10-01 against `spec.md`. Track: chore, so nothing a consumer installs changes.

## 1. Boundary and layering

Repository instruction files and scripts only. Nothing under `src/` or `packages/` changed. The
generated files stay generated from `workflow.ai.yml`: `AGENTS.md`'s block, `.agents/rules/workflow_cycle.md`,
`.agents/rules/workflow_rules.md` and `GEMINI.md` by `scripts/sync-agent-docs.mjs`, the skill pointers by
`scripts/sync-claude-skills.mjs`.

## 2. The local/remote seam

Not applicable.

## 3. Public surface and semver

None. `.agents/`, `scripts/`, `specs/`, `docs/` and the instruction files are not in `files`.

## 4. Accessibility and i18n

Not applicable.

## 5. Supply chain and packaging

No dependency added. The tarball is unchanged; `npm run check:exports` confirms it.

## 6. Honest output

`docs/agent-compatibility.md` separates tested from documented from unknown, and says Antigravity was
not run. The earlier claim that Antigravity lets `GEMINI.md` outrank `AGENTS.md` came from a third-party
guide; it is withdrawn rather than reworded.

## 7. Verification

- `tests/unit/workflow-check.test.ts`: the limit is the smallest among the agents that load a file, a
  glob reaches one directory deep, a workflows directory or a reference to one fails, and this
  repository passes its own check.
- Measured: `AGENTS.md` 11,178 characters (was 23,122), `workflow_cycle.md` 8,807,
  `workflow_rules.md` 5,990, `GEMINI.md` 1,055.
- `npm run verify`: see the pull request.

## Known gaps

- **AC-05, rule activation, and T5.** The frontmatter syntax for activation is unverified, and a file
  without it is of unknown behaviour in Antigravity. Writing frontmatter from a third-party
  description could silence a rule. Justified by one run in Antigravity answering Q1.
- **AC-01 for Codex, Cursor, Windsurf and Copilot.** Not researched; they read `AGENTS.md`, which
  now fits any limit they are likely to have. Justified when one of them is in use here.
- **AC-09 in Antigravity and Gemini CLI.** Not run.
- **The deadline.** `.agents/workflows/` is gone ahead of 2026-11-01, so nothing is left to break on it.
