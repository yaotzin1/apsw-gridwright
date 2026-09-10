# Contributing

## Setup

```bash
npm install
npm run hooks:install     # once per clone
```

`hooks:install` points `core.hooksPath` at the versioned `.githooks/`, so the pre-commit gates
actually block a commit instead of merely being documented.

## The gate

```bash
npm run verify
```

Skill validation, documentation sync, typecheck, lint, both test suites, the build, the smoke suite
against `dist/`, and the packaging audit. A change is not finished until this passes end to end,
and `prepublishOnly` runs it again before any publish.

Report what it printed. A summary of a test run is not a test run.

## How work is organised

This repository runs a spec-driven workflow. `antigravity.yml` is the source of truth for the
stages, the skill registry and the quality gates; `AGENTS.md` and `GEMINI.md` are generated from
it, and CI fails if they drift.

Anything that changes behaviour, the public surface or what ships gets a spec directory:

```bash
cp -r specs/_template specs/<feature-name>
```

All eight artifacts are required. Two of them, `api-surface.md` and `events.md`, are contracts:
they pin the public surface before implementation starts, which is what lets the engine and the
adapter be written in parallel without the halves disagreeing.

A typo or a comment does not need one.

## The rules most worth knowing before your first change

**The core is headless.** `src/core`, `src/data` and `src/plugins` must not reference `document`,
`window` or `react`. Lint enforces it. A change that seems to need an exception needs an adapter.

**Local and remote are one code path.** A data source declares what it resolved; the pipeline
applies the rest. No feature may branch on where the rows came from, and any feature touching the
query needs tests on both sides of that seam.

**A green `npm test` proves less than it looks.** Both suites import `src/`. The export map, the
CommonJS types, whether React leaked into the core bundle, whether `dist` is even in `files`: all
invisible. That is what `npm run test:smoke` and `npm run check:exports` are for.

**Classify the semver impact before writing the code.** The table is in
`.agents/skills/api_surface/SKILL.md`. A changed default is a major.

**Every visible string goes in `labels`.** A literal in JSX cannot be translated.

## Skills

Working guidance for each area lives in `.agents/skills/<name>/SKILL.md` — fifteen of them, from
the engine architecture to npm publishing. Claude Code reads generated pointers in
`.claude/skills/`, where underscores become hyphens, so `api_surface` is `/api-surface`.

After editing anything under `.agents/skills/`:

```bash
node scripts/sync-claude-skills.mjs
```

After editing `antigravity.yml`:

```bash
node scripts/sync-agent-docs.mjs
```

Both are checked with `--check` by the hook and by CI.

## Branches, commits and pull requests

Branch as `feat/<feature-name>`, matching the spec directory. Conventional commits. Fill the pull
request template completely, including the semver classification and the seven review answers; "see
the spec" means the review has not happened.

Details in `.agents/workflows/branching.md`.

## Tests

| Directory | Imports | Question it answers |
| :--- | :--- | :--- |
| `tests/unit` | `src/` | is the logic right |
| `tests/react` | `src/react` | does the component behave |
| `tests/smoke` | `dist/` | does the published artifact work |

No timers. Query by role. Cover both sides of the capability seam. Coverage thresholds are 85%
statements, functions and lines, and 80% branches.

## Reporting a bug

Include the data source shape and its declared capabilities, the query state when it happened, and
whether the engine state was already wrong:

```ts
api.on('state:change', ({ state }) => console.log(state.status, state.rows.length, state.totalRows));
```

That one line separates an engine bug from an adapter bug and usually halves the investigation.

## License

Contributions are accepted under the MIT license that covers this package.
