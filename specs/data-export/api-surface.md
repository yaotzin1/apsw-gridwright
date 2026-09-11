# API surface contract: data export

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: every addition is optional. Two methods appear on `GridApi`, which is returned by
`createGridEngine` and never implemented by a consumer, so the widened interface breaks no build.
`ColumnDef` and `DataSource` gain optional members only. No default changes, no signature changes,
no event payload changes.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `buildExportTable` | `.` | `<TRow>(options: BuildExportTableOptions<TRow>) => ExportTable` |
| `formatCsv` | `.` | `(table: ExportTable, options?: CsvOptions) => string` |
| `formatMarkdownTable` | `.` | `(table: ExportTable) => string` |
| `formatMarkdownTemplate` | `.` | `<TRow>(options: MarkdownTemplateOptions<TRow>) => string` |
| `formatExcelXml` | `.` | `(table: ExportTable, options?: ExcelOptions) => string` |
| `formatPrintHtml` | `.` | `(table: ExportTable, options?: PrintOptions) => string` |
| `EXPORT_MIME_TYPES` | `.` | `Readonly<Record<'csv' \| 'excel' \| 'markdown' \| 'html', string>>` |
| `GridApi.getMatchingRows` | `.` | `() => MatchingRows<TRow>` |
| `GridApi.fetchAllRows` | `.` | `(options?: { signal?: AbortSignal }) => Promise<readonly TRow[]>` |
| `downloadTextFile` | `./react` | `(options: DownloadOptions) => void` |
| `printHtmlDocument` | `./react` | `(html: string, options?: { documentTitle?: string }) => void` |
| `useGridExport` | `./react` | `<TRow>(options?: GridExportOptions<TRow>) => GridExportController` |
| `GridExportMenu` | `./react` | `<TRow>(props: GridExportMenuProps<TRow>) => ReactElement` |
| `Gridwright.ExportMenu` | `./react` | attached part |

Types added alongside them: `ExportScope`, `ExportFormat`, `ExportTable`, `ExportTableColumn`,
`ExportTableRow`, `BuildExportTableOptions`, `CsvOptions`, `ExcelOptions`, `PrintOptions`,
`MarkdownTemplateOptions`, `MatchingRows`, `ExportContext`, `GridExportOptions`,
`GridExportController`, `GridExportMenuProps`, `DownloadOptions`.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `ColumnDef` | no export fields | optional `exportable`, `exportValue` | minor |
| `DataSource` | `fetch`, `subscribe?`, `dispose?` | adds optional `fetchAll` | minor |
| `GridApi` | 30 members | adds `getMatchingRows`, `fetchAllRows` | minor |
| `GridwrightLabels` | 27 labels | adds seven export labels | minor |
| `MessageCatalog` | 40 keys | adds seven `export.*` keys | minor, a catalogue without them falls back to English |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

## Defaults introduced or changed

No existing default changes. New options and their defaults:

| Option | Old default | New default |
| :--- | :--- | :--- |
| `CsvOptions.delimiter` | — | `,` |
| `CsvOptions.newline` | — | `\r\n` |
| `CsvOptions.bom` | — | `true` |
| `CsvOptions.escapeFormulas` | — | `true` |
| `ExcelOptions.sheetName` | — | `Sheet1` |
| `GridExportOptions.formats` | — | `['csv', 'markdown', 'print']` |
| `GridExportOptions.scope` | — | `all` |
| `GridExportOptions.filename` | — | `export-YYYY-MM-DD` |

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
