# Implementation Plan: `@apsw/gridwright-vue`

## Modules & Files

1. **Workspace & Build Configuration**
   - `packages/vue/package.json`: `@apsw/gridwright-vue` v0.1.0, `peerDependencies` on `@apsw/gridwright` and `vue`, `files: ["dist", "README.md", "LICENSE", "CHANGELOG.md"]`, ESM + CJS + `.d.ts` + `.d.cts` exports.
   - `packages/vue/tsup.config.ts`: mirrors `packages/mui/tsup.config.ts`, `external: ['@apsw/gridwright', '@apsw/gridwright/view', 'vue']`.
   - `packages/vue/tsconfig.build.json`: extends `../../tsconfig.json`, maps `@apsw/gridwright` and `@apsw/gridwright/view` to `../../dist/`.
   - Root `package.json`:
     - Add `vue` (`^3.5.0`) to `devDependencies` so Vitest and `tsc` can test and typecheck `packages/vue`.
     - Update `build` and `clean` scripts to include `@apsw/gridwright-vue` / `packages/vue/dist`.
   - Root `tsconfig.json`: add `"@apsw/gridwright-vue": ["./packages/vue/src/index.ts"]` to `paths`.
   - Root `vitest.config.ts` and `vitest.smoke.config.ts` (if applicable): add alias for `@apsw/gridwright-vue`.
   - `scripts/check-exports.mjs`: audit `packages/vue` alongside `packages/mui` (export targets, published files, type conditions, zero runtime dependencies, external grid imports).

2. **Vue Renderer (`packages/vue/src/render-node.ts`)**
   - Calls `sanitizeNode(node)` first (per `docs/adapters.md`).
   - Maps `ViewNode` kinds:
     - `text` -> string
     - `fragment` -> array of children
     - `slot` -> `options.slots?.[node.name]?.() ?? null`
     - `component` -> `options.components?.[node.id]?.(...) ?? null` (safe own-property lookup via `Object.hasOwn`)
     - `element` -> Vue `h(node.tag, props, children)`
   - Attribute & property normalization:
     - `className` -> `class`, `htmlFor` -> `for`, `tabIndex` -> `tabindex`, `colSpan` -> `colspan`, `rowSpan` -> `rowspan`, `readOnly` -> `readonly`.
     - `style` -> `styleValueText(value)` string.
     - `indeterminate` / `checked` / `value` / `selected`: passed as props/DOM properties in Vue `h()`.
     - `key`: passed as `key` AND attached via `ref` callback to `options.registerFocusKey(key, el)` so `takeFocusRequest()` can focus the exact element after redraw.
   - Event normalization (`on`):
     - Maps `click` -> `onClick`, `keydown` -> `onKeydown`, `keyup` -> `onKeyup`, `input` -> `onInput`, `change` -> `onChange`, `focus` -> `onFocus`, `blur` -> `onBlur`, `pointerdown` -> `onPointerdown`.
     - Builds `ViewEvent` via `viewEvent(...)` with lazy `origin` getter (using the same `CONTROL_SELECTOR` and `EXPIRED_ORIGIN` guard as `tests/helpers/dom-renderer.ts`).

3. **Composable (`packages/vue/src/use-gridwright.ts`)**
   - `useGridwright(options)`: instantiates `createGridHost(options)`, holds `shallowRef(host.getModel())`, subscribes to `host.subscribe(...)`, and cleans up with `onScopeDispose(() => host.destroy())`.

4. **Component (`packages/vue/src/gridwright.ts`)**
   - `<Gridwright>` component built with `defineComponent`:
     - Uses `createGridHost` and `shallowRef` for reactive `model`.
     - Tracks focus-keyed elements in a `Map<string, HTMLElement>` via `registerFocusKey`.
     - After render/update (`onMounted` + `onUpdated` or `watch` + `nextTick`), calls `host.takeFocusRequest()` and focuses the matching element if present.
     - Renders `TableModel` via `tableNode(model)` when no custom cell renderers/slots are active, or renders the table structure with `renderViewNode` while substituting custom `column.render` / `#cell-<id>` / `#cell` slot content for data cells (still keeping `cell.attrs` and `row.handlers`).
     - Supports `#toolbar` slot by passing a `slot('toolbar')` `ViewNode` to `createGridHost` when `slots.toolbar` is defined, and passing `slots` to `renderViewNode`.

5. **Tests (`packages/vue/tests/`)**
   - `packages/vue/tests/conformance.test.ts`: implements `ConformanceDriver` mounting `<Gridwright>` via `vue` (`createApp` + `h`), driven by `@testing-library/dom` + `@testing-library/user-event`, running `conformanceSuite` (all 17 scenarios, 0 skips).
   - `packages/vue/tests/vue-adapter.test.ts`: unit/integration tests for `useGridwright`, `renderViewNode` (sanitization, `slot`, `component`, `origin` expiry), custom `column.render`, `#cell` / `#cell-<id>` / `#toolbar` slots, and cleanup on unmount.

6. **Documentation**
   - `packages/vue/README.md`, `packages/vue/CHANGELOG.md`, `packages/vue/LICENSE`.
   - Update root `README.md`, `CHANGELOG.md`, `specs/DEPENDENCY_MAP.md`, `workflow.ai.yml` (if `packages/vue` is referenced), and `specs/vue-adapter/review.md`.
