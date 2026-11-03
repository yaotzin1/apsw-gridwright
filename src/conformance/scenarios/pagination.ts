import { expectEqual, expectTruthy } from '../assert';
import type { ConformanceDriver, DriverElement, DriverGrid, DriverMountOptions, Scenario } from '../types';

const NAMES = ['Ada', 'Bea', 'Cleo', 'Dee', 'Eve', 'Fay', 'Gus'] as const;

/** Seven rows in pages of three: 3, 3 and 1, so there is a first, a middle and a last page. */
const TABLE: DriverMountOptions = {
    columns: [
        { id: 'name', header: 'Name' },
        { id: 'team', header: 'Team' },
    ],
    rows: NAMES.map((name, index) => ({ name, team: index % 2 === 0 ? 'Eng' : 'Ops' })),
    pageSize: 3,
};

const PREVIOUS = 'Previous page';
const NEXT = 'Next page';

async function withGrid(driver: ConformanceDriver, body: (grid: DriverGrid) => Promise<void>): Promise<void> {
    const grid = await driver.mount(TABLE);
    try {
        await body(grid);
    } finally {
        await driver.unmount();
    }
}

const button = (grid: DriverGrid, name: string): DriverElement => expectTruthy(grid.query('button', name), `the "${name}" button`);
const isDisabled = (element: DriverElement): boolean => element.attribute('disabled') !== null;
const firstColumn = (grid: DriverGrid): readonly string[] => grid.rows().map((row) => row[0] ?? '');
const focusedName = (grid: DriverGrid): string | null => grid.focused()?.name ?? null;

/** The behaviour of `pagination()`, as a reader of the page meets it. */
export const paginationScenarios: readonly Scenario[] = [
    {
        id: 'pagination/range',
        title: 'the range names the rows on show and the total, and follows the page',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                expectEqual(firstColumn(grid), ['Ada', 'Bea', 'Cleo'], 'rows on the first page');
                expectEqual(grid.text().includes('1-3 of 7'), true, 'the range on the first page');

                await grid.click(button(grid, NEXT));
                expectEqual(firstColumn(grid), ['Dee', 'Eve', 'Fay'], 'rows on the second page');
                expectEqual(grid.text().includes('4-6 of 7'), true, 'the range on the second page');

                await grid.click(button(grid, NEXT));
                expectEqual(firstColumn(grid), ['Gus'], 'rows on the last page');
                expectEqual(grid.text().includes('7-7 of 7'), true, 'the range on the last page');
            }),
    },
    {
        id: 'pagination/buttons-end-of-travel',
        title: 'previous is disabled on the first page and next on the last, and each is enabled in between',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                expectEqual([isDisabled(button(grid, PREVIOUS)), isDisabled(button(grid, NEXT))], [true, false], 'disabled on the first page');
                await grid.click(button(grid, NEXT));
                expectEqual([isDisabled(button(grid, PREVIOUS)), isDisabled(button(grid, NEXT))], [false, false], 'disabled on the middle page');
                await grid.click(button(grid, NEXT));
                expectEqual([isDisabled(button(grid, PREVIOUS)), isDisabled(button(grid, NEXT))], [false, true], 'disabled on the last page');
            }),
    },
    {
        id: 'pagination/page-size',
        title: 'the page-size choice lists the grid\'s own size with the usual ones, shows the current size, and changing it re-pages',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                const select = expectTruthy(grid.query('combobox'), 'the page-size control');
                expectEqual(select.value(), '3', 'the selected size');
                expectEqual(grid.queryAll('option').map((option) => option.text()), ['3', '10', '25', '50', '100'], 'the sizes offered');

                await grid.choose(select, '10');
                expectEqual(firstColumn(grid), [...NAMES], 'rows after choosing 10 per page');
                expectEqual(grid.text().includes('1-7 of 7'), true, 'the range after choosing 10 per page');
                expectEqual(expectTruthy(grid.query('combobox'), 'the page-size control').value(), '10', 'the selected size after the change');
            }),
    },
    {
        id: 'pagination/focus-stays-in-the-grid',
        title: 'when the button the reader pressed disables itself at the end of its travel, focus moves to the other one, not to the page',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                await grid.click(button(grid, NEXT));
                expectEqual(focusedName(grid), NEXT, 'focus after the first press, while next is still usable');

                await grid.click(button(grid, NEXT));
                expectEqual(isDisabled(button(grid, NEXT)), true, 'next on the last page');
                expectEqual(focusedName(grid), PREVIOUS, 'focus once next has disabled itself');

                await grid.click(button(grid, PREVIOUS));
                await grid.click(button(grid, PREVIOUS));
                expectEqual(isDisabled(button(grid, PREVIOUS)), true, 'previous on the first page');
                expectEqual(focusedName(grid), NEXT, 'focus once previous has disabled itself');
            }),
    },
];
