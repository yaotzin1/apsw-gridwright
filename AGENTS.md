# AGENTS.md — apsw-gridwright

The operating rules for every agent working in this repository. `workflow.ai.yml` outranks this
file; the cycle section below is generated from it.

## 1. What this package is

`apsw-gridwright` is a React data grid published to npm under MIT, built on a headless engine.

- **Core** (`src/core`, `src/data`, `src/plugins`) is a framework-agnostic engine. No DOM, no
  React, no runtime dependencies. It stays that way because it is what makes the pipeline testable
  without a renderer, not because a second adapter is planned.
- **Adapter** (`src/react`) is a React table component named `Gridwright`, plus the parts it is
  composed from. Every feature is an add-on (`docs/addons.md`) with no access a third-party add-on
  lacks. **It is the only supported surface.** The core entry stays exported and stays
  tested, and it is documented as the engine rather than as a second way to build a grid. No page,
  example or document in this repository builds a grid out of the engine by hand.
- **One pipeline serves local and remote data.** A data source declares which facets of the query
  it resolved through `capabilities`; the pipeline applies whatever is left. Nothing above the
  pipeline knows where the rows came from.

That last point is the whole design. Before adding anything, ask whether it preserves it.

## 2. Repository map

| Path | Holds |
| :--- | :--- |
| `src/core/` | engine, state, columns, query, pipeline, values, errors |
| `src/data/` | local, remote and REST data sources |
| `src/plugins/` | the four built-in pipeline stages |
| `src/react/` | the `Gridwright` shell, `useGridwright`, context, parts, the add-on contract (`addons/`), the core add-ons (`core-addons/`), and one directory per feature add-on: `detail/`, `export/`, `filters/`, `layout/`, `navigation/`, `tree/`, `url-sync/`, `virtual/`, `plugins/` |
| `packages/mui/` | `apsw-gridwright-mui`, a second published package in this npm workspace: MUI views of the core add-ons (`muiAddons()`) and the theme bridge (`muiTheme()`). It reaches the grid through public exports only; its tests re-run the grid's own suites against its views |
| `src/styles/` | the unstyled token stylesheet, published as `apsw-gridwright/styles.css` |
| `tests/unit/` | engine, pipeline, data sources, extensibility |
| `tests/react/` | component behaviour through Testing Library |
| `tests/smoke/` | the built package, imported through its export map |
| `scripts/` | validation, doc sync, hook install, packaging audit |
| `specs/` | one directory per feature: spec, API surface and review, plus the planning artifacts it has |
| `.agents/` | canonical skills, rules and workflows |

## 3. Commands

```bash
npm install
npm run hooks:install     # once per clone: points core.hooksPath at .githooks

npm test                  # unit + react suites
npm run typecheck
npm run lint
npm run build
npm run test:smoke        # builds, then tests dist/ through the export map
npm run check:exports     # audits the manifest, export map and bundles
npm run verify            # everything above, in the order CI runs it
```

`npm run verify` is the gate. A change is not done until it has passed end to end, and
`prepublishOnly` runs it again before any publish.

## 4. The rules that are easiest to skip

**A green unit suite is not evidence that the package works.** It imports `src/`. The export map,
the dual module output, the shared chunk and the tarball contents are invisible to it, and that is
exactly where packaging failures live. Run `npm run test:smoke` and `npm run check:exports`.

**Security has no exceptions.** HTML and script sinks, unsandboxed iframe documents, new tabs
without `noopener`, wildcard `postMessage` and prototype writes are banned everywhere, the playground
and scripts included, and `scripts/security-audit.mjs` blocks the commit. A design that seems to
need one needs a different design. Read `.agents/skills/application_security/SKILL.md` before
touching anything that renders, serializes, fetches, serves or extends.

**The headless boundary is enforced by lint, not by memory.** `document`, `window` and `react` are
banned under `src/core`, `src/data` and `src/plugins`. A change that appears to need an exception
needs an adapter instead.

**Classify the semver impact before writing the code.** A changed default breaks consumers without
breaking their build, which is what makes it dangerous. The table is in
`.agents/skills/api_surface/SKILL.md`, and the classification belongs in the spec.

**Every visible string goes in `labels`.** A literal in JSX cannot be translated.

**Never invent a total.** When a paginating source sends no count, the grid reports
`isTotalExact: false` and the range says "of many". A number computed from one page is a number the
reader would act on, and it would be wrong.

## 5. Agent skills

Canonical text lives in `.agents/skills/<name>/SKILL.md`. Claude Code reads the generated pointers
in `.claude/skills/`, where underscores become hyphens, so `api_surface` is invoked as
`/api-surface`. After editing anything under `.agents/skills/`, run:

```bash
node scripts/sync-claude-skills.mjs
```

CI and the pre-commit hook run it with `--check`.

## 6. Operating cycle

<!-- BEGIN GENERATED: ai-workflow-cycle (scripts/sync-agent-docs.mjs) -->

> Generated from `workflow.ai.yml`. Do not edit by hand: run `node scripts/sync-agent-docs.mjs`.
> Each track's deliverables, the stage table and the skill table are in `.agents/rules/workflow_cycle.md`; every rule with what enforces it is in `.agents/rules/workflow_rules.md`.

