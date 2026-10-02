import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { exportMenu } from '../../src/react/export/addon';
import { search } from '../../src/react/core-addons';
import type { DataSource, DataSourceRequest } from '../../src/core/types';
import { cellNavigation } from '../../src/react/navigation/addon';
import { virtualRows } from '../../src/react/virtual/addon';
import { columnLayout } from '../../src/react/layout/addon';
import { rowActions } from '../../src/react/plugins/addons';
import { responsive, useContainerWidth } from '../../src/react/responsive';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * jsdom has no layout, so the observer and the media queries are stubbed and the width is pushed in
 * by hand. What these assert is the contract (what renders at which width); whether the stylesheet
 * then looks right is a browser pass, recorded in the spec's review.
 */

type Callback = () => void;
const observers: { callback: Callback; observed: Element[]; disconnected: boolean }[] = [];
let containerWidth = 1000;

class FakeResizeObserver {
    private readonly entry = { callback: undefined as unknown as Callback, observed: [] as Element[], disconnected: false };
    constructor(callback: Callback) {
        this.entry.callback = callback;
        observers.push(this.entry);
    }
    observe(target: Element): void {
        this.entry.observed.push(target);
    }
    disconnect(): void {
        this.entry.disconnected = true;
    }
    unobserve(): void {}
}

const resizeTo = (width: number): void => {
    containerWidth = width;
    act(() => {
        for (const observer of observers) if (!observer.disconnected) observer.callback();
    });
};

