// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { GridwrightError } from '../../src/core/errors';
import type { DataSource, DataSourceRequest } from '../../src/core/types';
import { createGridHost, defineAddon, renderToText, sanitizeNode, tableNode } from '../../src/view';
import type { TableModel, ViewAddon } from '../../src/view';

interface Row {
    readonly id: number;
    readonly name: string;
}

const rows: readonly Row[] = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, name: `Name ${index + 1}` }));
const columns = [
    { id: 'name', header: 'Name' },
    { id: 'id', header: 'Id', align: 'end' as const },
];

const bodyRows = (model: TableModel<Row>) => {
    if (model.body.kind !== 'rows') throw new Error('expected a row body');
    return model.body;
};

/** A source that answers from a function, so a test chooses the page, the total and the failure. */
function source(answer: (request: DataSourceRequest<Row>) => Promise<{ rows: Row[]; totalRows?: number }> | { rows: Row[]; totalRows?: number }): DataSource<Row> {
    return { kind: 'test', capabilities: { sort: false, filter: false, search: false, paginate: false }, fetch: answer };
}

describe('the table model', () => {
    it('describes the table with the ARIA numbering the React shell uses', () => {
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 10 });
        const model = host.getModel();
        // The total plus the header row, because aria-rowindex counts it.
        expect(model.table).toMatchObject({ role: 'grid', 'aria-rowcount': 26, 'aria-busy': false });
        expect(model.header.attrs).toMatchObject({ 'aria-rowindex': 1 });
        expect(bodyRows(model).rowCount).toBe(10);
        expect(bodyRows(model).row(0).attrs).toMatchObject({ 'aria-rowindex': 2, 'data-row-id': '1' });
        host.destroy();
    });

    it('numbers rows by their place in the whole result, not on the page', () => {
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 10 });
        host.api.setPage(2);
        const model = host.getModel();
        expect(bodyRows(model).row(0).attrs).toMatchObject({ 'aria-rowindex': 22, 'data-row-id': '21' });
        expect(bodyRows(model).rowCount).toBe(5);
        host.destroy();
    });

    it('never invents a total: an unknown count is -1', async () => {
        const host = createGridHost<Row>({
            columns,
            // A source that paginates for itself and sends no count: the grid has a page, not a total.
            dataSource: { ...source(async () => ({ rows: rows.slice(0, 3) })), capabilities: { sort: false, filter: false, search: false, paginate: true } },
            pageSize: 3,
        });
        await vi.waitFor(() => expect(host.api.getState().status).toBe('ready'));
        expect(host.getModel().table['aria-rowcount']).toBe(-1);
        host.destroy();
    });

    it('builds a row only when it is asked for', () => {
        let reads = 0;
        const counted = [{ id: 'name', header: 'Name', accessor: (row: Row) => (reads += 1, row.name) }];
        const host = createGridHost<Row>({ columns: counted, data: rows, pageSize: 25 });
        const before = reads;
        // Building the model, and the header, reads no cell: 25 rows are on show and none was asked for.
        const model = host.getModel();
        expect(model.header.cells).toHaveLength(1);
        expect(reads).toBe(before);
        bodyRows(model).row(3);
        expect(reads).toBe(before + 1);
        host.destroy();
    });

    it('refuses a row position the grid does not show', () => {
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 5 });
        expect(() => bodyRows(host.getModel()).row(5)).toThrow(RangeError);
        expect(() => bodyRows(host.getModel()).row(-1)).toThrow(RangeError);
        host.destroy();
    });

    it('keeps cell text as text, whatever the data holds', () => {
        const hostile = ['<img src=x ', 'on', 'error=1>'].join('');
        const host = createGridHost<Row>({ columns, data: [{ id: 1, name: hostile }] });
        const cell = bodyRows(host.getModel()).row(0).cells[0]!;
        expect(cell.content).toEqual({ kind: 'text', value: hostile });
        const drawn = renderToText(tableNode(host.getModel()));
        expect(drawn.issues).toEqual([]);
        expect(drawn.text).toContain(JSON.stringify(hostile));
        // It is a quoted line of text; no line of the drawing is an element of that name.
        expect(drawn.text).not.toMatch(/^\s*<img/m);
        host.destroy();
    });

    it('carries column width, minimum width and alignment into the header and the cells', () => {
        const host = createGridHost<Row>({ columns: [{ id: 'name', header: 'Name', width: 120, minWidth: 80, align: 'end' }], data: rows });
        const model = host.getModel();
        expect(model.header.cells[0]!.attrs).toMatchObject({ style: { width: 120, minWidth: 80, textAlign: 'end' }, 'data-column-id': 'name', scope: 'col' });
        expect(bodyRows(model).row(0).cells[0]!.attrs).toMatchObject({ style: { textAlign: 'end' } });
        host.destroy();
    });

    it('sets language and direction on the root, direction only for right to left', () => {
        const english = createGridHost<Row>({ columns, data: rows });
        expect(english.getModel().root).toMatchObject({ lang: 'en' });
        expect(english.getModel().root.dir).toBeUndefined();
        const arabic = createGridHost<Row>({ columns, data: rows, i18n: { locale: 'ar' } });
        expect(arabic.getModel().root).toMatchObject({ lang: 'ar', dir: 'rtl' });
        english.destroy();
        arabic.destroy();
    });

    it('names the table by its label and caption when given', () => {
        const host = createGridHost<Row>({ columns, data: rows, ariaLabel: 'People', caption: 'All people' });
        expect(host.getModel().table['aria-label']).toBe('People');
        expect(host.getModel().caption).toBe('All people');
        expect(renderToText(tableNode(host.getModel())).text).toContain('<caption class="gw-caption">');
        host.destroy();
    });
});

