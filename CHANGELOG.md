# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

A changed default is treated as a breaking change even though nothing fails to compile: the
consumer's build stays green and their grid behaves differently, which is exactly what makes it
worth a major.

## [Unreleased]

## [0.1.0] — 2026-09-10

Initial release.

### Added

- **Headless grid engine** (`createGridEngine`) with sequenced, abortable fetching, a plugin
  pipeline, selection, and one published state shape for every kind of data source.
- **Capability negotiation.** A data source declares which query facets it resolved through
  `capabilities`; the pipeline applies the rest. An in-memory array and a paginating endpoint use
  the same code path, so moving between them changes one prop and nothing else.
- **Data sources.** `createLocalDataSource` for an array, answering synchronously so a local grid
  renders on the first paint. `createRemoteDataSource` for any async function, with backoff on
  retryable failures, abort handling, and `invalidate()`. `createRestDataSource` for REST
  endpoints, with parameter encoding, envelope tolerance across five common shapes, `X-Total-Count`
  support, and extraction of the server's own error message.
- **Plugins.** Filtering, search, sorting and pagination ship as ordinary plugins with no
  privileged access. `STAGE_ORDER` names seven slots, including a `TRANSFORM` slot reserved for
  grouping. A stage that throws loses its own effect and nothing else.
- **React adapter** (`apsw-gridwright/react`): the `Gridwright` component, the `useGridwright`
  hook, and five composable parts usable independently under `GridwrightProvider`.
- **Unstyled stylesheet** (`apsw-gridwright/styles.css`): structural CSS over `--gw-*` custom
  properties, dark mode in both directions, reduced-motion support.
- **Full interface copy in `labels`.** Sixteen strings, all replaceable. `pageRange` is a function
  because word order around numbers differs by language.
- **Accessibility.** A real `<table>` with `role="grid"`, sort controls as buttons, `aria-sort` on
  the header cell, states rendered inside the table, a live region for loading, `role="alert"` for
  errors.
- **Honest totals.** A paginating source that sends no count produces `isTotalExact: false`, and
  the grid says "of many" rather than computing a number from one page.
- Dual ESM and CommonJS output with separate `.d.ts` and `.d.cts` type entry points, and a shared
  chunk so both entries are one module instance.

### Notes

- Zero runtime dependencies. React 18 or 19 is an optional peer dependency, needed only for the
  React entry.
- `selectionMode` defaults to `none`. A checkbox column nobody asked for is a column the reader has
  to account for.
- Not included: row virtualization, inline editing, column resize and reorder, grouping and
  aggregation. See the non-goals in `specs/gridwright-core/spec.md`.

[Unreleased]: https://github.com/apsw/apsw-gridwright/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/apsw/apsw-gridwright/releases/tag/v0.1.0