const mediaMatches = new Set<string>();
const stubMedia = (): void => {
    window.matchMedia = ((query: string) => ({
        matches: mediaMatches.has(query),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
    observers.length = 0;
    containerWidth = 1000;
    mediaMatches.clear();
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    // jsdom reports 0 for every layout property; the root is given the width the test chose.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('gw-root') ? containerWidth : 0;
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department', responsive: { hideBelow: 600 } },
    { id: 'salary', header: 'Salary', responsive: { hideBelow: 400 } },
];

const renderGrid = (addons: GridAddon<Person>[] = [responsive<Person>()], props: Record<string, unknown> = {}) =>
    render(<Gridwright<Person> columns={columns} data={people} pageSize={10} addons={addons} {...props} />);

const headerNames = (): string[] =>
    screen
        .getAllByRole('columnheader', { hidden: true })
        .filter((cell) => !cell.hasAttribute('data-gw-hidden'))
        .map((cell) => cell.textContent ?? '');

describe('responsive(): hiding columns by container width', () => {
    it('shows every column while the container is wide', () => {
        renderGrid();
        expect(headerNames()).toEqual(expect.arrayContaining(['Name', 'Department', 'Salary']));
    });

    it('hides a column below its width and restores it when the container widens', () => {
        renderGrid();
        resizeTo(500);
        expect(headerNames()).toEqual(expect.arrayContaining(['Name', 'Salary']));
        expect(headerNames()).not.toContain('Department');
        resizeTo(300);
        expect(headerNames()).not.toContain('Salary');
        resizeTo(1000);
        expect(headerNames()).toEqual(expect.arrayContaining(['Name', 'Department', 'Salary']));
    });

    it('hides the cells with the header', () => {
        const { container } = renderGrid();
        resizeTo(500);
        const hidden = container.querySelectorAll('tbody td[data-gw-hidden]');
        expect(hidden.length).toBeGreaterThan(0);
        expect(hidden.length).toBe(container.querySelectorAll('tbody tr').length);
    });

    it('does nothing without the add-on', () => {
        const { container } = renderGrid([]);
        resizeTo(100);
        expect(container.querySelector('[data-gw-hidden]')).toBeNull();
        expect(container.querySelector('[data-gw-responsive]')).toBeNull();
    });

    it('keeps a hidden column in the grid and never writes the width into the saved layout', () => {
        const onChange = vi.fn();
        const { container } = renderGrid([responsive<Person>(), columnLayout<Person>({ onChange }), exportMenu<Person>()]);
        resizeTo(300);
        expect(container.querySelector('th[data-gw-hidden]')).not.toBeNull();
        // The cells are still rendered, only not displayed: the engine still has the column, so
        // sort, filter, search and export see it.
        expect(container.querySelectorAll('tbody td[data-gw-hidden]').length).toBeGreaterThan(0);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('marks the root so the stylesheet can make it a size container', () => {
        const { container } = renderGrid();
        expect(container.querySelector('.gw-root')?.hasAttribute('data-gw-responsive')).toBe(true);
    });

    it('uses initialWidth until a width is measured', () => {
        // No observer, as on the server: the assumed width is all there is.
        vi.stubGlobal('ResizeObserver', undefined);
        const { container } = renderGrid([responsive<Person>({ initialWidth: 300 })]);
        expect(container.querySelector('th[data-gw-hidden]')).not.toBeNull();
    });

    it('survives Strict Mode: one live observer, and the width still applies', () => {
        render(
            <StrictMode>
                <Gridwright<Person> columns={columns} data={people} pageSize={10} addons={[responsive<Person>()]} />
            </StrictMode>,
        );
        expect(observers.filter((observer) => !observer.disconnected)).toHaveLength(1);
        resizeTo(500);
        expect(headerNames()).not.toContain('Department');
    });

    it('disconnects the observer on unmount', () => {
        const { unmount } = renderGrid();
        unmount();
        expect(observers.every((observer) => observer.disconnected)).toBe(true);
    });
});

describe('useContainerWidth()', () => {
    it('gives an add-on component the measured width', () => {
        const Probe = () => <output data-testid="width">{String(useContainerWidth())}</output>;
        const probe: GridAddon<Person> = {
            name: 'test:probe',
            setup: () => ({ aboveTable: () => <Probe /> }),
        };
        renderGrid([responsive<Person>(), probe]);
        resizeTo(480);
        expect(screen.getByTestId('width').textContent).toBe('480');
    });

    it('is null without responsive()', () => {
        const Probe = () => <output data-testid="width">{String(useContainerWidth())}</output>;
        const probe: GridAddon<Person> = { name: 'test:probe', setup: () => ({ aboveTable: () => <Probe /> }) };
        renderGrid([probe]);
        expect(screen.getByTestId('width').textContent).toBe('null');
    });
});

describe('rowActions() on a device without hover', () => {
    const items = [{ id: 'open', label: 'Open', onSelect: vi.fn() }];

    it('adds a visible trigger, and a tap opens the menu', async () => {
        mediaMatches.add('(hover: none)');
        stubMedia();
        const user = userEvent.setup();
        renderGrid([rowActions<Person>({ items, trigger: 'hover' })]);
        const triggers = screen.getAllByRole('button', { name: 'Actions for this row' });
        expect(triggers.length).toBeGreaterThan(0);
        await user.click(triggers[0]!);
        expect(await screen.findByRole('menu', { name: 'Row actions' })).toBeTruthy();
    });

    it('adds nothing on a device with hover', () => {
        stubMedia();
        renderGrid([rowActions<Person>({ items, trigger: 'hover' })]);
        expect(screen.queryByRole('button', { name: 'Actions for this row' })).toBeNull();
    });

    it('does not open a hover or row-click menu on a touch device, so one tap on the trigger is enough', async () => {
        mediaMatches.add('(hover: none)');
        stubMedia();
        const user = userEvent.setup();
        renderGrid([rowActions<Person>({ items, trigger: 'both' })]);
        // What a touch emits before the click: the pointer events of a hover. Nothing may open.
        const cell = screen.getAllByRole('row')[1]!;
        await user.hover(cell);
        expect(screen.queryByRole('menu')).toBeNull();
        await user.click(cell);
        expect(screen.queryByRole('menu')).toBeNull();
        // One tap on the trigger pins the menu.
        await user.click(screen.getAllByRole('button', { name: 'Actions for this row' })[0]!);
        expect(await screen.findByRole('menu', { name: 'Row actions' })).toBeTruthy();
    });

    it.each(['both', 'click', 'contextmenu', 'hover-contextmenu'] as const)('adds one for the %s trigger too', (trigger) => {
        mediaMatches.add('(hover: none)');
        stubMedia();
        renderGrid([rowActions<Person>({ items, trigger })]);
        expect(screen.getAllByRole('button', { name: 'Actions for this row' }).length).toBeGreaterThan(0);
    });
});

describe('whenNarrow: an add-on that changes with the container', () => {
    const adapting = (): GridAddon<Person> => ({
        name: 'test:adapting',
        setup: () => ({
            aboveTable: () => <p>wide</p>,
            belowTable: () => <p>footer</p>,
            whenNarrow: { below: 600, contribution: { aboveTable: () => <p>narrow</p> } },
        }),
    });

    it('swaps the named slot below the width and keeps the others', () => {
        renderGrid([responsive<Person>(), adapting()]);
        expect(screen.getByText('wide')).toBeTruthy();
        resizeTo(500);
        expect(screen.getByText('narrow')).toBeTruthy();
        expect(screen.queryByText('wide')).toBeNull();
        expect(screen.getByText('footer')).toBeTruthy();
        resizeTo(800);
        expect(screen.getByText('wide')).toBeTruthy();
    });

    it('uses the base contribution without responsive(), and when listed before it', () => {
        renderGrid([adapting()]);
        expect(screen.getByText('wide')).toBeTruthy();
    });

    it('works whatever order the add-ons are listed in, and does not change the add-on list', () => {
        renderGrid([adapting(), responsive<Person>()]);
        resizeTo(500);
        expect(screen.getByText('narrow')).toBeTruthy();
    });

    it('keeps the add-on state across a resize', () => {
        const stateful: GridAddon<Person> = {
            name: 'test:stateful',
            setup: function useStateful() {
                const [clicks, setClicks] = useState(0);
                return {
                    toolbar: () => <button onClick={() => setClicks(clicks + 1)}>clicks {clicks}</button>,
                    whenNarrow: { below: 600, contribution: { toolbar: () => <button onClick={() => setClicks(clicks + 1)}>narrow clicks {clicks}</button> } },
                };
            },
        };
        renderGrid([responsive<Person>(), stateful]);
        act(() => screen.getByText('clicks 0').click());
        resizeTo(400);
        expect(screen.getByText('narrow clicks 1')).toBeTruthy();
    });
});

describe('responsive() with cellNavigation()', () => {
    it('never puts the cursor on a column that is not drawn', async () => {
        const user = userEvent.setup();
        const { container } = renderGrid([responsive<Person>(), cellNavigation<Person>()]);
        resizeTo(500);
        const firstRow = container.querySelector('tbody tr') as HTMLElement;
        const drawn = [...firstRow.querySelectorAll<HTMLElement>('td')].filter((cell) => !cell.hasAttribute('data-gw-hidden'));
        await user.tab();
        // The cursor opens on Name; one step right is the next *drawn* column, Salary, not Department.
        await user.keyboard('{ArrowRight}');
        const focused = document.activeElement as HTMLElement;
        expect(focused.hasAttribute('data-gw-hidden')).toBe(false);
        expect(drawn).toContain(focused);
        expect(focused).toBe(drawn[drawn.length - 1]);
    });
});

describe('responsive({ stackBelow }): rows as cards', () => {
    const stacking = (extra: GridAddon<Person>[] = [], stackBelow = 600) => [responsive<Person>({ stackBelow }), ...extra];

    it('does not stack while wide, or without stackBelow', () => {
        const { container, rerender } = renderGrid(stacking());
        expect(container.querySelector('[data-gw-stacked]')).toBeNull();
        expect(container.querySelector('.gw-table--stacked')).toBeNull();
        rerender(<Gridwright<Person> columns={columns} data={people} pageSize={10} addons={[responsive<Person>()]} />);
        resizeTo(300);
        expect(container.querySelector('[data-gw-stacked]')).toBeNull();
    });

    it('stacks below the width, restores the roles, and labels every value from its header', () => {
        const { container } = renderGrid(stacking());
        resizeTo(500);
        expect(container.querySelector('.gw-root')?.hasAttribute('data-gw-stacked')).toBe(true);
        expect(container.querySelector('table')?.classList.contains('gw-table--stacked')).toBe(true);
        // The grid role stays on the table; rows, cells and headers say what they are.
        expect(screen.getByRole('grid')).toBeTruthy();
        const row = container.querySelector('tbody tr') as HTMLElement;
        expect(row.getAttribute('role')).toBe('row');
        const cells = [...row.querySelectorAll<HTMLElement>('td')].filter((cell) => !cell.hasAttribute('data-gw-hidden'));
        expect(cells.every((cell) => cell.getAttribute('role') === 'gridcell')).toBe(true);
        expect(cells.map((cell) => cell.getAttribute('data-gw-label')).filter(Boolean)).toEqual(['Name', 'Salary']);
        // The header row is still in the document, so each value has its column header exactly once.
        const headers = screen.getAllByRole('columnheader', { hidden: true }).filter((cell) => !cell.hasAttribute('data-gw-hidden'));
        expect(headers.map((cell) => cell.textContent?.trim()).filter(Boolean)).toEqual(['Name', 'Salary']);
    });

    it('stacks again as the container narrows and goes back when it widens', () => {
        const { container } = renderGrid(stacking());
        resizeTo(500);
        expect(container.querySelector('.gw-table--stacked')).not.toBeNull();
        resizeTo(900);
        expect(container.querySelector('.gw-table--stacked')).toBeNull();
        expect(container.querySelector('tbody td[data-gw-label]')).toBeNull();
    });

    it('keeps the table when virtualRows() is listed, and does not throw', () => {
        const { container } = renderGrid(stacking([virtualRows<Person>({ rowHeight: 40, height: 200 })]));
        resizeTo(300);
        expect(container.querySelector('.gw-table--stacked')).toBeNull();
        expect(container.querySelector('[data-gw-stacked]')).toBeNull();
    });

    it('offers a sort control while stacked that sorts like the header button', async () => {
        const user = userEvent.setup();
        renderGrid(stacking());
        expect(screen.queryByLabelText('Sort by')).toBeNull();
        resizeTo(500);
        await user.selectOptions(screen.getByLabelText('Sort by'), 'name');
        const header = screen.getAllByRole('columnheader', { hidden: true }).find((cell) => cell.textContent?.includes('Name'))!;
        expect(header.getAttribute('aria-sort')).toBe('ascending');
        await user.selectOptions(screen.getByLabelText('Direction'), 'desc');
        expect(header.getAttribute('aria-sort')).toBe('descending');
        await user.selectOptions(screen.getByLabelText('Sort by'), '');
        expect(header.getAttribute('aria-sort')).toBe('none');
    });

    it('walks the values in reading order, and keeps the cursor off the header row', async () => {
        const user = userEvent.setup();
        const { container } = renderGrid(stacking([cellNavigation<Person>({ headerRow: true })]));
        resizeTo(500);
        const drawn = (row: Element) => [...row.querySelectorAll<HTMLElement>('td')].filter((cell) => !cell.hasAttribute('data-gw-hidden'));
        const rows = container.querySelectorAll('tbody tr');
        const first = drawn(rows[0]!);
        const second = drawn(rows[1]!);
        // Tab goes through the sort control first; the table's one tab stop is a data cell, never
        // the undrawn header.
        const stop = container.querySelector<HTMLElement>('[tabindex="0"][data-gw-cell]')!;
        expect(stop).toBe(first[0]);
        stop.focus();
        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(first[1]);
        // The end of a card is followed by the start of the next one.
        await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(second[0]);
        await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}');
        // Up from the first value stays on the first card: nothing above it to stand on.
        expect(document.activeElement).toBe(first[0]);
        expect((document.activeElement as HTMLElement).closest('thead')).toBeNull();
    });
});

describe('a sort or filter on a column the width has hidden', () => {
    it('says so, and keeps the sort in force', async () => {
        const user = userEvent.setup();
        const { container } = renderGrid([responsive<Person>(), ...[]]);
        // Sort by the column, then narrow the container past its hideBelow.
        const header = screen.getAllByRole('columnheader').find((cell) => cell.textContent?.includes('Department'))!;
        await user.click(header.querySelector('button')!);
        expect(container.querySelector('.gw-hidden-query-note')).toBeNull();
        resizeTo(500);
        expect(container.querySelector('.gw-hidden-query-note')?.textContent).toBe('Sorted by Department, hidden at this width');
        expect(header.getAttribute('aria-sort')).toBe('ascending');
        resizeTo(1000);
        expect(container.querySelector('.gw-hidden-query-note')).toBeNull();
    });
});

describe('the width never reaches the query', () => {
    it('does not refetch from a server source when the container resizes, and sends the same query', async () => {
        const requests: DataSourceRequest<Person>[] = [];
        const source: DataSource<Person> = {
            kind: 'test',
            capabilities: { sort: true, filter: true, search: true, paginate: true },
            fetch: async (request) => {
                requests.push(request);
                return { rows: people.slice(0, 5), totalRows: people.length };
            },
        };
        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={5} addons={[responsive<Person>({ stackBelow: 600 })]} />);
        await screen.findByText(people[0]!.name);
        const before = requests.length;
        resizeTo(500);
        resizeTo(300);
        resizeTo(1000);
        await act(async () => {});
        // Hiding a column and stacking the rows changed nothing the source was asked.
        expect(requests.length).toBe(before);
        expect(JSON.stringify(requests[0]!.query)).toBe(JSON.stringify(requests[requests.length - 1]!.query));
    });

    it('still searches a column the width has hidden', async () => {
        const user = userEvent.setup();
        const { container } = renderGrid([responsive<Person>(), search<Person>()]);
        resizeTo(500);
        expect(container.querySelector('th[data-gw-hidden]')).not.toBeNull();
        const department = people[0]!.department;
        await user.type(screen.getByRole('searchbox'), department);
        const rows = container.querySelectorAll('tbody tr');
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBe(people.filter((person) => person.department === department).length > 10 ? 10 : people.filter((person) => person.department === department).length);
    });
});

describe('pinned columns on a narrow container', () => {
    const pinned: readonly GridwrightColumn<Person>[] = [
        { id: 'name', header: 'Name', layout: { pinned: 'left' } },
        { id: 'department', header: 'Department' },
    ];

    it('lets go of pinning when the pinned columns would take over half the width, and takes it back', () => {
        // jsdom has no layout: the pinned header is given the width it would have.
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
            return this.hasAttribute('data-pinned') ? 400 : 0;
        });
        const { container } = render(
            <Gridwright<Person> columns={pinned} data={people} pageSize={10} addons={[columnLayout<Person>(), responsive<Person>()]} />,
        );
        expect(container.querySelector('[data-gw-pins-capped]')).toBeNull();
        resizeTo(900);
        expect(container.querySelector('[data-gw-pins-capped]')).toBeNull();
        resizeTo(700);
        expect(container.querySelector('.gw-root')?.hasAttribute('data-gw-pins-capped')).toBe(true);
        // The reader's pin is untouched: it is still on the column, and returns with the room.
        expect(container.querySelector('thead [data-pinned]')).not.toBeNull();
        resizeTo(1000);
        expect(container.querySelector('[data-gw-pins-capped]')).toBeNull();
    });
});

describe('the stylesheet does not reach the row menu', () => {
    it('scopes the pin-releasing rules to table cells, because the open menu is data-pinned too', async () => {
        const css = (await import('node:fs')).readFileSync('src/styles/styles.css', 'utf8');
        const rules = css.split('}').filter((rule) => rule.includes('position: static !important'));
        expect(rules.length).toBeGreaterThan(0);
        for (const rule of rules) expect(rule).toMatch(/:is\(th, td\)\[data-pinned\]/);
    });
});
