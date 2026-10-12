import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import type { GridAddon } from '../../src/react/addons/types';
import { columnLayout } from '../../src/react/layout';
import { cellNavigation } from '../../src/react/navigation';
import { renderedColumnsOf } from '../../src/react/parts/slots';
import { useVirtualColumnScroll, virtualColumns, virtualRows } from '../../src/react/virtual';
import type { GridwrightColumn } from '../../src/react/types';

/**
 * A grid too wide to mount: five hundred columns, of which only the ones in view are in the DOM.
 *
 * What is asserted is what a reader and a screen reader get: which columns are mounted, that every
 * row agrees with the header on how many cell positions it has, that the gaps are exactly as wide as
 * the columns they stand in for, and that every mounted cell says which column of the five hundred
 * it is. The viewport is given a width by hand, because a test document has no layout of its own.
 */

type Row = readonly number[];

const COLUMN_COUNT = 500;
const WIDTH = 160;

const columns: readonly GridwrightColumn<Row>[] = Array.from({ length: COLUMN_COUNT }, (_, index) => ({
    id: `c${index}`,
    header: `Column ${index}`,
    accessor: (row: Row) => row[index],
    width: WIDTH,
}));

const rowsOf = (count: number): Row[] =>
    Array.from({ length: count }, (_, row) => Array.from({ length: COLUMN_COUNT }, (_, column) => row * 1_000 + column));

const wrapperOf = (container: HTMLElement): HTMLElement => container.querySelector<HTMLElement>('.gw-table-wrapper')!;

