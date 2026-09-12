# Data model: report templates and custom formats

## Types added

```ts
export interface CustomExportFormat<TRow> {
    /** Namespaced like a plugin stage: `acme:report`. */
    readonly id: string;
    /** Already translated: a format only you define is a string only you can translate. */
    readonly label: string;
    readonly serialize: ExportSerializer<TRow>;
    /** What the live region calls it. Defaults to the label. */
    readonly name?: string;
}

export type ExportFormatOption<TRow> = ExportFormat | CustomExportFormat<TRow>;

/** Internal to the adapter: one menu entry, from either source. */
interface ResolvedFormat<TRow> {
    readonly id: string;
    readonly label: string;
    readonly name: string;
    readonly custom: CustomExportFormat<TRow> | null;
}
```

## Types changed

**Before**

```ts
interface MarkdownTemplateOptions<TRow> {
    readonly rows: readonly TRow[];
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly template: string | ((row: TRow, index: number) => string);
    readonly separator?: string;
}

interface ExportFile {
    readonly content: string;
}
```

**After**

```ts
interface MarkdownTemplateOptions<TRow> {
    readonly rows: readonly TRow[];
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly template: string | ((row: TRow, index: number) => string);
    readonly separator?: string;
    readonly header?: string | ((rows: readonly TRow[]) => string);
    readonly footer?: string | ((rows: readonly TRow[]) => string);
}

interface ExportFile {
    readonly content: string | Blob;
}
```

## State shape

None. A report is produced on demand from rows the export already resolved; nothing is held.

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| — | — | — | — |

## Serialisation

Markdown in, HTML out, both strings. A custom serializer returning a `Blob` hands bytes straight to
the downloader; nothing is re-encoded on the way.
