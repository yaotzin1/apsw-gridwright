import { GridwrightError } from '../core/errors';
import { STAGE_ORDER } from '../core/pipeline';
import { compareValues } from '../core/values';
import type { ColumnValue, GridPlugin, PipelineContext, ResolvedColumn } from '../core/types';
import { computeAggregate } from './aggregate';
import type { GroupingController } from './controller';
import type { GroupAggregateSpec, GroupedRow, GroupHeaderRow, GroupMemberRow } from './types';

export const GROUPING_STAGE_ID = 'gridwright:group';
export const GROUPING_PLUGIN_NAME = 'gridwright:grouping';

/** Key `groupingPlugin` publishes on `state.meta` when `summary` is on: `gridwright:grouping:summary`. */
export const GROUPING_SUMMARY_META_KEY = 'summary';

/** Key it always publishes: `gridwright:grouping:records`, the page range counted in records, headers excluded. */
export const GROUPING_RECORDS_META_KEY = 'records';

export interface GroupingPluginOptions<TRow> {
    readonly controller: GroupingController;
    /** Column ids, in nesting order. The first groups the whole set; the next groups within it. */
    readonly groupBy: readonly string[];
    readonly aggregates?: readonly GroupAggregateSpec<TRow>[];
    /** Publishes a grand-total aggregate over every matching row on `state.meta`. Default false. */
    readonly summary?: boolean;
    /**
     * Skips the stage: the data source is expected to return group headers and member rows itself.
     * A function is asked per pass, for a source whose grouping depends on the query.
     */
    readonly serverGrouped?: boolean | ((context: PipelineContext<GroupedRow<TRow>>) => boolean);
}

type Columns<TRow> = readonly ResolvedColumn<GroupedRow<TRow>, ColumnValue>[];

/**
 * Buckets, aggregates and collapses flat rows into group headers and member rows.
 *
 * Registered at `STAGE_ORDER.TRANSFORM`, after sort so members keep their sorted order and before
 * pagination so a group header counts toward the page like any other row. It does not suppress
 * filtering, search or sorting: they already ran on flat rows, which is what grouping wants.
 *
 * `options` is read fresh on every pass rather than destructured once here. A plugin is reconciled
 * by name: a new plugin object under a name already installed is ignored, so a consumer who wants
 * `groupBy`, `aggregates`, `summary` or `serverGrouped` to change on a live grid without uninstalling
 * and reinstalling the plugin mutates the same `options` object in place — which is exactly what the
 * `grouping()` add-on does, holding it in a ref, since its own options can change on any render.
 */
export function groupingPlugin<TRow>(options: GroupingPluginOptions<TRow>): GridPlugin<GroupedRow<TRow>> {
    return {
        name: GROUPING_PLUGIN_NAME,
        setup(context) {
            const stopListening = options.controller.subscribe(() => context.api.invalidatePipeline());
            let published: GroupedRecordRange | null = null;

            const removeStage = context.registerStage({
                id: GROUPING_STAGE_ID,
                order: STAGE_ORDER.TRANSFORM,
                skip: (pipelineContext) =>
                    typeof options.serverGrouped === 'function' ? options.serverGrouped(pipelineContext) : options.serverGrouped === true,
                run(rows, pipeline) {
                    if (pipeline.capabilities.paginate) {
                        // Grouping needs every matching row in memory. A source that paginates for
                        // itself has left most of them on the server, so bucketing what arrived here
                        // would group one page rather than the result. Refusing, rather than grouping
                        // a fragment silently, is what `plugin:error` exists to report.
                        throw new GridwrightError(
                            `[gridwright] "${GROUPING_PLUGIN_NAME}" cannot group a data source that paginates for itself: it would group one page, not the result. Set serverGrouped so the source returns groups itself, or stop the source from paginating.`,
                            { retryable: false },
                        );
                    }

                    const columns = pipeline.columns as Columns<TRow>;
                    const members = rows.filter((row): row is GroupMemberRow<TRow> => row.kind === 'row');
                    const aggregates = options.aggregates ?? [];

                    if (options.summary) context.setMeta(GROUPING_SUMMARY_META_KEY, computeAggregates(members, aggregates, columns));

                    const grouped = buildLevel(members, options.groupBy, 0, '', aggregates, columns, options.controller);
                    const range = recordRangeOf(grouped, members.length, pipeline.query.pagination);
                    // Only when it moved: every publish is a render, and most passes leave it where it was.
                    if (range.from !== published?.from || range.to !== published.to || range.total !== published.total) {
                        published = range;
                        context.setMeta(GROUPING_RECORDS_META_KEY, range);
                    }
                    return { rows: grouped, totalRows: grouped.length };
                },
            });

            return () => {
                removeStage();
                stopListening();
            };
        },
    };
}

