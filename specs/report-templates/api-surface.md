# API surface contract: report templates and custom formats

> **Immutable during stage 6.**

## Semver classification

**minor**

Reasoning: two optional fields on an options object, three new core exports, two new adapter
exports, and two widenings that accept strictly more than before (`formats` takes objects as well
as names; `ExportFile.content` takes a `Blob` as well as a string). One rename, `downloadTextFile`
to `downloadFile`, of a name added in the same unreleased cycle and never published.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `markdownToHtml` | `.` | `(markdown: string) => string` |
| `formatMarkdownDocument` | `.` | `(markdown: string, options?: PrintOptions) => string` |
| `formatPrintDocument` | `.` | `(body: string, options?: PrintOptions) => string` |
| `printMarkdownDocument` | `./react` | `(markdown: string, options?: PrintOptions) => () => void` |
| `CustomExportFormat` | `./react` | `{ id, label, serialize, name? }` |
| `ExportFormatOption` | `./react` | `ExportFormat \| CustomExportFormat<TRow>` |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `MarkdownTemplateOptions` | rows, columns, template, separator | adds optional `header`, `footer` | minor |
| `GridExportOptions.formats` | `readonly ExportFormat[]` | `readonly ExportFormatOption<TRow>[]` | minor, widening |
| `GridExportOptions.serializers` | `Partial<Record<ExportFormat, …>>` | `Record<string, …>` | minor, widening |
| `GridExportController.exportAs` | `(format: ExportFormat) => …` | `(format: string) => …` | minor, widening |
| `ExportContext.format` | `ExportFormat` | `string` | minor, widening |
| `ExportFile.content` | `string` | `string \| Blob` | minor, widening |
| `downloadTextFile` | `({ content: string, … })` | renamed `downloadFile`, content `string \| Blob` | none: never published |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| `downloadTextFile` | `downloadFile` | never shipped; removed in the same cycle |

## Defaults introduced or changed

None. `header` and `footer` default to absent, which produces the previous output exactly.

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
