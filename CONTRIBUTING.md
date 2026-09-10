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

## Seeing a change behave

```bash
npm run example
```

Builds the package and serves the playground on <http://localhost:5173>, driving `dist/` against a
mock API with capability toggles, latency, an armed failure and an "of many" total. It is the
fastest way to check that a change behaves for a remote source and not only in a test.

## How work is organised

This repository runs a spec-driven workflow. `workflow.ai.yml` is the source of truth for the
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

After editing `workflow.ai.yml`:

```bash
node scripts/sync-agent-docs.mjs
```

Both are checked with `--check` by the hook and by CI.

## How a change lands

`main` is protected. It accepts no direct pushes, no force pushes and no deletion, and a merge is
refused until all six CI checks report success. So every change, including a one-line typo fix,
arrives through a pull request.

```bash
git switch -c feat/<feature-name>     # matching the spec directory
# ... work, with npm run verify passing ...
git push -u origin feat/<feature-name>
gh pr create --fill
```

Conventional commits, because the changelog and the version bump are derived from them:

```
feat(core): negotiate search capability with the data source
fix(react): stop the row handler firing on a selection checkbox click
docs(specs): record the semver impact of the labels change
```

A `!` after the scope, or a `BREAKING CHANGE:` footer, marks a major.

Fill the pull request template completely, including the semver classification and the seven
review answers. "See the spec" means the review has not happened.

Merge by squashing. The branch's intermediate commits are working notes; the trunk's history is the
changelog's raw material.

### The six required checks

| Check | What it proves |
| :--- | :--- |
| Agent instruction set | `AGENTS.md`, `GEMINI.md` and the skill pointers match `workflow.ai.yml` |
| Verify on Node 18 / 20 / 22 | typecheck, lint, both suites, the build, the smoke suite, the packaging audit |
| Example playground boots | the playground still loads `dist/`, and the mock API still honours `serverDoes` |
| Publishable tarball | nothing from `src`, `tests`, `specs` or `.agents` would be published |

They run on every pull request. Getting them green locally first is `npm run verify`, which is the
same sequence and empties `dist/` before it starts so it reproduces the CI conditions rather than
the conditions of whoever built last.

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

If you would rather support the project than contribute code, there is a
[Ko-fi](https://ko-fi.com/yaotzin1). Neither is expected.
