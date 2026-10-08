import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Gridwright } from '../../src/react/Gridwright';
import { density, useDensity, useOptionalDensity } from '../../src/react/density';
import { columnLayout } from '../../src/react/layout';
import { virtualRows } from '../../src/react/virtual/addon';
import type { GridAddon } from '../../src/react/addons/types';
import type { DensityController, DensityOptions } from '../../src/react/density';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const grid = (options?: DensityOptions, extra: readonly GridAddon<Person>[] = []) => (
    <Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" addons={[density<Person>(options), ...extra]} />
);

const root = (): HTMLElement => screen.getByRole('grid').closest('.gw-root') as HTMLElement;
const select = (): HTMLSelectElement => screen.getByRole('combobox', { name: 'Density' });

describe('density(): the control and the root', () => {
    it('adds a labelled select and marks the root with the level (AC-01, AC-14)', () => {
        render(grid());

        expect(select()).toHaveValue('comfortable');
        expect(within(select()).getAllByRole('option').map((option) => option.textContent)).toEqual([
            'Compact',
            'Comfortable',
            'Spacious',
        ]);
        expect(root()).toHaveAttribute('data-gw-density', 'comfortable');
    });

    it('changes nothing about a grid that does not list it (AC-01)', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        expect(root()).not.toHaveAttribute('data-gw-density');
        expect(screen.queryByRole('combobox', { name: 'Density' })).toBeNull();
    });

    it('leaves the row height to the stylesheet while comfortable (AC-02, AC-10)', () => {
        render(grid());

        expect(root().style.getPropertyValue('--gw-row-height')).toBe('');
    });

    it('sets the level and the row height at once when a person chooses one (AC-04, AC-09)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(grid({ onChange }));
        expect(onChange).not.toHaveBeenCalled();

        await user.selectOptions(select(), 'compact');
        expect(root()).toHaveAttribute('data-gw-density', 'compact');
        expect(root().style.getPropertyValue('--gw-row-height')).toBe('32px');

        await user.selectOptions(select(), 'spacious');
        expect(root()).toHaveAttribute('data-gw-density', 'spacious');
        expect(root().style.getPropertyValue('--gw-row-height')).toBe('52px');

        await user.selectOptions(select(), 'comfortable');
        expect(root().style.getPropertyValue('--gw-row-height')).toBe('');

        expect(onChange.mock.calls).toEqual([['compact'], ['spacious'], ['comfortable']]);
    });

    it('takes the row heights it is given (AC-10)', async () => {
        const user = userEvent.setup();
        render(grid({ rowHeights: { compact: 28, comfortable: 44 } }));

        expect(root().style.getPropertyValue('--gw-row-height')).toBe('44px');
        await user.selectOptions(select(), 'compact');
        expect(root().style.getPropertyValue('--gw-row-height')).toBe('28px');
    });

    it('starts on `initial` and offers only `levels` (AC-03)', () => {
        render(grid({ initial: 'compact', levels: ['compact', 'spacious'] }));

        expect(select()).toHaveValue('compact');
        expect(within(select()).getAllByRole('option')).toHaveLength(2);
    });

    it('starts on the first level when `initial` is not offered (AC-03)', () => {
        render(grid({ initial: 'comfortable', levels: ['spacious', 'compact'] }));

        expect(select()).toHaveValue('spacious');
        expect(root()).toHaveAttribute('data-gw-density', 'spacious');
    });

    it('does not move the level when `initial` is written differently later (AC-08)', async () => {
        const user = userEvent.setup();
        const { rerender } = render(grid({ initial: 'compact' }));
        await user.selectOptions(select(), 'spacious');

        rerender(grid({ initial: 'comfortable' }));

        expect(select()).toHaveValue('spacious');
    });

    it('draws no control with `control: false` and still sets the root (AC-05)', () => {
        render(grid({ control: false, initial: 'compact' }));

        expect(screen.queryByRole('combobox', { name: 'Density' })).toBeNull();
        expect(root()).toHaveAttribute('data-gw-density', 'compact');
    });

    it('draws no control with one level and still sets the root and the height (AC-06)', () => {
        render(grid({ levels: ['compact'] }));

        expect(screen.queryByRole('combobox', { name: 'Density' })).toBeNull();
        expect(root()).toHaveAttribute('data-gw-density', 'compact');
        expect(root().style.getPropertyValue('--gw-row-height')).toBe('32px');
    });

    it('is a native select, first in the tab order, with no tabindex of its own (AC-14)', async () => {
        const user = userEvent.setup();
        render(grid());

        // The toolbar comes before the table, so Tab from the top of the page lands here. Arrow keys,
        // Home and End are the browser's own for a select: neither jsdom nor the browser automation used
        // for this change drives them, so they are native behaviour this test does not claim to cover.
        await user.tab();

        expect(select()).toHaveFocus();
        expect(select().tagName).toBe('SELECT');
        expect(select()).not.toHaveAttribute('tabindex');
    });

    it('says nothing in the live region when the level changes (AC-15)', async () => {
        const user = userEvent.setup();
        render(grid());
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Showing 1 to 3 of 7'));

        await user.selectOptions(select(), 'compact');

        expect(screen.getByRole('status').textContent).toBe('Showing 1 to 3 of 7');
    });

    it('renders the same markup on the server as the first client render (AC-16)', () => {
        const html = renderToString(grid({ initial: 'compact' }));

        expect(html).toContain('data-gw-density="compact"');
        expect(html).toContain('--gw-row-height:32px');
    });

    it('translates its four strings (AC-14)', async () => {
        const { pl } = await import('../../src/locales/pl');
        render(<Gridwright<Person> columns={personColumns} data={people} aria-label="Ludzie" locale={pl} addons={[density<Person>()]} />);

        const control = screen.getByRole('combobox', { name: 'Gęstość' });
        expect(within(control).getAllByRole('option').map((option) => option.textContent)).toEqual(['Kompaktowa', 'Wygodna', 'Przestronna']);
    });
});