/** What `groupingPlugin` publishes under `GROUPING_RECORDS_META_KEY`: the range counted in records. */
export interface GroupedRecordRange {
    readonly from: number;
    readonly to: number;
    readonly total: number;
}

/**
 * Publishes the page's range counted in records, not in rows.
 *
 * The pipeline pages over every row it is handed, and under grouping those include the group
 * headers, so a range built from `totalRows` read "1-100 of 5,005" for 5,000 people. The reader is
 * counting people: headers are not records. `total` is every record that matches, whatever is
 * collapsed, so it does not change when a group is opened; `from` and `to` count the records on
 * screen, and read 0 when the page holds only headers.
 */
function recordRangeOf(
    grouped: readonly GroupedRow<unknown>[],
    total: number,
    pagination: { readonly pageIndex: number; readonly pageSize: number },
): GroupedRecordRange {
    const start = pagination.pageIndex * pagination.pageSize;
    let before = 0;
    let shown = 0;
    for (let index = 0; index < grouped.length && index < start + pagination.pageSize; index += 1) {
        if (grouped[index]!.kind !== 'row') continue;
        if (index < start) before += 1;
        else shown += 1;
    }
    return shown === 0 ? { from: 0, to: 0, total } : { from: before + 1, to: before + shown, total };
}

function computeAggregates<TRow>(members: readonly GroupMemberRow<TRow>[], aggregates: readonly GroupAggregateSpec<TRow>[], columns: Columns<TRow>): Readonly<Record<string, unknown>> {
    if (aggregates.length === 0) return {};

    const rows = members.map((member) => member.row);
    const result: Record<string, unknown> = {};
    for (const spec of aggregates) {
        const column = columns.find((entry) => entry.id === spec.columnId);
        const values = column ? members.map((member) => column.getValue(member)) : [];
        result[spec.columnId] = computeAggregate(spec.fn, values, rows);
    }
    return result;
}

function groupKeyOf(value: unknown): string {
    if (value === null || value === undefined) return '\u0000';
    if (value instanceof Date) return `d:${value.toISOString()}`;
    return `${typeof value}:${String(value)}`;
}

function buildLevel<TRow>(
    members: readonly GroupMemberRow<TRow>[],
    groupBy: readonly string[],
    depth: number,
    parentGroupId: string,
    aggregates: readonly GroupAggregateSpec<TRow>[],
    columns: Columns<TRow>,
    controller: GroupingController,
): readonly GroupedRow<TRow>[] {
    const columnId = groupBy[depth];
    if (columnId === undefined) return members.map((member) => (member.depth === depth ? member : { ...member, depth }));

    const column = columns.find((entry) => entry.id === columnId);

    const order: string[] = [];
    const buckets = new Map<string, { value: unknown; first: GroupMemberRow<TRow>; members: GroupMemberRow<TRow>[] }>();

    for (const member of members) {
        const value = column ? column.getValue(member) : undefined;
        const bucketKey = groupKeyOf(value);
        let bucket = buckets.get(bucketKey);
        if (!bucket) {
            bucket = { value, first: member, members: [] };
            buckets.set(bucketKey, bucket);
            order.push(bucketKey);
        }
        bucket.members.push(member);
    }

    order.sort((a, b) => compareValues(buckets.get(a)!.value, buckets.get(b)!.value));

    const output: GroupedRow<TRow>[] = [];
    for (const bucketKey of order) {
        const bucket = buckets.get(bucketKey)!;
        const groupId = `${parentGroupId}/${columnId}:${bucketKey}`;
        const expanded = controller.isExpanded(groupId);
        const header: GroupHeaderRow = {
            kind: 'group',
            groupId,
            columnId,
            value: bucket.value,
            key: column ? column.getText(bucket.first) : String(bucket.value ?? ''),
            depth,
            count: bucket.members.length,
            aggregates: computeAggregates(bucket.members, aggregates, columns),
            expanded,
        };
        output.push(header);
        if (expanded) output.push(...buildLevel(bucket.members, groupBy, depth + 1, groupId, aggregates, columns, controller));
    }
    return output;
}
