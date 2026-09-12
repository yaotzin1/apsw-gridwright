# Tasks: report templates and custom formats

## Core

- [x] **T-01** `header` and `footer` on the Markdown template, string or function of the rows.
- [x] **T-02** `markdownToHtml`: the documented subset, escaped first, link schemes restricted.
- [x] **T-03** `formatPrintDocument` extracted; `formatMarkdownDocument` built on it.

## Adapter

- [x] **T-04** `printMarkdownDocument`.
- [x] **T-05** `downloadFile` accepting a `Blob`.
- [x] **T-06** Format resolution: built-in names and custom formats to menu entries.
- [x] **T-07** The menu and the hook resolve by id; an unregistered id is an error.

## Tests

- [x] **T-08** Unit coverage for the report document, the renderer, the escaping and the link rule.
- [x] **T-09** React coverage for a custom format in the menu, its context, and the unknown id.
- [x] **T-10** Smoke coverage through the built package, core and React.

## Documentation

- [x] **T-11** README, docs/export.md, CHANGELOG
- [x] **T-12** specs/DEPENDENCY_MAP.md
- [x] **T-13** The playground and the typed example both produce a report

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
