import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { exportMenu } from '../../src/react/export/addon';
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

    it.each(['both', 'click', 'contextmenu', 'hover-contextmenu'] as const)('adds one for the %s trigger too', (trigger) => {
        mediaMatches.add('(hover: none)');
        stubMedia();
        renderGrid([rowActions<Person>({ items, trigger })]);
        expect(screen.getAllByRole('button', { name: 'Actions for this row' }).length).toBeGreaterThan(0);
    });
});
