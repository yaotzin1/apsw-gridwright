import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { createLocalDataSource } from '../../src/data/local';
import { createGroupingController } from '../../src/grouping/controller';
import type { GroupingController } from '../../src/grouping/controller';
import { createGroupingDataSource } from '../../src/grouping/data-source';
import { groupingPlugin, GROUPING_PLUGIN_NAME, GROUPING_STAGE_ID, GROUPING_SUMMARY_META_KEY } from '../../src/grouping/plugin';
import { ungroupedRows } from '../../src/grouping/rows';
import { groupColumns } from '../../src/grouping/columns';
import type { GroupedRow } from '../../src/grouping/types';
import type { DataSource, GridApi, GridState } from '../../src/core/types';

interface Employee {
    readonly id: string;
    readonly name: string;
    readonly department: string;
    readonly region: string;
    readonly salary: number;
}

const employees: Employee[] = [
    { id: 'ada', name: 'Ada Lovelace', department: 'Engineering', region: 'EU', salary: 140_000 },
    { id: 'grace', name: 'Grace Hopper', department: 'Engineering', region: 'US', salary: 150_000 },
    { id: 'katherine', name: 'Katherine Johnson', department: 'Research', region: 'US', salary: 120_000 },
    { id: 'radia', name: 'Radia Perlman', department: 'Engineering', region: 'EU', salary: 130_000 },
    { id: 'barbara', name: 'Barbara Liskov', department: 'Research', region: 'EU', salary: 145_000 },
];

const columns = groupColumns<Employee>([
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'region', header: 'Region' },
    { id: 'salary', header: 'Salary' },
]);

/** `state.rows` holds `GridRow<GroupedRow<Employee>>`; this reaches past the envelope. */
const dataOf = (state: GridState<GroupedRow<Employee>>): readonly GroupedRow<Employee>[] => state.rows.map((row) => row.data);

function makeGroupedGrid(options: {
    readonly groupBy: readonly string[];
    readonly aggregates?: Parameters<typeof groupingPlugin<Employee>>[0]['aggregates'];
    readonly summary?: boolean;
    readonly controller?: GroupingController;
    readonly dataSource?: DataSource<Employee>;
    readonly defaultExpanded?: boolean;
}): { api: GridApi<GroupedRow<Employee>>; controller: GroupingController } {
    const controller = options.controller ?? createGroupingController({ defaultExpanded: options.defaultExpanded ?? true });
    const inner = options.dataSource ?? createLocalDataSource(employees);
    const dataSource = createGroupingDataSource(inner, { getRowId: (row) => row.id });

    const api = createGridEngine<GroupedRow<Employee>>({
        columns,
        dataSource,
        getRowId: (row) => (row.kind === 'group' ? row.groupId : `row:${String(row.rowId)}`),
        initialQuery: { pagination: { pageIndex: 0, pageSize: 100 } },
        plugins: [
            groupingPlugin<Employee>({
                controller,
                groupBy: options.groupBy,
                aggregates: options.aggregates ?? [],
                summary: options.summary ?? false,
            }),
        ],
    });

    return { api, controller };
}

