# Data model: add-on architecture

## Engine types changed

```ts
export interface GridEngineOptions<TRow> {
    // …unchanged fields…
    /** Added to the core plugins. Before: replaced them. */
    readonly plugins?: readonly GridPlugin<TRow>[];
    /** Default true. False installs no core plugin: filtering, search, sorting and pagination are then yours. */
    readonly corePlugins?: boolean;
}

export interface PluginContext<TRow> {
    readonly api: GridApi<TRow>;
    registerStage(stage: PipelineStage<TRow>): Unsubscribe;
    /** Skips a registered stage, whoever registered it, until the returned function is called. */
    suppressStage(stageId: string): Unsubscribe;
    on<K extends keyof GridEventMap<TRow>>(event: K, listener: (payload: GridEventMap<TRow>[K]) => void): Unsubscribe;
    setMeta(key: string, value: unknown): void;
}

export interface PipelineStage<TRow> {
    readonly id: string;
    readonly order: number;
    readonly capability?: keyof DataSourceCapabilities;
    /** Skipped for this pass when it returns true. Evaluated after `capability`. */
    readonly skip?: (context: PipelineContext<TRow>) => boolean;
    run(rows: readonly TRow[], context: PipelineContext<TRow>): readonly TRow[] | PipelineOutput<TRow>;
}
```

## Add-on types added (`src/react/addons/types.ts`)

```ts
/** A React add-on. The built-in features are add-ons of exactly this shape. */
export interface GridAddon<TRow = unknown> {
    /** Namespaced: `gridwright:filters`, `acme:heatmap`. Also the namespace of its messages. */
    readonly name: string;
    /** Names that must be present in the same grid. */
    readonly requires?: readonly string[];
    /**
     * Called on every render of the grid, in add-on order. May call hooks. Returns what the add-on
     * contributes, or nothing.
     */
    readonly setup: (context: AddonSetupContext<TRow>) => AddonContribution<TRow> | void;
}

export interface AddonSetupContext<TRow> {
    /** The grid's options after the add-ons before this one configured them. */
    readonly options: UseGridwrightOptions<TRow>;
    /** Every add-on name in this grid, in order. */
    readonly addons: readonly string[];
}

/** What a slot render function receives. */
export interface GridwrightInstance<TRow> {
    readonly api: GridApi<TRow>;
    readonly state: GridState<TRow>;
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly definitions: ReadonlyMap<string, GridwrightColumn<TRow, ColumnValue>>;
    /** Every add-on's contribution, resolved, in order. */
    readonly contributions: ResolvedContributions<TRow>;
}

type Render<TRow> = (grid: GridwrightInstance<TRow>) => ReactNode;
type Attributes<E> = Omit<HTMLAttributes<E>, 'children' | 'dangerouslySetInnerHTML'> & Record<`data-${string}`, string | undefined>;

export interface ExtraColumn<TRow> {
    readonly id: string;
    readonly placement: 'start' | 'end';
    readonly header: Render<TRow>;
    readonly cell: (row: GridRow<TRow>, grid: GridwrightInstance<TRow>) => ReactNode;
    readonly className?: string;
}

export interface AnnouncementChange<TRow> {
    /** Null on the first settled render. */
    readonly previous: GridState<TRow> | null;
    readonly next: GridState<TRow>;
    /** Header text by column id. */
    readonly headers: ReadonlyMap<string, string>;
    readonly grid: GridwrightInstance<TRow>;
}

export interface AnnouncementContributor<TRow> {
    /** Higher wins. The shell's row range is 0; sorting uses 20, column filters 10. */
    readonly priority: number;
    readonly describe: (change: AnnouncementChange<TRow>) => string | null;
}

export type AddonMessages = Readonly<Record<string, Readonly<Record<string, Message>>>> & {
    readonly en: Readonly<Record<string, Message>>;
};

export interface AddonContribution<TRow> {
    // Engine
    readonly configure?: (options: UseGridwrightOptions<any>) => UseGridwrightOptions<any>;
    readonly plugins?: readonly GridPlugin<any>[];
    readonly columnSignature?: (column: GridwrightColumn<any>) => string;

    // Composition
    readonly provide?: (children: ReactNode, grid: GridwrightInstance<TRow>) => ReactNode;
    readonly suppresses?: readonly string[];
    readonly navigation?: 'pages' | 'window';

    // Around the table
    readonly toolbar?: Render<TRow>;
    readonly aboveTable?: Render<TRow>;
    readonly belowTable?: Render<TRow>;
    readonly overlay?: Render<TRow>;

    // The table
    readonly tableAttributes?: (grid: GridwrightInstance<TRow>) => Attributes<HTMLTableElement>;
    readonly tableWrapper?: (grid: GridwrightInstance<TRow>) => {
        readonly ref?: RefObject<HTMLDivElement | null>;
        readonly style?: CSSProperties;
        readonly className?: string;
    };
    readonly tableKeyDown?: (event: KeyboardEvent<HTMLTableElement>, grid: GridwrightInstance<TRow>) => boolean;
    readonly tableFooter?: Render<TRow>;

    // Header
    readonly headerLabel?: (column: ResolvedColumn<TRow>, grid: GridwrightInstance<TRow>) => ReactNode;
    readonly headerBefore?: (column: ResolvedColumn<TRow>, grid: GridwrightInstance<TRow>) => ReactNode;
    readonly headerAfter?: (column: ResolvedColumn<TRow>, grid: GridwrightInstance<TRow>) => ReactNode;
    readonly headerAttributes?: (column: ResolvedColumn<TRow>, grid: GridwrightInstance<TRow>) => Attributes<HTMLTableCellElement>;

    // Body
    readonly columns?: readonly ExtraColumn<TRow>[];
    readonly body?: (grid: GridwrightInstance<TRow>) => ReactNode;
    readonly rowAttributes?: (row: GridRow<TRow>, grid: GridwrightInstance<TRow>) => Attributes<HTMLTableRowElement>;
    readonly renderRow?: (row: GridRow<TRow>, grid: GridwrightInstance<TRow>) => ReactNode | undefined;
    readonly cellAttributes?: (row: GridRow<TRow>, column: ResolvedColumn<TRow>, grid: GridwrightInstance<TRow>) => Attributes<HTMLTableCellElement>;
    readonly status?: {
        readonly loading?: Render<TRow>;
        readonly empty?: Render<TRow>;
        readonly error?: (error: GridError, retry: () => void, grid: GridwrightInstance<TRow>) => ReactNode;
    };

    // Speech and copy
    readonly announce?: readonly AnnouncementContributor<TRow>[];
    readonly messages?: AddonMessages;
}
```

