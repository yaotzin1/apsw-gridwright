/**
 * The React adapter for apsw-gridwright.
 *
 * Import the stylesheet once in your application: `import 'apsw-gridwright/styles.css'`. It is
 * structural only and drives everything visible from CSS custom properties, so a theme is a
 * handful of variable overrides rather than a fork of the component.
 */

export { Gridwright } from './Gridwright';
export {
    GridwrightProvider,
    useGridwrightContext,
    useTranslator,
    type GridwrightContextValue,
    type GridwrightProviderProps,
} from './context';
export { useGridwright, columnSignature, addonNamesOf } from './useGridwright';
export { defaultLabels, labelsFrom, mergeLabels } from './labels';

// The add-on contract, and what an add-on of your own builds with.
export type {
    AddonContribution,
    AddonMessages,
    AddonSetupContext,
    AnnouncementChange,
    AnnouncementContributor,
    ContributedAttributes,
    ExtraColumn,
    GridAddon,
    GridContext,
    ResolvedAddon,
    ResolvedContributions,
    SlotRender,
    StatusContribution,
    TableWrapperContribution,
} from './addons/types';
export { addonMessages, useAddonMessages, useGridContributions, type AddonTranslate } from './addons/context';
export { mergeAttributes, orderAddons, rendersSomething, resolveContributions } from './addons/resolve';

// The add-ons this package ships. Every one is built from the exports above and nothing else.
export {
    coreAddons,
    pagination,
    search,
    selection,
    sorting,
    staleNotice,
    GridSearch,
    PAGINATION_ADDON,
    SEARCH_ADDON,
    SELECTION_ADDON,
    SORTING_ADDON,
    STALE_NOTICE_ADDON,
    paginationMessages,
    searchMessages,
    selectionMessages,
    sortingMessages,
    staleNoticeMessages,
    type GridSearchProps,
    type CoreAddonOptions,
    type PaginationOptions,
    type SelectionOptions,
    type SortingOptions,
} from './core-addons';

export {
    treeData,
    TREE_ADDON,
    treeMessages,
    TreeProvider,
    TreeCell,
    reactTreeColumns,
    useTreeContext,
    useOptionalTreeContext,
    useNodeState,
    rowDataOf,
} from './tree';
export type { TreeCellProps, TreeContextValue, TreeDataOptions, TreeProviderProps } from './tree';

export {
    BubbleMenu,
    BubbleMenuView,
    useBubbleMenu,
    InlineEditProvider,
    editableColumns,
    inlineEditing,
    rowActions,
    rowElement,
    useInlineEdit,
    useInlineEditContext,
    INLINE_EDITING_ADDON,
    ROW_ACTIONS_ADDON,
    rowActionsMessages,
} from './plugins';
export type {
    BubbleMenuController,
    BubbleMenuItem,
    BubbleMenuProps,
    BubbleMenuRowHandlers,
    BubbleMenuViewProps,
    BubbleMenuTrigger,
    ColumnEditOptions,
    CommitEdit,
    EditorContext,
    InlineEditController,
    InlineEditingOptions,
    InlineEditProviderProps,
    RowActionsOptions,
} from './plugins';

export {
    exportMenu,
    EXPORT_ADDON,
    exportMessages,
    GridExportMenu,
    useGridExport,
    downloadFile,
    markdownReportFormats,
    printHtmlDocument,
    printMarkdownDocument,
} from './export';
export type {
    CustomExportFormat,
    DownloadOptions,
    MarkdownReportOptions,
    MarkdownReportOutput,
    ExportContext,
    ExportFile,
    ExportFormatOption,
    ExportSerializer,
    FormatText,
    GridExportController,
    GridExportMenuProps,
    GridExportOptions,
} from './export';

export {
    columnFilters,
    COLUMN_FILTER_OPERATORS,
    ColumnFilterProvider,
    ColumnFilterTrigger,
    FILTERS_ADDON,
    filterMessages,
    GridFilterClear,
    operatorLabel,
    useColumnFilters,
    useOptionalColumnFilters,
} from './filters';
export type {
    ColumnFilterChoice,
    ColumnFilterContextValue,
    ColumnFilterOptions,
    ColumnFilterProviderProps,
    ColumnFilterTriggerProps,
    ColumnFilterType,
    GridFilterClearProps,
} from './filters';

