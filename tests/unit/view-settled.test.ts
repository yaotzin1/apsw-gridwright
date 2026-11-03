import { describe, expect, it, vi } from 'vitest';
import { createGridHost, defineAddon, h, pagination } from '../../src/view';
import type { GridHost, ViewAddon, ViewFocus } from '../../src/view';

/**
 * `settled` and the focus request, in the headless host: an add-on is told when the page changed, never because
 * of its own state, and what it asks for is handed to the renderer once.
 */

interface Row {
    readonly id: number;
}
const rows: readonly Row[] = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));
const columns = [{ id: 'id', header: 'Id' }];

const hostOf = (addons: ViewAddon<Row>[], pageSize = 3): GridHost<Row> =>
    createGridHost<Row>({ columns, data: rows, getRowId: (row) => row.id, pageSize, coreAddons: false, addons });

describe('settled in the grid host', () => {
    it('is told about the first state, and then only when the page or whether another page exists changes', () => {
        const settled = vi.fn((): ViewFocus | void => undefined);
        const host = hostOf([defineAddon<Row>({ name: 'acme:watch', setup: () => ({ settled }) })]);
        expect(settled).toHaveBeenCalledTimes(1);

        host.api.nextPage();
        expect(settled).toHaveBeenCalledTimes(2);
        host.api.setPageSize(3);
        host.destroy();
    });

    it('is not told when an add-on writes its own state, which is how a recorded button press survives until the page settles', () => {
        let store: { set(value: number): void } | undefined;
        const settled = vi.fn((): ViewFocus | void => undefined);
        const host = hostOf([
            defineAddon<Row>({
                name: 'acme:own',
                setup: (context) => {
                    store = context.state('n', 0);
                    return { settled };
                },
            }),
        ]);
        const before = settled.mock.calls.length;
        store!.set(1);
        store!.set(2);
        expect(settled.mock.calls.length).toBe(before);
        host.destroy();
    });

    it('hands over the first focus request once, and then nothing', () => {
        const host = hostOf([
            defineAddon<Row>({ name: 'acme:a', setup: () => ({ settled: () => ({ type: 'focus', key: 'first' }) }) }),
            defineAddon<Row>({ name: 'acme:b', setup: () => ({ settled: () => ({ type: 'focus', key: 'second' }) }) }),
        ]);
        expect(host.takeFocusRequest()).toBe('first');
        expect(host.takeFocusRequest()).toBeNull();
        host.destroy();
    });
});

describe('the neutral pager in the grid host', () => {
    const keysIn = (host: GridHost<Row>): string[] => {
        const found: string[] = [];
        const walk = (node: unknown): void => {
            const current = node as { kind?: string; key?: string; children?: unknown[] };
            if (current.kind === 'element' && current.key) found.push(current.key);
            for (const child of current.children ?? []) walk(child);
        };
        walk(host.getModel().belowTable);
        return found;
    };

    it('draws the pager below the table, with its two buttons named by key', () => {
        const host = hostOf([pagination<Row>()]);
        expect(host.getModel().belowTable).not.toBeNull();
        expect(keysIn(host)).toEqual(expect.arrayContaining(['previous', 'next']));
        host.destroy();
    });

    it('asks for focus on the other button only after the reader pressed the one that has now disabled itself', () => {
        const host = hostOf([pagination<Row>()]);
        const press = (key: 'previous' | 'next') => {
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

        // A page change nobody pressed for moves nothing.
        host.api.nextPage();
        host.api.nextPage();
        expect(host.takeFocusRequest()).toBeNull();
        host.api.setPage(0);

        press('next');
        expect(host.takeFocusRequest()).toBeNull();
        press('next');
        expect(host.takeFocusRequest()).toBe('previous');
        host.destroy();
    });

    it('does not draw when another add-on suppresses it', () => {
        const host = hostOf([
            pagination<Row>(),
            defineAddon<Row>({ name: 'acme:window', setup: () => ({ suppresses: ['gridwright:pagination'] }) }),
        ]);
        expect(host.getModel().belowTable).toBeNull();
        host.destroy();
    });

    it('leaves a page size the options do not list among the choices, so the select can show it', () => {
        const host = hostOf([pagination<Row>({ pageSizeOptions: [10, 20] })], 5);
        const options: string[] = [];
        const walk = (node: unknown): void => {
            const current = node as { kind?: string; tag?: string; attrs?: { value?: unknown; selected?: unknown }; children?: unknown[] };
            if (current.kind === 'element' && current.tag === 'option') options.push(`${String(current.attrs?.value)}${current.attrs?.selected === true ? '*' : ''}`);
            for (const child of current.children ?? []) walk(child);
        };
        walk(host.getModel().belowTable);
        expect(options).toEqual(['5*', '10', '20']);
        host.destroy();
    });
});

describe('a pager that is never drawn costs a grid nothing', () => {
    it('has no below-table content without the add-on', () => {
        const host = hostOf([defineAddon<Row>({ name: 'acme:none', setup: () => ({ toolbarStatus: () => h('span', {}, 'x') }) })]);
        expect(host.getModel().belowTable).toBeNull();
        host.destroy();
    });
});
