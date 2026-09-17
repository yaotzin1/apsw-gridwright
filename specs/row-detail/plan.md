# Plan: expandable rows (row detail panels)

## Modules touched

| File | Change |
| :--- | :--- |
| `src/react/addons/types.ts` | `rowAfter` added to `AddonContribution`, documented with what an extra row is and is not |
| `src/react/parts/slots.tsx` | `rowsAfterOf(grid, row)`: every add-on's `rowAfter`, in order, through `callSlot`, keyed by add-on name. `columnCountOf` unchanged but now re-exported |
| `src/react/parts/GridBody.tsx` | `GridRowOrCustom` returns the row followed by `rowsAfterOf(...)`. `GridRowView` untouched |
| `src/react/parts/GridTable.tsx` | `onKeyDown` ignores an event whose closest `<table>` is not `event.currentTarget` |
| `src/react/detail/types.ts` | new: the options, the controller, the context, the props |
| `src/react/detail/messages.ts` | new: `ROW_DETAIL_ADDON`, `rowDetailMessages` |
| `src/react/detail/context.tsx` | new: `RowDetailProvider`, `useRowDetail`, `useOptionalRowDetail` |
| `src/react/detail/GridDetailToggle.tsx` | new: the button |
| `src/react/detail/GridRowDetail.tsx` | new: the presentational `<tr>` and the named region |
| `src/react/detail/addon.tsx` | new: `rowDetail()` — the set, the controller, the four contributions |
| `src/react/detail/index.ts` | new: the directory's public surface |
| `src/react/index.ts` | re-exports the above, plus `columnCountOf` |
| `src/locales/{en,pl,de,es,fr}.ts` | the six strings under `addons['gridwright:row-detail']` |
| `src/styles/styles.css` | `.gw-detail-row`, `.gw-detail-cell`, `.gw-detail-panel`, `.gw-detail-toggle` and their custom properties |
| `docs/addons.md` | `rowAfter` in the body table, and what an extra row may and may not claim to be |
| `docs/api.md` | the add-on, its options, the controller, the hooks |
| `docs/row-detail.md` | new: the feature, with the nested-grid example and its three traps |
| `docs/accessibility.md` | the disclosure pattern and the presentational-row decision |
| `README.md` | one line in the add-on list |
| `CHANGELOG.md` | Unreleased / Added, classified minor |
| `specs/DEPENDENCY_MAP.md` | `src/react/detail` in the feature add-on group |
| `examples/` | the playground gains a detail panel with a nested grid, per the repository's own rule that a feature is not done until it can be clicked |

## Where the behaviour lives

The four questions from `.agents/rules/architecture.md`:

1. **Does it change which rows exist, or their order?** No. The pipeline is untouched; no stage is
   added; `GridQuery` gains nothing.
2. **Does the engine need to know?** No. Nothing the engine computes depends on whether a panel is
   open, and nothing a second adapter would need is here — the content is a ReactNode, which the
   headless boundary forbids naming.
3. **Can a third-party add-on already do this?** No, and that is the finding that shapes the work:
   the missing piece is a contract slot, not a component. The slot is added publicly first, and the
   built-in is written against it with no privileges.
4. **Is any of it a core service?** No. The bar is state every renderer needs with nothing about it
   a choice; a detail panel is a rendering choice by definition.

So: **the adapter wins, entirely.** One new public slot on the add-on contract, one add-on that uses
it, one shell defect fixed along the way.

## The shell change, precisely

```tsx
// GridBody.tsx
export function GridRowOrCustom<TRow>(props: GridRowViewProps<TRow>) {
    const grid = useGridwrightContext<TRow>();
    const custom = customRowOf(grid, props.row);
    return (
        <>
            {custom === undefined ? <GridRowView {...props} /> : custom}
            {rowsAfterOf(grid, props.row)}
        </>
    );
}
```

