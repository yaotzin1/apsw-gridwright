# Changelog

All notable changes to `apsw-gridwright-mui` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html). The grid itself has its own changelog.

## [Unreleased]

## [0.3.2] — 2026-10-05

### Documentation

- The README says that a single view (`muiSorting()`, `muiSelection()`, `muiPagination()`) does not apply the MUI
  theme, that `muiTheme()` has to be added beside it, and how the grid behaves when the theme and the operating system's
  colour scheme disagree.

## [0.3.1] — 2026-10-03

### Changed

- The peer range on `apsw-gridwright` is `^0.14.1`, the grid release that carries the cell-navigation focus fix and the
  hardened link-scheme check in the markdown report. The views themselves are unchanged.

## [0.3.0] — 2026-10-02

### Added

- The views are covered by the grid's `responsive()` suite, which now runs against them: wrapping, hidden columns, stacked cards and the touch sizes reach them through the `gw-*` classes they keep. No API change.

### Changed

- The peer range on `apsw-gridwright` is `^0.14.0`, the grid release that ships `responsive()`; the showcase uses it. The views themselves need nothing from it.

## [0.2.0] — 2026-10-01

### Changed

- **Needs `apsw-gridwright@^0.13.0`** (minor). The sort label calls `useHeaderCellTabIndex`, new in
  0.13.0, so it leaves the Tab order when `cellNavigation({ headerRow: true })` brings the header
  into the cursor. The floor also carries 0.13.0's fix for numeric character references in
  `markdownToHtml`'s link-scheme check. Nothing changes for a grid that does not set `headerRow`.

## [0.1.1] — 2026-09-29

### Fixed

- **Peer dependency floor raised to `apsw-gridwright@^0.12.1`** (patch, security). 0.12.1 fixed an
  XSS in `markdownToHtml`'s link-scheme check and two formula-injection gaps in export (Excel XML,
  and CSV/clipboard headers); `^0.12.0` let a consumer pair this package with the vulnerable 0.12.0
  with no warning. No code in this package changed. Thanks to #25, #26, #27.

## [0.1.0] — 2026-09-25

### Added

- **First release** (0.1.0). `muiAddons()`, `muiTheme()`, `muiSorting()`, `muiSelection()`,
  `muiPagination()` and `muiTokens()`. Needs `apsw-gridwright` 0.12 and `@mui/material` 7 or 9.
  See `specs/mui-integration` in the repository.

[Unreleased]: https://github.com/yaotzin1/apsw-gridwright/compare/mui-v0.3.1...HEAD
[0.3.1]: https://github.com/yaotzin1/apsw-gridwright/compare/mui-v0.3.0...mui-v0.3.1
[0.3.0]: https://github.com/yaotzin1/apsw-gridwright/compare/mui-v0.2.0...mui-v0.3.0
[0.2.0]: https://github.com/yaotzin1/apsw-gridwright/compare/mui-v0.1.1...mui-v0.2.0
[0.1.1]: https://github.com/yaotzin1/apsw-gridwright/compare/mui-v0.1.0...mui-v0.1.1
[0.1.0]: https://github.com/yaotzin1/apsw-gridwright/releases/tag/mui-v0.1.0
