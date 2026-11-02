import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright, sorting } from '../../src/react/index';
import { createGridHost, renderToText, tableNode } from '../../src/view';
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
});
