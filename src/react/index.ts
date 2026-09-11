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
} from './context';
export { useGridwright } from './useGridwright';
export { defaultLabels, labelsFrom, mergeLabels } from './labels';

export {
    TreeGridwright,
    TreeProvider,
    TreeCell,
    reactTreeColumns,
    useTreeGridwright,
    useTreeContext,
    useOptionalTreeContext,
    useNodeState,
    rowDataOf,
} from './tree';
export type {
    TreeCellProps,
    TreeContextValue,
    TreeGridwrightInstance,
    TreeGridwrightProps,
    TreeProviderProps,
    UseTreeGridwrightOptions,
} from './tree';

export {
    BubbleMenu,
    InlineEditProvider,
    editableColumns,
    rowElement,
    useInlineEdit,
    useInlineEditContext,
} from './plugins';
export type {
    BubbleMenuItem,
    BubbleMenuProps,
    BubbleMenuTrigger,
    ColumnEditOptions,
    CommitEdit,
    EditorContext,
    InlineEditController,
    InlineEditProviderProps,
} from './plugins';

export { GridVirtualBody, useVirtualRows } from './virtual';
export type { GridVirtualBodyProps, VirtualRows, VirtualRowsOptions } from './virtual';

export { GridBody, GridCell, type GridBodyProps } from './parts/GridBody';
export { GridHeader, type GridHeaderProps } from './parts/GridHeader';
export { GridPagination, type GridPaginationProps } from './parts/GridPagination';
export { GridStaleNotice } from './parts/GridStaleNotice';
export { GridTable, type GridTableProps } from './parts/GridTable';
export { GridToolbar, type GridToolbarProps } from './parts/GridToolbar';

export type {
    CellContext,
    GridTreeOptions,
    GridVirtualOptions,
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
    createGridEngine,
    createLocalDataSource,
    createRemoteDataSource,
    createRestDataSource,
    createTranslator,
    englishCatalog,
    GridwrightError,
    STAGE_ORDER,
} from '../index';

export type {
    LocaleCatalog,
    MessageCatalog,
    MessageKey,
    PluralMessage,
    TranslateFn,
    Translator,
} from '../i18n';

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
    PipelineStage,
    ResolvedColumn,
    RowId,
    SelectionMode,
    SortDirection,
    SortSpec,
} from '../core/types';
