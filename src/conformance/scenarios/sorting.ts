import { expectEqual, expectTruthy } from '../assert';
import type { ConformanceDriver, DriverGrid, DriverMountOptions, Scenario } from '../types';

const TABLE: DriverMountOptions = {
    columns: [
        { id: 'name', header: 'Name' },
        { id: 'salary', header: 'Salary' },
        { id: 'note', header: 'Note', sortable: false },
    ],
    rows: [
        { name: 'Cleo', salary: 300, note: 'c' },
        { name: 'Ada', salary: 100, note: 'a' },
        { name: 'Bea', salary: 200, note: 'b' },
    ],
};

const firstColumn = (grid: DriverGrid): readonly string[] => grid.rows().map((row) => row[0] ?? '');
const headerOf = (grid: DriverGrid, name: string) => expectTruthy(grid.query('columnheader', name), `the "${name}" column header`);
const buttonOf = (grid: DriverGrid, name: string) => expectTruthy(grid.query('button', name), `the "${name}" sort button`);

async function withGrid(driver: ConformanceDriver, body: (grid: DriverGrid) => Promise<void>): Promise<void> {
    const grid = await driver.mount(TABLE);
    try {
        await body(grid);
    } finally {
        await driver.unmount();
    }
}

/** The behaviour of `sorting()`, as a reader of the page meets it. */
export const sortingScenarios: readonly Scenario[] = [
    {
        id: 'sorting/header-is-a-button',
        title: 'a sortable header holds a real button named by its text, and an unsortable one holds none',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                expectEqual(buttonOf(grid, 'Name').role, 'button', 'the control for Name');
                expectEqual(grid.query('button', 'Note'), null, 'a button for a column that cannot be sorted');
            }),
    },
    {
        id: 'sorting/aria-sort-on-the-cell',
        title: 'aria-sort sits on the column header cell, not on the button, and starts as none',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                expectEqual(headerOf(grid, 'Name').attribute('aria-sort'), 'none', 'aria-sort on Name before any sort');
                expectEqual(buttonOf(grid, 'Name').attribute('aria-sort'), null, 'aria-sort on the button');
                expectEqual(headerOf(grid, 'Note').attribute('aria-sort'), null, 'aria-sort on an unsortable column');
            }),
    },
    {
        id: 'sorting/cycle',
        title: 'activating the button sorts ascending, then descending, then clears, and the rows follow',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                const unsorted = firstColumn(grid);
                expectEqual(unsorted, ['Cleo', 'Ada', 'Bea'], 'rows before sorting');

                await grid.click(buttonOf(grid, 'Name'));
                expectEqual(headerOf(grid, 'Name').attribute('aria-sort'), 'ascending', 'aria-sort after one activation');
                expectEqual(firstColumn(grid), ['Ada', 'Bea', 'Cleo'], 'rows sorted ascending');

                await grid.click(buttonOf(grid, 'Name'));
                expectEqual(headerOf(grid, 'Name').attribute('aria-sort'), 'descending', 'aria-sort after two activations');
                expectEqual(firstColumn(grid), ['Cleo', 'Bea', 'Ada'], 'rows sorted descending');

                await grid.click(buttonOf(grid, 'Name'));
                expectEqual(headerOf(grid, 'Name').attribute('aria-sort'), 'none', 'aria-sort after three activations');
                expectEqual(firstColumn(grid), unsorted, 'rows after the sort is cleared');
            }),
    },
    {
        id: 'sorting/announces',
        title: 'the live region names the column and its direction, and the sort is not silent when it is cleared',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                await grid.click(buttonOf(grid, 'Salary'));
                expectEqual(grid.liveRegionText(), 'Salary, sorted ascending', 'the sentence after sorting ascending');
                await grid.click(buttonOf(grid, 'Salary'));
                expectEqual(grid.liveRegionText(), 'Salary, sorted descending', 'the sentence after sorting descending');
                await grid.click(buttonOf(grid, 'Salary'));
                expectEqual(grid.liveRegionText(), 'Salary, not sorted', 'the sentence after clearing');
            }),
    },
    {
        id: 'sorting/keyboard',
        title: 'the sort button is reached with Tab and operated with Enter',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                await grid.press('Tab');
                const focused = expectTruthy(grid.focused(), 'the focused element after Tab');
                expectEqual(focused.role, 'button', 'the role of the first Tab stop');
                expectEqual(focused.name, 'Name', 'the name of the first Tab stop');
                await grid.press('Enter');
                expectEqual(headerOf(grid, 'Name').attribute('aria-sort'), 'ascending', 'aria-sort after Enter');
            }),
    },
    {
        id: 'sorting/multi-sort',
        title: 'Shift keeps the other sorted columns and names the priority; a plain activation replaces the sort',
        run: (driver) =>
            withGrid(driver, async (grid) => {
                await grid.click(buttonOf(grid, 'Name'));
                await grid.click(buttonOf(grid, 'Salary'), { shift: true });
                expectEqual(headerOf(grid, 'Name').attribute('aria-sort'), 'ascending', 'Name stays sorted under Shift');
                expectEqual(headerOf(grid, 'Salary').attribute('aria-sort'), 'ascending', 'Salary joins the sort');
                expectEqual(grid.liveRegionText(), 'Salary, sort priority 2, sorted ascending', 'the sentence for an added column');

                await grid.click(buttonOf(grid, 'Salary'));
                expectEqual(headerOf(grid, 'Name').attribute('aria-sort'), 'none', 'a plain activation replaces the sort');
            }),
    },
];
