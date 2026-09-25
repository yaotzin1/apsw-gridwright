import { createTheme, ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright, SORTING_ADDON } from 'apsw-gridwright/react';
import { muiAddons, muiTokens } from 'apsw-gridwright-mui';

/**
 * The built MUI package against the built grid, both through their package names.
 *
 * If the MUI build carried its own copy of the grid's React entry, its views would read a context
 * the grid never provides, and rendering them inside `<Gridwright />` would throw. So a grid that
 * renders and sorts here is the proof that there is one engine across the two packages.
 */

interface Row {
    readonly id: number;
    readonly name: string;
}

const rows: Row[] = [
    { id: 1, name: 'Beta' },
    { id: 2, name: 'Alpha' },
];

describe('apsw-gridwright-mui, as installed', () => {
    it('renders its views inside the built grid and shares its engine', async () => {
        const user = userEvent.setup();
        render(
            <ThemeProvider theme={createTheme({ palette: { primary: { main: '#7c3aed' } } })}>
                <Gridwright<Row> columns={[{ id: 'name', header: 'Name' }]} data={rows} selectionMode="multiple" coreAddons={muiAddons()} aria-label="Rows" />
            </ThemeProvider>,
        );

        const root = screen.getByRole('grid').closest('.gw-root') as HTMLElement;
        expect(root.style.getPropertyValue('--gw-accent')).toBe('#7c3aed');

        await user.click(screen.getByRole('button', { name: 'Name' }));
        await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('Alpha'));
        expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
        expect(screen.getAllByRole('checkbox', { name: 'Select row' })).toHaveLength(2);
    });

    it('names its views after the grid add-ons they replace', () => {
        expect(muiAddons().map((addon) => addon.name)).toContain(SORTING_ADDON);
        expect(Object.keys(muiTokens(createTheme()))).toContain('--gw-surface');
    });
});
