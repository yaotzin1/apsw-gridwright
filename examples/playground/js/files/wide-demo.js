/**
 * Five hundred columns and ten thousand rows, both axes windowed.
 *
 * `virtualRows()` mounts the rows in view and `virtualColumns()` the columns in view, so the DOM holds
 * their product rather than five million cells. `columnLayout()` is listed too, so a column can be
 * pinned and resized while the rest scroll, and `cellNavigation()` shows the keyboard reaching column
 * 500 with End.
 */
import { React, catalogs, gridwright, h } from '../shared/package.js';

const { Gridwright, cellNavigation, columnLayout, virtualColumns, virtualRows } = gridwright;
const { useEffect, useMemo, useRef, useState } = React;

const COLUMN_COUNT = 500;
const ROW_COUNT = 10_000;
const count = new Intl.NumberFormat('en-US');

// Built once for the page, not per render: the data is the point of the demo, not its cost.
const columns = Array.from({ length: COLUMN_COUNT }, (_, index) => ({
    id: `c${index}`,
    header: `Column ${index + 1}`,
    accessor: (row) => row.values[index],
    width: 120 + (index % 3) * 40,
    align: 'end',
}));

// Five million values, built the first time the demo is opened rather than when the page loads: the
// page imports every demo, and the other demos should not pay for this one.
let rows = null;
const rowsOnce = () =>
    (rows ??= Array.from({ length: ROW_COUNT }, (_, row) => ({
        id: row,
        values: Array.from({ length: COLUMN_COUNT }, (_, column) => (row * 31 + column * 17) % 10_000),
    })));

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
            data: rowsOnce(),
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
