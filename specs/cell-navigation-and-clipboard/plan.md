# Plan: 2D cell navigation and clipboard copy

## 1. Modules touched

| File | Change |
| :--- | :--- |
| `src/react/navigation/addon.tsx` | New. `cellNavigation()`: `setup`, `cellAttributes`, `tableKeyDown`, `provide` |
| `src/react/navigation/useCellNavigation.ts` | New. Active cell state (row id, column id), movement across pages and windows |
| `src/react/navigation/clipboard.ts` | New. Builds TSV with `buildExportTable` + `formatCsv`, and an escaped HTML table; writes with `navigator.clipboard.write()` |
| `src/react/navigation/messages.ts` | New. `gridwright:cell-navigation` messages |
| `src/react/navigation/index.ts`, `src/react/index.ts` | Exports |
| `src/locales/{de,es,fr,pl}.ts` | `addons['gridwright:cell-navigation']` |
| `src/styles/styles.css` | Focus ring for `.gw-cell--focused` |

Not touched: `src/react/Gridwright.tsx` (no prop), `src/react/parts/GridBody.tsx` and
`src/react/virtual/GridVirtualBody.tsx`, which already render `cellAttributes` through the shared row
renderer and call `tableKeyDown` from `GridTable`.

## 2. Architecture and Data Flow

```mermaid
sequenceDiagram
    participant User as End User
    participant Table as GridTable (tableKeyDown slot)
    participant Nav as cellNavigation() add-on
    participant Scroll as useVirtualScroll() (only under virtualRows())
    participant Core as buildExportTable / formatCsv (core)
    participant OS as OS Clipboard
    participant Region as Live region (grid.announce)

    User->>Table: ArrowDown
    Table->>Nav: tableKeyDown(event, grid)
    Note over Nav: next cell = [row + 1, same column]
    Nav->>Scroll: scrollToIndex(rowIndex) when the row is not mounted
    Nav-->>Table: returns true; re-render with tabIndex 0 on the new cell, focus() it
    User->>Table: Ctrl + C
    Table->>Nav: tableKeyDown(event, grid)
    Nav->>Core: buildExportTable(selected rows or the active cell)
    Core-->>Nav: TSV text and table cells
    Nav->>OS: navigator.clipboard.write([ClipboardItem])
    Nav->>Region: "Copied 5 rows to clipboard"
```

## 3. Where the behaviour lives

- **2D roving tabindex**: `src/react/navigation/useCellNavigation.ts`, contributed through
  `cellAttributes` and `tableKeyDown`.
- **Clipboard assembly**: cell text from the core export table (`src/core/export/`), so a copied cell
  reads exactly like an exported one; the browser clipboard call in `src/react/navigation/clipboard.ts`.
- **Cell focus styles**: a non-layout-shifting outline via `--gw-focus-ring`.

## 4. Trade-offs taken

- **No legacy copy fallback.** A hidden-textarea copy needs a focus steal and a deprecated command; a
  refused or unavailable clipboard is announced instead.
- **Roving tabindex over active-descendant**: the real focused cell carries its header associations.
- **Active cell stored by ids, not indices**: sorting, filtering or a new page keeps it on the same row
  and column when they are still present, and falls back to the first cell otherwise.

## 5. Risks & Mitigation

| Risk | Mitigation |
| :--- | :--- |
| Clipboard permission rejection in a frame or unfocused window | Caught; announced through `grid.announce` and passed to the add-on's `onError`. |
| Moving focus past the windowed viewport | `useVirtualScroll().scrollToIndex(index)`, then focus the cell after it renders. |
| Arrow keys stolen from an inline editor or a filter dialog | `tableKeyDown` returns `false` when the event target is an interactive element; the dialog renders outside the table. |
| Markup in copied cells | The HTML flavour escapes every cell, as `formatPrintHtml` does. |
