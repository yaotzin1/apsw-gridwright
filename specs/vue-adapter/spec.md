# Specification: Vue 3 adapter (`@apsw/gridwright-vue`)

> **Status**: Stages 1 to 5 written 2026-11-13. Approved by maintainer ("Start building", `packages/vue` workspace package, core `<Gridwright>` + `useGridwright` + custom cell slots/renderers + neutral sorting/selection/pagination).
> **Stage entry**: 1
> **Track**: feature
> **Semver impact**: `@apsw/gridwright` none (consumes existing `@apsw/gridwright`, `@apsw/gridwright/view`, `@apsw/gridwright/conformance`); new package `@apsw/gridwright-vue` (`0.1.0`). Confirmed in `api-surface.md`.

---

## 1. The consumer problem

`@apsw/gridwright` provides a headless engine and a framework-neutral view layer (`@apsw/gridwright/view`), plus a conformance kit (`@apsw/gridwright/conformance`), but only ships a React renderer (`@apsw/gridwright/react`). A Vue 3 developer who wants to use `@apsw/gridwright` today must hand-write a `ViewNode` renderer, store subscription, `ViewEvent` + `origin` bridge, focus restoration, and live-region wiring.

## 2. User stories

- **US-01.** As a Vue 3 developer, I install `@apsw/gridwright` and `@apsw/gridwright-vue`, render `<Gridwright :columns="columns" :data="rows" />`, and get the same accessible, sortable, selectable, paginated data grid as React consumers.
- **US-02.** As a Vue 3 developer, I use `useGridwright` when I want direct access to the `GridHost`, reactive `TableModel`, and `GridApi` to compose custom layouts or drive programmatic actions.
- **US-03.** As a Vue 3 developer, I customize cell rendering using either a column `render` function or Vue scoped slots (`#cell`, `#cell-<columnId>`, `#toolbar`), without losing keyboard navigation, `aria-*` attributes, or sorting/selection/pagination behaviour.
- **US-04.** As a Vue 3 developer, I pass any neutral `ViewAddon` (including `sorting()`, `selection()`, `pagination()`, or a third-party `defineAddon(...)`) and it works identically to React.
- **US-05.** As the maintainer, I run `conformanceSuite` from `@apsw/gridwright/conformance` against the Vue adapter and verify all 17 scenarios pass with zero skips.

## 3. Acceptance criteria

- [x] **AC-01** New workspace package `packages/vue` (`@apsw/gridwright-vue`) with zero runtime `dependencies` and `peerDependencies` on `@apsw/gridwright` and `vue` (`^3.4.0 || ^3.5.0`).
- [x] **AC-02** `renderViewNode(node, options?)` renders any `ViewNode` (`element`, `text`, `fragment`, `slot`, `component`) into Vue `VNodeChild` after passing the node through `sanitizeNode` from `@apsw/gridwright/view`.
- [x] **AC-03** `ViewEvent` handlers are wired with `viewEvent(...)`, including lazy `origin` evaluation during native event dispatch (`fromControl`, `fromNestedGrid`, `textSelected`, `cell`) and `EXPIRED_ORIGIN` after dispatch.
- [x] **AC-04** `useGridwright(options)` creates and manages a `GridHost`, subscribes to model updates via Vue reactivity (`shallowRef`), exposes `model`, `api`, `host`, and `takeFocusRequest`, and calls `host.destroy()` on unmount.
- [x] **AC-05** `<Gridwright>` component renders the grid from `TableModel` / `tableNode`, includes the visually hidden `aria-live="polite"` status region, restores focus via `host.takeFocusRequest()` after DOM commit (`nextTick`), and supports custom cell rendering via `GridwrightColumn.render` and `#cell` / `#cell-<id>` / `#toolbar` slots.
- [x] **AC-06** Re-exports `sorting`, `selection`, `pagination`, and `defineAddon` (and related types) from `@apsw/gridwright/view` for ergonomic Vue imports, or works seamlessly with `@apsw/gridwright/view`.
- [x] **AC-07** Passes all 17 scenarios of `conformanceSuite` from `@apsw/gridwright/conformance` with zero skips using a Vue conformance driver.
- [x] **AC-08** `npm run verify` passes end-to-end, including dual ESM/CJS builds, `.d.ts` / `.d.cts` type generation, `check:exports`, and `security:audit`.

## 4. Non-goals

- **No Vue wrappers for unmigrated React-only feature add-ons** (filters, grouping, tree, virtualization, row detail, export, pinning, etc.). Those await their own neutral-addon migration specs.
- **No SFC (`.vue`) compiler requirement in the library build.** The package is written in TypeScript using Vue's `h()` render function so `tsup` and `vitest` require no `@vitejs/plugin-vue` dependency.
- **No changes to `@apsw/gridwright` core, pipeline, or React adapter.**
- **No new runtime dependencies.** `vue` is a peer dependency (and root `devDependency` for testing).

## 5. Behaviour across the capability seam

Unchanged. `@apsw/gridwright-vue` delegates all query, sorting, pagination, and selection logic to `createGridHost` (`@apsw/gridwright/view`) and the engine (`@apsw/gridwright`).

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | Engine pipeline resolves sorting, pagination, and selection locally. |
| everything (server) | Data source resolves query facets; view layer renders returned rows and exact/inexact totals (`"of many"`). |
| pagination only | Data source paginates; pipeline applies sorting/selection over the current page or as declared by capabilities. |

## 6. Accessibility and interface copy

All ARIA roles, `aria-sort`, `aria-rowcount`, `aria-rowindex`, `aria-selected`, `aria-busy`, focus restoration (`takeFocusRequest`), and live-region sentences (`model.live`) are produced by `@apsw/gridwright/view`. The Vue adapter renders them faithfully and adds no hardcoded English strings.

## 7. Delivery as a plugin

Not an engine plugin. Delivered as a workspace adapter package (`packages/vue`, `@apsw/gridwright-vue`) that renders `@apsw/gridwright/view` nodes and models using Vue 3.

## 8. Clarifications

- **C-1. Packaging.** Lives in `packages/vue` (`@apsw/gridwright-vue`), mirroring `packages/mui` (`@apsw/gridwright-mui`), with its own `package.json`, `tsup.config.ts`, `tsconfig.build.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, and `tests/`.
- **C-2. Scope.** Ships `<Gridwright>`, `useGridwright`, `renderViewNode`, `GridwrightColumn` (supporting `render`), and scoped slots (`#cell`, `#cell-<id>`, `#toolbar`), passing all 17 conformance scenarios.
- **C-3. DOM properties vs attributes.** Vue's `h()` handles `class`, `for`, `tabindex`, `colspan`, `rowspan`, `readonly`, and boolean/property bindings (`value`, `checked`, `indeterminate`, `selected`) via explicit normalization in `renderViewNode` so checkbox `indeterminate` and `<select>` `value` work reliably in both browsers and jsdom.

## Artifacts not written

- `data-model.md`: engine and view-layer state shapes are unchanged; Vue adapter props and return types are specified in `api-surface.md`.
- `events.md`: no engine events or pipeline stages are added; native DOM events are mapped to `ViewEvent` as specified in `specs/adapter-architecture/api-surface.md`.
- `research.md`: the framework-neutral view layer and plain-DOM reference renderer (`tests/helpers/dom-renderer.ts`) were already researched and proven in `specs/adapter-architecture/`.
