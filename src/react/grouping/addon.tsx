import { useEffect, useMemo, useRef, useState } from 'react';
import { createLocalDataSource } from '../../data/local';
import type { LocalDataSource } from '../../data/local';
import { GridwrightError } from '../../core/errors';
import type { ColumnValue, DataSource, GridPlugin, RowId } from '../../core/types';
import {
    createGroupingController,
    createGroupingDataSource,
    groupingPlugin,
    GROUPING_PLUGIN_NAME,
    GROUPING_SUMMARY_META_KEY,
} from '../../grouping';
import type { GroupAggregateSpec, GroupedRow, GroupingController, GroupingPluginOptions } from '../../grouping';
import type { GridAddon, GridContext } from '../addons/types';
import type { GridwrightColumn, UseGridwrightOptions } from '../types';
import { TREE_ADDON } from '../tree/messages';
import { reactGroupColumns } from './columns';
import { GroupRow } from './GroupRow';
import { SummaryRow } from './SummaryRow';
import { GROUPING_ADDON, groupingMessages } from './messages';
import type { AggregateSpecFn } from './types';

/** Groups rows by one or more columns, with collapsible headers and column aggregates. */
export interface GroupingOptions {
    /** Column ids, in nesting order. The first groups the whole set; the next groups within it. */
    readonly groupBy: readonly string[];
    /** A grand-total row in the table footer, aggregating across every matching row. Default false. */
    readonly summaryRow?: boolean;
    /** Whether a group starts expanded. Default true. */
    readonly defaultExpanded?: boolean;
    /** The data source already returns group headers and member rows itself. Default false. */
    readonly serverGrouped?: boolean;
}

function defaultRowId<TRow>(row: TRow, index: number): RowId {
    const candidate = (row as { id?: unknown } | null)?.id;
    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : index;
}

/**
 * Row grouping and aggregation.
 *
 * The engine's rows become `GroupedRow<TRow>` — group headers mixed with member rows — for the same
 * reason a tree's become nodes: a group header summarises many rows and is not one of them. Your
 * columns, `onSelectionChange` and the rows you get back from the grid stay your own row; the
 * wrapping happens here.
 *
 * Cannot be listed with `treeData()`: both transform rows at `STAGE_ORDER.TRANSFORM` and both change
 * the row type, and there is no combined design yet.
 */
export function grouping<TRow>(options: GroupingOptions): GridAddon<TRow> {
    return {
        name: GROUPING_ADDON,
        setup: function useGroupingSetup({ options: grid, addons }) {
            return useGrouping(options, grid, addons);
        },
    };
}

