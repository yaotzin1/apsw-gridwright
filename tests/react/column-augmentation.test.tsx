import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
// The runtime from source, like every suite here; the types through the package specifier, which is
// what the augmentation below names and what a consumer's add-on would write.
import { Gridwright } from '../../src/react/index';
import type { GridAddon, GridwrightColumn } from 'apsw-gridwright/react';

/**
 * An add-on's own column options, declared the way a consumer's add-on would declare them.
 *
 * The built-in add-ons read `filter` and `edit` from a column; a third-party add-on needs the same
 * reach, so a column option must be addable to `GridwrightColumn` from outside the package, through
 * the package's own specifier.
 */
declare module 'apsw-gridwright/react' {
    // The parameters must repeat the interface's own, even unread.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface GridwrightColumn<TRow, TValue> {
        /** Read by the acme:heat add-on: tint cells whose value passes the threshold. */
        readonly heat?: { readonly above: number };
    }
}

interface Row {
    id: number;
    name: string;
    score: number;
}

const heat = <TRow,>(): GridAddon<TRow> => ({
    name: 'acme:heat',
    setup: () => ({
        columnSignature: (column) => (column.heat ? `heat:${column.heat.above}` : ''),
        cellAttributes: (row, column, grid) => {
            const threshold = grid.definitions.get(column.id)?.heat?.above;
            const value = column.getValue(row.data);
            return threshold !== undefined && typeof value === 'number' && value > threshold ? { 'data-heat': 'hot' } : {};
        },
    }),
});

describe('a column option declared by an add-on', () => {
    it('type-checks on the column and reaches the add-on at render time', () => {
        const columns: readonly GridwrightColumn<Row>[] = [
            { id: 'name', header: 'Name' },
            { id: 'score', header: 'Score', heat: { above: 15 } },
        ];

        render(
            <Gridwright<Row>
                columns={columns}
                data={[
                    { id: 1, name: 'Alpha', score: 30 },
                    { id: 2, name: 'Bravo', score: 10 },
                ]}
                addons={[heat<Row>()]}
            />,
        );

        const cells = screen.getAllByRole('cell');
        expect(cells[1]).toHaveAttribute('data-heat', 'hot');
        expect(cells[3]).not.toHaveAttribute('data-heat');
    });
});
