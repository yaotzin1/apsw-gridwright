import { describe, expect, it } from 'vitest';
import { createGridHost, defineAddon, h, pagination, renderToText, sanitizeAttrs, sanitizeNode } from '../../src/view';
import type { GridHost, ViewAddon } from '../../src/view';

/**
 * Regressions for what the Indaba review debate of 2026-11-03 found, each reproduced with a probe before it was fixed.
 * Names are built so this file stays clean of the sinks the security audit looks for.
 */

describe('the style names and values a description may carry', () => {
    it('refuses a style name that would end its own declaration and begin another', () => {
        const node = h('div', { attrs: { style: { 'color: red; background-image': 'x' } as never } }, 'x');
        const { node: clean, issues } = sanitizeNode(node);
        expect(issues.map((issue) => issue.message).join(' ')).toMatch(/not a plain CSS property name/);
        expect(clean?.kind === 'element' ? clean.attrs?.style : 'dropped').toBeUndefined();
        // A string renderer never gets to print it.
        expect(renderToText(node).text).not.toContain('background-image');
    });

    it('refuses names that hold a quote, a brace, a space or a comment', () => {
        for (const name of ['a"b', 'a{b', 'a b', 'a/*b*/', 'a;b', 'a:b', '1a', '']) {
            const { issues } = sanitizeNode(h('div', { attrs: { style: { [name]: 'x' } as never } }));
            expect(issues.length, JSON.stringify(name)).toBe(1);
        }
    });

    it('still draws camelCase, kebab-case and custom properties', () => {
        const node = h('div', { attrs: { style: { textAlign: 'end', 'margin-top': 4, '--gw-offset': '2px' } } }, 'x');
        expect(sanitizeNode(node).issues).toEqual([]);
        expect(renderToText(node).text).toContain('text-align: end;');
    });

    it('refuses a fixed position, which can cover the page and redress what a reader clicks, and keeps the others', () => {
        expect(sanitizeNode(h('div', { attrs: { style: { position: 'fixed' } } })).issues).toHaveLength(1);
        expect(sanitizeNode(h('div', { attrs: { style: { position: ' FIXED ' } } })).issues).toHaveLength(1);
        for (const position of ['absolute', 'relative', 'sticky', 'static']) {
            expect(sanitizeNode(h('div', { attrs: { style: { position } } })).issues, position).toEqual([]);
        }
    });
});

describe('sanitizeAttrs: what an add-on contributes to an element the shell draws', () => {
    it('drops a function, an unlisted name and a url() style, and keeps what a description could carry', () => {
        const dirty = { className: 'a', 'aria-label': 'x', 'data-k': 1, onClick: () => undefined, srcdoc: 'x', style: { backgroundImage: 'url(https://example.test/p.png)' } } as never;
        expect(sanitizeAttrs('tr', dirty)).toEqual({ className: 'a', 'aria-label': 'x', 'data-k': 1 });
    });

    it('keeps a plain style, as a copy', () => {
        const style = { width: 120, textAlign: 'end' };
        const clean = sanitizeAttrs('th', { style } as never);
        expect(clean).toEqual({ style: { width: 120, textAlign: 'end' } });
        expect((clean as { style: unknown }).style).not.toBe(style);
    });

    it('returns the very same object when nothing was dropped, because it runs for every row', () => {
        const attrs = { className: 'a', 'aria-selected': true };
        expect(sanitizeAttrs('tr', attrs)).toBe(attrs);
        const none = Object.freeze({});
        expect(sanitizeAttrs('tr', none)).toBe(none);
    });

    it('reads a getter once: what was checked is what is returned', () => {
        let reads = 0;
        const style = {
            get backgroundImage(): string {
                reads += 1;
                return reads === 1 ? 'none' : 'url(https://example.test/p.png)';
            },
        };
        const clean = sanitizeAttrs('tr', { style } as never) as { style?: { backgroundImage?: string } };
        expect(clean.style?.backgroundImage).toBe('none');
        expect(reads).toBe(1);
    });
});