/** Gives the scroll container a size and a position, then lets the add-on's frame-coalesced read happen. */
async function scrollTo(container: HTMLElement, left: number, top = 0, width = 800, height = 400): Promise<void> {
    const wrapper = wrapperOf(container);
    Object.defineProperty(wrapper, 'clientWidth', { value: width, configurable: true });
    Object.defineProperty(wrapper, 'clientHeight', { value: height, configurable: true });
    await act(async () => {
        wrapper.scrollLeft = left;
        wrapper.scrollTop = top;
        wrapper.dispatchEvent(new Event('scroll'));
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
}

const headerIds = (container: HTMLElement): string[] =>
    [...container.querySelectorAll('thead th[data-column-id]')].map((cell) => cell.getAttribute('data-column-id')!);

const colIndexes = (cells: Iterable<Element>): number[] => [...cells].map((cell) => Number(cell.getAttribute('aria-colindex')));

const gapWidth = (cells: Iterable<Element>): number =>
    [...cells].reduce((sum, cell) => sum + Number.parseFloat((cell as HTMLElement).style.width), 0);

const renderGrid = (addons: readonly GridAddon<Row>[], rowCount = 30) =>
    render(
        <Gridwright<Row>
            columns={columns}
            data={rowsOf(rowCount)}
            getRowId={(_row: Row, index: number) => index}
            pageSize={10}
            aria-label="Wide"
            addons={addons}
        />,
    );

describe('virtualColumns()', () => {
    it('mounts the columns in view, not all five hundred', async () => {
        const { container } = renderGrid([virtualColumns<Row>()]);
        await scrollTo(container, 0);

        const mounted = headerIds(container);
        // 800 pixels of 160-pixel columns is five, and two more of overscan.
        expect(mounted).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6']);
        expect(container.querySelectorAll('tbody tr.gw-row td[data-column-id]')).toHaveLength(10 * 7);
    });

    it('follows the scroll into the middle of the columns', async () => {
        const { container } = renderGrid([virtualColumns<Row>()]);
        await scrollTo(container, 40_000);

        const mounted = headerIds(container);
        expect(mounted[0]).toBe('c248');
        expect(mounted[mounted.length - 1]).toBe('c256');
    });

    it('stands a gap in for each run of unmounted columns, exactly as wide as they are', async () => {
        const { container } = renderGrid([virtualColumns<Row>()]);
        await scrollTo(container, 40_000);

        const header = container.querySelector('thead tr')!;
        const gaps = header.querySelectorAll('.gw-column-gap');
        const mounted = header.querySelectorAll('th[data-column-id]');

        expect(gaps).toHaveLength(2);
        // The scrollbar is the width of every column, mounted or not.
        expect(gapWidth(gaps) + mounted.length * WIDTH).toBe(COLUMN_COUNT * WIDTH);
        // Gaps are not content: a screen reader is never handed an empty cell.
        expect([...gaps].every((gap) => gap.getAttribute('aria-hidden') === 'true')).toBe(true);
    });

    it('gives every row the same cell positions as the header', async () => {
        const { container } = renderGrid([virtualColumns<Row>()]);
        await scrollTo(container, 40_000);

        const positions = (row: Element): number => row.children.length;
        const header = positions(container.querySelector('thead tr')!);
        const rows = [...container.querySelectorAll('tbody tr')];

        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => positions(row) === header)).toBe(true);
    });

    it('tells a screen reader the true column count and each mounted column’s true position', async () => {
        const { container } = renderGrid([virtualColumns<Row>()]);
        await scrollTo(container, 40_000);

        expect(container.querySelector('table')!.getAttribute('aria-colcount')).toBe(String(COLUMN_COUNT));

        const header = colIndexes(container.querySelectorAll('thead th[data-column-id]'));
        expect(header[0]).toBe(249);

        const firstRow = container.querySelector('tbody tr.gw-row')!;
        expect(colIndexes(firstRow.querySelectorAll('td[data-column-id]'))).toEqual(header);
    });

    it('leaves the markup of a grid without it exactly as it was', () => {
        const { container } = render(
            <Gridwright<Row> columns={columns.slice(0, 5)} data={rowsOf(3)} getRowId={(_row: Row, index: number) => index} aria-label="Narrow" />,
        );

        expect(container.querySelector('table')!.hasAttribute('aria-colcount')).toBe(false);
        expect(container.querySelector('[aria-colindex]')).toBeNull();
        expect(container.querySelector('.gw-column-gap')).toBeNull();
    });

    it('puts the table into fixed layout and sets each header width when no layout add-on does', () => {
        const { container } = renderGrid([virtualColumns<Row>({ defaultWidth: 100 })]);

        expect(container.querySelector('table')!.classList.contains('gw-table--fixed')).toBe(true);
        expect(container.querySelector<HTMLElement>('thead th[data-column-id="c0"]')!.style.width).toBe(`${WIDTH}px`);
    });

    it('keeps a pinned column mounted wherever the grid is scrolled', async () => {
        const { container } = renderGrid([columnLayout<Row>({ picker: false, initial: { pinned: { c3: 'left' } } }), virtualColumns<Row>()]);
        await scrollTo(container, 40_000);

        const mounted = headerIds(container);
        expect(mounted[0]).toBe('c3');
        expect(mounted).toContain('c250');
        expect(container.querySelector('thead th[data-column-id="c3"]')!.getAttribute('aria-colindex')).toBe('4');
    });

    it('is placed after the column layout whatever order they are listed in', async () => {
        // Listed first, it still reads the layout's widths and pins, because a setup only sees what
        // the add-ons before it published.
        const { container } = renderGrid([virtualColumns<Row>(), columnLayout<Row>({ picker: false, initial: { pinned: { c3: 'left' } } })]);
        await scrollTo(container, 40_000);

        expect(headerIds(container)[0]).toBe('c3');
    });

    it('windows both axes with virtualRows(): rows in view times columns in view', async () => {
        const { container } = renderGrid([virtualRows<Row>({ height: 400 }), virtualColumns<Row>()], 10_000);
        await scrollTo(container, 40_000, 200_000);

        const rows = container.querySelectorAll('tbody tr.gw-row');
        const firstRowIndex = Number(rows[0]!.getAttribute('aria-rowindex'));

        // Both windows read the one scroll container: the column window moved, and so did the row window.
        expect(headerIds(container)[0]).toBe('c248');
        expect(firstRowIndex).toBeGreaterThan(4_000);
        expect(container.querySelectorAll('tbody td[data-column-id]').length).toBeLessThan(40 * 12);
    });

    it('lets End on the keyboard reach the last of five hundred columns', async () => {
        const { container } = renderGrid([virtualColumns<Row>(), cellNavigation<Row>()]);
        await scrollTo(container, 0);

        const first = container.querySelector<HTMLElement>('tbody td[tabindex="0"]')!;
        await act(async () => {
            first.focus();
            first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        });
        // The column is scrolled to, mounted on the next frame, and then focused.
        await scrollTo(container, wrapperOf(container).scrollLeft);

        const focused = document.activeElement as HTMLElement;
        expect(focused.getAttribute('data-column-id')).toBe('c499');
        expect(focused.getAttribute('aria-colindex')).toBe(String(COLUMN_COUNT));
    });

    it('keeps one tab stop when the cursor’s column has scrolled out of the DOM', async () => {
        const { container } = renderGrid([virtualColumns<Row>(), cellNavigation<Row>()]);
        await scrollTo(container, 0);
        await scrollTo(container, 40_000);

        // The cursor is still on column 0, which is not in the DOM. The stop falls back to the first
        // mounted column in the same render, so Tab can always get into the grid.
        expect(container.querySelector('tbody td[data-column-id="c0"]')).toBeNull();
        expect(container.querySelectorAll('tbody td[tabindex="0"]')).toHaveLength(1);
    });

    it('scrolls to a column from inside the grid', async () => {
        let scroll: ReturnType<typeof useVirtualColumnScroll> = null;
        const Probe = () => {
            scroll = useVirtualColumnScroll();
            return null;
        };
        const probe: GridAddon<Row> = { name: 'test:probe', setup: () => ({ toolbar: () => <Probe /> }) };

        const { container } = renderGrid([virtualColumns<Row>(), probe]);
        await scrollTo(container, 0);

        expect(scroll).not.toBeNull();
        await act(async () => scroll!.scrollToColumn('c300'));
        await scrollTo(container, wrapperOf(container).scrollLeft);

        expect(headerIds(container)).toContain('c300');
    });

    it('answers null to useVirtualColumnScroll in a grid that does not list it', () => {
        let scroll: ReturnType<typeof useVirtualColumnScroll> | 'unset' = 'unset';
        const Probe = () => {
            scroll = useVirtualColumnScroll();
            return null;
        };
        const probe: GridAddon<Row> = { name: 'test:probe', setup: () => ({ toolbar: () => <Probe /> }) };

        renderGrid([probe]);
        expect(scroll).toBeNull();
    });
});

