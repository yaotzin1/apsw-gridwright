# Research: agent compatibility

Collected 2026-09-15. Each fact says whether it was **measured** in this repository, **documented**
by the vendor, or **reported** by a third party. Nothing here was tested in a running agent other
than Claude Code.

## Measurements

| File | Characters on 2026-09-15 | Note |
| :--- | ---: | :--- |
| `AGENTS.md` (`main` before #8) | 15,364 | already over Antigravity's 12,000 |
| `AGENTS.md` (after #8) | 21,832 | tracks, stage table and rule enforcement added |
| `GEMINI.md` | 988 | |
| largest `.agents/rules/*.md` (`architecture.md`) | 3,432 | every rules file is under the limit |

None of the ten `.agents/rules/` files and none of the six `.agents/workflows/` files has
frontmatter.

## Antigravity

| Fact | Kind | Source |
| :--- | :--- | :--- |
| Workspace rules live in `.agents/rules/`; `.agent/rules/` still works | documented | [Rules](https://antigravity.google/docs/rules-workflows/) |
| Rules activate as Manual (@mention), Always On, Model Decision or Glob | documented | [Rules](https://antigravity.google/docs/rules-workflows/) |
| Each rules file is limited to 12,000 characters | documented | [Rules](https://antigravity.google/docs/rules-workflows/) |
| Rules support `@filename` references, relative to the rule file | documented | [Rules](https://antigravity.google/docs/rules-workflows/) |
| Global rules live in `~/.gemini/GEMINI.md` | documented | [Rules](https://antigravity.google/docs/rules-workflows/) |
| `AGENTS.md` in the project root is read as rules since IDE 1.20.5, and the 12,000 cap applies to it | reported | [The Prompt Shelf guide](https://thepromptshelf.dev/blog/google-antigravity-agents-md-rules-guide-2026/) |
| No precedence between `AGENTS.md` and `GEMINI.md` is documented | reported | same |
| Workflows at `.agents/workflows/<name>.md` stop being indexed or invocable on 2026-11-01 | documented | [Workflows to Skills Migration](https://antigravity.google/docs/migration/workflows-to-skills/) |
| Skills live at `.agents/skills/<name>/SKILL.md`, need `name` and `description` frontmatter, and are invoked as `/<name>` | documented | same |
| A `/migrate-workflows` command converts workflows to skills | documented | same |

## Other agents, not yet researched

To confirm before AC-01, each with a source and a date:

- **Codex:** reads `AGENTS.md`, nearest file wins, with a default project-doc byte limit (believed
  to be 32 KiB). Does it discover `.agents/skills/`?
- **Cursor:** reads `AGENTS.md`. Size limit? Skill discovery?
- **Windsurf:** reads `AGENTS.md`. Size limit?
- **GitHub Copilot** (coding agent and editor): reads `AGENTS.md`. Which skill directories does it
  discover (`.github/skills/`, `.claude/skills/`, `.agents/skills/`)?
- **Gemini CLI:** loads `GEMINI.md` by default and can be configured to load `AGENTS.md`. Confirm
  the `@file` import syntax and whether it applies to the project file.

## Open questions

- **Q1** What is the exact frontmatter syntax for a rule's activation mode in Antigravity, and does
  a file without it default to always-on, manual, or not loaded? Verify in the product before AC-05.
- **Q2** When `AGENTS.md` exceeds 12,000 characters, does Antigravity truncate it, reject it, or
  report it? This decides whether the essentials must come first (truncation) or the whole file
  must fit (rejection). AC-03 satisfies both.
- **Q3** Does an `@file` reference inside `AGENTS.md` count toward the referencing file's limit? If
  not, AC-03 could link the generated tables instead of splitting them out.

## Options considered

- **Split `AGENTS.md` into a short entry file and a generated rules file** (chosen for AC-03). Both
  stay under the cap, and tools without rules directories still get the essentials.
- **Drop sections from the generated block.** Rejected: the stage and skill tables are the reason
  the block exists.
- **Per-tool copies of the rules.** Rejected in the non-goals: two texts drift, and the copy that
  drifts is the one an agent obeys.