describe('useDensity()', () => {
    it('drives the level from a control of your own (AC-05, AC-07)', async () => {
        const user = userEvent.setup();
        let controller: DensityController | undefined;
        const spy: GridAddon<Person> = {
            name: 'test:spy',
            setup: () => ({
                toolbar: () => {
                    // A slot is called while rendering, so the hook cannot run here: a component can.
                    return <Probe onController={(value) => (controller = value)} />;
                },
            }),
        };
        function Probe({ onController }: { onController: (value: DensityController) => void }) {
            const value = useDensity();
            onController(value);
            return <button onClick={() => value.setLevel('compact')}>Tighter</button>;
        }

        render(grid({ control: false }, [spy]));
        await user.click(screen.getByRole('button', { name: 'Tighter' }));

        expect(root()).toHaveAttribute('data-gw-density', 'compact');
        expect(controller?.level).toBe('compact');
        expect(controller?.levels).toEqual(['compact', 'comfortable', 'spacious']);
    });

    it('ignores a level that is not offered, and the one already chosen (AC-07)', async () => {
        const onChange = vi.fn();
        let controller: DensityController | undefined;
        const spy: GridAddon<Person> = {
            name: 'test:spy',
            setup: () => ({ toolbar: () => <Probe /> }),
        };
        function Probe() {
            controller = useDensity();
            return null;
        }

        render(grid({ levels: ['compact', 'comfortable'], onChange }, [spy]));
        controller!.setLevel('spacious');
        controller!.setLevel('comfortable');

        expect(onChange).not.toHaveBeenCalled();
        expect(root()).toHaveAttribute('data-gw-density', 'comfortable');
    });

    it('throws a message that names the add-on where it is not listed, and the optional form returns null (AC-07)', () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => renderHook(() => useDensity())).toThrow(/density\(\) add-on/);
        quiet.mockRestore();

        const { result } = renderHook(() => useOptionalDensity());
        expect(result.current).toBeNull();
    });
});

