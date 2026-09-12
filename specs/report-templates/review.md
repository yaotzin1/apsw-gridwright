# Self-review: report templates and custom formats

## 1. Boundary and layering

Rendering Markdown is text in, text out, so it sits in `src/core/export/` beside the serializers,
where the headless lint glob already covers it. The printable document wrapper was pulled out of
the table print so both documents share it rather than each carrying a copy of the stylesheet.
Printing stays in the adapter, in the function that already owned the frame.

Format resolution is its own adapter module rather than inline in the menu, because the hook needs
the same answer: the menu needs a label, the announcement needs a name, and both come from one
place.

## 2. The local/remote seam

Untouched. A report is built from rows a scope already resolved, so exporting everything from a
paginating source still asks `fetchAll` and still refuses when there is none. A custom serializer
is handed the resolved rows and cannot reach around that.

## 3. Public surface and semver

Minor. Two optional fields on an options object, three core exports, two adapter exports, and five
widenings that accept strictly more than before. The one rename, `downloadTextFile` to
`downloadFile`, is of a name added in this same unreleased cycle, so nothing published carries it;
the old name would have been a lie once the content could be bytes.

`ExportFormat` stayed a union of the four names this package writes. The escape hatch is a separate
type, `ExportFormatOption`, which is the union plus an object. That keeps autocomplete useful for
the built-in names instead of degrading them to `string`.

## 4. Accessibility and i18n

A custom format is a `menuitem` like any other, in the same `role="menu"`, reached by the same
arrow keys, announced through the same region. No new message keys: the four built-in labels
already existed, and a custom label arrives already translated. That is a deliberate limitation,
and `spec.md` says why: a key this package does not ship has nothing to fall back to.

## 5. Supply chain and packaging

Still zero runtime dependencies, and the audit checks it. Both routes to a PDF avoid an engine: the
browser writes one from a document, or a service writes one from the same Markdown and hands back
bytes the downloader saves.

The renderer is the new attack surface and it is the one thing here worth reading twice. Every
character is escaped before any markup is decided, so a cell holding a script tag is text. A link
whose target carries a scheme outside `http`, `https`, `mailto` and `tel` is rendered as the text
somebody wrote rather than as an anchor. Both are tested, including the script-URL case.

## 6. Honest output

The subset is documented rather than implied, and anything outside it survives as its own text, so
a template using an unsupported construct produces a document with that construct visible in it
instead of a section that silently vanished. The limits of printing, that page size and margins
belong to the reader's settings, are written down beside the feature rather than discovered.

An unregistered format id throws. The alternative was a menu item that does nothing, which is the
hardest kind of bug to find and the easiest to ship.

## 7. Verification

```
> apsw-gridwright@0.5.0 verify

      Tests  407 passed (407)
      Tests  20 passed (20)

  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   core ESM entry exports 25 expected names
  ok   react ESM entry exports 17 expected names
  ok   both entries share one module instance

the published package resolves cleanly.
```

Checked in Chrome against the built package, through the module the page itself loads. The
playground's own report format appears in the menu as a fifth item beside the four built-in ones.
Rendering a report from `dist/index.js` produced the heading, the per-row sections, the export
value rather than the formatted currency, emphasis in the footer, and no anchor at all for a link
written with a script URL. The adapter's print path was driven far enough to prove the document,
the frame is created with the rendered report and the paged-media rules, and torn down in the same
task so no dialog opened. The switch went back off, the grid returned to its plain state, and the
console stayed empty.

## Known gaps

- **The print dialog was again not opened.** It is modal and freezes the automation session. What
  is proven is the document handed to it.
- **The Markdown subset is a subset.** Nested lists, reference links, footnotes, inline HTML and
  setext headings are not rendered. They appear as text.
- **A cell containing Markdown syntax is interpreted.** A value holding asterisks emphasises. That
  is what a template language does; `exportValue` is where to neutralise it.
- **No page numbers, running headers or footers in the printed output.** Those are print settings,
  and CSS paged-media support for them is uneven across browsers.
