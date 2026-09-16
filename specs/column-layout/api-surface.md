# API surface contract: column layout (resizing, pinning and visibility)

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: everything below is added. `<Gridwright />` gains no prop, `ColumnDef` gains no field,
no existing signature changes and no existing default changes. A grid that does not list
`columnLayout()` renders exactly the markup it rendered before, including its table layout
algorithm: `table-layout: fixed` arrives with the add-on's own class on the table, never with the
stylesheet.

The one thing a consumer inherits without asking is the column option `layout` on
`GridwrightColumn`, declared by module augmentation. It is optional, so no existing column
definition stops compiling.

## Exports added

All from `apsw-gridwright/react`. The core entry is unchanged.

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `columnLayout` | `./react` | `<TRow>(options?: ColumnLayoutOptions) => GridAddon<TRow>` |
| `COLUMN_LAYOUT_ADDON` | `./react` | `'gridwright:column-layout'` |
| `columnLayoutMessages` | `./react` | `AddonMessages` |
| `GridColumnPicker` | `./react` | `(props: GridColumnPickerProps) => ReactNode` |
| `GridResizeHandle` | `./react` | `(props: GridResizeHandleProps) => ReactNode` |
| `useColumnLayout` | `./react` | `() => ColumnLayoutController` — throws outside a grid that lists the add-on |
| `useOptionalColumnLayout` | `./react` | `() => ColumnLayoutController \| null` |
| `stickyOffsets` | `./react` | `(columns: readonly LayoutColumn[]) => StickyOffsets` |
| `columnWidthProperty` | `./react` | `(columnId: string) => string` — the custom property name a column's width is published under |
| `ColumnLayoutOptions` | `./react` (type) | see below |
| `ColumnLayoutState` | `./react` (type) | see below |
| `ColumnLayoutController` | `./react` (type) | see below |
| `ColumnLayoutColumnOptions` | `./react` (type) | see below |
| `ColumnPin` | `./react` (type) | `'left' \| 'right'` |
| `LayoutColumn` | `./react` (type) | `{ id: string; width: number; pinned: ColumnPin \| null }` |
| `StickyOffsets` | `./react` (type) | `{ left: ReadonlyMap<string, number>; right: ReadonlyMap<string, number>; lastLeft: string \| null; firstRight: string \| null }` |
| `GridColumnPickerProps` | `./react` (type) | `{ className?: string }` |
| `GridResizeHandleProps` | `./react` (type) | `{ columnId: string; className?: string }` |

```ts
export interface ColumnLayoutOptions {
    readonly initial?: Partial<ColumnLayoutState>;
    readonly onChange?: (layout: ColumnLayoutState) => void;
    /** The picker in the toolbar. Default true. */
    readonly picker?: boolean;
    /** Resize handles at all. Default true. A column opts out with `layout: { resizable: false }`. */
    readonly resizable?: boolean;
    /** Width of a column that declares no numeric `width`. Default 150. */
    readonly defaultWidth?: number;
    /** Floor for every column, under the column's own `minWidth`. Default 50. */
    readonly minWidth?: number;
    /** Width used for an add-on's extra column, which has no column definition. Default 48. */
    readonly extraColumnWidth?: number;
}

/** What `onChange` reports and `initial` restores. JSON on both sides: no `undefined`, no functions. */
export interface ColumnLayoutState {
    readonly widths: Readonly<Record<string, number>>;
    /** `null` is "pinned nowhere", stated rather than absent, so it survives JSON. */
    readonly pinned: Readonly<Record<string, ColumnPin | null>>;
    readonly hidden: Readonly<Record<string, boolean>>;
}

export interface ColumnLayoutController {
    readonly layout: ColumnLayoutState;
    /** The width a column renders at now, whether it was resized or not. */
    widthOf(columnId: string): number;
    pinOf(columnId: string): ColumnPin | null;
    isHidden(columnId: string): boolean;
    /** False for `layout: { hideable: false }`, and for the last visible column. */
    canHide(columnId: string): boolean;
    setWidth(columnId: string, width: number): void;
    setPinned(columnId: string, side: ColumnPin | null): void;
    setHidden(columnId: string, hidden: boolean): void;
    showAll(): void;
    /** Back to what `initial` said, or to nothing if it said nothing. */
    reset(): void;
}

export interface ColumnLayoutColumnOptions {
    /** Default true. */
    readonly resizable?: boolean;
    readonly pinned?: ColumnPin;
    /** Default true. False locks the column into the picker as checked and disabled. */
    readonly hideable?: boolean;
    readonly maxWidth?: number;
}
```

The column option, declared from the add-on through the package's own specifier exactly as
`columnFilters()` declares `filter`:

```ts
declare module 'apsw-gridwright/react' {
    interface GridwrightColumn<TRow, TValue> {
        readonly layout?: ColumnLayoutColumnOptions;
    }
}
```

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| — | — | — | — |

Nothing. In particular `AddonContribution` is unchanged: the add-on is written against the
contract as it already stands, `extraCellAttributes` and `extraHeaderAttributes` included.

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

## Defaults introduced or changed

No existing default changes. The defaults introduced belong to the new add-on and apply only to a
grid that lists it.

| Option | Old default | New default |
| :--- | :--- | :--- |
| `columnLayout({ picker })` | — | `true` |
| `columnLayout({ resizable })` | — | `true` |
| `columnLayout({ defaultWidth })` | — | `150` |
| `columnLayout({ minWidth })` | — | `50` |
| `columnLayout({ extraColumnWidth })` | — | `48` |
| `column.layout.resizable` | — | `true` |
| `column.layout.hideable` | — | `true` |
| `column.layout.pinned` | — | unpinned |
| `column.layout.maxWidth` | — | none |

Two behaviours a consumer inherits by listing the add-on, recorded here because neither breaks a
build and both change what is on screen:

- The table gets `table-layout: fixed` and every column an explicit width. Without it a browser
  treats a width as a suggestion and a dragged column springs back, which reads as a broken handle.
- Cells under that table truncate with an ellipsis instead of wrapping. Wrapping and a fixed width
  give a row whose height changes as a column is dragged.

## Type entry points

- [x] Every type appearing in a new signature is itself exported — `ColumnPin`, `LayoutColumn`,
      `StickyOffsets`, `ColumnLayoutState`, `ColumnLayoutOptions`, `ColumnLayoutController`,
      `ColumnLayoutColumnOptions` and both prop types are all in the table above
- [ ] Both `import` and `require` conditions still resolve types — checked at stage 7
- [ ] `npm run check:exports` passes — checked at stage 7