function useGrouping<TRow>(options: GroupingOptions, grid: UseGridwrightOptions<TRow>, addons: readonly string[]) {
    if (addons.includes(TREE_ADDON)) {
        throw new GridwrightError(
            `[gridwright] "${GROUPING_ADDON}" cannot be listed with "${TREE_ADDON}": both transform rows at the same pipeline stage and both change the row type. Use one or the other until a combined design exists.`,
            { retryable: false },
        );
    }

    const [controller] = useState<GroupingController>(() => createGroupingController({ defaultExpanded: options.defaultExpanded }));

    const ownedSource = useRef<LocalDataSource<TRow> | null>(null);
    const inner: DataSource<TRow> = useMemo(() => {
        if (grid.dataSource) return grid.dataSource;
        ownedSource.current ??= createLocalDataSource<TRow>(grid.data ?? []);
        return ownedSource.current;
    }, [grid.dataSource, grid.data]);

    useEffect(() => {
        if (grid.data === undefined) return;
        const source = ownedSource.current;
        if (!source || source.getRows() === grid.data) return;
        source.setRows(grid.data);
    }, [grid.data]);

    const explicitGetRowId = grid.getRowId;
    const serverGrouped = options.serverGrouped ?? false;
    const dataSource = useMemo(
        () =>
            serverGrouped
                ? (inner as unknown as DataSource<GroupedRow<TRow>>)
                : createGroupingDataSource(inner, { getRowId: explicitGetRowId ?? defaultRowId }),
        [inner, explicitGetRowId, serverGrouped],
    );

    const aggregates = useMemo<readonly GroupAggregateSpec<TRow>[]>(
        () =>
            grid.columns.flatMap((column) => {
                const aggregate = (column as GridwrightColumn<TRow, ColumnValue>).aggregate as AggregateSpecFn<TRow> | undefined;
                return aggregate ? [{ columnId: column.id, fn: aggregate }] : [];
            }),
        [grid.columns],
    );

    const groupBy = options.groupBy;
    const summaryRow = options.summaryRow ?? false;

    // A plugin is reconciled by name: a new object under `plugins` for a name already installed is
    // ignored, so re-running `groupingPlugin(...)` on every render would not actually update the
    // live grid once mounted. `pluginOptions` is created once and mutated in place instead; the
    // plugin's stage reads it fresh on every pipeline pass, so `groupBy`, `aggregates`, `summaryRow`
    // and `serverGrouped` all take effect immediately without uninstalling and reinstalling anything.
    const pluginOptions = useRef<{ -readonly [K in keyof GroupingPluginOptions<TRow>]: GroupingPluginOptions<TRow>[K] }>({
        controller,
        groupBy,
        aggregates,
        summary: summaryRow,
        serverGrouped,
    });
    pluginOptions.current.groupBy = groupBy;
    pluginOptions.current.aggregates = aggregates;
    pluginOptions.current.summary = summaryRow;
    pluginOptions.current.serverGrouped = serverGrouped;

    // Created once for the add-on's life: pluginOptions.current is the mutable object every later
    // change is written into, not a value this memo should recompute from.
    const plugin = useMemo(() => groupingPlugin<TRow>(pluginOptions.current), []);

    // Mutating `pluginOptions.current` above is not, on its own, enough to make the grid recompute:
    // nothing about a ref changing schedules a pipeline pass. `refresh()` reuses the controller's
    // existing subscribe/invalidatePipeline wiring (already there for a toggle) for exactly this.
    const groupByKey = groupBy.join('\u0000');
    useEffect(() => {
        controller.refresh();
    }, [controller, groupByKey, aggregates, summaryRow, serverGrouped]);

    return {
        messages: groupingMessages,
        // The grid is generic over your row; the engine underneath holds group headers and member
        // rows. The casts are the one place that is admitted, and every value handed back to you
        // (onSelectionChange, the rows you read from the grid) is unwrapped again.
        plugins: [plugin] as unknown as readonly GridPlugin<TRow>[],
        configure: (current: UseGridwrightOptions<TRow>): UseGridwrightOptions<TRow> => {
            const { data: _data, onSelectionChange, getRowId: _getRowId, ...rest } = current;
            const configured: UseGridwrightOptions<GroupedRow<TRow>> = {
                ...(rest as unknown as UseGridwrightOptions<GroupedRow<TRow>>),
                columns: reactGroupColumns(current.columns),
                dataSource,
                getRowId: (grouped: GroupedRow<TRow>) => (grouped.kind === 'group' ? grouped.groupId : `row:${String(grouped.rowId)}`),
                ...(onSelectionChange
                    ? {
                          onSelectionChange: (ids: readonly RowId[], rows: readonly GroupedRow<TRow>[]) =>
                              onSelectionChange(
                                  ids,
                                  rows.flatMap((row) => (row.kind === 'row' ? [row.row] : [])),
                              ),
                      }
                    : {}),
            };
            return configured as unknown as UseGridwrightOptions<TRow>;
        },
        columnSignature: (column: GridwrightColumn<TRow, ColumnValue>) => ((column as GridwrightColumn<TRow, ColumnValue>).aggregate ? '1' : '0'),
        // Group rows carry `aria-level`, which is what a treegrid is for: `role="grid"` has no place
        // for it. Refused beside `treeData()` above, so there is no second add-on setting this role.
        tableAttributes: () => ({ role: 'treegrid' }),
        rowAttributes: (row: { data: unknown }) => {
            const data = row.data as GroupedRow<TRow>;
            return data.kind === 'row' ? { 'aria-level': data.depth + 1 } : {};
        },
        renderRow: (row: { data: unknown; index: number }, gridContext) => {
            const data = row.data as GroupedRow<TRow>;
            if (data.kind !== 'group') return undefined;
            const context = gridContext as unknown as GridContext<GroupedRow<TRow>>;
            const { pageIndex, pageSize } = context.state.query.pagination;
            const position = pageIndex * pageSize + row.index;
            return <GroupRow header={data} position={position} controller={controller} grid={context} />;
        },
        tableFooter: summaryRow
            ? (gridContext) => {
                  const context = gridContext as unknown as GridContext<GroupedRow<TRow>>;
                  const summary = (context.state.meta[`${GROUPING_PLUGIN_NAME}:${GROUPING_SUMMARY_META_KEY}`] as Readonly<Record<string, unknown>> | undefined) ?? {};
                  return (
                      <SummaryRow
                          summary={summary}
                          aggregateOf={(columnId) => {
                              const spec = aggregates.find((entry) => entry.columnId === columnId);
                              return typeof spec?.fn === 'string' ? spec.fn : undefined;
                          }}
                          grid={context}
                      />
                  );
              }
            : undefined,
    } satisfies ReturnType<GridAddon<TRow>['setup']>;
}
