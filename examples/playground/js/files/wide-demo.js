/**
 * Five hundred columns and a million rows, both axes windowed.
 *
 * `virtualRows()` mounts the rows in view and `virtualColumns()` the columns in view, so the DOM holds
 * their product rather than five hundred million cells. The rows come from a windowed data source that
 * makes a block of 200 on demand, so the table is never in memory either: at 500 values a row, a
 * million rows built up front would be half a billion numbers. `columnLayout()` is listed too, so a column can be
 * pinned and resized while the rest scroll, and `cellNavigation()` shows the keyboard reaching column
 * 500 with End.
 */
import { React, catalogs, core, gridwright, h } from '../shared/package.js';

const { Gridwright, cellNavigation, columnLayout, virtualColumns, virtualRows } = gridwright;
const { createWindowedDataSource } = core;
const { useEffect, useMemo, useRef, useState } = React;

const COLUMN_COUNT = 500;
const ROW_COUNT = 1_000_000;
const count = new Intl.NumberFormat('en-US');

// Built once for the page, not per render: the data is the point of the demo, not its cost.
const columns = Array.from({ length: COLUMN_COUNT }, (_, index) => ({
    id: `c${index}`,
    header: `Column ${index + 1}`,
    accessor: (row) => row.values[index],
    width: 120 + (index % 3) * 40,
    align: 'end',
}));

// One row's five hundred values, from its position: the same row every time it is asked for, and
// nothing stored. A block is 200 rows, so 100,000 numbers, made the moment a region is scrolled to.
const rowAt = (index) => ({ id: index, values: Array.from({ length: COLUMN_COUNT }, (_, column) => (index * 31 + column * 17) % 10_000) });

const source = createWindowedDataSource({
    blockSize: 200,
    maxBlocks: 8,
    fetchRange: async ({ offset, limit, signal }) => {
        // A short real delay, so the skeleton rows are something you can see.
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (signal && signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        const rows = [];
        for (let index = offset; index < Math.min(offset + limit, ROW_COUNT); index += 1) rows.push(rowAt(index));
        return { rows, totalRows: ROW_COUNT };
    },
});

export function WideDemo({ locale, onStats }) {
    const host = useRef(null);
    const [tick, setTick] = useState(0);

    // The stats panel is a diagnostic, not grid state, so it polls instead of re-rendering the grid.
    useEffect(() => {
        const timer = setInterval(() => setTick((current) => current + 1), 500);
        return () => clearInterval(timer);
    }, []);

    const stats = useMemo(() => {
        const root = host.current;
        const mountedCells = root ? root.querySelectorAll('tbody td[data-column-id]').length : 0;
        const mountedColumns = root ? root.querySelectorAll('thead th[data-column-id]').length : 0;
        return [
            ['cells in the data', count.format(COLUMN_COUNT * ROW_COUNT)],
            ['columns mounted', `${mountedColumns} of ${COLUMN_COUNT}`],
            ['cells in the DOM', count.format(mountedCells)],
        ];
    }, [tick]);
    onStats(stats);

    return h(
        'div',
        { ref: host },
        h(Gridwright, {
            'aria-label': 'Wide data',
            columns,
            dataSource: source,
            pageSize: 200,
            getRowId: (row) => row.id,
            locale: catalogs[locale],
            addons: [
                columnLayout({ picker: false, initial: { pinned: { c0: 'left' } } }),
                virtualRows({ rowHeight: 40, height: 420 }),
                virtualColumns(),
                cellNavigation(),
            ],
        }),
    );
}