### Precedence

**This file is the supreme instruction source for every agent working in this repository. Where any other document disagrees with it, this file wins, and the other document is a defect to be fixed rather than a rule to be followed.**

1. workflow.ai.yml (this file) - supreme. Tracks, stages, the skill registry, quality gates and architectural rules are defined here and nowhere else.
2. .agents/rules/** and .agents/skills/** - binding detail, procedures included (spec_driven_development, verification, branching, release, create_plugin, create_data_source). They elaborate this file and may not contradict it.
3. AGENTS.md - loaded automatically by AGENTS.md-aware agents. Its cycle section is generated from this file; never hand-edit the generated block.
4. GEMINI.md - generated, and it carries no rule of its own. Google documents no order between it and AGENTS.md, so neither may hold a rule the other lacks; it imports AGENTS.md and the order is then harmless.
5. CLAUDE.md - Claude Code entry point. Imports AGENTS.md and may add tool-specific notes, never overrides.
6. specs/<feature-name>/** - binding for one feature only, subordinate to everything above.

On conflict: Stop. Correct the subordinate document, re-run the sync scripts, then continue. Never settle a conflict by following the subordinate text.

### Enforced or guidance

Every statement in this cycle is **enforced** (a hook, a CI job, a lint rule, a test or
`scripts/check-workflow.mjs` fails when it is broken) or **guidance** (nothing fails when you do not).
The gates, the required checks, the spec directory rule and every rule with a named enforcer are
enforced. The tracks, the stages and every rule marked "review" are guidance, and exactly as strong
as your honesty about following them.

### Tracks: pick one before starting

When the work turns out bigger than its track, move up to the larger track and do the stages it
adds. Never move down to skip them. The stages, and which skill leads each, are in `.agents/rules/workflow_cycle.md`.

| Track | When | Stages |
| :--- | :--- | :--- |
| `feature` | Anything a consumer would notice: a new or changed export, prop, column field, add-on, option, default, event or rendered markup. | 1. Specify<br>2. Clarify<br>3. Plan<br>4. Tasks<br>5. Analyze<br>6. Implement<br>7. Verify<br>8. Review and ship |
| `fix` | Restores behaviour that is already documented or specified. No new surface. A fix that has to change a public type or a default is a feature. | 6. Implement<br>7. Verify<br>8. Review and ship |
| `chore` | Documentation, agent instructions, tests, CI, tooling or dev dependencies, with nothing a consumer installs changing. | 7. Verify<br>8. Review and ship |
| `release` | Cutting a version: moving Unreleased under a number, bumping the version, tagging. | 7. Verify<br>8. Review and ship |

### Blocking gates before a commit

A real git hook: run `node scripts/install-hooks.mjs` once per clone. The pure-Node gates always run, the suites run
when `node_modules` exists, and CI enforces all of them.

- **Skills Syntax & Security Validation** — `node scripts/validate-skills.mjs`
- **Claude Code Skill Pointer Sync** — `node scripts/sync-claude-skills.mjs --check`
- **Operating Cycle Mirrored Into AGENTS.md** — `node scripts/sync-agent-docs.mjs --check`
- **Workflow Claims Match the Repository** — `node scripts/check-workflow.mjs`
- **Security Audit (banned APIs, sandboxing, supply chain)** — `node scripts/security-audit.mjs --source`
- **TypeScript Type-Check** — `npm run typecheck`
- **ESLint** — `npm run lint`
- **Unit & React Test Suites** — `npm test`

### Architectural rules

One line each. The reason and what enforces it are in `.agents/rules/workflow_rules.md`.

- Security is a blocking gate with no exceptions.
- The core is headless.
- Every feature is an engine plugin, a React add-on, or both.
- Zero runtime dependencies.
- MUI lives in packages/mui (apsw-gridwright-mui) and nowhere else.
- Local and remote data travel one code path.
- Rendering belongs to the adapter.
- Every visible string is in the labels object or an add-on's messages.
- Public API changes are classified before they are written.
- A stage or plugin that throws loses its own effect and nothing else.
- Every feature directory under specs/ contains spec.md, api-surface.md and review.md.
- A green unit suite is not evidence that the package works.
- Repository documentation moves with the change: AGENTS.md, README.md, CHANGELOG.md and specs/DEPENDENCY_MAP.md whenever the public surface, the architecture or the release contents change, and docs/api.md in the same ...
- Accessibility is a gate, not a nicety: the header sort control is a real button, sort state is announced through aria-sort, and row changes reach a live region.
- No AI slop in the rendered output: no decorative sparkles, no placeholder charts, no invented totals.

<!-- END GENERATED: ai-workflow-cycle -->

## 7. Rules and procedures

Binding detail lives beside the skills:

- `.agents/rules/` — architecture, api_surface, testing, review, spec_pipeline, styling,
  performance, security, agent_orchestration, agent_execution_standards, and the generated
  `workflow_cycle.md` (the stage and skill tables, every rule with what enforces it)
- `.agents/skills/` — the skills, procedures included: spec_driven_development, verification,
  branching, release, create_plugin, create_data_source

They elaborate `workflow.ai.yml` and may not contradict it. Where they do, the YAML wins and the
rule is a defect to fix.
