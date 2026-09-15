# Specification: 2D cell navigation and clipboard copy

> **Status**: Draft (corrected 2026-09-14 against the code and `specs/addon-architecture`)
> **Stage entry**: 1 & 2
> **Semver impact**: minor (a new `cellNavigation()` add-on; nothing on `<Gridwright />`; to be
> confirmed in api-surface.md)

---

## 1. The consumer problem

Standard HTML tables require pressing `Tab` repeatedly to move between interactive elements. In a grid
with 100 rows and 10 columns, keyboard users must press `Tab` hundreds of times to traverse the data.
1. **Missing 2D WAI-ARIA Navigation**:
   - The W3C WAI-ARIA Grid Design Pattern requires a single `Tab` stop to enter the table, followed by
     two-dimensional navigation using Arrow keys (`Up`, `Down`, `Left`, `Right`) via a roving `tabindex`.
   - Power users, keyboard-only operators, and screen reader users expect spreadsheet-style cursor
     movement across cells.
2. **Missing Clipboard Integration (`Ctrl + C`)**:
   - Analysts routinely select rows or cells and expect `Ctrl + C` (or `Cmd + C`) to copy the tabular data
     to the clipboard as tab-separated values (TSV) and HTML, allowing instant pasting into Microsoft Excel,
     Google Sheets, Notion, or text editors.
   - Without grid clipboard support, selecting text with the mouse copies misaligned fragments,
     column headers are lost, and offscreen rows under `virtualRows()` cannot be captured.

A first-class navigation and clipboard add-on will implement WAI-ARIA 2D roving tabindex cell focus
and multi-format clipboard copying (`text/plain` TSV and `text/html`), in the paged and the windowed
body alike.

```mermaid
flowchart LR
    subgraph Keys["Keyboard Interaction (tableKeyDown slot)"]
        Arrows["Arrow Keys (Up/Down/Left/Right)"]
        HomeEnd["Home / End / Ctrl+Home / Ctrl+End"]
        CopyKey["Ctrl + C / Cmd + C"]
    end

    subgraph Navigation["2D Roving Tabindex (cellAttributes slot)"]
        FocusCell["Focused cell state (row id, column id)"]
        Tabindex["tabIndex 0 on the active cell, -1 on others"]
        Scroll["useVirtualScroll().scrollToIndex under virtualRows()"]
    end

    subgraph Clipboard["Clipboard Handler"]
        TSV["formatCsv(table, { delimiter: tab }) (text/plain)"]
        HTML["escaped HTML table (text/html)"]
        ClipAPI["navigator.clipboard.write()"]
    end

    Arrows & HomeEnd --> FocusCell
    FocusCell --> Tabindex & Scroll
    CopyKey --> TSV & HTML --> ClipAPI
```

---

## 2. User stories

- **US-01.** As a keyboard user, pressing `Tab` enters the grid on the last-focused cell, and `Arrow` keys
  move focus cell by cell (Up, Down, Left, Right).
- **US-02.** As a keyboard user, pressing `Home` jumps to the first cell of the current row, and `End`
  jumps to the last cell.
- **US-03.** As a keyboard user, pressing `Ctrl + Home` jumps to the top-left cell (row 1, col 1), and
  `Ctrl + End` jumps to the bottom-right cell.
- **US-04.** As an end user on a windowed grid (`virtualRows()`), navigating past the visible edge
  scrolls the container to keep the focused cell in view.
- **US-05.** As an end user, pressing `Ctrl + C` on a focused cell copies that cell's formatted value to
  the clipboard.
- **US-06.** As an end user with rows selected, pressing `Ctrl + C` copies all selected loaded rows
  (including column headers) as TSV and HTML table to the clipboard.
- **US-07.** As a person using a screen reader, navigating to a cell announces its column header, row number,
  and formatted text value.

---

## 3. Acceptance criteria

- [ ] **AC-01** Roving `tabindex`: exactly one data cell holds `tabIndex={0}` at any time; all other data
      cells hold `tabIndex={-1}`, contributed through `cellAttributes`.
- [ ] **AC-02** 2D Arrow navigation, handled in `tableKeyDown`:
      - `ArrowUp` / `ArrowDown`: moves focus between rows within the same column.
      - `ArrowLeft` / `ArrowRight`: moves focus between columns within the same row, in reading
        direction (reversed under `dir="rtl"`).
- [ ] **AC-03** Jump keys:
      - `Home` / `End`: first / last column in the current row.
      - `PageUp` / `PageDown`: by one page of rows (the page size, or the visible window under
        `virtualRows()`); on a paged grid, crossing the page edge calls `api.nextPage()` /
        `api.previousPage()` and keeps the column.
      - `Ctrl + Home` / `Ctrl + End`: first cell of the first row / last cell of the last row of the
        result set, moving pages or scrolling as needed.
