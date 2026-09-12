# Research: report templates and custom formats

## Options considered

### Option A — bundle a Markdown parser and a PDF engine

**How it works.** `markdown-it` and `jspdf`, or a headless Chromium on a server.

**Rejected because.** The package declares zero runtime dependencies, and this would add hundreds
of kilobytes to every consumer's bundle to serve the subset of them who export a report. The
architectural rule requires an explicit decision recorded in a spec for any dependency; this is
that decision, and it is no.

### Option B — a Markdown subset, rendered, and printed by the browser

**How it works.** A renderer covering the constructs a report is made of, the existing printable
document, and the browser's own print dialog writing the PDF.

**Chosen because.** It costs nothing, it works offline, and the print document already existed for
the table export. The limit is honest and documented: page size and margins belong to the reader's
print settings, and a template using a construct outside the subset shows that construct as text
rather than losing the section.

### Option C — leave PDF entirely to the consumer

**How it works.** Export Markdown; somebody else's problem after that.

**Rejected because.** It was already possible and nobody could reach it: the menu had no room for a
format the consumer defined, which is what made the whole idea awkward rather than the rendering.

## Prior art

Grids that offer PDF either bundle an engine or sell a server component. The ones that bundle it
are the reason "export to PDF" has a reputation for adding a megabyte to a bundle. Printing a
purpose-built document is what applications did before those libraries existed, and it is still
what produces the most faithful output per byte shipped.

On escaping: rendering untrusted text as Markdown is the same class of problem as rendering it as
HTML. Escaping first and restricting link schemes is what every careful renderer does, and it is
cheap when the renderer is a subset.

## Measurements

No performance claim, so none required. A report renders when a person asks for one.

| Scenario | Rows | Before | After |
| :--- | ---: | ---: | ---: |
| — | — | — | — |

## Open questions

None.
