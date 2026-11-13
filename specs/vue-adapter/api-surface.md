# API Surface: `@apsw/gridwright-vue`

> **Package**: `@apsw/gridwright-vue` (`packages/vue`)
> **Semver**: `0.1.0` (initial release of new workspace package; `@apsw/gridwright` itself is unchanged)
> **Dependencies**: zero runtime `dependencies`; `peerDependencies`: `@apsw/gridwright` (`^0.24.0`), `vue` (`^3.4.0 || ^3.5.0`)

---

## Exported symbols (`packages/vue/src/index.ts`)

### 1. Components

#### `Gridwright`

Vue 3 functional/setup component (`DefineComponent`) rendering the data grid.

```ts
export interface GridwrightProps<TRow = Record<string, unknown>> {
    readonly columns: readonly GridwrightColumn<TRow, ColumnValue>[];
    readonly data?: readonly TRow[];
    readonly dataSource?: DataSource<TRow>;
    readonly getRowId?: (row: TRow, index: number) => RowId;
    readonly pageSize?: number;
    readonly initialQuery?: Partial<GridQuery>;
    readonly selectionMode?: SelectionMode;
    readonly addons?: readonly OptionalAddon<ViewAddon<TRow>>[];
    readonly coreAddons?: readonly OptionalAddon<ViewAddon<TRow>>[] | false;
    readonly i18n?: TranslatorOptions;
    readonly labels?: Partial<ViewLabels>;
    readonly caption?: string;
    readonly ariaLabel?: string;
    readonly components?: Readonly<Record<string, VueComponentRenderer>>;
}
```

- **Slots**:
  - `toolbar`: rendered into the grid toolbar region (triggers toolbar visibility and add-on `toolbarStatus` rendering).
  - `cell`: scoped slot `(props: CellRenderContext<TRow>) => VNodeChild` for custom data cell rendering.
  - `cell-<columnId>`: scoped slot `(props: CellRenderContext<TRow>) => VNodeChild` for column-specific custom cell rendering (takes precedence over `cell` slot; `column.render` takes precedence over both).

### 2. Composables

#### `useGridwright<TRow>(options: UseGridwrightOptions<TRow>): UseGridwrightReturn<TRow>`

```ts
export interface UseGridwrightOptions<TRow> extends Omit<GridHostOptions<TRow>, 'toolbar'> {
    readonly toolbar?: ViewNode;
}

export interface UseGridwrightReturn<TRow> {
    readonly host: GridHost<TRow>;
    readonly api: GridApi<TRow>;
    readonly model: ShallowRef<TableModel<TRow>>;
    readonly takeFocusRequest: () => string | null;
}
```

- Creates `GridHost<TRow>` once, subscribes to updates, keeps `model` updated in a `ShallowRef`, and calls `host.destroy()` in `onScopeDispose` (safe in both component setup and effect scopes).
- Note: When `Gridwright` receives reactive prop changes (e.g. `data`, `columns`, `pageSize`, `selectionMode`), `Gridwright` rebuilds or updates the host cleanly; `useGridwright` accepts either plain options or a getter/reactive options? Keep `useGridwright(options)` simple and synchronous like `createGridHost(options)`, and `Gridwright` watches props if needed.

### 3. Renderer & Types

#### `renderViewNode(node: ViewNode, options?: RenderViewNodeOptions): VNodeChild`

```ts
export type VueComponentRenderer = (props: Readonly<Record<string, unknown>> | undefined) => VNodeChild;

export interface RenderViewNodeOptions {
    readonly slots?: Readonly<Record<string, (() => VNodeChild) | undefined>>;
    readonly components?: Readonly<Record<string, VueComponentRenderer>>;
    readonly registerFocusKey?: (key: string, el: Element | null) => void;
}
```

#### `GridwrightColumn<TRow, TValue = ColumnValue>`

```ts
export interface CellRenderContext<TRow, TValue = ColumnValue> {
    readonly value: TValue;
    readonly row: TRow;
    readonly rowIndex: number;
    readonly column: ColumnDef<TRow, TValue>;
}

export interface GridwrightColumn<TRow, TValue = ColumnValue> extends ColumnDef<TRow, TValue> {
    readonly render?: (context: CellRenderContext<TRow, TValue>) => VNodeChild;
}
```

### 4. Re-exports from `@apsw/gridwright/view`

For convenience (so Vue consumers don't need two imports for basic grids):
- `sorting`, `selection`, `pagination`, `defineAddon`
- Types: `ViewAddon`, `ViewLabels`, `SortingOptions`, `SelectionOptions`, `PaginationOptions`
