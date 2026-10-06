# Plan: density

## Modules touched

| File | Change |
| :--- | :--- |
| `src/react/density/types.ts` | `DensityLevel`, `DensityOptions`, `DensityController` |
| `src/react/density/state.ts` | pure: resolve levels, initial level and row height; no React, no DOM |
| `src/react/density/context.tsx` | the controller context, `useDensity`, `useOptionalDensity`, and the hook that holds the level |
| `src/react/density/DensityControl.tsx` | the labelled native select |
| `src/react/density/messages.ts` | `DENSITY_ADDON`, English messages |
| `src/react/density/addon.tsx` | `density()`: wires the above into the contribution |
| `src/react/density/index.ts`, `src/react/index.ts` | exports |
| `src/react/addons/types.ts` | `AddonContribution.rowHeight`, `AddonSetupContext.rowHeight` |
| `src/react/useGridwright.ts` | pass the first published `rowHeight` of the earlier add-ons into the next one's `setup` |
| `src/react/virtual/addon.tsx` | read `context.rowHeight` before `options.rowHeight`; update the comment |
| `src/styles/styles.css` | four density tokens on `.gw-root`; the two attribute rules |
| `src/locales/{de,es,fr,pl}.ts` | `gridwright:density` |
| `tests/unit/density-state.test.ts` | the pure resolution rules, AC-03, AC-10 |
| `tests/react/density.test.tsx` | AC-01 to AC-08, AC-12 to AC-16 through the real control |
| `tests/smoke/tree-shaking.test.ts`, `tests/smoke/package.test.tsx`, `scripts/check-exports.mjs` | AC-18 and the export, imported from `dist/`; the expected export list |
| `docs/density.md`, `docs/api.md`, `docs/addons.md`, `docs/virtualization.md`, `docs/i18n.md`, `README.md`, `CHANGELOG.md` | the surface |
| `examples/` | a density switch in the playground and the remote example |
| `specs/DEPENDENCY_MAP.md` | the new module row |

## Where the behaviour lives

Not DOM or React in the core: nothing here touches `src/core`. It is not a pipeline stage and not a query
facet, because it changes how rows look and not which rows there are. It is an adapter add-on whose
decisions (resolve the levels, pick the initial level, choose the height) are plain functions in `state.ts`,
as `.agents/rules/architecture.md` section 8 asks, and whose component only renders a select.

The one thing the existing contract could not do is let `virtualRows()` learn a height from another add-on. The
seam added for it is general (a published number and a way to read it), mirrors `containerWidth`, and gives a
third-party windowed body the same reach, so no built-in has access a third party lacks.

## Design

1. `state.ts` resolves `levels`, the initial level and the height of a level from the options.
2. `density()`'s `setup` is a hook: it holds `level` in `useState`, builds the controller (`setLevel` checks
   the level is offered, skips an unchanged one and calls `onChange`), and returns
   `{ messages, before, rowHeight, provide, rootAttributes, toolbar }`.
3. `rootAttributes` returns `data-gw-density` and, when the level has a height, `style: { '--gw-row-height': 'Npx' }`.
   Both pass the existing attribute allowlist (`data-*` and `style`).
4. `useGridwright` keeps `published` while it loops over add-ons in order: after each `setup`, if the
   contribution has a `rowHeight` and `published` is still unset, it records it; each next `setup` receives it.
5. `virtualRows()` computes `rowHeight = context.rowHeight ?? options.rowHeight ?? 40`. The memoised scroll
   value already depends on `rowHeight`, so a change of level re-places the rows.
6. CSS: the padding tokens sit beside the existing ones; the attribute rules only reassign
   `--gw-cell-padding-y` and `--gw-cell-padding-x`.

## Trade-offs taken

- **Row height in JavaScript, padding in CSS.** Two homes for one idea, but the number virtualization needs is
  in JS anyway, and a single source keeps rows and scrollbar equal. Padding has no consumer in JS.
- **A published value rather than importing the density module from the virtual one.** It costs a small
  contract addition; it keeps the shell free of feature code (the tree-shaking test) and opens the same
  seam to everyone.
- **`comfortable` publishes nothing.** The cost is that "comfortable" does not set the height, so a consumer's
  own `--gw-row-height` still governs it. That is the point: adding the add-on changes nothing until a person
  chooses another level.
- **No persistence.** The consumer writes `onChange` and passes `initial`. Costs a few lines for the consumer;
  buys no storage in a package that also renders on a server.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| Rows drift from the scrollbar when a level changes under `virtualRows()` | The virtual value is memoised on `rowHeight`; a test scrolls to an index at every level |
| `style` from this add-on collides with another add-on's `rootAttributes.style` | `mergeAttributes` merges `style` objects already; a test lists `columnLayout()` beside it, which also sets custom properties on the root |
| A consumer's `--gw-row-height` is silently overridden at compact and spacious | Documented in `docs/density.md` and C-5; `rowHeights` is the supported route |
| Compact makes a coarse-pointer target too small | Controls keep `--gw-touch-target`; a test asserts the rule is still in the stylesheet |
| Hydration mismatch | The level comes from options only; a test renders to a string and compares |
| The select fights `responsive()`'s stacked toolbar | Both are toolbar items; the stacked sort control and this select are separate native controls and wrap with the toolbar |

## Out of scope for this change

Persistence, automatic density, per-column density, font size, the card layout's gap, variable-height virtual
rows, a MUI view.
