# Dependency map

How the modules depend on each other, and what breaks what. Updated at stage 8 of every feature.

## Import direction

```
                     ┌──────────────────────────────────────────┐
                     │  src/react/          (adapter)           │
                     │  Gridwright, useGridwright, parts        │
                     └───────────────┬──────────────────────────┘
                                     │ imports
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────▼────────┐          ┌────────▼────────┐          ┌────────▼────────┐
│  src/data/     │          │  src/plugins/   │          │  src/core/      │
│  local, remote │─────────▶│  filter, search │─────────▶│  engine, types  │
│  rest          │  types   │  sort, paginate │  types   │  pipeline, query│
└────────────────┘          └─────────────────┘          │  values, columns│
                                     ▲                   │  errors, emitter│
                                     └───────────────────┤                 │
                                       default plugins   └─────────────────┘
```

Imports point one way, upward into `src/core`. The single arrow back is `engine.ts` importing
`corePlugins` for its default plugin set; the plugins depend only on core types, so there is no
cycle at the type level.

## Module responsibilities and blast radius

| Module | Depends on | Changing it affects |
| :--- | :--- | :--- |
| `core/types.ts` | nothing | **everything**, and the published type surface. Every change here is a semver event. |
| `core/values.ts` | `types` | sorting order, filter semantics, search matching, default cell text |
| `core/columns.ts` | `types`, `values` | every consumer of a resolved column: engine, stages, adapter |
| `core/query.ts` | `types` | when a refetch happens, and when the page resets |
| `core/errors.ts` | `types` | what a failed grid displays, and what gets retried |
| `core/emitter.ts` | `types` | every listener and plugin |
| `i18n/messages.ts` | nothing | the translation contract. A key change is a semver event for every catalog, including third-party ones. |
| `i18n/translator.ts` | `i18n/messages` | every rendered string, plural selection, number formatting, direction |
| `locales/*` | `i18n/messages` | the bundled translations only |
| `core/pipeline.ts` | `types` | stage ordering and the capability skip rule |
| `core/engine.ts` | all of core, `plugins` | the whole runtime |
| `data/local.ts` | core types | array-backed grids |
| `data/remote.ts` | core types, `errors` | every async source, including `rest` |
| `data/rest.ts` | `data/remote`, `errors` | REST-backed grids and the wire format |
| `plugins/*` | core types, `pipeline`, `values`, `columns` | what the pipeline does in memory |
| `react/useGridwright.ts` | `core/engine`, `data/local` | every React grid |
| `react/context.tsx` | `react/types`, `labels`, `i18n/translator` | every part |
| `react/labels.ts` | `i18n/translator` | what every part renders as text |
| `react/parts/*` | context, core types | rendering and interaction |
| `react/Gridwright.tsx` | hook, context, parts | the assembled component |
| `styles/styles.css` | nothing | every consumer who imported it, including their overrides |

## The contracts that cross module boundaries

| Contract | Defined in | Implemented by | Consumed by |
| :--- | :--- | :--- | :--- |
| `DataSource` | `core/types.ts` | `data/*`, consumer sources | `core/engine.ts` |
| `DataSourceCapabilities` | `core/types.ts` | every data source | `core/pipeline.ts` |
| `PipelineStage` | `core/types.ts` | `plugins/*`, consumer plugins | `core/pipeline.ts` |
| `GridPlugin` | `core/types.ts` | `plugins/*`, consumer plugins | `core/engine.ts` |
| `GridState` | `core/types.ts` | `core/engine.ts` | `react/*`, consumers |
| `GridEventMap` | `core/types.ts` | `core/emitter.ts` | plugins, `react/useGridwright.ts` |
| `ResolvedColumn` | `core/types.ts` | `core/columns.ts` | stages, adapter |
| `MessageCatalog` | `i18n/messages.ts` | `locales/*`, consumer catalogs | `i18n/translator.ts` |
| `TranslateFn` | `i18n/translator.ts` | an external i18n library | `i18n/translator.ts` |

A change to any row of that table is a change to the public API, because every one of them is
implementable by a consumer.

## Build graph

| Entry | Bundles | External |
| :--- | :--- | :--- |
| `dist/index.js` / `.cjs` | `src/index.ts` and everything under core, data, plugins, i18n | — |
| `dist/react/index.js` / `.cjs` | `src/react/index.ts` | `react`, `react-dom`, `react/jsx-runtime` |
| `dist/locales/index.js` / `.cjs` | the translation packs | — |
| shared chunk | the core, imported by every entry | — |

The locales are a separate entry so a consumer pays only for the packs they import. Folding them
into the core entry would put five translations in every bundle that uses the grid in English.

The shared chunk is load-bearing. Without `splitting: true` each entry carries its own copy of the
engine, and `GridwrightError` becomes two classes: `instanceof` then fails for anyone who imports
it from one path and catches it from the other, while every test still passes.
`scripts/check-exports.mjs` compares module identity across the entries specifically to catch that.

## External dependencies

**Runtime: none.** `dependencies` is empty and the packaging audit fails the build if it is not.

**Peer, optional:** `react` and `react-dom`, `^18 || ^19`, needed only for `apsw-gridwright/react`.

**Development:** TypeScript, tsup, Vitest, Testing Library, ESLint, jsdom. None reaches the
published tarball.

## Repository tooling

| Script | Reads | Writes | Enforced by |
| :--- | :--- | :--- | :--- |
| `validate-skills.mjs` | `.agents/skills/**` | — | pre-commit, CI |
| `sync-claude-skills.mjs` | `.agents/skills/**`, `workflow.ai.yml` | `.claude/skills/**` | pre-commit, CI |
| `sync-agent-docs.mjs` | `workflow.ai.yml` | `AGENTS.md` block, `GEMINI.md` | pre-commit, CI |
| `install-hooks.mjs` | `.githooks/` | git config | run once per clone |
| `check-exports.mjs` | `package.json`, `dist/**` | — | `npm run verify`, CI |
| `serve-example.mjs` | `dist/**`, `examples/**` | — | run by hand: `npm run example` |

`workflow.ai.yml` is upstream of `AGENTS.md`, `GEMINI.md` and `.claude/skills/`. Editing any of
those three directly is a defect: the next sync overwrites it, and CI fails first.