`ResolvedContributions<TRow>` is the ordered list of `{ name, contribution }` after suppression, plus
the owners of `headerLabel` and `body` and the merged `navigation`.

## React types changed

**Before**

```ts
interface UseGridwrightOptions<TRow> {
    columns; data?; dataSource?; getRowId?; initialQuery?; pageSize?; selectionMode?;
    keepPreviousData?; queryDebounceMs?;
    plugins?;            // replaced corePlugins()
    onQueryChange?; onSelectionChange?; onError?;
}

interface GridwrightProps<TRow> extends UseGridwrightOptions<TRow>, GridwrightI18nProps {
    instance?; tree?; virtual?; export?; rowActions?; rowActionsTrigger?; onCellEdit?; columnFilters?;
    renderSkeleton?; className?; classNames?; searchable?; toolbar?; footer?; caption?;
    hidePagination?; pageSizeOptions?; onRowClick?; renderEmpty?; renderLoading?; renderError?;
    'aria-label'?;
}

interface GridwrightColumn<TRow, TValue> extends ColumnDef<TRow, TValue> {
    cell?; headerCell?; icon?; edit?; filter?;
}
```

**After**

```ts
interface UseGridwrightOptions<TRow> {
    columns; data?; dataSource?; getRowId?; initialQuery?; pageSize?; selectionMode?;
    keepPreviousData?; queryDebounceMs?;
    plugins?;            // added to the core plugins
    corePlugins?: boolean;
    addons?: readonly GridAddon<TRow>[];
    /** Default `coreAddons()`. `false` for none. */
    coreAddons?: readonly GridAddon<TRow>[] | false;
    onQueryChange?; onSelectionChange?; onError?;
}

interface GridwrightProps<TRow> extends UseGridwrightOptions<TRow>, GridwrightI18nProps {
    instance?; className?; classNames?; toolbar?; footer?; caption?; onRowClick?; 'aria-label'?;
}

interface GridwrightColumn<TRow, TValue> extends ColumnDef<TRow, TValue> {
    cell?; headerCell?; icon?;
    // `edit`, `filter` and any add-on's own options arrive by augmentation:
    // declare module 'apsw-gridwright/react' { interface GridwrightColumn<TRow, TValue> { filter?: … } }
}

type TranslateFn = (key: string, values?: TranslateValues) => string;   // was MessageKey
```

`GridwrightLabels` keeps only the shell's strings: `loading`, `empty`, `errorTitle`, `retry`,
`rowsShown`, `rowsTotal`. Every other label moves into its add-on's messages and an optional
`labels` option on the add-on.

## State shape

No field is added to `GridState` or `GridQuery`.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| engine: suppressed stage ids | `Map<string, number>` (reference count) | empty | `PluginContext.suppressStage` |
| React: resolved contributions | `ResolvedContributions` | from `coreAddons()` | `useGridwright`, every render |

## Serialisation

Nothing new travels to a data source. Add-on option transforms may change `initialQuery`, which is
serialised exactly as before.
