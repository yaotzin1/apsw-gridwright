import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
// Only the public entry points: an add-on adding a row after a row has exactly this reach.
import { Gridwright, columnCountOf, virtualRows, type GridAddon } from '../../src/react/index';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

/** An add-on that puts one identifiable row after every row. */
function noteAfter(name: string, text: string): GridAddon<Person> {
    return {
        name,
        setup: () => ({
            rowAfter: (row, grid) => (
                <tr role="presentation" data-note={name}>
                    <td role="presentation" colSpan={columnCountOf(grid)}>
                        {text} {row.data.name}
                    </td>
                </tr>
            ),
        }),
    };
}

const notesOf = (): string[] => Array.from(document.querySelectorAll('[data-note]')).map((node) => node.getAttribute('data-note')!);

describe('rowAfter', () => {
    it('renders every contributed row after the row, in add-on order', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={2}
                addons={[noteAfter('acme:first', 'first'), noteAfter('acme:second', 'second')]}
            />,
        );

        // Not an owned slot: two add-ons both adding a row after the same row both render, and the
        // order is the order they were listed in rather than whichever happened to be asked first.
        expect(notesOf()).toEqual(['acme:first', 'acme:second', 'acme:first', 'acme:second']);

        const firstRow = screen.getAllByRole('row')[1]!;
        expect(firstRow.nextElementSibling).toHaveAttribute('data-note', 'acme:first');
        expect(firstRow.nextElementSibling!.nextElementSibling).toHaveAttribute('data-note', 'acme:second');
    });

    it('leaves the ARIA numbering of the result set alone', () => {
        const withoutNotes = render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);
        const bare = {
            rowCount: screen.getByRole('grid').getAttribute('aria-rowcount'),
            indices: screen.getAllByRole('row').map((row) => row.getAttribute('aria-rowindex')),
        };
        withoutNotes.unmount();

        render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" addons={[noteAfter('acme:note', 'note')]} />,
        );

        // Three extra `<tr>` elements are in the DOM and none of them is a row, so the count that
        // describes the whole result set and every row's position in it are byte-for-byte the same.
        expect(document.querySelectorAll('[data-note]')).toHaveLength(3);
        expect(screen.getByRole('grid').getAttribute('aria-rowcount')).toBe(bare.rowCount);
        expect(screen.getAllByRole('row').map((row) => row.getAttribute('aria-rowindex'))).toEqual(bare.indices);
    });

    it('spans every column the table has, extra columns included', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={1}
                selectionMode="multiple"
                addons={[noteAfter('acme:note', 'note')]}
            />,
        );

        // Four data columns and the selection checkbox column.
        expect(document.querySelector('[data-note] td')).toHaveAttribute('colspan', '5');
    });

    it('costs the contributing add-on its own row and nothing else when it throws', () => {
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
        const broken: GridAddon<Person> = {
            name: 'acme:broken',
            setup: () => ({
                rowAfter: () => {
                    throw new Error('no');
                },
            }),
        };

        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={2} addons={[broken, noteAfter('acme:note', 'note')]} />);

        // The grid still has its rows, and the add-on that works still has its own.
        expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
        expect(document.querySelectorAll('[data-note]')).toHaveLength(2);
        expect(reported).toHaveBeenCalled();
        reported.mockRestore();
    });

    it('renders in a windowed body as well as a paged one', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={7}
                addons={[virtualRows({ rowHeight: 40, height: 200 }), noteAfter('acme:note', 'note')]}
            />,
        );

        // One implementation, not two: `GridVirtualBody` renders its rows through the same
        // `GridRowOrCustom` the paged body does, so the seam reaches a windowed grid unchanged.
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows.length).toBeGreaterThan(0);
        expect(document.querySelectorAll('[data-note]')).toHaveLength(rows.length);
        expect(rows[0]!.nextElementSibling).toHaveAttribute('data-note', 'acme:note');
    });

    it('does not reach the keyboard of a grid rendered inside it', async () => {
        const user = userEvent.setup();
        const outerKeys = vi.fn();

        const watchKeys: GridAddon<Person> = {
            name: 'acme:keys',
            setup: () => ({
                tableKeyDown: (event) => {
                    outerKeys(event.key);
                    return false;
                },
            }),
        };

        // The reason the seam exists: a second grid under a row. Its keys are its own.
        const nested: GridAddon<Person> = {
            name: 'acme:nested',
            setup: () => ({
                rowAfter: (row, grid) =>
                    row.index === 0 ? (
                        <tr role="presentation">
                            <td role="presentation" colSpan={columnCountOf(grid)}>
                                <div role="region" aria-label={`Details for ${row.data.name}`}>
                                    <Gridwright<Person> columns={personColumns} data={people} pageSize={2} aria-label="Reports" />
                                </div>
                            </td>
                        </tr>
                    ) : undefined,
            }),
        };

        render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={2} aria-label="People" addons={[watchKeys, nested]} />,
        );

        const inner = screen.getByRole('grid', { name: 'Reports' });
        const outer = screen.getByRole('grid', { name: 'People' });
        expect(within(screen.getByRole('region', { name: 'Details for Ada Lovelace' })).getByRole('grid')).toBe(inner);

        // Focus something real in each table: a `<table>` takes no focus of its own, so a key press
        // is only ever delivered through whatever is focused inside it.
        await user.click(within(inner).getByRole('button', { name: 'Name' }));
        await user.keyboard('{ArrowDown}');
        expect(outerKeys).not.toHaveBeenCalled();

        await user.click(within(outer.querySelector('thead')!).getByRole('button', { name: 'Name' }));
        await user.keyboard('{ArrowDown}');
        expect(outerKeys).toHaveBeenCalledWith('ArrowDown');
    });
});
