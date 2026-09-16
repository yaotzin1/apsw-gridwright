# Plan: column layout (resizing, pinning and visibility)

## 1. Modules touched

| File | Change |
| :--- | :--- |
| `src/react/layout/addon.tsx` | New. `columnLayout()`: `setup`, `configure`, the attribute and slot contributions |
| `src/react/layout/types.ts` | New. `ColumnLayoutOptions`, `ColumnLayoutState`, the controller, and the `GridwrightColumn` augmentation for `layout` through `declare module 'apsw-gridwright/react'` |
| `src/react/layout/layout.ts` | New. The pure arithmetic, no DOM: the encoded custom property name, clamping, resolved widths, sticky offsets, auto-fit |
| `src/react/layout/context.tsx` | New. The layout state, the controller and `useColumnLayout` |
| `src/react/layout/GridResizeHandle.tsx` | New. Pointer capture and keyboard stepping, writing CSS variables on the table element |
| `src/react/layout/GridColumnPicker.tsx` | New. The accessible `menuitemcheckbox` menu, contributed to `toolbar` |
| `src/react/layout/messages.ts` | New. `gridwright:column-layout` messages |
| `src/react/layout/index.ts`, `src/react/index.ts` | Exports |
| `src/locales/{de,es,fr,pl}.ts` | `addons['gridwright:column-layout']` |
| `src/styles/styles.css` | Fixed table layout, resize handle, sticky shadow, picker |

Not touched: `src/core/types.ts` (no `pinned` on `ColumnDef`; `width`, `minWidth` and `hidden` already
exist), `src/react/Gridwright.tsx` and the parts, which already render header, cell and table
attributes and `headerAfter` from context.

## 2. Architecture and Data Flow

```mermaid
sequenceDiagram
    participant User as End User
    participant Handle as Resize handle (headerAfter)
    participant ResizeHook as useColumnResize
    participant Table as table element (found from the handle; variables committed via tableAttributes.style)
    participant State as Layout state (add-on setup)

    User->>Handle: onPointerDown(e)
    Handle->>ResizeHook: setPointerCapture()
    loop Dragging
        User->>Table: PointerMove (dx)
        ResizeHook->>Table: style.setProperty('--gw-col-w-<id>', newWidth + 'px')
        Note over Table: Browser repaints the column without React renders
    end
    User->>Handle: onPointerUp(e)
    ResizeHook->>State: commitWidth(id, finalWidth)
    State-->>Table: re-render: recomputed sticky offsets, onChange(layout), announcement
```

## 3. Where the behaviour lives

- **Column options**: `layout` on `GridwrightColumn`, declared by the add-on's module augmentation.
- **Visibility**: `ColumnDef.hidden`, written by the add-on's `configure`.
  No `columnSignature` contribution: the grid's own signature already reads `column.hidden`, and
  `configure` runs before the signature is built, so a hidden column reaches the engine without one.
  Contributing a second copy of the same fact would be ceremony, and ceremony is what rots.
- **Active resizing**: `src/react/layout/GridResizeHandle.tsx`.
- **Sticky offset math**: pure helpers in `src/react/layout/layout.ts`.
- **Picker**: `src/react/layout/GridColumnPicker.tsx`, rendered through the `toolbar` slot.

## 4. Trade-offs taken

- **CSS variables during drag**: writing the variable directly on the table allows smooth resizing
  without React renders across thousands of cells; state commits only on release.
- **Sticky CSS positioning over cloned headers and bodies**: native `position: sticky` rather than
  frozen panes. No DOM duplication, and the table stays one ARIA grid.
- **Visibility through `hidden`, not by filtering columns out in the view**: search and export then
  agree with what the reader sees.

## 5. Risks & Mitigation

| Risk | Mitigation |
| :--- | :--- |
| Stacking context leaks when scrolling under sticky columns | Sticky cells receive explicit `z-index: 2` (headers higher) and an elevation shadow `--gw-pinned-shadow`. |
| Pointer capture loss on touch devices or frame boundaries | `setPointerCapture`, plus `pointerup` / `pointercancel` handling that commits the last width. |
| A column id that is not a valid custom property name | The id is encoded before it is used in a property name (security rule: nothing built from data reaches a style unencoded). |
| Extra columns from other add-ons cannot receive cell attributes | Resolved before stage 6: `extraCellAttributes` and `extraHeaderAttributes` are already on the contract and already exercised by `tests/react/third-party-addon.test.tsx` (spec.md C-1). |
| A second add-on's `tableWrapper` ref would silently replace this one's | The add-on contributes no `tableWrapper`. `GridTable` keeps the last ref it is handed, so a grid listing both `columnLayout()` and `virtualRows()` would lose one of them. The drag reaches the table with `closest('table')` from the handle instead, which needs no ref. |
| `table-layout: fixed` changes an existing grid's appearance | It arrives on the add-on's own class on the table, never in the base stylesheet, so only a grid that lists the add-on gets it. Recorded in api-surface.md as a behaviour a consumer inherits. |
