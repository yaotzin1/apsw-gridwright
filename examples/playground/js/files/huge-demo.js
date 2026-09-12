/**
 * The same component over ten million rows. The only difference from `shape-demo.js` is what is
 * behind it: a windowed data source instead of an array, and edits written to the mock table.
 */
import { React, catalogs, gridwright, h } from '../shared/package.js';
import { useFileColumns } from './columns.js';
import { HUGE_TOTAL, diagnostics, hugeSource, overrides } from './data.js';

const { Gridwright } = gridwright;
const { useCallback, useEffect, useMemo, useState } = React;

const count = new Intl.NumberFormat('en-US');

export function HugeDemo({ actions, editing, icons, exporting, locale, log, onStats }) {
    const columns = useFileColumns(editing, icons);
    const [tick, setTick] = useState(0);

    const onCellEdit = useCallback(
        (rowId, columnId, value) => {
            log('edit', `${rowId}.${columnId}`);
            overrides.set(rowId, { ...overrides.get(rowId), [columnId]: value });
            // Every cached block was built from the table that just changed, so the whole cache goes.
            // The source tells the grid, which asks again by itself.
            hugeSource.invalidate();
        },
        [log],
    );

    const rowActions = useMemo(
        () => (actions ? [{ id: 'inspect', label: 'Inspect', onSelect: (gridRow) => log('inspect', gridRow.data.name) }] : undefined),
        [actions, log],
    );

    // The stats panel is a diagnostic, not grid state, so it polls instead of re-rendering the grid.
    useEffect(() => {
        const timer = setInterval(() => setTick((current) => current + 1), 500);
        return () => clearInterval(timer);
    }, []);

    // Memoised on the timer, because the page stores what it receives: a new array on every render
    // would make the page re-render this grid, which would send another new array.
    const stats = useMemo(
        () => [
            ['rows in the table', count.format(HUGE_TOTAL)],
            ['blocks cached', hugeSource.cachedBlockCount],
            ['rows resident', count.format(hugeSource.cachedBlockCount * 200)],
            ['block requests', diagnostics.blockRequests],
        ],
        [tick],
    );
    onStats(stats);

    return h(Gridwright, {
        'aria-label': 'Records',
        columns,
        dataSource: hugeSource,
        getRowId: (row) => row.id,
        pageSize: 200,
        selectionMode: 'multiple',
        locale: catalogs[locale],
        virtual: { rowHeight: 40, height: 420 },
        ...(rowActions ? { rowActions } : {}),
        ...(editing ? { onCellEdit } : {}),
        // The source hands over one block at a time and has no fetchAll, so the honest export is
        // what is loaded, fixed as `scope: 'page'`.
        ...(exporting ? { export: { formats: ['csv', 'markdown'], scope: 'page', filename: 'records-window' } } : {}),
    });
}