- [ ] **AC-04** Focused cell styling: the active cell receives `gw-cell--focused` through
      `cellAttributes`, with an accessible focus ring (`outline: var(--gw-focus-ring)`).
- [ ] **AC-05** Windowed alignment: under `virtualRows()`, navigating to a row outside the mounted window
      calls `useVirtualScroll().scrollToIndex(index)` and focuses the cell once it is rendered. Without
      `virtualRows()`, `useVirtualScroll()` is `null` and nothing scrolls programmatically.
- [ ] **AC-06** Clipboard copy (`Ctrl + C` / `Cmd + C`):
      - If loaded rows are selected: copies them as TSV and as an HTML table, built from
        `buildExportTable` so cell text matches every export.
      - If no rows are selected: copies the active cell's formatted text.
      - Uses `navigator.clipboard.write()`; where it is unavailable or refused, the copy fails with an
        announcement rather than silently.
      - Every cell is escaped in the HTML flavour; nothing from data becomes markup.
- [ ] **AC-07** Live region: a copy is announced through `grid.announce`: "Copied 5 rows to clipboard" /
      "Copied cell value to clipboard" / "Could not copy to the clipboard".
- [ ] **AC-08** Interactive child protection: when focus is inside a form control or editor (e.g. an
      inline edit `<input>`), `tableKeyDown` returns `false` for arrow keys, so the control keeps them;
      `Escape` returns focus to the cell. Add-ons listed before `cellNavigation()` see keys first.
- [ ] **AC-09** Every string is in the `gridwright:cell-navigation` add-on's messages, in five languages.
- [ ] **AC-10** Zero runtime dependencies: React keydown handlers and standard clipboard Web APIs.

---

## 4. Non-goals

- **Clipboard paste-to-edit across multiple cells.** Pasting spreadsheet blocks to edit dozens of cells
  at once requires bulk validation and rollback, which is a dedicated editing capability.
- **Navigating into extra columns contributed by other add-ons** (the selection checkbox column). Those
  cells hold their own focusable control and stay in the Tab order; see clarification C-1.
- **A `cellNavigation` prop on `<Gridwright />`.**

---

## 5. Behaviour across the capability seam

An adapter and presentation capability:
- Operates identically across local arrays and remote endpoints; copying selected rows copies the
  selected rows that are loaded, the same honest limit as `getSelectedRows()`.
- Tree grids: `ArrowLeft` on an expanded node collapses it and `ArrowRight` on a collapsed node expands
  it, through the public tree context (`useOptionalTreeContext()`), when `treeData()` is listed.
- Windowed bodies: AC-05.

---

## 6. Accessibility and interface copy

- **Cell markup** (the shell renders the `<td>`; the add-on contributes attributes):
  `<td tabindex="0" class="gw-cell gw-cell--focused">`
- **Messages** under `gridwright:cell-navigation`:
  - `copiedRows`: "Copied {count} rows to clipboard" (plural)
  - `copiedCell`: "Copied cell value to clipboard"
  - `copyFailed`: "Could not copy to the clipboard"

---

## 7. Delivery as a plugin

**Engine.** None. Focus position is view state. Row data for copying comes from public
`GridApi.getSelectedRows()` and `state.rows`, resolved with the core `buildExportTable` and `formatCsv`.

**React add-on.** `cellNavigation(options)`, named `gridwright:cell-navigation`. Not in `coreAddons()`.

| Slot | Use |
| :--- | :--- |
| `setup` (hooks) | the active cell (row id and column id), kept valid when rows or columns change |
| `cellAttributes` | `tabIndex`, `gw-cell--focused`, `onFocus` to follow pointer focus |
| `tableKeyDown` | arrows, jump keys, `Ctrl + C`; returns `true` only for keys it handled |
| `provide` | a context exposing the active cell to other add-ons (e.g. `selection()` handling `Space`) |
| `announce` / `grid.announce` | copy results |
| `messages` | the strings in §6 |

Scrolling reuses `virtualRows()`'s public `useVirtualScroll()`; tree expansion reuses `treeData()`'s
public context. Neither is a dependency: both are optional and detected at render.

**What cannot be an add-on.** Nothing, with one note. Extra columns are reachable through
`extraCellAttributes`, so whether they join the roving model is a design choice (C-1), not a gap. Focus must move to a DOM node after a render,
which the add-on does from a component it renders (not from a slot function, which may not use hooks).

---

## 8. Clarifications

- **C-1. Extra columns.** The contract can reach them (`extraCellAttributes`). Open for stage 3 only as a
  design choice: include them in arrow navigation, or leave their own control in the Tab order.
- **Why roving tabindex rather than `aria-activedescendant`?** Screen readers announce the real focused
  cell's header associations and content natively, without synthetic focus management.
- **Where does a copy failure go?** Through the grid's live region and the add-on's `onError` option;
  there is no separate notification channel.
