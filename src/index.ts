/**
 * apsw-gridwright core: a headless, component-oriented grid engine.
 *
 * Nothing exported here touches the DOM or React. The React table component lives behind
 * `apsw-gridwright/react`, so importing this entry in a Node script, a worker or a test costs
 * nothing beyond the engine itself.
 */

export { createGridEngine } from './core/engine';
export { GridEmitter } from './core/emitter';
export { GridwrightError, isAbortError, isRetryableStatus, toGridError } from './core/errors';
export { findColumn, resolveColumns, visibleColumns } from './core/columns';
export { runPipeline, STAGE_ORDER, type PipelineRunResult, type PipelineRunOptions } from './core/pipeline';
export { createQuery, normalizeQuery, queriesEqual, resetsPage, DEFAULT_PAGE_SIZE } from './core/query';
export { compareValues, isNullish, matchesFilter, toText } from './core/values';

export {
    corePlugins,
    filteringPlugin,
    paginationPlugin,
    searchPlugin,
    sortingPlugin,
    FILTERING_STAGE_ID,
    PAGINATION_STAGE_ID,
    SEARCH_STAGE_ID,
    SORTING_STAGE_ID,
    type SearchPluginOptions,
} from './plugins';

export {
    createLocalDataSource,
    createRemoteDataSource,
    createRestDataSource,
    defaultBuildParams,
    defaultParseResponse,
    type LocalDataSource,
    type LocalDataSourceOptions,
    type RemoteDataSource,
    type RemoteDataSourceOptions,
    type RemoteFetcher,
    type RestDataSourceOptions,
    type RestParams,
    type RetryPolicy,
} from './data';

export type {
    ColumnAlign,
    ColumnDef,
    DataSource,
    DataSourceCapabilities,
    DataSourceRequest,
    DataSourceResult,
    FilterOperator,
    FilterSpec,
    GridApi,
    GridEngineOptions,
    GridError,
    GridEventMap,
    GridEventName,
    GridPlugin,
    GridQuery,
    GridRow,
    GridState,
    GridStatus,
    PaginationSpec,
    PipelineContext,
    PipelineOutput,
    PipelineStage,
    PluginContext,
    ResolvedColumn,
    RowId,
    SelectionMode,
    SortDirection,
    SortSpec,
    Unsubscribe,
} from './core/types';

export const VERSION = '0.1.0';