describe('the body when there are no rows', () => {
    it('says loading while the first fetch is in flight, in the table and not instead of it', async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const host = createGridHost<Row>({ columns, dataSource: source(async () => (await gate, { rows: [], totalRows: 0 })) });
        const model = host.getModel();
        expect(model.body).toMatchObject({ kind: 'status', status: 'loading', colSpan: 2 });
        expect(model.header.cells).toHaveLength(2);
        expect(model.table['aria-busy']).toBe(true);
        release();
        await vi.waitFor(() => expect(host.getModel().body).toMatchObject({ status: 'empty' }));
        expect(renderToText(tableNode(host.getModel())).text).toContain('No rows');
        host.destroy();
    });

    it('shows the error with a retry that fetches again, and only when the error can be retried', async () => {
        let calls = 0;
        const host = createGridHost<Row>({
            columns,
            dataSource: source(async () => {
                calls += 1;
                if (calls === 1) throw new GridwrightError('server is down', { retryable: true });
                return { rows: rows.slice(0, 2), totalRows: 2 };
            }),
        });
        await vi.waitFor(() => expect(host.getModel().body).toMatchObject({ status: 'error' }));
        const tree = sanitizeNode(tableNode(host.getModel())).node!;
        const drawn = renderToText(tree).text;
        expect(drawn).toContain('role="alert"');
        expect(drawn).toContain('"server is down"');
        expect(drawn).toContain('type="button"');

        const retry = findButton(tree);
        retry!.on!.click!({ shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault: () => undefined });
        await vi.waitFor(() => expect(host.getModel().body).toMatchObject({ kind: 'rows', rowCount: 2 }));
        host.destroy();
    });

    it('offers no retry for an error that cannot be retried', async () => {
        const host = createGridHost<Row>({
            columns,
            dataSource: source(async () => {
                throw new GridwrightError('forbidden', { retryable: false });
            }),
        });
        await vi.waitFor(() => expect(host.getModel().body).toMatchObject({ status: 'error' }));
        // The header's sort buttons are buttons too; the retry is the one with the grid's button class.
        expect(renderToText(tableNode(host.getModel())).text).not.toContain('gw-button');
        host.destroy();
    });
});

function findButton(node: ReturnType<typeof tableNode>): Extract<ReturnType<typeof tableNode>, { kind: 'element' }> | null {
    if (node.kind === 'element') {
        if (node.tag === 'button') return node;
        for (const child of node.children ?? []) {
            const found = findButton(child);
            if (found) return found;
        }
    }
    return null;
}

