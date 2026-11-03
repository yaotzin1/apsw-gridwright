import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright, renderNode } from '../../src/react/index';
import { cellNavigation } from '../../src/react/navigation';
import { defineAddon, h } from '../../src/view';
import type { ViewAddon, ViewEvent } from '../../src/view';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

/**
 * The slots a neutral add-on gained for T-15: extra columns, table and row attributes, row handlers, a
 * key handler and a toolbar status. Each is written once in plain data and drawn by the React adapter.
 */

const mark = (onKey: (event: ViewEvent) => boolean = () => false, onRow = vi.fn()): ViewAddon<Person> =>
    defineAddon<Person>({
        name: 'acme:marks',
        setup: () => ({
            columns: [
                {
                    id: 'acme:marks',
                    placement: 'start',
                    className: 'acme-mark',
                    header: () => h('span', { attrs: { className: 'acme-mark-header' } }, 'Mark'),
                    cell: (row, grid) =>
                        h('input', {
                            attrs: { type: 'checkbox', 'aria-label': `mark ${row.id}`, tabIndex: grid.cellControlTabIndex('acme:marks') },
                            on: { click: (event) => void event.preventDefault },
                        }),
                },
            ],
            tableAttributes: () => ({ 'data-marks': 'on' }),
            rowAttributes: (row) => ({ 'data-marked': row.id === 1 }),
            rowHandlers: (row) => ({ click: (event) => onRow(row.id, event.origin?.fromControl) }),
            tableKeyDown: (event) => onKey(event),
            toolbarStatus: (grid) => h('span', { attrs: { className: 'acme-status' } }, `${grid.state.rows.length} shown`),
        }),
    });

describe('a neutral add-on with the T-15 slots', () => {
    it('draws its extra column, header and body cells in the table', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[mark()]} />);
        const header = screen.getAllByRole('row')[0]!;
        expect(within(header).getByText('Mark')).toBeInTheDocument();
        expect(header.firstElementChild).toHaveClass('acme-mark');
        expect(screen.getAllByRole('checkbox', { name: /^mark / })).toHaveLength(3);
    });

    it('puts its attributes on the table and on a row, through the allowlist', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[mark()]} />);
        expect(screen.getByRole('grid')).toHaveAttribute('data-marks', 'on');
        expect(screen.getAllByRole('row')[1]).toHaveAttribute('data-marked', 'true');
    });

    it('runs its row handler with an origin that says what was clicked', async () => {
        const onRow = vi.fn();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[mark(() => false, onRow)]} />);
        await userEvent.click(screen.getByText(people[0]!.name));
        expect(onRow).toHaveBeenLastCalledWith(people[0]!.id, false);
        await userEvent.click(screen.getByRole('checkbox', { name: `mark ${people[0]!.id}` }));
        expect(onRow).toHaveBeenLastCalledWith(people[0]!.id, true);
    });

    it('runs its key handler with the cell the key came from', async () => {
        const onKey = vi.fn((_event: ViewEvent) => false);
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[cellNavigation(), mark(onKey)]} />);
        screen.getAllByRole('cell')[1]!.focus();
        await userEvent.keyboard(' ');
        const event = onKey.mock.calls.find(([candidate]) => candidate.key === ' ')?.[0] as ViewEvent | undefined;
        expect(event?.origin?.cell).toMatchObject({ rowId: String(people[0]!.id), targetIsCell: true });
    });

    it('draws its toolbar status while a toolbar is shown', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[mark()]} toolbar={<span>tools</span>} />);
        expect(document.querySelector('.acme-status')).toHaveTextContent('3 shown');
    });

    it('takes the control out of the Tab order only while cell navigation visits its column', () => {
        const { unmount } = render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[mark()]} />);
        expect(screen.getAllByRole('checkbox', { name: /^mark / })[0]).not.toHaveAttribute('tabindex');
        unmount();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[cellNavigation(), mark()]} />);
        expect(screen.getAllByRole('checkbox', { name: /^mark / })[0]).toHaveAttribute('tabindex', '-1');
    });
});

describe('renderNode indeterminate', () => {
    it('sets it as the property a checkbox has, and not as an attribute', () => {
        const { container } = render(<>{renderNode(h('input', { attrs: { type: 'checkbox', checked: false, indeterminate: true }, on: { change: () => undefined } }))}</>);
        const box = container.querySelector('input')!;
        expect(box.indeterminate).toBe(true);
        expect(box).not.toHaveAttribute('indeterminate');
    });

    it('clears it when the description says false', () => {
        const { container, rerender } = render(<>{renderNode(h('input', { attrs: { type: 'checkbox', checked: false, indeterminate: true }, on: { change: () => undefined } }))}</>);
        rerender(<>{renderNode(h('input', { attrs: { type: 'checkbox', checked: false, indeterminate: false }, on: { change: () => undefined } }))}</>);
        expect(container.querySelector('input')!.indeterminate).toBe(false);
    });
});
