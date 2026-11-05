import { expectEqual, expectTruthy } from '../assert';
import type { ConformanceDriver, DriverElement, DriverGrid, DriverMountOptions, Scenario } from '../types';

const BASE: Pick<DriverMountOptions, 'columns' | 'rows'> = {
    columns: [
        { id: 'name', header: 'Name' },
        { id: 'team', header: 'Team' },
    ],
    rows: [
        { name: 'Ada', team: 'Eng' },
        { name: 'Bea', team: 'Ops' },
        { name: 'Cleo', team: 'Eng' },
    ],
};

const SELECT_ALL = 'Select all rows on this page';
const SELECT_ROW = 'Select row';

type Selection = NonNullable<DriverMountOptions['selection']>;

async function withGrid(driver: ConformanceDriver, selection: Selection, body: (grid: DriverGrid) => Promise<void>): Promise<void> {
    const grid = await driver.mount({ ...BASE, selection });
    try {
        await body(grid);
    } finally {
        await driver.unmount();
    }
}

/** The body rows, which are the rows that say whether they are selected: the header row says nothing. */
const bodyRows = (grid: DriverGrid): readonly DriverElement[] => grid.queryAll('row').filter((row) => row.attribute('aria-selected') !== null);
const selectedFlags = (grid: DriverGrid): readonly (string | null)[] => bodyRows(grid).map((row) => row.attribute('aria-selected'));
const selectAll = (grid: DriverGrid): DriverElement => expectTruthy(grid.query('checkbox', SELECT_ALL), 'the select-all checkbox');
const rowBoxes = (grid: DriverGrid): readonly DriverElement[] => grid.queryAll('checkbox').filter((box) => box.name === SELECT_ROW);

const MULTIPLE: Selection = { mode: 'multiple' };

/** The behaviour of `selection()`, as a reader of the page meets it. */
export const selectionScenarios: readonly Scenario[] = [
    {
        id: 'selection/checkboxes',
        title: 'a multiple-selection grid has a select-all checkbox and one named checkbox per row',
        run: (driver) =>
            withGrid(driver, MULTIPLE, async (grid) => {
                expectEqual(selectAll(grid).role, 'checkbox', 'the role of the select-all control');
                expectEqual(rowBoxes(grid).length, 3, 'the row checkboxes');
                expectEqual(selectedFlags(grid), ['false', 'false', 'false'], 'aria-selected on each row before any selection');
            }),
    },
    {
        id: 'selection/table-is-multiselectable',
        title: 'the grid says more than one row may be selected, and a single-selection grid does not',
        run: async (driver) => {
            await withGrid(driver, MULTIPLE, async (grid) => {
                expectEqual(expectTruthy(grid.query('grid'), 'the grid').attribute('aria-multiselectable'), 'true', 'aria-multiselectable on a multiple grid');
            });
            await withGrid(driver, { mode: 'single' }, async (grid) => {
                expectEqual(expectTruthy(grid.query('grid'), 'the grid').attribute('aria-multiselectable'), null, 'aria-multiselectable on a single grid');
            });
        },
    },
    {
        id: 'selection/row-checkbox',
        title: 'ticking a row checkbox selects that row only, and unticking clears it',
        run: (driver) =>
            withGrid(driver, MULTIPLE, async (grid) => {
                await grid.click(rowBoxes(grid)[1]!);
                expectEqual(selectedFlags(grid), ['false', 'true', 'false'], 'aria-selected after ticking the second row');
                expectEqual(rowBoxes(grid)[1]!.checked(), true, 'the second checkbox is checked');
                expectEqual(rowBoxes(grid)[0]!.checked(), false, 'the first checkbox is not');

                await grid.click(rowBoxes(grid)[1]!);
                expectEqual(selectedFlags(grid), ['false', 'false', 'false'], 'aria-selected after unticking');
            }),
    },
    {
        id: 'selection/select-all-state',
        title: 'select-all is unchecked, then indeterminate when some rows are selected, then checked when all are',
        run: (driver) =>
            withGrid(driver, MULTIPLE, async (grid) => {
                expectEqual([selectAll(grid).checked(), selectAll(grid).indeterminate()], [false, false], 'select-all with nothing selected');

                await grid.click(rowBoxes(grid)[0]!);
                expectEqual([selectAll(grid).checked(), selectAll(grid).indeterminate()], [false, true], 'select-all with one row selected');

                await grid.click(rowBoxes(grid)[1]!);
                await grid.click(rowBoxes(grid)[2]!);
                expectEqual([selectAll(grid).checked(), selectAll(grid).indeterminate()], [true, false], 'select-all with every row selected');
            }),
    },
    {
        id: 'selection/select-all-toggles-the-page',
        title: 'select-all selects every row on the page when some are not selected, and clears them when all are',
        run: (driver) =>
            withGrid(driver, MULTIPLE, async (grid) => {
                await grid.click(rowBoxes(grid)[0]!);
                await grid.click(selectAll(grid));
                expectEqual(selectedFlags(grid), ['true', 'true', 'true'], 'aria-selected after select-all from a partial selection');

                await grid.click(selectAll(grid));
                expectEqual(selectedFlags(grid), ['false', 'false', 'false'], 'aria-selected after select-all from a full selection');
            }),
    },
    {
        id: 'selection/row-click',
        title: 'with selectOnRowClick a click on a cell toggles its row, and a click on the row checkbox toggles it once',
        run: (driver) =>
            withGrid(driver, { mode: 'multiple', onRowClick: true }, async (grid) => {
                const cell = (row: number) => expectTruthy(grid.queryAll('cell').find((candidate) => candidate.text() === BASE.rows[row]!.name), 'a name cell');

                await grid.click(cell(1));
                expectEqual(selectedFlags(grid), ['false', 'true', 'false'], 'aria-selected after clicking a cell');
                await grid.click(cell(1));
                expectEqual(selectedFlags(grid), ['false', 'false', 'false'], 'aria-selected after clicking it again');

                // The checkbox is a control in the row: it operates itself and the row's click must not undo it.
                await grid.click(rowBoxes(grid)[2]!);
                expectEqual(selectedFlags(grid), ['false', 'false', 'true'], 'aria-selected after ticking a checkbox in a clickable row');
            }),
    },
    {
        id: 'selection/row-click-is-opt-in',
        title: 'without selectOnRowClick a click on a cell selects nothing',
        run: (driver) =>
            withGrid(driver, MULTIPLE, async (grid) => {
                const cell = expectTruthy(grid.queryAll('cell').find((candidate) => candidate.text() === 'Ada'), 'a name cell');
                await grid.click(cell);
                expectEqual(selectedFlags(grid), ['false', 'false', 'false'], 'aria-selected after clicking a cell');
            }),
    },
];
