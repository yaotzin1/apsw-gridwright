# Tasks: data export

Ordered by dependency. Core first, adapter second, documentation last.

## Core

- [x] **T-01** `ExportTable` and the value resolution: `exportValue`, then `getText`, then raw.
- [x] **T-02** `formatCsv` with RFC 4180 quoting, configurable delimiter and newline, byte order
      mark, and formula-injection escaping.
- [x] **T-03** `formatMarkdownTable` and `formatMarkdownTemplate`.
- [x] **T-04** `formatExcelXml`, typed cells, escaped markup.
- [x] **T-05** `formatPrintHtml`, self-contained styles, escaped markup.

## Data sources

- [x] **T-06** `DataSource.fetchAll`, optional, same request shape.
- [x] **T-07** `GridApi.getMatchingRows` and `GridApi.fetchAllRows`.

## Adapter

- [x] **T-08** `downloadTextFile` and `printHtmlDocument`.
- [x] **T-09** `useGridExport`, resolving scope to rows and format to a file.
- [x] **T-10** `GridExportMenu`, a button and a `role="menu"`, with its own live region.
- [x] **T-11** The `export` prop on `Gridwright`, and seven labels in five locales.

## Tests

- [x] **T-12** Unit coverage for every serializer, both sides of the capability seam for row
      resolution, and the injection escaping.
- [x] **T-13** React coverage for the menu, queried by role, including focus return.
- [x] **T-14** Smoke coverage for the new exports through the export map.

## Documentation

- [x] **T-15** `docs/export.md`, README, CHANGELOG under Unreleased
- [x] **T-16** `specs/DEPENDENCY_MAP.md`
- [x] **T-17** The playground exports what is on screen

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md

## Addendum: the reader chooses the rows (2026-09-12)

- [x] **T-18** `GridApi.canFetchAllRows()`, with unit coverage on both sides of the seam
- [x] **T-19** Six message keys in five locales, six labels
- [x] **T-20** `useGridExport` owns scope, availability and fallback; failures are translated
- [x] **T-21** `GridExportMenu` renders the "Rows" group and the reason
- [x] **T-22** React coverage by role: choosing a scope, disabled items, fixed scope, translated failure
- [x] **T-23** Styles, docs/export.md, README, CHANGELOG, playground hint and README
- [x] **T-24** `npm run verify`, then every toggle clicked in Chrome
