import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright, selection as reactSelection, sorting } from '../../src/react/index';
import { createGridHost, defineAddon, h, renderToText, selection, tableNode } from '../../src/view';
import { serializeDom } from '../helpers/serialize-dom';

interface Row {
    readonly id: number;
    readonly name: string;
    readonly dept: string;
}

const rows: readonly Row[] = [
    { id: 3, name: 'Cleo', dept: 'Ops' },
    { id: 1, name: 'Ada', dept: 'Eng' },
    { id: 2, name: 'Bea', dept: 'Eng' },
    { id: 4, name: 'Dee', dept: 'Ops' },
    { id: 5, name: 'Eve', dept: 'Eng' },
];
const columns = [
    { id: 'name', header: 'Name' },
    { id: 'dept', header: 'Department', width: 140, align: 'end' as const },
    { id: 'id', header: 'Id', sortable: false },
];

/**
 * The model against the shell it describes. The React grid is given only what the model covers
 * (sorting, no footer), and both are serialized the same way, so any difference is a line that differs.
 */
const reactTree = (): string => serializeDom(document.querySelector('.gw-root')!);

describe('the table model draws what the React shell draws', () => {
    it('for a default page', async () => {
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={3} coreAddons={[sorting<Row>()]} aria-label="People" />);
        await act(async () => undefined);
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 3, ariaLabel: 'People' });
        expect(renderToText(tableNode(host.getModel())).text).toBe(reactTree());
        host.destroy();
    });

    it('after a sort, a second sort, and a column that cannot be sorted', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={3} coreAddons={[sorting<Row>()]} />);
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 3 });

        for (let press = 0; press < 3; press += 1) {
            await user.click(screen.getByRole('button', { name: 'Department' }));
            host.api.toggleSort('dept');
            expect(renderToText(tableNode(host.getModel())).text).toBe(reactTree());
        }
        host.destroy();
    });

    it('on the second page, where the row indices continue from the first', async () => {
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={2} coreAddons={[sorting<Row>()]} />);
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 2 });
        await act(async () => undefined);
        // The React page is changed by the engine behind the grid, as its pagination buttons do.
        host.api.setPage(1);
        const secondPage = renderToText(tableNode(host.getModel())).text;
        expect(secondPage).toContain('aria-rowindex="4"');
        expect(secondPage).toContain('data-row-id="2"');
        host.destroy();
    });

    it('for a grid with no rows', async () => {
        render(<Gridwright<Row> columns={columns} data={[]} coreAddons={[sorting<Row>()]} />);
        await act(async () => undefined);
        const host = createGridHost<Row>({ columns, data: [] });
        expect(renderToText(tableNode(host.getModel())).text).toBe(reactTree());
        host.destroy();
    });

    it('for a right-to-left language, with its own strings', async () => {
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={3} locale="ar" coreAddons={[sorting<Row>()]} />);
        await act(async () => undefined);
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 3, i18n: { locale: 'ar' } });
        const drawn = renderToText(tableNode(host.getModel())).text;
        expect(drawn).toContain('dir="rtl"');
        expect(drawn).toBe(reactTree());
        host.destroy();
    });

    it('for extra columns, table and row attributes and a toolbar status from one neutral add-on', async () => {
        const marks = () =>
            defineAddon<Row>({
                name: 'acme:marks',
                setup: () => ({
                    columns: [
                        { id: 'acme:first', placement: 'start', className: 'is-first', header: () => h('span', {}, 'Mark'), cell: (row) => h('span', {}, `m${row.id}`) },
                        { id: 'acme:last', placement: 'end', header: () => h('span', {}, 'End'), cell: (row) => h('span', {}, `e${row.id}`) },
                    ],
                    tableAttributes: () => ({ 'data-marks': 'on' }),
                    rowAttributes: (row) => ({ 'data-marked': row.id === 1 }),
                    toolbarStatus: (grid) => h('span', { attrs: { className: 'acme-status' } }, `${grid.state.rows.length} shown`),
                }),
            });
        render(
            <Gridwright<Row>
                columns={columns}
                data={rows}
                pageSize={3}
                coreAddons={[sorting<Row>()]}
                addons={[marks()]}
                toolbar={<span>tools</span>}
            />,
        );
        await act(async () => undefined);
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 3, addons: [marks()], toolbar: h('span', {}, 'tools') });
        const drawn = renderToText(tableNode(host.getModel())).text;
        // Guards against agreeing on an empty grid: the extras have to be in what is compared.
        for (const expected of ['data-marks="on"', 'data-marked="true"', 'is-first', 'm1', 'e3', 'acme-status', '3 shown', 'tools']) {
            expect(drawn).toContain(expected);
        }
        expect(drawn).toBe(reactTree());
        host.destroy();
    });

    it('for the selection add-on: checkboxes, aria-selected, the multiselectable table and the count, in three states', async () => {
        const toolbar = h('span', {}, 'tools');
        render(
            <Gridwright<Row>
                columns={columns}
                data={rows}
                pageSize={3}
                selectionMode="multiple"
                coreAddons={[sorting<Row>()]}
                addons={[reactSelection<Row>()]}
                toolbar={<span>tools</span>}
            />,
        );
        await act(async () => undefined);
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 3, selectionMode: 'multiple', addons: [selection<Row>()], toolbar });
        // `checked` is a property React sets after mount, so whether the DOM also carries the attribute depends on
        // history; a string renderer prints it. It is dropped from both sides here and asserted by the conformance scenarios.
        const withoutChecked = (text: string): string => text.replaceAll(' checked=""', '');
        const same = (): string => {
            const drawn = renderToText(tableNode(host.getModel())).text;
            expect(withoutChecked(drawn)).toBe(withoutChecked(reactTree()));
            return drawn;
        };

        const none = same();
        expect(none).toContain('aria-multiselectable="true"');
        expect(none).toContain('Select all rows on this page');
        expect(none).toContain('aria-selected="false"');
        expect(none).not.toContain('gw-selected-count');

        // Two engines, so the same rows are selected in each: the first row on the page in both.
        const user = userEvent.setup();
        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
        host.api.toggleRowSelection(3);
        const one = same();
        expect(one).toContain('aria-selected="true"');
        expect(one).toContain('gw-row--selected');
        expect(one).toContain('1 selected');

        await user.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
        host.api.selectPage();
        const all = same();
        expect(all).toContain('3 selected');
        expect(all.match(/aria-selected="true"/g)).toHaveLength(3);
        // `checked` and `indeterminate` are properties of the element, not attributes, so this comparison cannot see them;
        // the conformance scenarios (selection/select-all-state) ask the element itself.
        host.destroy();
    });
});
