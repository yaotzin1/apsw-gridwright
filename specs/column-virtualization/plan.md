# Plan: column virtualization

## Modules touched

| Module | Change |
| :--- | :--- |
| `src/core/virtual-columns.ts` (new) | `columnOffsets`, `computeColumnWindow` (binary search), `scrollLeftForColumn` (nearest, clear of pinned insets). No DOM. |
| `src/index.ts` | Exports the three functions and their types. |
| `src/react/addons/types.ts` | `ColumnGeometry`, `ColumnWindowEntry`, `ColumnWindowPlan`; `columnGeometry` and `columnWindow` on `AddonContribution`; `columnGeometry` on `AddonSetupContext`. |
| `src/react/useGridwright.ts` | Passes the first published `columnGeometry` to later add-ons' `setup`, like `rowHeight`. |
| `src/react/parts/slots.tsx` | `columnWindowOf` (first publisher wins; null under card layout), `renderedColumnsOf` (shared per plan or per column set), `columnCountOf` counts rendered positions. |
| `src/react/parts/GridColumnGap.tsx` (new) | The gap cell. |
| `src/react/parts/GridHeader.tsx`, `GridBody.tsx` | Render through `renderedColumnsOf`; `aria-colindex` when windowed; `GridCell` takes `ariaColIndex`. |
| `src/react/parts/GridTable.tsx` | Sets every contributed wrapper ref; `aria-colcount` when windowed. |
| `src/react/grouping/SummaryRow.tsx` | Renders through `renderedColumnsOf`. |
| `src/react/layout/addon.tsx` | Publishes `columnGeometry`. |
| `src/react/virtual/columns.tsx` (new) | The add-on and `useVirtualColumnScroll`. |
| `src/react/navigation/addon.tsx` | Reveals a column on a move; tab-stop fallback for an unmounted column; per-render cache of ids and cursor. |
| `src/styles/styles.css` | `.gw-column-gap`; `contain: inline-size` for fixed-layout header content. |

## Seams and trade-offs

- **One render per column crossed.** The window is grid-wide state, so a horizontal move re-renders the
  host. Measured at 2–3 ms of script per frame at fling speed; the alternative (a separate store per row)
  adds a subscription per row for no measured gain.
- **Fixed table layout is required.** Without `columnLayout()` the add-on applies it and sets header
  widths. With it, the layout's widths are used and the add-on sets none, so its live resize (a custom
  property written during the drag) is not fought.
- **Navigation reads the window through public helpers,** not through the add-on: `columnWindowOf` for the
  tab stop and `useVirtualColumnScroll` (from its existing bridge component) to reveal a column.
