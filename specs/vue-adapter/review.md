# Self-review: Vue 3 adapter (`@apsw/gridwright-vue`) and `@apsw` workspace migration

## 1. Boundary and layering

`packages/vue` (`@apsw/gridwright-vue`) sits beside `packages/mui` (`@apsw/gridwright-mui`) and imports only public exports (`@apsw/gridwright`, `@apsw/gridwright/view`, and `vue`). Nothing under `src/` imports `vue` or `@apsw/gridwright-vue`; the ESLint headless ban remains intact.

## 2. The local/remote seam

Not touched. `<Gridwright>` and `useGridwright` delegate to `createGridHost` from `@apsw/gridwright/view`, so local arrays and remote data sources travel the same pipeline.

## 3. Public surface and semver

- Workspace packages renamed to `@apsw/gridwright`, `@apsw/gridwright-mui`, and `@apsw/gridwright-vue`.
- `@apsw/gridwright-vue` (`0.1.0`) exports `Gridwright`, `useGridwright`, `renderViewNode`, `GridwrightColumn`, `GridwrightProps`, `GridwrightSlots`, `CellRenderContext`, `RenderViewNodeOptions`, `VueComponentRenderer`, `UseGridwrightOptions`, `UseGridwrightReturn`, and re-exports `sorting`, `selection`, `pagination`, `defineAddon` and their option/label types from `@apsw/gridwright/view`.

## 4. Accessibility and i18n

All ARIA attributes (`aria-sort`, `aria-selected`, `aria-rowcount`, `aria-rowindex`, `aria-busy`), keyboard interactions, focus restoration (`host.takeFocusRequest()`), and live-region announcements (`model.live`) come from `@apsw/gridwright/view` and are verified by all 17 scenarios in `conformanceSuite` (`packages/vue/tests/conformance.test.ts`) with zero skips.

## 5. Supply chain and packaging

- Zero runtime `dependencies` in `@apsw/gridwright`, `@apsw/gridwright-mui`, and `@apsw/gridwright-vue`.
- `vue` (`^3.5.0`) added to root `devDependencies` for testing/typechecking; `packages/vue` declares `vue: "^3.4.0 || ^3.5.0"` and `@apsw/gridwright: "^0.24.0"` as `peerDependencies`.
- `scripts/check-exports.mjs` audits `packages/vue` alongside `packages/mui` for export targets, `.d.ts`/`.d.cts` type conditions, published files, zero runtime dependencies, and external imports.

### Review of 0.1.1 (2026-11-14)

- The core peer was optional although the adapter imports `@apsw/gridwright/view` at runtime: fixed (AC-09).
- `<Gridwright>` rebuilt its host whenever any prop changed by identity, so an inline `:columns` or `:data` reset sort, selection and page on every parent render: fixed (AC-10), with tests that fail against the old code.
- `useGridwright` warned outside a scope: fixed (AC-11).
- Checked and not a defect: the custom-cell table path does not call `sanitizeAttrs`, but add-on attributes are already filtered by `mergeAttributes`/`isContributable` when the model is built. A regression test pins it.
- Known limitation: the `#toolbar` slot is read when the host is built, so a slot that appears later is picked up on the next rebuild only.

## 6. Honest output

Unchanged. Totals, `"of many"`, and status rows come directly from `@apsw/gridwright/view`.

## 7. Verification

Verified via `npm run verify` (see session output).
