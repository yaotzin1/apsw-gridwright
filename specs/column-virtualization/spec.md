# Specification: column virtualization

> **Status**: Implemented (2026-10-12); verified in a browser and against the pure-Node gates, `npm run verify` pending (see review.md).
> **Stage entry**: 1
> **Semver impact**: minor (a new add-on, new core arithmetic, new optional fields on the add-on contract; no default changes; see api-surface.md)

---

## 1. The consumer problem

`virtualRows()` keeps the DOM small in one direction only. A grid with hundreds of columns still mounts
every column of every row in view: 500 columns × 30 visible rows is 15,000 cells, and every vertical
scroll frame re-renders them. Measured in Chromium at 500 × 10,000, a vertical scroll costs about 58 ms of
script and 12 ms of layout per frame, which is 5 frames a second (research.md).

A developer with wide data today has no way out short of hiding columns. A wide grid also cannot honour
the targets in `.agents/rules/performance.md` section 8, which say the cells in the DOM are bounded by the
viewport and never by the data.

## 2. User stories

- **US-01.** As a developer with hundreds of columns, I list one add-on and the grid mounts only the
  columns in view, so scrolling stays smooth.
- **US-02.** As a developer with many rows and many columns, I list `virtualRows()` and `virtualColumns()`
  together, and the DOM holds the rows in view times the columns in view.
- **US-03.** As a developer using `columnLayout()`, pinned columns stay put, and resizing and reordering
  keep working with the window.
- **US-04.** As a keyboard user, arrow keys, Home and End reach every column, including ones that were not
  mounted when I pressed the key, and the grid always has one Tab stop.
- **US-05.** As a screen reader user, I am told I am in column 240 of 500, not column 6 of 12.
- **US-06.** As an add-on author, I can render a row of my own (a summary row) that stays aligned with a
  windowed header, through the same public helpers the built-ins use.

## 3. Acceptance criteria

**Windowing**

- **AC-01.** `virtualColumns()` mounts the visible data columns that overlap the scroll container's
  viewport, plus `overscan` (default 2) on each side, plus every pinned column. Extra columns (another
  add-on's checkbox column) are always mounted.
- **AC-02.** Each run of unmounted columns is one empty cell (`.gw-column-gap`, `aria-hidden="true"`) whose
  width is the sum of theirs, in the header row and every body row, so the table's width equals the sum of
  every column's width wherever it is scrolled.
- **AC-03.** Every row that renders a cell per column (the default row, the header, the grouping summary
  row) renders the same cell positions as the header. Rows that span the table (`columnCountOf`) span
  exactly those positions.
- **AC-04.** Scrolling within a column renders nothing. A render happens only when the window's edges move.
- **AC-05.** Widths come from `columnLayout()` when it is listed. Without it, a column's width is its
  pixel `width` (or `minWidth` when larger), else `defaultWidth` (160); an extra column's is
  `extraColumnWidth` (48). The add-on then puts the table into fixed layout and sets each header width.
- **AC-06.** `virtualColumns()` is placed after `columnLayout()` whatever order they are listed in.
- **AC-07.** Composes with `virtualRows()`: both read the one scroll container. With both listed the DOM
  holds the rows in view times the columns in view.
- **AC-08.** While an add-on draws rows as cards (`cardLayout`), every column is mounted.

**Accessibility**

- **AC-09.** Under a column window the table carries `aria-colcount` (all extra and data columns) and every
  mounted header and body cell its true `aria-colindex`. A grid without a column window renders neither,
  and its markup is unchanged.
- **AC-10.** With `cellNavigation()`, a move to a column that is not mounted scrolls it into view and
  focuses it once mounted; Home and End reach the first and last of all columns.
- **AC-11.** With `cellNavigation()`, when the cursor's column is scrolled out of the DOM the first mounted
  column of the cursor's row is the Tab stop, so the grid always has exactly one.

**Contract**

- **AC-12.** The column window is a public add-on contribution (`columnWindow`) read through public helpers
  (`columnWindowOf`, `renderedColumnsOf`); an add-on of anyone's can publish one and it renders like the
  built-in one. Column widths and pins are published by `columnLayout()` as `columnGeometry` and read by
  later add-ons from `AddonSetupContext.columnGeometry`.
- **AC-13.** Every add-on that contributes a `tableWrapper` ref has it set; previously only the last was.

## 4. Non-goals

- **Measured column widths.** Placement is arithmetic over declared widths. A column whose content is
  wider than its width is clipped (the existing fixed-layout ellipsis), not measured.
- **Auto-fit over unmounted cells.** `columnLayout()`'s double-click auto-fit measures the cells that are
  mounted, as it already does for rows under `virtualRows()`.
- **Virtualizing extra columns.** They are few and usually pinned.
- **Column scaling.** Unlike rows, columns do not need a ratio scrollbar: at 160 px the browser height
  limit is about 100,000 columns.

## 5. Behaviour across the capability seam

Column windowing renders; it touches no query facet and no engine state.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | Windowed as described; data untouched |
| everything (server) | The same; the source is never asked about columns |
| pagination only | The same; with `virtualRows()` the row window still drives the page as before |

## 6. Accessibility and interface copy

No new control and no new string. `aria-colcount` and `aria-colindex` as AC-09; gap cells are
`aria-hidden`. Keyboard as AC-10 and AC-11. The focused cell is scrolled into view nearest-first and clear
of pinned columns (`scrollLeftForColumn`).

## 7. Delivery as a plugin

A React add-on, `virtualColumns()`, with no engine plugin: nothing about the rows changes. It contributes
`columnWindow`, `tableWrapper` (ref and `overflowX`), `provide` (the `useVirtualColumnScroll` context) and,
without `columnLayout()`, `tableAttributes` and the two header-attribute slots. Two seams are added to the
contract for everyone, because a built-in may use only public exports: `columnWindow` and
`columnGeometry`. The shell parts and the grouping summary row render through `renderedColumnsOf`.

The arithmetic (`columnOffsets`, `computeColumnWindow`, `scrollLeftForColumn`) is in the core, beside
`computeVirtualWindow`, and holds no DOM.

## 8. Clarifications

Resolved with the maintainer on 2026-10-12:

- **A separate add-on, not an option on `virtualRows()`.** Each axis is useful alone, and every feature is
  an add-on.
- **Columns without a width get a default (160 px), not an error.** Configurable with `defaultWidth`.
- **Default overscan 2.** Columns are wider than rows are tall, so fewer are needed beyond the edge;
  measured larger overscan costs more script per render than it saves (research.md).

## Artifacts not written

- `data-model.md`: no engine state or query shape changes; the new types are in api-surface.md.
- `events.md`: the feature emits no event and adds no pipeline stage.
