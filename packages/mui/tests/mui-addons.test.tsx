import { createTheme, ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createRemoteDataSource } from 'apsw-gridwright';
import { Gridwright, coreAddons, virtualRows } from 'apsw-gridwright/react';
import { muiAddons, muiSorting, muiTokens, MUI_THEME_ADDON } from 'apsw-gridwright-mui';
import type { Person } from '../../../tests/fixtures';
import { people, personColumns } from '../../../tests/fixtures';

/**
 * The MUI views, through the same public surface a consumer uses: the grid from
 * `apsw-gridwright/react`, the views from `apsw-gridwright-mui`, MUI from `@mui/material`.
 */

const announcement = (): string => screen.getByRole('status').textContent ?? '';
const root = (): HTMLElement => screen.getByRole('grid').closest('.gw-root') as HTMLElement;

const inTheme = (theme: ReturnType<typeof createTheme>, children: ReactNode) => <ThemeProvider theme={theme}>{children}</ThemeProvider>;

describe('muiTokens', () => {
    it('reads the palette, type, radius and spacing of a theme', () => {
        const theme = createTheme({ palette: { primary: { main: '#7c3aed' } }, shape: { borderRadius: 6 } });
        const tokens = muiTokens(theme);

        expect(tokens['--gw-accent']).toBe('#7c3aed');
        expect(tokens['--gw-surface']).toBe(theme.palette.background.paper);
        expect(tokens['--gw-radius']).toBe('6px');
        expect(tokens['--gw-cell-padding-x']).toBe(theme.spacing(2));
        expect(tokens['--gw-surface-selected']).toMatch(/^rgba\(/);
    });

    it('follows the dark palette', () => {
        const light = muiTokens(createTheme());
        const dark = muiTokens(createTheme({ palette: { mode: 'dark' } }));
        expect(dark['--gw-surface']).not.toBe(light['--gw-surface']);
        expect(dark['--gw-text']).toBe(createTheme({ palette: { mode: 'dark' } }).palette.text.primary);
    });

    it('writes CSS variable references for a CSS-variables theme, so a scheme switch needs no render', () => {
        const tokens = muiTokens(createTheme({ cssVariables: true }));
        expect(tokens['--gw-accent']).toMatch(/^var\(--mui-palette-primary-main,/);
        expect(tokens['--gw-surface-selected']).toContain('var(--mui-palette-primary-mainChannel');
    });
});

describe('muiTheme()', () => {
    it('puts the tokens, the font and the mode on the root, around every part of the grid', () => {
        render(
            inTheme(
                createTheme({ palette: { mode: 'dark', primary: { main: '#7c3aed' } } }),
                <Gridwright<Person> columns={personColumns} data={people} pageSize={3} coreAddons={muiAddons()} aria-label="People" />,
            ),
        );

        expect(root().style.getPropertyValue('--gw-accent')).toBe('#7c3aed');
        expect(root().style.fontFamily).not.toBe('');
        expect(root()).toHaveAttribute('data-gw-theme', 'dark');
        // The shell's own attributes survive the contribution.
        expect(root()).toHaveClass('gw-root');
        expect(root()).toContainElement(screen.getByRole('button', { name: 'Next page' }));
    });

    it('uses the default theme with no ThemeProvider', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} coreAddons={muiAddons()} aria-label="People" />);
        expect(root().style.getPropertyValue('--gw-accent')).toBe(createTheme().palette.primary.main);
        expect(root()).toHaveAttribute('data-gw-theme', 'light');
    });
});

describe('muiAddons()', () => {
    it('lists the theme, the three views and the stale notice, under the native names', () => {
        expect(muiAddons().map((addon) => addon.name)).toEqual([
            MUI_THEME_ADDON,
            'gridwright:sorting',
            'gridwright:selection',
            'gridwright:pagination',
            'gridwright:stale-notice',
        ]);
    });

    it('refuses a grid that lists both views of one feature', () => {
        // The shell reports a duplicate name rather than rendering two sort controls per header.
        expect(() =>
            render(
                <Gridwright<Person>
                    columns={personColumns}
                    data={people}
                    coreAddons={[...coreAddons<Person>(), muiSorting<Person>()]}
                    aria-label="People"
                />,
            ),
        ).toThrow(/gridwright:sorting/);
    });

    it('swaps one view into the native set by name', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                coreAddons={coreAddons<Person>().map((addon) => (addon.name === 'gridwright:sorting' ? muiSorting<Person>() : addon))}
                aria-label="People"
            />,
        );
        expect(screen.getByRole('button', { name: 'Salary' })).toHaveClass('MuiTableSortLabel-root');
        // The native pager is still there.
        expect(screen.getByRole('button', { name: 'Next page' })).toHaveClass('gw-button');
    });
});

