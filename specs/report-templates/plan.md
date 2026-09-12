# Plan: Markdown report templates and custom export formats

## Modules touched

| File | Change |
| :--- | :--- |
| `src/core/export/types.ts` | `header` and `footer` on `MarkdownTemplateOptions` |
| `src/core/export/markdown.ts` | the document around the rendered rows |
| `src/core/export/markdown-html.ts` | new: `markdownToHtml`, `formatMarkdownDocument` |
| `src/core/export/print.ts` | `formatPrintDocument` extracted, shared by both documents |
| `src/react/export/formats.ts` | new: resolves built-in names and custom formats into menu entries |
| `src/react/export/types.ts` | `CustomExportFormat`, `ExportFormatOption`, `Blob` content |
| `src/react/export/download.ts` | `downloadFile` takes bytes, `printMarkdownDocument` added |
| `src/react/export/useGridExport.ts`, `GridExportMenu.tsx` | resolve a format by id, render its label |

## Where the behaviour lives

Rendering Markdown is text in, text out, so it is core, next to the serializers it belongs with.
Printing it is the adapter, in the one function that already owns the print frame.

Resolving a format list into menu entries is adapter work, because a label is interface copy and a
custom format is defined where the component is used. It is its own module rather than inline in
the menu, because the hook needs the same resolution to announce the right name.

## Trade-offs taken

- **A Markdown subset rather than a parser.** The dependency policy decides this. The cost is real:
  a template using reference links or nested lists renders those as text. The renderer covers what
  a report is made of, and the failure mode is visible rather than silent.
- **The custom label is a plain string, not a message key.** A key this package does not ship has
  no fallback. The cost is that a consumer with several locales resolves the label themselves.
- **An unregistered format id throws.** The alternative, ignoring it, produces a menu item that
  does nothing, which is the hardest kind of bug to find.
- **`downloadTextFile` renamed to `downloadFile`.** It was added in this same unreleased cycle and
  has never shipped, so the rename costs nobody anything and the old name would have lied.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| Row text reaching a document as markup or a live link | Escaped before rendering; link schemes restricted to http, https, mailto, tel |
| A custom format colliding with a built-in id | Documented namespacing, and the built-in serializer is only used when no serializer is registered |
| The subset renderer silently dropping a construct | Anything unrecognised survives as its own text, so it is visible in the output |

## Out of scope for this change

Rendering a PDF in the package, a template editor, template storage, and any Markdown construct
outside the documented subset.