`rowsAfterOf` mirrors `renderSlot` exactly — `callSlot` per add-on, `rendersSomething` to skip the
empties, a `Fragment` keyed by add-on name — so a throwing contributor costs its own row and
nothing else.

Both bodies call `GridRowOrCustom`, so both get it. `GridVirtualBody` gets it too, which is why
`rowDetail()` refuses to be listed beside `virtualRows()`: the seam works there, the arithmetic does
not.

## The nested-grid keyboard fix

```tsx
// GridTable.tsx, inside onKeyDown
const target = event.target as HTMLElement | null;
if (target?.closest('table') !== event.currentTarget) return;
```

A defect that exists today: a `tableKeyDown` add-on on an outer grid already receives keys from any
focusable content a consumer renders in a cell. The feature makes it reachable often enough to be
worth fixing, and the fix is three lines. It ships with this change and is called out in
CHANGELOG under Fixed.

## Trade-offs taken

| Trade-off | Cost accepted | Reason |
| :--- | :--- | :--- |
| The panel row is presentational | An element inside `role="grid"` that is neither a row nor a descendant of one | Keeps `aria-rowcount` and every `aria-rowindex` correct for the result set. The alternative is a count computed from one page, which the repository refuses everywhere. |
| `virtualRows()` is refused rather than approximated | A grid with 100,000 rows cannot have panels | A scrollbar that is wrong is worse than a feature that says no. A measured virtualizer is a separate spec. |
| No `loadDetail` | A consumer fetching per panel writes their own component | It is a component with a `useEffect`, which every React consumer can already write, and owning it would mean owning its cache, its errors and its abort. |
| `render` returning null still costs a render | One wasted render for a row whose emptiness is only discoverable by rendering | `hasDetail` is the cheap route and is documented as the one to prefer. |
| The panel is unmounted when collapsed | A nested grid re-fetches when reopened | Keeping 25 collapsed panels mounted makes a grid of 25 rows into 26 grids. Consumers who want the state kept lift it. |
| `columnCountOf` becomes public | One more name in the surface | Every add-on rendering a full-width row needs it, and each one recomputing it is how the number drifts from the status row's. |

## Risks

| Risk | Mitigation |
| :--- | :--- |
| `rowAfter` looks like a place to put anything, and someone renders a `<div>` in a `<tbody>` | The JSDoc says "one or more `<tr>` elements" and says why; `docs/addons.md` repeats it; the third-party add-on test contributes a `<tr>` |
| An add-on gives its extra row `role="row"` and breaks the numbering for the grid | Stated in the `rowAfter` JSDoc, in `docs/addons.md` and in `docs/accessibility.md`. It cannot be enforced — an add-on may set any role it likes — so it is documented at the point where someone would do it |
| The toggle and the tree chevron read as the same control | Different columns, different accessible names, one on a button and one on the row. Covered by a test that asserts both `aria-expanded` values independently |
| A panel throwing at mount empties the grid | `callSlot` catches the slot; a consumer's component failing after mount is their error boundary, which `docs/addons.md` already documents |
| The `single: true` path collapses a row the consumer expanded through the controller in the same tick | The controller is the only writer; `single` is applied inside it, not in the toggle |
| Expansion kept across a query change opens a panel on the wrong record for a source recycling ids | `persistAcrossPages: false`, documented against exactly that source |
| The panel's sticky positioning fights `columnLayout()`'s pinned columns | Known gap in review.md, with the reason the alternative (measuring the wrapper) is refused: `GridTable` keeps only the last `tableWrapper` ref and `virtualRows()` holds one |

## Out of scope for this change

- A measured virtualizer (its own spec, and the prerequisite for panels plus windowing).
- `specs/grouping-and-aggregation`'s subtotal row, which is the second consumer of `rowAfter` and
  will be written against the slot this change adds.
- Persisting the expanded set anywhere; `specs/view-state-sync` owns that.
- Detail content in exports or prints.