describe('the column window contract', () => {
    it('is open to an add-on of anyone’s: a third-party plan is rendered like the built-in one', () => {
        // Mount only the first and last columns, with one gap between: what the shell renders from a
        // plan is the same whoever published it.
        const ends: GridAddon<Row> = {
            name: 'acme:ends',
            setup: () => ({
                columnWindow: (grid) => {
                    const visible = grid.columns.filter((column) => !column.hidden);
                    return {
                        columnCount: visible.length,
                        entries: [
                            { kind: 'column', column: visible[0]!, index: 0 },
                            { kind: 'gap', key: 'middle', width: (visible.length - 2) * WIDTH, columns: visible.length - 2 },
                            { kind: 'column', column: visible[visible.length - 1]!, index: visible.length - 1 },
                        ],
                    };
                },
            }),
        };
        const { container } = renderGrid([ends]);

        expect(headerIds(container)).toEqual(['c0', 'c499']);
        expect(colIndexes(container.querySelectorAll('thead th[data-column-id]'))).toEqual([1, 500]);
        expect(container.querySelector('table')!.getAttribute('aria-colcount')).toBe('500');
    });

    it('is ignored while the rows are drawn as cards', () => {
        const cards: GridAddon<Row> = { name: 'acme:cards', setup: () => ({ cardLayout: true }) };
        let entries = -1;
        const counter: GridAddon<Row> = {
            name: 'acme:count',
            setup: () => ({
                toolbar: (grid) => {
                    entries = renderedColumnsOf(grid).length;
                    return null;
                },
            }),
        };

        renderGrid([virtualColumns<Row>(), cards, counter]);
        expect(entries).toBe(COLUMN_COUNT);
    });
});
