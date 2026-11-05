// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conformanceSuite } from '../../src/conformance';
import { createGridHost, defineAddon, h, pagination, selection } from '../../src/view';
import { mountDomGrid } from '../helpers/dom-renderer';
import { domDriver } from '../helpers/dom-conformance-driver';

/**
 * The second real renderer: the platform DOM, native events, elements kept between drawings, and no React. The node
 * driver shows the model is complete with no DOM at all; this one shows the contract also holds against a lifecycle
 * that is not React's. Every scenario the React grid passes, it passes, with no skips.
 */
conformanceSuite(domDriver(), { describe, it });

const helpers = (file: string): string => readFileSync(join(process.cwd(), 'tests/helpers', file), 'utf8');

describe('the plain-DOM renderer', () => {
    it('imports nothing from React or from the React adapter', () => {
        for (const file of ['dom-renderer.ts', 'dom-conformance-driver.ts']) {
            const source = helpers(file);
            expect(source, file).not.toMatch(/from\s+['"](?:react|react-dom|@testing-library\/react)(?:\/[^'"]*)?['"]/);
            expect(source, file).not.toMatch(/from\s+['"][^'"]*src\/react/);
        }
    });

    type Row = { id: string; name: string };
    const rows: Row[] = Array.from({ length: 12 }, (_, index) => ({ id: `r${index}`, name: `Name ${String(index).padStart(2, '0')}` }));
    const columns = [
        { id: 'id', header: 'Id' },
        { id: 'name', header: 'Name' },
    ];

    it('keeps the elements it drew, so focus survives a redraw', async () => {
        const host = createGridHost<Row>({ columns, data: rows, getRowId: (row) => row.id, pageSize: 5, addons: [pagination<Row>()] });
        const container = document.createElement('div');
        document.body.append(container);
        const grid = mountDomGrid(host, container);

        const button = container.querySelector('th button') as HTMLButtonElement;
        button.focus();
        button.click();
        await Promise.resolve();
        grid.flush();
        // Same element, still focused, now sorted: the redraw patched it in place instead of replacing it.
        expect(container.querySelector('th button')).toBe(button);
        expect(document.activeElement).toBe(button);
        expect(button.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
        grid.destroy();
        container.remove();
    });

    it('moves rows by key when the order changes, rather than rewriting every cell', async () => {
        const host = createGridHost<Row>({ columns, data: rows, getRowId: (row) => row.id, pageSize: 5, addons: [pagination<Row>()] });
        const container = document.createElement('div');
        document.body.append(container);
        const grid = mountDomGrid(host, container);
        const before = new Map(Array.from(container.querySelectorAll('tbody tr')).map((row) => [row.getAttribute('data-row-id'), row]));

        host.api.setSort([{ columnId: 'id', direction: 'desc' }]);
        await Promise.resolve();
        await Promise.resolve();
        grid.flush();
        const after = Array.from(container.querySelectorAll('tbody tr'));
        // Rows that were on the page before and still are, are the same elements.
        const kept = after.filter((row) => before.get(row.getAttribute('data-row-id')) === row);
        expect(after.map((row) => row.getAttribute('data-row-id'))[0]).not.toBe('r0');
        for (const row of kept) expect(before.get(row.getAttribute('data-row-id'))).toBe(row);
        grid.destroy();
        container.remove();
    });

    it('draws several store writes in one handler as one redraw', async () => {
        let draws = 0;
        const counter = defineAddon<Row>({
            name: 'test:counter',
            setup: ({ state }) => {
                const count = state('count', 0);
                return {
                    belowTable: () =>
                        h('button', { attrs: { type: 'button' }, on: { click: () => { count.update((n) => n + 1); count.update((n) => n + 1); } } }, `Count ${count.get()}`),
                };
            },
        });
        const host = createGridHost<Row>({ columns, data: rows, getRowId: (row) => row.id, addons: [selection<Row>(), counter] });
        // The renderer reads the model once per drawing, so counting reads counts drawings.
        const counted = { ...host, getModel: () => ((draws += 1), host.getModel()) };
        const container = document.createElement('div');
        document.body.append(container);
        const grid = mountDomGrid(counted, container);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.startsWith('Count'))!;
        const start = draws;
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(button.textContent).toBe('Count 2');
        expect(draws - start).toBe(1);
        grid.destroy();
        container.remove();
    });

    it('drops what the allowlist refuses, and says so', () => {
        const hostile = defineAddon<Row>({
            name: 'test:hostile',
            setup: () => ({
                belowTable: () => ({ kind: 'element', tag: 'script', children: [{ kind: 'text', value: 'alert(1)' }] }) as never,
            }),
        });
        const host = createGridHost<Row>({ columns, data: rows, getRowId: (row) => row.id, addons: [hostile] });
        const container = document.createElement('div');
        const reported: string[] = [];
        const grid = mountDomGrid(host, container, { onIssues: (issues) => reported.push(...issues.map((issue) => issue.message)) });
        expect(container.querySelector('script')).toBeNull();
        expect(reported.join(' ')).toMatch(/script/);
        grid.destroy();
    });
});
