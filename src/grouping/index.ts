export { computeAggregate } from './aggregate';

export { createGroupingController } from './controller';
export type { GroupingController, GroupingControllerOptions } from './controller';

export { groupColumn, groupColumns } from './columns';

export { ungroupedRows } from './rows';

export { createGroupingDataSource } from './data-source';
export type { GroupingDataSourceOptions } from './data-source';

export { GROUPING_PLUGIN_NAME, GROUPING_STAGE_ID, GROUPING_SUMMARY_META_KEY, groupingPlugin } from './plugin';
export type { GroupingPluginOptions } from './plugin';

export type {
    AggregateAccumulator,
    AggregateSpecFn,
    BuiltinAggregate,
    GroupAggregateSpec,
    GroupedRow,
    GroupHeaderRow,
    GroupId,
    GroupMemberRow,
} from './types';