describe('groupingPlugin', () => {
    it('buckets rows by the groupBy column, ordered by key', () => {
        const { api } = makeGroupedGrid({ groupBy: ['department'] });
        const headers = dataOf(api.getState()).filter((row) => row.kind === 'group');
        expect(headers.map((header) => header.key)).toEqual(['Engineering', 'Research']);
        expect(headers.map((header) => header.count)).toEqual([3, 2]);
        api.destroy();
    });

    it('counts group headers toward totalRows, so pagination never leaves an empty page', () => {
        const { api } = makeGroupedGrid({ groupBy: ['department'] });
        // 2 group headers + 5 member rows.
        expect(api.getState().totalRows).toBe(7);
        api.destroy();
    });

    it('keeps member rows in their already-sorted order within a group', () => {
        const { api } = makeGroupedGrid({ groupBy: ['department'] });
        const engineering = dataOf(api.getState()).filter((row) => row.kind === 'row' && row.row.department === 'Engineering');
        expect(engineering.map((row) => (row.kind === 'row' ? row.row.id : null))).toEqual(['ada', 'grace', 'radia']);
        api.destroy();
    });

    it('nests a second groupBy column inside the first', () => {
        const { api } = makeGroupedGrid({ groupBy: ['department', 'region'] });
        const headers = dataOf(api.getState()).filter((row) => row.kind === 'group');
        // Engineering (depth 0) > EU, US (depth 1); Research (depth 0) > EU, US (depth 1).
        expect(headers.map((header) => `${header.depth}:${header.key}`)).toEqual([
            '0:Engineering',
            '1:EU',
            '1:US',
            '0:Research',
            '1:EU',
            '1:US',
        ]);
        api.destroy();
    });

    it.each([
        ['sum', 140_000 + 150_000 + 130_000],
        ['avg', (140_000 + 150_000 + 130_000) / 3],
        ['min', 130_000],
        ['max', 150_000],
    ] as const)('computes %s over a group\'s salaries', (fn, expected) => {
        const { api } = makeGroupedGrid({ groupBy: ['department'], aggregates: [{ columnId: 'salary', fn }] });
        const engineering = dataOf(api.getState()).find((row) => row.kind === 'group' && row.key === 'Engineering');
        expect(engineering?.kind === 'group' ? engineering.aggregates.salary : null).toBe(expected);
        api.destroy();
    });

    it('counts rows in a group regardless of the column counted', () => {
        const { api } = makeGroupedGrid({ groupBy: ['department'], aggregates: [{ columnId: 'name', fn: 'count' }] });
        const engineering = dataOf(api.getState()).find((row) => row.kind === 'group' && row.key === 'Engineering');
        expect(engineering?.kind === 'group' ? engineering.aggregates.name : null).toBe(3);
        api.destroy();
    });

    it('supports a custom accumulator', () => {
        const { api } = makeGroupedGrid({
            groupBy: ['department'],
            aggregates: [{ columnId: 'salary', fn: (values) => (values as number[]).join(',') }],
        });
        const engineering = dataOf(api.getState()).find((row) => row.kind === 'group' && row.key === 'Engineering');
        expect(engineering?.kind === 'group' ? engineering.aggregates.salary : null).toBe('140000,150000,130000');
        api.destroy();
    });

    it('publishes a grand-total summary on state.meta when summary is on', () => {
        const { api } = makeGroupedGrid({
            groupBy: ['department'],
            aggregates: [{ columnId: 'salary', fn: 'sum' }],
            summary: true,
        });
        const summary = api.getState().meta[`${GROUPING_PLUGIN_NAME}:${GROUPING_SUMMARY_META_KEY}`] as Record<string, unknown>;
        expect(summary.salary).toBe(140_000 + 150_000 + 120_000 + 130_000 + 145_000);
        api.destroy();
    });

    it('does not publish a summary when summary is off', () => {
        const { api } = makeGroupedGrid({ groupBy: ['department'] });
        expect(api.getState().meta[`${GROUPING_PLUGIN_NAME}:${GROUPING_SUMMARY_META_KEY}`]).toBeUndefined();
        api.destroy();
    });

    it('drops the members of a collapsed group but keeps its header', () => {
        const controller = createGroupingController({ defaultExpanded: true });
        const { api } = makeGroupedGrid({ groupBy: ['department'], controller });

        controller.toggle('/department:string:Engineering');
        const rows = dataOf(api.getState());
        expect(rows.some((row) => row.kind === 'group')).toBe(true);
        expect(rows.some((row) => row.kind === 'row' && row.row.department === 'Engineering')).toBe(false);
        expect(rows.some((row) => row.kind === 'row' && row.row.department === 'Research')).toBe(true);
        api.destroy();
    });

    it('recomputes on toggle without asking the data source again', () => {
        const inner = createLocalDataSource(employees);
        const fetchSpy = vi.spyOn(inner, 'fetch');
        const controller = createGroupingController({ defaultExpanded: true });
        const { api } = makeGroupedGrid({ groupBy: ['department'], controller, dataSource: inner });

        const callsBefore = fetchSpy.mock.calls.length;
        controller.toggle('/department:string:Engineering');
        expect(fetchSpy.mock.calls.length).toBe(callsBefore);
        api.destroy();
    });

    it('refuses to group a source that paginates for itself, and reports it rather than grouping a fragment', () => {
        const paginating: DataSource<Employee> = {
            kind: 'test:paginating',
            capabilities: { sort: false, filter: false, search: false, paginate: true },
            fetch: () => ({ rows: employees.slice(0, 2), totalRows: employees.length }),
        };
        const errors = vi.fn();
        const { api } = makeGroupedGrid({ groupBy: ['department'], dataSource: paginating });
        api.on('plugin:error', errors);
        api.invalidatePipeline();

        expect(errors).toHaveBeenCalledWith(expect.objectContaining({ plugin: GROUPING_STAGE_ID }));
        // The stage lost its own effect: the rows stay whatever entered it, ungrouped.
        expect(dataOf(api.getState()).every((row) => row.kind === 'row')).toBe(true);
        api.destroy();
    });

    it('skips the stage entirely when serverGrouped is true, leaving the source rows untouched', () => {
        const controller = createGroupingController();
        const alreadyGrouped: DataSource<GroupedRow<Employee>> = {
            kind: 'test:server-grouped',
            capabilities: { sort: true, filter: true, search: true, paginate: false },
            fetch: () => ({
                rows: [
                    { kind: 'group', groupId: 'g1', columnId: 'department', value: 'Engineering', key: 'Engineering', depth: 0, count: 1, aggregates: {}, expanded: true },
                    { kind: 'row', row: employees[0]!, rowId: employees[0]!.id, depth: 1 },
                ],
                totalRows: 2,
            }),
        };

        const api = createGridEngine<GroupedRow<Employee>>({
            columns,
            dataSource: alreadyGrouped,
            getRowId: (row) => (row.kind === 'group' ? row.groupId : `row:${String(row.rowId)}`),
            plugins: [groupingPlugin<Employee>({ controller, groupBy: ['department'], serverGrouped: true })],
        });

        expect(dataOf(api.getState()).map((row) => row.kind)).toEqual(['group', 'row']);
        api.destroy();
    });
});

describe('ungroupedRows', () => {
    it('drops group headers and returns the member rows in order', () => {
        const { api } = makeGroupedGrid({ groupBy: ['department'] });
        const flat = ungroupedRows(dataOf(api.getState()));
        expect(flat.map((row) => row.id)).toEqual(['ada', 'grace', 'radia', 'katherine', 'barbara']);
        api.destroy();
    });
});
