# Tasks: add-on architecture

## Core

- [x] **T-01** `corePlugins` option; `plugins` added to the core set in `createGridEngine`.
- [x] **T-02** `PluginContext.suppressStage` with reference counts, released on plugin teardown.
- [x] **T-03** `PipelineStage.skip`.
- [x] **T-04** `treePlugins` suppress `core:filter`, `core:search`, `core:sort` instead of replacing the list.
- [x] **T-05** Unit tests: additive plugins, `corePlugins: false`, suppression and release, `skip`, tree
      composing with a third-party plugin.

## i18n

- [x] **T-06** `TranslateFn` on `string`; `formatMessage(message, values)` on the translator.
- [x] **T-07** Core catalog trimmed to shell keys in all five locales; feature keys moved to add-ons.
- [x] **T-08** `auditAddonMessages`; tests.

## Adapter: contract and shell

- [x] **T-09** `src/react/addons/types.ts`, `resolve.ts` (order, unique, requires, suppression, owners,
      navigation, attribute merge) with unit tests.
- [x] **T-10** Contributions context, `useGridContributions`, `useAddonMessages`.
- [x] **T-11** `useGridwright`: add-on setup and `configure`, plugin reconciliation, remount key,
      `contributions` on the instance.
- [x] **T-12** Shell `Gridwright` and `GridRoot` (provide wraps, above, below, overlays, announcements).
- [x] **T-13** Parts: `GridToolbar`, `GridTable` (attributes, wrapper, keyboard, footer), `GridHeader`
      (extra columns, before, label owner, after, attributes), `GridBody` and `GridRowView` (extra columns,
      row and cell attributes, `renderRow`, status).

## Adapter: add-ons

- [x] **T-14** `sorting()`, `selection()`, `pagination()`, `staleNotice()`, `search()`, `coreAddons()`.
- [x] **T-15** `columnFilters()`.
- [x] **T-16** `exportMenu()` (announcements through the grid's region).
- [x] **T-17** `inlineEditing()`.
- [x] **T-18** `rowActions()` through row attributes.
- [x] **T-19** `virtualRows()`, `useVirtualScroll()`, rows through `GridRowView`.
- [x] **T-20** `treeData()`; remove `TreeGridwright`, `useTreeGridwright`; forward `plugins`,
      `onSelectionChange`; virtualized tree ARIA.
- [x] **T-21** Column option augmentation for `edit` and `filter`, verified on the built `.d.ts` and `.d.cts`.

## Tests

- [x] **T-22** Rewrite the React suites to add-ons.
- [x] **T-23** A third-party add-on from public exports using every slot.
- [x] **T-24** Tree-shaking: an entry importing only `Gridwright` excludes feature code.
- [x] **T-25** Smoke suite through the built package; export audit lists the new names.

## Documentation

- [x] **T-26** `docs/addons.md`: the contract, every slot, writing an add-on, messages, column options.
- [x] **T-27** README, `docs/*` updated to add-ons; `docs/extensibility.md` rewritten around the eleven
      extension points plus add-ons.
- [x] **T-28** Every spec gains "Delivery as a plugin"; draft specs corrected (nonexistent files, props,
      closed query); `data-export/spec.md` status and criteria reconciled with the code.
- [x] **T-29** CHANGELOG (breaking section), `specs/DEPENDENCY_MAP.md`, AGENTS.md repository map,
      skills (`extensibility`, `react_adapter`, `architect`) updated to add-ons.
- [x] **T-30** Playground and typed example on add-ons, including a third-party add-on of the page's own.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [ ] Both playground pages, every add-on on and off, in Chrome (done except scrolling ten million rows: the tab was hidden; see review.md)