describe('the host', () => {
    it('publishes a new model when the engine changes and the same one otherwise', () => {
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 5 });
        const first = host.getModel();
        expect(host.getModel()).toBe(first);
        const heard = vi.fn();
        host.subscribe(heard);
        host.api.setPage(1);
        expect(heard).toHaveBeenCalled();
        expect(host.getModel()).not.toBe(first);
        host.destroy();
    });

    it('stops telling a listener who unsubscribed, and everyone after destroy', () => {
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 5 });
        const gone = vi.fn();
        const kept = vi.fn();
        host.subscribe(gone)();
        host.subscribe(kept);
        host.api.setPage(1);
        expect(gone).not.toHaveBeenCalled();
        expect(kept).toHaveBeenCalled();
        kept.mockClear();
        host.destroy();
        expect(host.api.destroyed).toBe(true);
        expect(kept).not.toHaveBeenCalled();
    });

    it('refuses data and a data source together, as the React hook does', () => {
        expect(() => createGridHost<Row>({ columns, data: rows, dataSource: source(() => ({ rows: [] })) })).toThrow(/either `data`/);
    });

    it('is ordered, required and suppressed like the React grid lists add-ons', () => {
        const needs = defineAddon<Row>({ name: 'acme:needs', requires: ['acme:absent'], setup: () => ({}) });
        expect(() => createGridHost<Row>({ columns, data: rows, addons: [needs] })).toThrow(/requires "acme:absent"/);
        const twin = defineAddon<Row>({ name: 'gridwright:sorting', setup: () => ({}) });
        expect(() => createGridHost<Row>({ columns, data: rows, addons: [twin] })).toThrow(/listed twice/);
        const bare = createGridHost<Row>({ columns, data: rows, coreAddons: false });
        expect(bare.getModel().header.cells[0]!.label).toMatchObject({ kind: 'element', tag: 'span' });
        bare.destroy();
    });

    it('runs an add-on of its own: attributes, label, and state that redraws the grid', () => {
        const marker: ViewAddon<Row> = defineAddon<Row>({
            name: 'acme:marker',
            setup: ({ state }) => {
                const marks = state('marks', 0);
                return {
                    headerAttributes: (column) => ({ 'data-marks': marks.get(), 'data-for': column.id }),
                };
            },
        });
        let store: { set(n: number): void } | null = null;
        const spy: ViewAddon<Row> = defineAddon<Row>({
            name: 'acme:spy',
            setup: ({ state }) => {
                store = state<number>('marks', 0);
                return {};
            },
        });
        const host = createGridHost<Row>({ columns, data: rows, addons: [marker, spy] });
        expect(host.getModel().header.cells[0]!.attrs).toMatchObject({ 'data-marks': 0, 'data-for': 'name' });
        // Keys belong to the add-on: the spy's "marks" is its own store, not the marker's.
        store!.set(7);
        expect(host.getModel().header.cells[0]!.attrs).toMatchObject({ 'data-marks': 0 });
        host.destroy();
    });

    it('survives an add-on that throws in a slot? No: setup errors surface, they are not swallowed', () => {
        const broken = defineAddon<Row>({
            name: 'acme:broken',
            setup: () => {
                throw new Error('setup failed');
            },
        });
        expect(() => createGridHost<Row>({ columns, data: rows, addons: [broken] })).toThrow('setup failed');
    });
});

describe('the live region of a host that is told of every publish', () => {
    it('says what a sort did even though the engine publishes the query before the rows', () => {
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 5 });
        expect(host.getModel().live).toBe('Showing 1 to 5 of 25');
        host.api.toggleSort('id');
        expect(host.getModel().live).toBe('Id, sorted ascending');
        host.api.toggleSort('id');
        expect(host.getModel().live).toBe('Id, sorted descending');
        host.destroy();
    });

    it('goes back to the row range after a page change, which no add-on has anything to say about', () => {
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 10 });
        host.api.toggleSort('id');
        host.api.setPage(1);
        expect(host.getModel().live).toBe('Showing 11 to 20 of 25');
        host.destroy();
    });
});
