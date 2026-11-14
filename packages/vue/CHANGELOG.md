# Changelog

All notable changes to `@apsw/gridwright-vue` are documented here.

## [Unreleased]

### Fixed

- `<Gridwright>` no longer rebuilds its host whenever a prop changes by identity. An inline `:columns`, `:labels` or `:data` used to reset sort, selection and page on every parent re-render. Columns now update the live engine by signature, `data` and `dataSource` through `setDataSource` (the query is kept), and only options the host bakes in (add-on names, `selectionMode`, `pageSize`, `caption`, `ariaLabel`, `labels`, `i18n`, compared by value) build a new host. `getRowId` and `initialQuery` are read at mount only.
- `useGridwright` no longer warns when called outside a component or effect scope; destroy the host yourself there.

## [0.1.1] — 2026-11-14

### Changed

- Republished `@apsw/gridwright-vue` (`0.1.1`) to validate npm OIDC trusted publishing; no API or runtime changes from `0.1.0`.

## [0.1.0] — 2026-11-14

### Added

- Initial Vue 3 adapter package (`<Gridwright>`, `useGridwright`, `renderViewNode`, `GridwrightColumn`, and scoped `#cell`, `#cell-<columnId>`, and `#toolbar` slots) built on `@apsw/gridwright/view`.
