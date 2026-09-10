# AGENTS.md — apsw-gridwright

The operating rules for every agent working in this repository. `antigravity.yml` outranks this
file; the cycle section below is generated from it.

## 1. What this package is

`apsw-gridwright` is a headless, component-oriented data grid published to npm under MIT.

- **Core** (`src/core`, `src/data`, `src/plugins`) is a framework-agnostic engine. No DOM, no
  React, no runtime dependencies.
- **Adapter** (`src/react`) is a React table component named `Gridwright`, plus the parts it is
  composed from.
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
| `src/react/` | `Gridwright`, `useGridwright`, context, parts |
| `src/styles/` | the unstyled token stylesheet, published as `apsw-gridwright/styles.css` |
| `tests/unit/` | engine, pipeline, data sources, extensibility |
| `tests/react/` | component behaviour through Testing Library |
| `tests/smoke/` | the built package, imported through its export map |
| `scripts/` | validation, doc sync, hook install, packaging audit |
| `specs/` | the 8-artifact Spec-Kit, one directory per feature |
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

<!-- BEGIN GENERATED: antigravity-cycle (scripts/sync-agent-docs.mjs) -->

> Generated from `antigravity.yml`. Do not edit by hand: run `node scripts/sync-agent-docs.mjs`.
> The YAML is the source of truth, but no toolchain loads it automatically, so the cycle is
> reproduced here, in the file that is loaded automatically.

### Precedence

**This file is the supreme instruction source for every agent working in this repository. Where any other document disagrees with it, this file wins, and the other document is a defect to be fixed rather than a rule to be followed.**

