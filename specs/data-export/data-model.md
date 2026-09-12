# Data model: data export

## Types added

```ts
export type ExportScope = 'all' | 'page' | 'selected';

export interface ExportTableColumn {
    readonly id: string;
    readonly header: string;
    readonly align: ColumnAlign;
}

export interface ExportTableRow {
    /** One entry per column, already resolved to text. */
    readonly text: readonly string[];
    /** The same cells before text conversion, so a spreadsheet can type them. */
    readonly values: readonly ColumnValue[];
}

export interface ExportTable {
    readonly columns: readonly ExportTableColumn[];
    readonly rows: readonly ExportTableRow[];
}

export interface CsvOptions {
    readonly delimiter?: string;      // ','
    readonly newline?: string;        // '\r\n'
    readonly bom?: boolean;           // true
    readonly header?: boolean;        // true
    readonly escapeFormulas?: boolean; // true
}

export interface ExcelOptions {
    readonly sheetName?: string;      // 'Sheet1'
}

export interface MarkdownTemplateOptions<TRow> {
    readonly rows: readonly TRow[];
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly template: string | ((row: TRow, index: number) => string);
    readonly separator?: string;      // '\n'
}

export interface PrintOptions {
    readonly title?: string;
    readonly styles?: string;
    readonly lang?: string;
    readonly direction?: 'ltr' | 'rtl';
}

export interface MatchingRows<TRow> {
    readonly rows: readonly TRow[];
    /**
     * False when the source paginates: these are the rows in memory, not every row matching
     * the query.
     */
    readonly isComplete: boolean;
}
```

## Types changed

**Before**

```ts
interface ColumnDef<TRow, TValue> {
    readonly formatValue?: (value: TValue, row: TRow) => string;
}

interface DataSource<TRow> {
    fetch(request: DataSourceRequest<TRow>): DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;
}
```

**After**

```ts
interface ColumnDef<TRow, TValue> {
    readonly formatValue?: (value: TValue, row: TRow) => string;
    /** Default true. A column set false is left out of every export. */
    readonly exportable?: boolean;
    /** Export text for this column, overriding `formatValue`. */
    readonly exportValue?: (value: TValue, row: TRow) => string;
}

interface DataSource<TRow> {
    fetch(request: DataSourceRequest<TRow>): DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;
    /** Every row matching the query, ignoring its pagination. Only a paginating source needs it. */
    fetchAll?(request: DataSourceRequest<TRow>): DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;
}
```

Both are optional additions, so every existing column definition and data source still satisfies
the interface.

## State shape

No new fields on `GridState` or `GridQuery`. An export reads state; it does not hold any. The
React menu keeps one transient string of its own for the live region, which is component state and
never reaches the engine.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| — | — | — | — |

## Serialisation

`fetchAll` receives the same `DataSourceRequest` as `fetch`, including `query.pagination`, which it
is expected to ignore. Sending the request unchanged keeps one wire shape rather than a second one
that a source would have to parse differently.
