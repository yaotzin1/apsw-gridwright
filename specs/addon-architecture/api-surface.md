# API surface contract: add-on architecture

> **Immutable during stage 6.** An implementation that finds this wrong stops and returns to stage 3.

## Semver classification

**major.** The package is unpublished and in development (no version on the npm registry), so no
consumer is broken; the classification is recorded because the workflow requires it and because the
first published changelog must read truthfully.

Breaking: feature props removed from `<Gridwright />`; `plugins` changes from replacing to adding;
`TreeGridwright` and `useTreeGridwright` removed; `GridwrightLabels`, `MessageKey`, `MessageCatalog`
and the `apsw-gridwright/locales` packs lose every feature string; `TranslateFn` takes `string`;
`GridwrightColumn.edit` and `.filter` move to augmentation (the property names and types are
unchanged for a consumer who imports the package). `GridwrightClassNames.footer` removed at stage 8:
the shell never applied it, so setting it had no effect, but deleting a type member is still a break
for code that names it.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `GridAddon`, `AddonSetupContext`, `AddonContribution`, `ExtraColumn`, `AnnouncementChange`, `AnnouncementContributor`, `AddonMessages`, `ResolvedContributions` | `./react` | types, see `data-model.md` |
| `coreAddons` | `./react` | `<TRow>() => GridAddon<TRow>[]` |
| `sorting` | `./react` | `<TRow>(options?: SortingOptions) => GridAddon<TRow>` |
| `selection` | `./react` | `<TRow>(options?: SelectionOptions) => GridAddon<TRow>` |
| `pagination` | `./react` | `<TRow>(options?: PaginationOptions) => GridAddon<TRow>` |
| `staleNotice` | `./react` | `<TRow>() => GridAddon<TRow>` |
| `search` | `./react` | `<TRow>(options?: SearchOptions) => GridAddon<TRow>` |
| `columnFilters` | `./react` | `<TRow>(options?: ColumnFiltersOptions) => GridAddon<TRow>` |
| `exportMenu` | `./react` | `<TRow>(options?: GridExportOptions<TRow>) => GridAddon<TRow>` |
| `rowActions` | `./react` | `<TRow>(options: RowActionsOptions<TRow>) => GridAddon<TRow>` |
| `inlineEditing` | `./react` | `<TRow>(options: InlineEditingOptions) => GridAddon<TRow>` |
| `treeData` | `./react` | `<TRow>(options: TreeDataOptions<TRow>) => GridAddon<TRow>` |
| `virtualRows` | `./react` | `<TRow>(options?: GridVirtualOptions) => GridAddon<TRow>` |
| `useAddonMessages` | `./react` | `(addonName: string) => (key: string, values?: TranslateValues) => string` |
| `useGridContributions` | `./react` | `<TRow>() => ResolvedContributions<TRow>` |
| `useVirtualScroll` | `./react` | `() => { scrollToIndex(index: number): void; containerRef: RefObject<HTMLElement | null> } \| null` |
| `GridRowView` | `./react` | the row renderer both bodies use |
| `auditAddonMessages` | `.` | `(messages: AddonMessages) => Readonly<Record<string, readonly string[]>>` |
| `PluginContext.suppressStage` | `.` | `(stageId: string) => Unsubscribe` |
| `PipelineStage.skip` | `.` | `(context: PipelineContext<TRow>) => boolean` |
| `GridEngineOptions.corePlugins` | `.` | `boolean`, default `true` |
| `GridApi.removePlugin` | `.` | `(name: string) => boolean`. Runs the named plugin's teardown, whether it was installed at creation or through `use`; false when none is installed. Added at stage 6 when reconciling a changed `plugins` list showed that creation-time plugins had no removal path (recorded, not silently widened). |
| `GridAddon.after`, `GridAddon.before`, `AddonContribution.toolbarStatus`, `AnnouncementContributor.key`, `AnnouncementChange.t` | `./react` | added at stage 6, see spec §8 |
| `GridContext`, `SlotRender`, `ContributedAttributes`, `StatusContribution`, `TableWrapperContribution`, `ResolvedAddon`, `AddonTranslate` | `./react` | types of the contract |
| `GridwrightInstance.announce`, `GridwrightInstance.contributions` | `./react` | `(message: string) => void`; the resolved contributions |
| `GridRoot`, `GridSlot`, `GridRowOrCustom`, `GridStatusBody`, `bodyStatusOf`, `headerContentOf`, `GridSearch` | `./react` | shell parts and helpers for a layout of your own |
| `addonMessages`, `mergeAttributes`, `orderAddons`, `resolveContributions`, `addonNamesOf` | `./react` | add-on tooling without hooks |
| `useBubbleMenu`, `BubbleMenuView`, `BubbleMenuController`, `BubbleMenuRowHandlers` | `./react` | the row menu, split so an add-on attaches it through `rowAttributes` |
| `*_ADDON` name constants and `*Messages` English catalogs of the built-in add-ons | `./react` | so an application can suppress, require, order against or translate them |
| `LocaleCatalog.addons`, `AddonCatalog`, `AddonMessages`, `MessageOverrides`, `Translator.translateAddon` | `.`, `./locales` | add-on strings in the packs and their resolution |