describe('density() beside virtualRows()', () => {
    // 40 is what virtualRows() uses alone; density publishes 32 and 52 for the other two levels.
    const heights = (): number[] =>
        [...document.querySelectorAll<HTMLElement>('tbody tr.gw-row')].map((row) => parseFloat(row.style.height)).filter((value) => !Number.isNaN(value));

    const windowed = (order: 'density-first' | 'virtual-first', options?: DensityOptions, virtualHeight = 40) => {
        const virtual = virtualRows<Person>({ rowHeight: virtualHeight, height: 200 });
        const dens = density<Person>(options);
        return (
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={7}
                aria-label="People"
                addons={order === 'density-first' ? [dens, virtual] : [virtual, dens]}
            />
        );
    };

    it.each(['density-first', 'virtual-first'] as const)('places rows by the level\'s height, listed %s (AC-12, AC-13)', async (order) => {
        const user = userEvent.setup();
        render(windowed(order));

        await waitFor(() => expect(heights().length).toBeGreaterThan(0));
        expect(new Set(heights())).toEqual(new Set([40]));

        await user.selectOptions(select(), 'compact');
        await waitFor(() => expect(new Set(heights())).toEqual(new Set([32])));

        await user.selectOptions(select(), 'spacious');
        await waitFor(() => expect(new Set(heights())).toEqual(new Set([52])));
    });

    it('leaves virtualRows({ rowHeight }) in charge while comfortable (AC-12)', async () => {
        render(windowed('density-first', undefined, 48));

        await waitFor(() => expect(new Set(heights())).toEqual(new Set([48])));
    });

    it('lets a third-party windowed add-on read the same number, with nothing the built-ins lack (AC-12)', async () => {
        const user = userEvent.setup();
        let seen: number | undefined;
        const thirdParty: GridAddon<Person> = {
            name: 'acme:rows',
            after: ['gridwright:density'],
            setup: ({ rowHeight }) => {
                seen = rowHeight;
            },
        };
        render(grid({}, [thirdParty]));
        expect(seen).toBeUndefined();

        await user.selectOptions(select(), 'compact');

        expect(seen).toBe(32);
    });
});

describe('density() beside another add-on that writes to the root', () => {
    it('keeps both sets of root properties (the plan\'s style-merge risk)', async () => {
        const user = userEvent.setup();
        render(grid({}, [columnLayout<Person>()]));

        await user.selectOptions(select(), 'compact');

        expect(root()).toHaveAttribute('data-gw-density', 'compact');
        expect(root().style.getPropertyValue('--gw-row-height')).toBe('32px');
    });
});

describe('the stylesheet (AC-09, AC-11)', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/styles.css'), 'utf8');

    it('reassigns only the cell padding for each non-default level, from documented tokens', () => {
        for (const level of ['compact', 'spacious']) {
            const rule = new RegExp(`\\.gw-root\\[data-gw-density='${level}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
            expect(rule).toContain(`--gw-cell-padding-x: var(--gw-density-${level}-padding-x)`);
            expect(rule).toContain(`--gw-cell-padding-y: var(--gw-density-${level}-padding-y)`);
            expect(rule).not.toMatch(/font-size|--gw-touch-target|--gw-row-height/);
            for (const axis of ['x', 'y']) expect(css).toMatch(new RegExp(`--gw-density-${level}-padding-${axis}:\\s*\\d+px`));
        }
    });

    it('still keeps interactive controls at the touch target on a coarse pointer, whatever the level', () => {
        const coarse = css.slice(css.indexOf('@media (pointer: coarse)'));
        expect(coarse).toContain('min-block-size: var(--gw-touch-target)');
    });
});