export {
    columnLayout,
    COLUMN_LAYOUT_ADDON,
    columnLayoutMessages,
    ColumnLayoutProvider,
    GridColumnPicker,
    GridResizeHandle,
    autoFitWidth,
    clampWidth,
    columnWidthProperty,
    columnWidthVar,
    moveInOrder,
    orderedColumns,
    pixelWidth,
    stickyOffsets,
    useColumnLayout,
    useColumnLayoutController,
    useOptionalColumnLayout,
} from './layout';
export type {
    ColumnLayoutChange,
    ColumnLayoutColumnOptions,
    ColumnLayoutController,
    ColumnLayoutOptions,
    ColumnLayoutProviderProps,
    ColumnLayoutState,
    ColumnPin,
    GridColumnPickerProps,
    GridResizeHandleProps,
    LayoutColumn,
    StickyOffsets,
    WidthBounds,
} from './layout';

export {
    rowDetail,
    ROW_DETAIL_ADDON,
    rowDetailMessages,
    RowDetailProvider,
    GridDetailToggle,
    GridRowDetail,
    useRowDetail,
    useOptionalRowDetail,
} from './detail';
export type {
    GridDetailToggleProps,
    GridRowDetailProps,
    RowDetailContext,
    RowDetailController,
    RowDetailOptions,
    RowDetailProviderProps,
} from './detail';

export { virtualRows, useVirtualScroll, VIRTUAL_ADDON, GridVirtualBody, useVirtualRows } from './virtual';
export type { GridVirtualBodyProps, GridVirtualOptions, VirtualRows, VirtualRowsOptions, VirtualScroll } from './virtual';

export { urlSync, URL_SYNC_ADDON, serializeGridQuery, parseGridQuery, formatSearchParams } from './url-sync';
export type {
    GridQueryParamsOptions,
    ParseGridQueryOptions,
    UrlSyncAdapter,
    UrlSyncFacet,
    UrlSyncHistoryMode,
    UrlSyncOptions,
} from './url-sync';

// The shell's parts, for a layout composed by hand.
export {
    GridBody,
    GridCell,
    GridRowOrCustom,
    GridRowView,
    GridStatusBody,
    bodyStatusOf,
    type GridBodyStatus,
    type GridRowViewProps,
} from './parts/GridBody';
export { GridHeader, headerContentOf } from './parts/GridHeader';
export { GridPagination, type GridPaginationProps } from './parts/GridPagination';
export { GridRoot, type GridRootProps } from './parts/GridRoot';
// `columnCountOf` is how an add-on builds a row that spans the table: the same number the status
// row uses, rather than one each add-on recomputes slightly differently.
export { GridSlot, columnCountOf, type GridSlotProps } from './parts/slots';
export { GridStaleNotice } from './parts/GridStaleNotice';
export { GridTable, type GridTableProps } from './parts/GridTable';
export { GridToolbar, type GridToolbarProps } from './parts/GridToolbar';

export type {
    CellContext,
    GridwrightClassNames,
    GridwrightColumn,
    GridwrightI18nProps,
    GridwrightInstance,
    GridwrightLabels,
    GridwrightProps,
    HeaderContext,
    UseGridwrightOptions,
} from './types';

// Re-exported so a React consumer needs one import path for the common case.
export {
    buildExportTable,
    formatCsv,
    formatExcelXml,
    formatMarkdownTable,
    formatMarkdownDocument,
    formatMarkdownTemplate,
    formatPrintDocument,
    formatPrintHtml,
    markdownToHtml,
    EXPORT_MIME_TYPES,
    createGridEngine,
    createLocalDataSource,
    createRemoteDataSource,
    createRestDataSource,
    createTranslator,
    auditAddonMessages,
    englishCatalog,
    GridwrightError,
    STAGE_ORDER,
} from '../index';

export type {
    AddonCatalog,
    LocaleCatalog,
    Message,
    MessageCatalog,
    MessageKey,
    MessageOverrides,
    PluralMessage,
    TranslateFn,
    TranslateValues,
    Translator,
} from '../i18n';

export type {
    CsvOptions,
    ExcelOptions,
    ExportFormat,
    ExportScope,
    ExportTable,
    ExportTableColumn,
    ExportTableRow,
    MarkdownTemplateOptions,
    PrintOptions,
} from '../core/export';

export type {
    ColumnDef,
    DataSource,
    DataSourceCapabilities,
    DataSourceRequest,
    DataSourceResult,
    FilterOperator,
    FilterSpec,
    GridApi,
    GridError,
    GridPlugin,
    GridQuery,
    GridRow,
    GridState,
    GridStatus,
    MatchingRows,
    PipelineStage,
    ResolvedColumn,
    RowId,
    SelectionMode,
    SortDirection,
    SortSpec,
} from '../core/types';