1. antigravity.yml (this file) - supreme. Stages, skill registry, quality gates and architectural rules are defined here and nowhere else.
2. .agents/rules/** and .agents/skills/** - binding detail. They elaborate this file and may not contradict it.
3. AGENTS.md - loaded automatically by AGENTS.md-aware agents. Its cycle section is generated from this file; never hand-edit the generated block.
4. GEMINI.md - Antigravity merges it with AGENTS.md and lets it win on conflict, so it is generated to carry no rule of its own. Never put a rule here; it would silently outrank the block generated from this file.
5. CLAUDE.md - Claude Code entry point. Imports AGENTS.md and may add tool-specific notes, never overrides.
6. specs/<feature-name>/** - binding for one feature only, subordinate to everything above.

On conflict: Stop. Correct the subordinate document, re-run the sync scripts, then continue. Never settle a conflict by following the subordinate text.

### The eight stages

| Phase | Stage | Lead skills | Deliverables |
| :--- | :--- | :--- | :--- |
| 1 | Stage 1: Capability Specification (/speckit.specify) | `architect`, `documentation`, `accessibility` | `specs/<feature-name>/spec.md` |
| 2 | Stage 2: Requirements Clarification (/speckit.clarify) | `architect`, `api_surface`, `documentation` | `specs/<feature-name>/spec.md (clarifications)` |
| 3 | Stage 3: Technical Planning & Public Contract Generation (/speckit.plan) | `architect`, `api_surface`, `data_source`, `performance`, `documentation` | `specs/<feature-name>/plan.md`<br>`specs/<feature-name>/data-model.md`<br>`specs/<feature-name>/research.md`<br>`specs/<feature-name>/api-surface.md`<br>`specs/<feature-name>/events.md` |
| 4 | Stage 4: Dependency-Aware Task Decomposition (/speckit.tasks) | `architect`, `refactor`, `documentation` | `specs/<feature-name>/tasks.md` |
| 5 | Stage 5: Compatibility & Boundary Pre-Audit (/speckit.analyze) | `api_surface`, `security_guard`, `performance`, `accessibility` | — |
| 6 | Stage 6: Parallel Subagent Implementation (/speckit.implement) | `architect`, `react_adapter`, `extensibility`, `styling` | — |
| 7 | Stage 7: Empirical Verification (/speckit.verify) | `qa`, `smoke_tests`, `accessibility`, `debugger` | — |
| 8 | Stage 8: Self-Review, Documentation Sync & Release Gate (/speckit.review) | `documentation`, `release`, `security_guard`, `api_surface` | `specs/<feature-name>/review.md`<br>`AGENTS.md`<br>`README.md`<br>`CHANGELOG.md`<br>`specs/DEPENDENCY_MAP.md` |

Feature work runs these in order. A defect fix may enter at stage 6, but stages 7 and 8 are not
optional for it: verification and self-review apply to every change that reaches a branch, and
a published package cannot be unpublished after 72 hours.

### Skills and when they lead

Canonical text: `.agents/skills/<name>/SKILL.md`. Antigravity discovers that directory natively.
Claude Code reads the mirror in `.claude/skills/`, where the name loses its underscores. Tools
with no skill discovery of their own get this table, and open the canonical file themselves.

| Skill | Claude Code | Applies to |
| :--- | :--- | :--- |
| `architect` | `/architect` | The headless boundary, the engine state machine, where a behaviour belongs between core, plugin and adapter |
| `api_surface` | `/api-surface` | Exported names and signatures, breaking-change classification, export map and type entry points |
| `data_source` | `/data-source` | The DataSource contract, capability declaration, remote pagination, totals, aborts and retries |
| `extensibility` | `/extensibility` | Writing plugins and pipeline stages, stage ordering, teardown, keeping third-party reach equal to the built-ins |
| `react_adapter` | `/react-adapter` | Component composition, useSyncExternalStore, Strict Mode, render-count discipline, cell renderers |
| `styling` | `/styling` | CSS custom properties, class name overrides, dark mode, reduced motion, every visible string in labels |
| `accessibility` | `/accessibility` | The ARIA grid pattern, aria-sort, live regions, keyboard reachability, focus after a page change |
| `qa` | `/qa` | Vitest and Testing Library, what to assert, async grid tests without arbitrary timers |
| `smoke_tests` | `/smoke-tests` | The dist-level smoke suite and the packaging audit: export map, dual module output, shared chunk identity |
| `performance` | `/performance` | Per-row work, pipeline allocation, render counts, large data sets, measuring before changing |
| `debugger` | `/debugger` | Reading the actual failure output, isolating engine from adapter, reproducing a report as a test first |
| `refactor` | `/refactor` | Behaviour-preserving change, splitting an overgrown module, deprecating an export without breaking it |
| `documentation` | `/documentation` | The 8-artifact Spec-Kit lifecycle, README, CHANGELOG, DEPENDENCY_MAP, comments that explain why |
| `release` | `/release` | Version selection, CHANGELOG entries, the publish gate, what a published tarball contains |
| `security_guard` | `/security-guard` | Runtime dependency policy, install scripts, what must never enter the tarball, untrusted row data in the DOM |

### Blocking gates before a commit

Enforced by a real git hook, not by good intentions. Run `node scripts/install-hooks.mjs` once
per clone; it points `core.hooksPath` at the versioned `.githooks/`. The three document gates
always run, the suites run when their toolchain is reachable, and CI enforces all of them.

- **Skills Syntax & Security Validation** — `node scripts/validate-skills.mjs`
- **Claude Code Skill Pointer Sync** — `node scripts/sync-claude-skills.mjs --check`
- **Operating Cycle Mirrored Into AGENTS.md** — `node scripts/sync-agent-docs.mjs --check`
- **TypeScript Type-Check** — `npm run typecheck`
- **ESLint** — `npm run lint`
- **Unit & React Test Suites** — `npm test`

### Architectural rules

- The core is headless. Nothing under src/core, src/data or src/plugins may reference document, window, or React. The lint config enforces this, and a change that needs an exception is a change that belongs in an adapter.
- Zero runtime dependencies. The package declares peer dependencies on React only, both optional. A new entry under `dependencies` requires an explicit decision recorded in the spec, because every one of them is a version this package can force onto a consumer's tree.
- Local and remote data travel one code path. A data source declares what it resolves through `capabilities`; the pipeline applies whatever is left. No feature may branch on where the rows came from.
- Rendering belongs to the adapter. ColumnDef carries no ReactNode; renderers live in GridwrightColumn under src/react.
- Every visible string is in the labels object. A string literal rendered from JSX cannot be translated, and this package is used in applications that are.
- Public API changes are classified before they are written. Adding an optional field is a minor; changing a signature, a default, or an emitted event's payload is a major. Record the classification in the spec and in CHANGELOG.md.
- A stage or plugin that throws loses its own effect and nothing else. Third-party code runs in the pipeline by design, and a broken plugin must not empty the grid.
- Mandatory 8-artifact Spec-Kit standard: every feature directory under specs/ contains spec.md, plan.md, tasks.md, data-model.md, research.md, api-surface.md, events.md and review.md.
- A green unit suite is not evidence that the package works. It imports src/. The smoke suite imports dist/ through the export map, and no change ships without it passing.
- Mandatory repository documentation synchronisation: update AGENTS.md, README.md, CHANGELOG.md and specs/DEPENDENCY_MAP.md whenever the public surface, the architecture or the release contents change.
- Accessibility is a gate, not a nicety: the header sort control is a real button, sort state is announced through aria-sort, and row changes reach a live region. A grid nobody can operate by keyboard is a broken grid.
- No AI slop in the rendered output: no decorative sparkles, no placeholder charts, no invented totals. When a paginating source sends no total, the grid says so rather than displaying a number it computed from one page.

<!-- END GENERATED: antigravity-cycle -->

## 7. Rules and workflows

Binding detail lives beside the skills:

- `.agents/rules/` — architecture, api_surface, testing, review, spec_pipeline, styling,
  performance, security, agent_orchestration, agent_execution_standards
- `.agents/workflows/` — spec_driven_development, verification, branching, release, create_plugin,
  create_data_source

They elaborate `antigravity.yml` and may not contradict it. Where they do, the YAML wins and the
rule is a defect to fix.