describe('muiSorting()', () => {
    it('is a real button that sorts, with aria-sort on the cell and the sentence in the live region', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} coreAddons={muiAddons()} aria-label="People" />);

        const salary = screen.getByRole('button', { name: 'Salary' });
        expect(salary.tagName).toBe('BUTTON');
        expect(salary).toHaveAttribute('type', 'button');
        expect(salary).toHaveAttribute('title', 'Sort ascending (Shift: keep other columns sorted)');

        await user.click(salary);
        expect(screen.getByRole('columnheader', { name: 'Salary' })).toHaveAttribute('aria-sort', 'ascending');
        await waitFor(() => expect(announcement()).toBe('Salary, sorted ascending'));
    });

    it('adds a column with Shift and numbers the sorted columns', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} coreAddons={muiAddons()} aria-label="People" />);

        await user.click(screen.getByRole('button', { name: 'Department' }));
        await user.keyboard('{Shift>}');
        await user.click(screen.getByRole('button', { name: 'Salary' }));
        await user.keyboard('{/Shift}');

        const badge = (name: string) => within(screen.getByRole('columnheader', { name })).queryByText(/^\d$/);
        expect(badge('Department')).toHaveTextContent('1');
        expect(badge('Salary')).toHaveTextContent('2');
        await waitFor(() => expect(announcement()).toBe('Salary, sort priority 2, sorted ascending'));
    });
});

describe('muiSelection()', () => {
    it('renders labelled MUI checkboxes with an indeterminate select-page checkbox', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={3} selectionMode="multiple" coreAddons={muiAddons()} aria-label="People" />,
        );

        const all = screen.getByRole('checkbox', { name: 'Select all rows on this page' }) as HTMLInputElement;
        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);

        expect(all.indeterminate).toBe(true);
        expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
    });

    it('takes the selection options: no select-all, and selection by row click', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                coreAddons={muiAddons({ selection: { selectAll: false, selectOnRowClick: true } })}
                aria-label="People"
            />,
        );

        expect(screen.queryByRole('checkbox', { name: 'Select all rows on this page' })).toBeNull();
        await user.click(screen.getByRole('cell', { name: 'Grace Hopper' }));
        expect(screen.getAllByRole('row')[2]).toHaveAttribute('aria-selected', 'true');

        // The checkbox toggles its row once, not once for itself and once for the row click.
        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1]!);
        expect(screen.getAllByRole('row')[2]).toHaveAttribute('aria-selected', 'false');
    });
});

describe('muiPagination()', () => {
    it('says "of many" when the source sends no total, and never MUI\'s own wording', async () => {
        const source = createRemoteDataSource<Person>({
            fetcher: async ({ query }) => {
                const start = query.pagination.pageIndex * query.pagination.pageSize;
                const rows = people.slice(start, start + query.pagination.pageSize);
                return { rows, hasNextPage: start + rows.length < people.length };
            },
            retry: { attempts: 0 },
        });
        render(<Gridwright<Person> columns={personColumns} dataSource={source} pageSize={3} coreAddons={muiAddons()} aria-label="People" />);

        await waitFor(() => expect(screen.getByText('1-3 of many')).toBeInTheDocument());
        expect(screen.queryByText(/more than/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    });

    it('keeps focus in the pager when the button pressed disables itself', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} coreAddons={muiAddons()} aria-label="People" />);

        const next = screen.getByRole('button', { name: 'Next page' });
        await user.click(next);
        await user.click(next);

        // Page three of three: Next is disabled, and focus went to Previous rather than to <body>.
        await waitFor(() => expect(next).toBeDisabled());
        expect(screen.getByRole('button', { name: 'Previous page' })).toHaveFocus();
    });

    it('offers the grid its own page size and changes it', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} coreAddons={muiAddons()} aria-label="People" />);

        const select = screen.getByRole('combobox', { name: 'Rows per page' });
        expect(select.tagName).toBe('SELECT');
        expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['3', '10', '25', '50', '100']);
        await user.selectOptions(select, '10');
        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(1 + people.length));
    });

    it('gives way to virtualRows(), which replaces it by name', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                coreAddons={muiAddons()}
                addons={[virtualRows<Person>({ rowHeight: 40, height: 400 })]}
                aria-label="People"
            />,
        );
        expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
    });
});