describe('the host and the focus request', () => {
    interface Row {
        readonly id: number;
    }
    const rows: readonly Row[] = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));
    const build = (): GridHost<Row> =>
        createGridHost<Row>({ columns: [{ id: 'id', header: 'Id' }], data: rows, getRowId: (row) => row.id, pageSize: 3, coreAddons: false, addons: [pagination<Row>()] });
    const press = (host: GridHost<Row>, key: 'previous' | 'next'): void => {
        const walk = (node: unknown): { on?: { click?: () => void } } | null => {
            const current = node as { kind?: string; key?: string; on?: { click?: () => void }; children?: unknown[] };
            if (current.kind === 'element' && current.key === key) return current;
            for (const child of current.children ?? []) {
                const found = walk(child);
                if (found) return found;
            }
            return null;
        };
        walk(host.getModel().belowTable)!.on!.click!();
    };

    it('lets a renderer that is told of the new page already ask for the focus that came with it', () => {
        const host = build();
        const heard: Array<string | null> = [];
        host.subscribe(() => {
            const request = host.takeFocusRequest();
            if (request !== null) heard.push(request);
        });
        press(host, 'next');
        press(host, 'next');
        expect(heard).toEqual(['previous']);
        host.destroy();
    });

    it('drops a request nobody took when the page changes again, so it cannot steal focus later', () => {
        const host = build();
        press(host, 'next');
        press(host, 'next');
        host.api.setPage(0);
        expect(host.takeFocusRequest()).toBeNull();
        host.destroy();
    });

    it('tells listeners no more for a press than for the same page change made through the API, plus recording the press', () => {
        const told = (change: (host: GridHost<Row>) => void): number => {
            const host = build();
            let count = 0;
            host.subscribe(() => void (count += 1));
            change(host);
            host.destroy();
            return count;
        };
        const viaApi = told((host) => host.api.nextPage());
        const viaPress = told((host) => press(host, 'next'));
        // The engine publishes more than once for a page change and the host is told of each; the press adds the one
        // notification for recording it. Spending the press when the page settles used to add another, which made four.
        expect(viaPress).toBeLessThanOrEqual(viaApi + 1);
    });

    it('builds the model again, before anyone is told, when an add-on spends its own state while settling', () => {
        const spenders = (spends: boolean) => {
            let spentStore: { get(): number } | undefined;
            let renders = 0;
            const addon: ViewAddon<Row> = defineAddon<Row>({
                name: 'acme:spender',
                setup: (context) => {
                    const spent = context.state('spent', 0);
                    spentStore = spent;
                    return {
                        settled: () => {
                            if (spends) spent.set(spent.get() + 1);
                        },
                        belowTable: () => {
                            renders += 1;
                            return h('span', {}, String(spent.get()));
                        },
                    };
                },
            });
            const host = createGridHost<Row>({ columns: [{ id: 'id', header: 'Id' }], data: rows, getRowId: (row) => row.id, pageSize: 3, coreAddons: false, addons: [addon] });
            let told = 0;
            host.subscribe(() => void (told += 1));
            host.api.nextPage();
            const drawn = renderToText(host.getModel().belowTable!).text;
            const result = { told, renders, drawn, spent: spentStore!.get() };
            host.destroy();
            return result;
        };
        const quiet = spenders(false);
        const spending = spenders(true);
        // Spending state while settling tells nobody more than not spending it does...
        expect(spending.told).toBe(quiet.told);
        // ...is built for, rather than ignored...
        expect(spending.renders).toBeGreaterThan(quiet.renders);
        // ...and what people were told about already has what settling wrote.
        expect(spending.spent).toBeGreaterThan(0);
        expect(spending.drawn).toContain(`"${spending.spent}"`);
    });
});

describe('the table model finds what every row asks of the add-ons once, not for every row', () => {
    it('reads the extra columns and the row slots a few times however many rows are built', () => {
        let reads = 0;
        const counting: ViewAddon<{ id: number }> = defineAddon<{ id: number }>({
            name: 'acme:counting',
            setup: () => ({
                get columns() {
                    reads += 1;
                    return [{ id: 'acme:c', placement: 'start' as const, header: () => h('span', {}, 'C'), cell: () => h('span', {}, 'c') }];
                },
                rowAttributes: () => ({ 'data-x': 1 }),
            }),
        });
        const data = Array.from({ length: 50 }, (_, index) => ({ id: index }));
        const host = createGridHost<{ id: number }>({ columns: [{ id: 'id', header: 'Id' }], data, getRowId: (row) => row.id, pageSize: 50, coreAddons: false, addons: [counting] });
        const afterBuild = reads;
        const body = host.getModel().body;
        if (body.kind !== 'rows') throw new Error('expected rows');
        for (let index = 0; index < 50; index += 1) body.row(index);
        // Building fifty rows read it no more than building none did.
        expect(reads).toBe(afterBuild);
        host.destroy();
    });
});
