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
> The YAML is the source of truth, but no toolchain loads it automatically, so the cycle is
> reproduced here, in the file that is loaded automatically.

### Precedence

**This file is the supreme instruction source for every agent working in this repository. Where any other document disagrees with it, this file wins, and the other document is a defect to be fixed rather than a rule to be followed.**

1. workflow.ai.yml (this file) - supreme. Tracks, stages, the skill registry, quality gates and architectural rules are defined here and nowhere else.
2. .agents/rules/** and .agents/skills/** - binding detail. They elaborate this file and may not contradict it.
3. .agents/workflows/** - the procedures behind each stage and track. Guidance, not settings.
4. AGENTS.md - loaded automatically by AGENTS.md-aware agents. Its cycle section is generated from this file; never hand-edit the generated block.
5. GEMINI.md - Antigravity merges it with AGENTS.md and lets it win on conflict, so it is generated to carry no rule of its own. Never put a rule here; it would silently outrank the block generated from this file.
6. CLAUDE.md - Claude Code entry point. Imports AGENTS.md and may add tool-specific notes, never overrides.
7. specs/<feature-name>/** - binding for one feature only, subordinate to everything above.

On conflict: Stop. Correct the subordinate document, re-run the sync scripts, then continue. Never settle a conflict by following the subordinate text.

### Enforced or guidance

Every statement in this cycle is one of two kinds. **Enforced**: a hook, a CI job, a lint rule, a
test or `scripts/check-workflow.mjs` fails when it is broken. **Guidance**: what you are expected
to do, with nothing that fails when you do not. The gates, the required checks, the spec
directory rule and every rule with a named enforcer are enforced. The tracks, the stages and
every rule marked "review" are guidance, and they are exactly as strong as your honesty about
following them.

### Tracks: pick one before starting

When the work turns out bigger than its track, move up to the larger track and do the stages it
adds. Never move down to skip them.

| Track | When | Stages | Deliverables |
| :--- | :--- | :--- | :--- |
| `feature` | Anything a consumer would notice: a new or changed export, prop, column field, add-on, option, default, event or rendered markup. | 1. Specify<br>2. Clarify<br>3. Plan<br>4. Tasks<br>5. Analyze<br>6. Implement<br>7. Verify<br>8. Review and ship | a specs/&lt;feature-name&gt;/ directory satisfying spec_kit<br>CHANGELOG.md entry under Unreleased with the semver classification<br>docs/api.md, README.md and examples/ updated where the surface appears |
| `fix` | Restores behaviour that is already documented or specified. No new surface. A fix that has to change a public type or a default is a feature. | 6. Implement<br>7. Verify<br>8. Review and ship | a test that fails before the fix and passes after it<br>CHANGELOG.md entry under Unreleased, in Fixed<br>if a public type still changes, its classification in the owning spec's api-surface.md |
| `chore` | Documentation, agent instructions, tests, CI, tooling or dev dependencies, with nothing a consumer installs changing. | 7. Verify<br>8. Review and ship | CHANGELOG.md entry only when it reaches a consumer: the Node floor, a peer range, the tarball |
| `release` | Cutting a version: moving Unreleased under a number, bumping the version, tagging. | 7. Verify<br>8. Review and ship | CHANGELOG.md section for the version, package.json, package-lock.json and VERSION in src/index.ts in agreement<br>a v&lt;version&gt; tag on the merge commit on main for apsw-gridwright, or mui-v&lt;version&gt; for apsw-gridwright-mui (packages/mui, released only after the grid version its peer range needs is on npm). Pushing either runs .github/workflows/release.yml, which publishes to npm through that package's trusted publisher on npmjs.com: a pushed tag is a publish decision, and it is the maintainer's |

### Stages

| Stage | Lead skills | Deliverables | Procedure |
| :--- | :--- | :--- | :--- |
| 1. Specify — The consumer problem, the stories of the developer who installs this package and of the person using the grid, acceptance criteria, non-goals, and which plugin and add-on deliver it. | `architect`, `documentation`, `accessibility` | `specs/<feature-name>/spec.md` | `.agents/workflows/spec_driven_development.md` |
| 2. Clarify — Resolves naming, defaults, and which side of the local/remote seam a behaviour sits on. Every default chosen here is a decision a consumer inherits. | `architect`, `api_surface`, `documentation` | `specs/<feature-name>/spec.md (clarifications)` | `.agents/workflows/spec_driven_development.md` |
| 3. Plan — Designs the engine change, the state shape, and the exact exported names, signatures and semver classification. api-surface.md is the contract implementation is written against. | `architect`, `api_surface`, `data_source`, `performance`, `documentation` | `specs/<feature-name>/api-surface.md`<br>`specs/<feature-name>/plan.md, data-model.md, research.md, events.md where the feature has one (see spec_kit)` | `.agents/workflows/spec_driven_development.md` |
| 4. Tasks — An ordered checklist of testable tasks: core first, adapter second, documentation last. | `architect`, `refactor`, `documentation` | `specs/<feature-name>/tasks.md, where the work has more than one step worth tracking` | `.agents/workflows/spec_driven_development.md` |
| 5. Analyze — Audits the plan before code: breaking changes without a major, DOM or React in the core, new runtime dependencies, exploit-prone designs, accessibility regressions, per-row work in the hot path. A failure returns to Plan. | `api_surface`, `application_security`, `security_guard`, `performance`, `accessibility` | — | `.agents/workflows/spec_driven_development.md` |
| 6. Implement — Writes the change against api-surface.md. It may be split between a core agent and an adapter agent when the contract is precise enough; an agent that finds the contract wrong stops and reports rather than editing it. | `architect`, `react_adapter`, `extensibility`, `styling`, `application_security` | — | `.agents/rules/agent_orchestration.md` |
| 7. Verify — Runs npm run verify end to end and reports its actual output, then the manual checks no gate can make. A failing gate is investigated from its own output; after three failed attempts the plan is wrong, not the code. | `qa`, `smoke_tests`, `accessibility`, `debugger` | — | `.agents/workflows/verification.md` |
| 8. Review and ship — The 7-dimension self-review, documentation synchronised with the change, and a pull request whose required CI checks are green before it merges. | `documentation`, `release`, `application_security`, `security_guard`, `api_surface` | `specs/<feature-name>/review.md (feature track), or the review answers in the pull request`<br>`AGENTS.md, README.md, CHANGELOG.md, specs/DEPENDENCY_MAP.md and docs/api.md where they changed` | `.agents/rules/review.md` |

### Spec directories

Every feature directory under `specs/` contains `spec.md`, `api-surface.md`, `review.md`. Each of
`plan.md`, `tasks.md`, `data-model.md`, `research.md`, `events.md` is either written or listed in `spec.md` under
`## Artifacts not written`, one bullet per file naming it and the reason it does not apply.
Copy `specs/_template/` to start. `scripts/check-workflow.mjs` enforces this.

### Skills and when they lead

Canonical text: `.agents/skills/<name>/SKILL.md`. Antigravity discovers that directory natively.
Claude Code reads the mirror in `.claude/skills/`, where the name loses its underscores. Tools
with no skill discovery of their own get this table, and open the canonical file themselves.

| Skill | Claude Code | Applies to |
| :--- | :--- | :--- |
| `architect` | `/architect` | The headless boundary, the engine state machine, and deciding whether a feature is a plugin, an add-on, a core service or a combination |
| `api_surface` | `/api-surface` | Exported names and signatures, breaking-change classification, export map and type entry points |
| `data_source` | `/data-source` | The DataSource contract, capability declaration, remote pagination, totals, aborts and retries |
| `extensibility` | `/extensibility` | Writing engine plugins, pipeline stages and React add-ons: stage order, teardown, slots, suppression, keeping third-party reach equal to the built-ins |
| `react_adapter` | `/react-adapter` | Component composition, useSyncExternalStore, Strict Mode, render-count discipline, cell renderers |
| `styling` | `/styling` | CSS custom properties, class name overrides, dark mode, reduced motion, every visible string in labels |
| `accessibility` | `/accessibility` | The ARIA grid pattern, aria-sort, live regions, keyboard reachability, focus after a page change |
| `qa` | `/qa` | Vitest and Testing Library, what to assert, async grid tests without arbitrary timers |
| `smoke_tests` | `/smoke-tests` | The dist-level smoke suite and the packaging audit: export map, dual module output, shared chunk identity |
| `performance` | `/performance` | Per-row work, pipeline allocation, render counts, large data sets, measuring before changing |
| `debugger` | `/debugger` | Reading the actual failure output, isolating engine from adapter, reproducing a report as a test first |
| `refactor` | `/refactor` | Behaviour-preserving change, splitting an overgrown module, deprecating an export without breaking it |
| `documentation` | `/documentation` | Spec directories and which artifacts a feature needs, README, CHANGELOG, DEPENDENCY_MAP, docs/api.md, comments that explain why |
| `release` | `/release` | Version selection, CHANGELOG entries, tags and the publish workflow they start, what a published tarball contains |
| `security_guard` | `/security-guard` | Runtime dependency policy, install scripts, the lockfile and .npmrc, what must never enter the tarball |
| `application_security` | `/application-security` | Exploit classes a grid has: HTML and script sinks, injection into files, URLs, selectors and styles, sandboxed documents, prototype pollution, ReDoS, what add-ons may reach, the development server. Banned APIs, no exceptions |

### Blocking gates before a commit

Enforced by a real git hook. Run `node scripts/install-hooks.mjs` once per clone; it points
`core.hooksPath` at the versioned `.githooks/`. The pure-Node gates always run, the suites run
when `node_modules` exists, and CI enforces all of them.

- **Skills Syntax & Security Validation** — `node scripts/validate-skills.mjs`
- **Claude Code Skill Pointer Sync** — `node scripts/sync-claude-skills.mjs --check`
- **Operating Cycle Mirrored Into AGENTS.md** — `node scripts/sync-agent-docs.mjs --check`
- **Workflow Claims Match the Repository** — `node scripts/check-workflow.mjs`
- **Security Audit (banned APIs, sandboxing, supply chain)** — `node scripts/security-audit.mjs --source`
- **TypeScript Type-Check** — `npm run typecheck`
- **ESLint** — `npm run lint`
- **Unit & React Test Suites** — `npm test`

### Required before a pull request merges

`main` accepts a merge only when these CI checks pass. Before a release, confirm
GitHub still requires exactly these with `node scripts/check-workflow.mjs --remote`.

- Agent instruction set
- Dependency audit
- Verify on Node 22
- Verify on Node 24
- Example playground boots
- Publishable tarball

### Architectural rules

- Security is a blocking gate with no exceptions. Exploit-prone APIs are banned everywhere in the repository, the playground and scripts included: HTML sinks (dangerouslySetInnerHTML, innerHTML, outerHTML, insertAdjacentHTML, document.write), script sinks (eval, new Function, string timers), unsandboxed or script-enabled iframe documents, target=_blank without noopener, postMessage to '*', prototype writes from data, and inline disabling of a security lint rule. Every generated file and document escapes at the boundary, every URL, selector and style built from data is encoded, and no extension point may give third-party code a sink the package itself does not have. A change that needs an exception needs a different design.
  *Enforced by:* `scripts/security-audit.mjs` (hook, verify, CI) and `eslint.config.js`
- The core is headless. Nothing under src/core, src/data, src/plugins, src/tree, src/i18n or src/locales may reference document, window, or React. A change that needs an exception is a change that belongs in an adapter.
  *Enforced by:* `eslint.config.js` (no-restricted-globals, no-restricted-imports)
- Every feature is an engine plugin, a React add-on, or both. &lt;Gridwright /&gt; is a shell that imports no feature, and a built-in plugin or add-on has no access a third-party one lacks: when a feature needs a seam that does not exist, the seam is added to the public contract for everyone. Only state or an operation every renderer needs, with nothing about it a choice, is a core service on GridApi, and its UI is still an add-on.
  *Enforced by:* `tests/react/third-party-addon.test.tsx` (a public-exports add-on reaches every slot) and `tests/smoke/tree-shaking.test.ts` (the shell carries no feature code)
- Zero runtime dependencies. apsw-gridwright declares peer dependencies on React only, both optional; apsw-gridwright-mui declares peers on the grid, @mui/material and React, and no dependencies either. A new entry under `dependencies` requires an explicit decision recorded in the spec, because every one of them is a version this package can force onto a consumer's tree.
  *Enforced by:* `scripts/check-exports.mjs` and `scripts/security-audit.mjs` (manifest)
- MUI lives in packages/mui (apsw-gridwright-mui) and nowhere else. Nothing under src/ may import @mui/* or @emotion/*, and no grid bundle may reference @mui/: one import would put MUI in the tree of every consumer, including those on other MUI versions and those without MUI. The MUI package reaches the grid through its public exports only, and imports it at run time rather than bundling a copy.
  *Enforced by:* `eslint.config.js` (no-restricted-imports) and `scripts/check-exports.mjs` (grid bundles, and the MUI build's imports)
- Local and remote data travel one code path. A data source declares what it resolves through `capabilities`; the pipeline applies whatever is left. No feature may branch on where the rows came from.
  *Enforced by:* review (.agents/rules/review.md, dimension 2)
- Rendering belongs to the adapter. ColumnDef carries no ReactNode; renderers live in GridwrightColumn under src/react.
  *Enforced by:* `eslint.config.js` (react may not be imported under the core)
- Every visible string is in the labels object or an add-on's messages. A string literal rendered from JSX cannot be translated, and this package is used in applications that are.
  *Enforced by:* review (.agents/rules/review.md, dimension 4); `auditAddonMessages` catches a missing key, not a literal
- Public API changes are classified before they are written. Adding an optional field is a minor; changing a signature, a default, or an emitted event's payload is a major. Record the classification in the spec and in CHANGELOG.md.
  *Enforced by:* review (.agents/rules/review.md, dimension 3)
- A stage or plugin that throws loses its own effect and nothing else. Third-party code runs in the pipeline by design, and a broken plugin must not empty the grid.
  *Enforced by:* `tests/unit/extensibility.test.ts`
- Every feature directory under specs/ contains spec.md, api-surface.md and review.md. Each of plan.md, tasks.md, data-model.md, research.md and events.md is either written or named in spec.md under Artifacts not written, with the reason it does not apply.
  *Enforced by:* `scripts/check-workflow.mjs`
- A green unit suite is not evidence that the package works. It imports src/. The smoke suite imports dist/ through the export map, and no change ships without it passing.
  *Enforced by:* CI (Verify on Node 22 and 24) and `prepublishOnly`
- Repository documentation moves with the change: AGENTS.md, README.md, CHANGELOG.md and specs/DEPENDENCY_MAP.md whenever the public surface, the architecture or the release contents change, and docs/api.md in the same change as any added, removed or changed prop, column field, add-on option or default.
  *Enforced by:* review (.github/PULL_REQUEST_TEMPLATE.md)
- Accessibility is a gate, not a nicety: the header sort control is a real button, sort state is announced through aria-sort, and row changes reach a live region. A grid nobody can operate by keyboard is a broken grid.
  *Enforced by:* `tests/react/accessible-state.test.tsx` and `tests/react/gridwright.test.tsx`, run a second time against the MUI views by `packages/mui/tests/shared-suites.test.tsx`; keyboard walk-through in `.agents/workflows/verification.md`
- No AI slop in the rendered output: no decorative sparkles, no placeholder charts, no invented totals. When a paginating source sends no total, the grid says so rather than displaying a number it computed from one page.
  *Enforced by:* `tests/unit/engine-remote.test.ts` (totals); review for the rest

<!-- END GENERATED: ai-workflow-cycle -->

## 7. Rules and workflows

Binding detail lives beside the skills:

- `.agents/rules/` — architecture, api_surface, testing, review, spec_pipeline, styling,
  performance, security, agent_orchestration, agent_execution_standards
- `.agents/workflows/` — spec_driven_development, verification, branching, release, create_plugin,
  create_data_source

They elaborate `workflow.ai.yml` and may not contradict it. Where they do, the YAML wins and the
rule is a defect to fix.
