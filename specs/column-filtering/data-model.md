# Data model: column filtering

## Types added

All under `src/react/filters/types.ts`, exported from `apsw-gridwright/react`.

```ts
/** What a column holds, which decides the conditions and the input the dialog offers. */
export type ColumnFilterType = 'text' | 'number' | 'date' | 'select';

/** One value a `select` column can be filtered to. The label is already translated. */
export interface ColumnFilterChoice {
    readonly value: unknown;
    readonly label: string;
}

export interface ColumnFilterOptions {
    /** Default `text`. */
    readonly type?: ColumnFilterType;
    /** The values a `select` column offers. Ignored by the other types. */
    readonly choices?: readonly ColumnFilterChoice[];
    /** Narrows or reorders the conditions. Default: `COLUMN_FILTER_OPERATORS[type]`. */
    readonly operators?: readonly FilterOperator[];
}

export interface ColumnFilterProviderProps {
    readonly children: ReactNode;
}

export interface ColumnFilterTriggerProps {
    readonly columnId: string;
    readonly className?: string;
}

export interface GridFilterClearProps {
    readonly className?: string;
}

export const COLUMN_FILTER_OPERATORS: Readonly<Record<ColumnFilterType, readonly FilterOperator[]>> = {
    text: ['contains', 'notContains', 'eq', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
    number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'isEmpty', 'isNotEmpty'],
    date: ['eq', 'gt', 'lt', 'between', 'isEmpty', 'isNotEmpty'],
    select: ['in', 'notIn'],
};
```

## Types changed

**Before**

```ts
interface GridwrightColumn<TRow, TValue> extends ColumnDef<TRow, TValue> {
    cell?; headerCell?; icon?; edit?;
}

interface GridwrightProps<TRow> { /* … */ searchable?: boolean; /* … */ }

interface GridwrightLabels { /* 43 labels after the export addendum */ }

interface GridwrightClassNames { /* 16 slots */ }
```

**After**

```ts
interface GridwrightColumn<TRow, TValue> extends ColumnDef<TRow, TValue> {
    cell?; headerCell?; icon?; edit?;
    /** How this column is filtered from its header. Read only when `columnFilters` is on. */
    readonly filter?: ColumnFilterOptions;
}

interface GridwrightProps<TRow> {
    /* … */
    /** A filter control in every filterable header, and a clear button in the toolbar. Default false. */
    readonly columnFilters?: boolean;
}

interface GridwrightLabels {
    /* … */
    readonly filterTrigger: (column: string, active: boolean) => string;
    readonly filterCondition: string;
    readonly filterValue: string;
    readonly filterFrom: string;
    readonly filterTo: string;
    readonly filterValues: string;
    readonly filterApply: string;
    readonly filterClear: string;
    readonly filterClearAll: (count: number) => string;
    readonly filterOperator: (operator: FilterOperator, type: ColumnFilterType) => string;
    readonly filterAnnouncement: (column: string, active: boolean) => string;
}

interface GridwrightClassNames {
    /* … */
    readonly filterTrigger?: string;
    readonly filterDialog?: string;
}
```

`AnnouncementInput` (internal, not exported) gains `filterChange: { columnHeader, active } | null`
beside `sortChange`.

## State shape

No engine state is added. `query.filters` is the only filter state, and it already exists.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| provider: `openColumnId` | `string \| null` | `null` | `ColumnFilterTrigger`, the dialog's close paths |
| dialog: `draft` | `{ operator; value; to; picked }` | from `api.getFilter(columnId)`, else the type's first condition | the dialog's inputs; discarded on close |

The draft never reaches the engine until Apply. It is component state, so a Strict Mode double
render cannot apply it twice.

## Serialisation

What travels is the existing `FilterSpec`, unchanged, and every value the dialog produces survives
JSON:

| Type | Condition | `value` on the wire |
| :--- | :--- | :--- |
| text | contains, eq, … | the typed string |
| number | eq, gt, … | a number |
| number | between | `[from, to]`, two numbers |
| date | eq, gt, lt | `"YYYY-MM-DD"` |
| date | between | `["YYYY-MM-DD", "YYYY-MM-DD"]` |
| select | in, notIn | an array of the chosen choices' `value`s |
| any | isEmpty, isNotEmpty | omitted |

`createRestDataSource` already sends `filters` as a JSON array of these, and the playground's paging
fetcher now does the same.
