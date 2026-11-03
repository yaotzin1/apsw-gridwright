import { describe, expect, it, vi } from 'vitest';
import { createGridHost, defineAddon, h, renderToText, tableNode, viewEvent } from '../../src/view';
import type { GridHost, ViewAddon } from '../../src/view';

/**
 * What the table model draws for the slots T-15 added to the neutral contract: extra columns on either
 * side, attributes and handlers on the table and its rows, and the toolbar status.
 */

interface Row {
    readonly id: number;
    readonly name: string;
}
const rows: readonly Row[] = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bea' },
];
const columns = [{ id: 'name', header: 'Name' }];

const addon = (patch: Partial<ReturnType<NonNullable<ViewAddon<Row>['setup']>> & object> = {}, name = 'acme:one'): ViewAddon<Row> =>
    defineAddon<Row>({ name, setup: () => patch });

const hostOf = (addons: ViewAddon<Row>[], extra: Record<string, unknown> = {}): GridHost<Row> =>
    createGridHost<Row>({ columns, data: rows, getRowId: (row) => row.id, coreAddons: false, addons, ...extra });

const body = (host: GridHost<Row>) => {
    const model = host.getModel().body;
    if (model.kind !== 'rows') throw new Error('expected rows');
    return model;
};

describe('extra columns in the table model', () => {
    const start = addon({
        columns: [{ id: 'acme:start', placement: 'start', className: 'is-start', header: () => h('span', {}, 'S'), cell: (row) => h('span', {}, `s${row.id}`) }],
    });
    const end = addon(
        { columns: [{ id: 'acme:end', placement: 'end', header: () => h('span', {}, 'E'), cell: (row) => h('span', {}, `e${row.id}`) }] },
        'acme:two',
    );

    it('puts start columns before the data columns and end columns after, in header and body', () => {
        const host = hostOf([end, start]);
        expect(host.getModel().header.cells.map((cell) => cell.id)).toEqual(['acme:start', 'name', 'acme:end']);
        expect(body(host).row(0).cells.map((cell) => cell.columnId)).toEqual(['acme:start', 'name', 'acme:end']);
        host.destroy();
    });

    it('marks an extra header cell as no data column, with the class and column id on both cells', () => {
        const host = hostOf([start]);
        const [first] = host.getModel().header.cells;
        expect(first).toMatchObject({ id: 'acme:start', column: null, attrs: { scope: 'col', 'data-column-id': 'acme:start' } });
        expect(String(first!.attrs.className)).toContain('is-start');
        expect(body(host).row(1).cells[0]).toMatchObject({ columnId: 'acme:start', attrs: { 'data-column-id': 'acme:start' } });
        host.destroy();
    });

    it('counts the extra columns in the span of a status row, so the row is as wide as the header', () => {
        const host = hostOf([start, end], { data: [] });
        const status = host.getModel().body;
        expect(status).toMatchObject({ kind: 'status', colSpan: 3 });
        host.destroy();
    });

    it('draws the extra cells, in order, through the node description', () => {
        const host = hostOf([start, end]);
        expect(renderToText(tableNode(host.getModel())).text).toContain('s1');
        expect(renderToText(tableNode(host.getModel())).text).toContain('e2');
        host.destroy();
    });
});

describe('attributes and handlers in the table model', () => {
    it('merges table and row attributes from every add-on, through the allowlist', () => {
        const host = hostOf([
            addon({ tableAttributes: () => ({ 'data-a': 'x' }), rowAttributes: (row) => ({ 'data-row': row.id, onclick: 'bad' as never }) }),
            addon({ tableAttributes: () => ({ 'data-b': 'y' }) }, 'acme:two'),
        ]);
        expect(host.getModel().table).toMatchObject({ 'data-a': 'x', 'data-b': 'y', role: 'grid' });
        expect(body(host).row(0).attrs).toMatchObject({ 'data-row': 1, 'data-row-id': '1' });
        // The model keeps what the add-on gave; the allowlist is applied when a renderer draws it.
        const drawn = renderToText(tableNode(host.getModel())).text;
        expect(drawn).not.toContain('onclick');
        host.destroy();
    });

    it('merges row handlers, running each add-on in order and applying the first action', () => {
        const order: string[] = [];
        const host = hostOf([
            addon({ rowHandlers: (row) => ({ click: () => void order.push(`one${row.id}`) }) }),
            addon({ rowHandlers: (row) => ({ click: () => (order.push(`two${row.id}`), { type: 'focus' as const, key: 'x' }) }) }, 'acme:two'),
        ]);
        const action = body(host).row(1).handlers.click!(viewEvent());
        expect(order).toEqual(['one2', 'two2']);
        expect(action).toEqual({ type: 'focus', key: 'x' });
        host.destroy();
    });

    it('has no table handler when no add-on handles keys', () => {
        const host = hostOf([addon()]);
        expect(host.getModel().tableHandlers).toEqual({});
        host.destroy();
    });

    it('runs table key handlers in order until one handles the key, and prevents its default', () => {
        const first = vi.fn(() => false);
        const second = vi.fn(() => true);
        const third = vi.fn(() => true);
        const host = hostOf([
            addon({ tableKeyDown: first }),
            addon({ tableKeyDown: second }, 'acme:two'),
            addon({ tableKeyDown: third }, 'acme:three'),
        ]);
        const preventDefault = vi.fn();
        host.getModel().tableHandlers.keydown!(viewEvent({ key: ' ', preventDefault }));
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
        expect(third).not.toHaveBeenCalled();
        expect(preventDefault).toHaveBeenCalledOnce();
        host.destroy();
    });

    it('leaves the default alone when no add-on handled the key', () => {
        const host = hostOf([addon({ tableKeyDown: () => false })]);
        const preventDefault = vi.fn();
        host.getModel().tableHandlers.keydown!(viewEvent({ key: 'a', preventDefault }));
        expect(preventDefault).not.toHaveBeenCalled();
        host.destroy();
    });
});

describe('the toolbar in the table model', () => {
    const status = addon({ toolbarStatus: (grid) => h('span', {}, `${grid.state.rows.length} shown`) });

    it('is absent without toolbar content, so a status alone never makes a bar appear', () => {
        const host = hostOf([status]);
        expect(host.getModel().toolbar).toBeNull();
        expect(renderToText(tableNode(host.getModel())).text).not.toContain('shown');
        host.destroy();
    });

    it('holds the status and the content while the host has a toolbar, status first', () => {
        const host = hostOf([status], { toolbar: h('span', {}, 'tools') });
        expect(host.getModel().toolbar?.status).not.toBeNull();
        const text = renderToText(tableNode(host.getModel())).text;
        expect(text.indexOf('2 shown')).toBeGreaterThan(-1);
        expect(text.indexOf('2 shown')).toBeLessThan(text.indexOf('tools'));
        host.destroy();
    });

    it('has no status when every add-on returns null', () => {
        const host = hostOf([addon({ toolbarStatus: () => null })], { toolbar: h('span', {}, 'tools') });
        expect(host.getModel().toolbar).toMatchObject({ status: null });
        host.destroy();
    });
});
