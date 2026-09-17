# Self-review: expandable rows (row detail panels)

Implemented in two steps: the contract seam (`rowAfter`, `columnCountOf`) first, then the
`rowDetail()` add-on on top of it using nothing but the public exports. See
[`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Adapter only. No file under `src/core`, `src/data`, `src/plugins`, `src/tree`, `src/i18n` or
`src/locales` changed except the four locale packs, which gained the add-on's strings. Nothing new
names a ReactNode outside `src/react`, and `ColumnDef` is untouched.

The Core and Data-sources sections of tasks.md are empty and stayed empty, which was the test of the
plan: expansion changes no query facet, produces no row, and nothing the pipeline computes depends on
it, so no engine plugin and no `GridState` field were needed. `rowDetail()` reaches the grid through
`configure`-free contributions — `rowAfter`, `columns`, `provide`, `messages` — every one of which a
third-party add-on has.

## 2. The local/remote seam

Untouched. The add-on never reads `capabilities`, never calls a data source, and never branches on
where rows came from. Expansion is keyed on `GridRow.id`, so a local array, a server that resolves
everything and a paginating source behave identically; `persistAcrossPages: false` exists for the one
real difference, a source whose ids are not stable across pages.

`expandAll()` covers the rows the grid is holding and reports nothing about pages that were never
fetched — the same rule as `isTotalExact`.

## 3. Public surface and semver

**Minor.** `rowAfter` is an optional field on an interface add-ons produce and the shell consumes, so
neither direction breaks; everything else is an addition. No default changed: a grid listing neither
`rowDetail()` nor any `rowAfter` contributor renders the markup it rendered before, with no wrapper
element and no array allocated per row.

One amendment to the stage-3 contract, recorded in api-surface.md under **Amendments during
implementation** rather than absorbed silently: `RowDetailProviderProps` gained an optional
`rowLabel`, because stage 3 never asked where the toggle's accessible name comes from and the
provider is the only place both the toggle and the panel can read it from.

`check-exports.mjs` now guards `rowDetail`, `columnCountOf` and `GridRowOrCustom` by name, so none of
them can fall out of the export map quietly.

## 4. Accessibility and i18n

The part that had to be right, and the reason the design looks the way it does.

- The toggle is a real `<button>` with `aria-expanded`, named after its row, `aria-controls` only
  while the panel is in the document, focus left where the reader put it.
- The panel is `role="presentation"` around a named `role="region"`. A test asserts `aria-rowcount`
  and every `aria-rowindex` are identical with a panel open and closed — the regression that would
  otherwise be invisible.
- Expansion is announced through `grid.announce`, because an announcement contributor is handed
  `GridState` and expansion is deliberately not in it.
- Six strings, all in `gridwright:row-detail`, translated in `de`, `es`, `fr` and `pl`, and covered
  by `auditAddonMessages` in `tests/unit/i18n.test.ts`. No literal is rendered from JSX.

## 5. Supply chain and packaging

No dependency, runtime or otherwise. The smoke suite expands a row through `dist/` and the export
map, and `tree-shaking.test.ts` asserts two things: a grid that does not list `rowDetail()` does not
carry it, and `rowDetail()` naming `VIRTUAL_ADDON` in order to refuse it does not drag the windowed
body in behind it.

## 6. Honest output

- The panel is not counted as a row, because counting it would make `aria-rowcount` a number derived
  from the one page that is mounted.
- `expandAll()` has no companion "everything is expanded" flag.
- Windowing is refused by name rather than approximated with a `detailHeight` option that would lie
  in pixels.
- A `render` that returns nothing renders no row, rather than an empty full-width strip that reads
  as a bug in the consumer's code.

## 7. Verification

```
✨ All 16 skills validated successfully! (0 Security Threats / 0 Syntax Errors)
security audit: no findings (source, manifest)
 Test Files  38 passed (38)
      Tests  666 passed (666)
 Test Files  2 passed (2)
      Tests  27 passed (27)
  ok   react ESM entry exports 46 expected names
  ok   react ESM entry no longer exports TreeGridwright, useTreeGridwright
  ok   both entries share one module instance
the published package resolves cleanly.
security audit: no findings (source, manifest, dist)
```

**Two defects the gates did not catch, and what did.**

1. **A stale controller.** `controllerRef` fires once by design, but the controller was rebuilt on
   every expansion, so a consumer holding it read the set as it was at mount. Caught by the test that
   asserts `controller.expanded` after `expandAll()`. Fixed by giving the controller a stable
   identity over refs, which is what events.md said it had.
2. **A tree node where the type promised a row.** `hasDetail` was handed the engine's row, whose
   `data` is a `TreeNode` under `treeData()`, so `row.data.kind` was silently `undefined` and every
   team in the playground got a toggle that `hasDetail` was written to refuse. **Found by clicking
   the playground in Chrome, not by any test.** Fixed by unwrapping before the callback, which makes
   the declared `GridRow<TRow>` true rather than nearly true, and covered by a regression test.

**Playground.** The `row detail` and `one panel at a time` switches were turned on and off again in
Chrome, over the flat grid and the tree, with a nested `<Gridwright />` inside each panel. No console
errors.

## Known gaps

- **The panel row is presentational inside `role="grid"`.** An element that is neither a row nor a
  presentational descendant of one sits in the table. Taken in exchange for `aria-rowcount` and every
  `aria-rowindex` staying correct for the result set rather than being computed from one page.
  Revisit if assistive technology gains a way to express "between two rows, and not one".
- **No windowing.** `rowDetail()` and `virtualRows()` refuse each other with a named error. The
  condition that would justify supporting both is a measured virtualizer, which is a separate spec.
- **Pinned columns paint over the panel.** The panel's region is `position: sticky; inset-inline-start: 0`
  so its content stays at the reader's edge, but a column pinned by `columnLayout()` is sticky too and
  overlays it while the table is scrolled horizontally. Fixing it properly needs the table wrapper's
  width, and `GridTable` keeps only the last `tableWrapper` ref it is handed — which `virtualRows()`
  already holds.
- **Panels are not exported or printed.** `buildExportTable` works from columns and rows; a panel is a
  ReactNode with no cells. Documented rather than attempted.
- **`render` returning null still costs a render.** `hasDetail` is the cheap route and the docs say
  to prefer it.
