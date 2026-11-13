// @vitest-environment node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Deliberately the package specifiers, resolved to `dist/` by vitest.smoke.config.ts. Nothing in this file may reach into
// `src/`: this proves the artifact a consumer installs, including its export map, for the two headless entries a
// framework adapter is built on. The environment is node on purpose: there is no document and no window here at all.
import { GridwrightError, createTranslator } from '@apsw/gridwright';
import * as react from '@apsw/gridwright/react';
import * as view from '@apsw/gridwright/view';
import {
    PAGINATION_ADDON,
    SELECTION_ADDON,
    SORTING_ADDON,
    createGridHost,
    orderAddons,
    pagination,
    renderToText,
    sanitizeNode,
    selection,
    sorting,
    tableNode,
    h,
} from '@apsw/gridwright/view';
import { allScenarios, conformanceSuite } from '@apsw/gridwright/conformance';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('@apsw/gridwright/view through the export map', () => {
    it('draws a whole grid, with its pager and its checkboxes, in a process that has no DOM', () => {
        expect(typeof document).toBe('undefined');
        expect(typeof window).toBe('undefined');
        const host = createGridHost<{ name: string }>({
            columns: [{ id: 'name', header: 'Name' }],
            data: [{ name: 'Ada' }, { name: 'Bea' }, { name: 'Cleo' }],
            pageSize: 2,
            selectionMode: 'multiple',
            coreAddons: false,
            addons: [sorting(), selection(), pagination()],
        });
        const { text, issues } = renderToText(tableNode(host.getModel()));
        expect(issues).toEqual([]);
        for (const expected of ['Sort ascending', 'Select all rows on this page', 'Select row', 'Next page', '1-2 of 3', 'Ada']) {
            expect(text).toContain(expected);
        }
        host.destroy();
    });

    it('names its add-ons as the React entry does', () => {
        expect([SORTING_ADDON, SELECTION_ADDON, PAGINATION_ADDON]).toEqual(['gridwright:sorting', 'gridwright:selection', 'gridwright:pagination']);
        expect([react.sorting().name, react.selection().name, react.pagination().name]).toEqual([SORTING_ADDON, SELECTION_ADDON, PAGINATION_ADDON]);
    });

    it('throws the engine\'s own error class, the one imported from the core entry', () => {
        expect(() => orderAddons(false, () => [], [sorting(), sorting()])).toThrow(GridwrightError);
    });

    it('draws only what its allowlist names: a tag outside it is dropped and reported', () => {
        const hostile = { kind: 'element', tag: ['scr', 'ipt'].join(''), children: [{ kind: 'text', value: 'x' }] } as never;
        const { node, issues } = sanitizeNode(h('div', {}, hostile));
        expect(issues.length).toBeGreaterThan(0);
        expect(JSON.stringify(node)).not.toContain(['scr', 'ipt'].join(''));
    });

    it('is the same module instance the React entry re-exports from, not a second copy', () => {
        // Imported from both specifiers, these are the same function: a second copy would be a second engine, and a fix
        // to one would not reach the other. (The React sorting, selection and pagination are the neutral add-ons adapted,
        // so they are different functions on purpose; scripts/check-exports.mjs lists them and checks they behave alike.)
        const names = [
            'mergeAttributes',
            'bodyStatusOf',
            'ariaSortOf',
            'nextSortAction',
            'sortPriorityOf',
            'sortTitleOf',
            'pageSelectionOf',
            'pageRangeOf',
            'pageSizeChoices',
            'pageFocusAfterChange',
            'DEFAULT_PAGE_SIZE_OPTIONS',
            'sortingMessages',
            'selectionMessages',
            'paginationMessages',
            'SORTING_ADDON',
            'SELECTION_ADDON',
            'PAGINATION_ADDON',
        ] as const;
        for (const name of names) expect(react[name], name).toBe(view[name]);
        expect(createTranslator).toBeDefined();
    });
});

describe('@apsw/gridwright/conformance through the export map', () => {
    it('lists every scenario once, and registers each with the adapter\'s own runner', () => {
        const ids = allScenarios.map((scenario) => scenario.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeGreaterThanOrEqual(17);
        for (const family of ['sorting/', 'selection/', 'pagination/']) expect(ids.some((id) => id.startsWith(family))).toBe(true);

        const registered: string[] = [];
        conformanceSuite(
            { mount: () => Promise.reject(new Error('unused')), unmount: () => undefined },
            { describe: (_name, body) => body(), it: (name) => void registered.push(name) },
        );
        expect(registered).toHaveLength(ids.length);
    });
});

/**
 * The claim an adapter author relies on: both entries import where React is not installed. A subprocess is the only honest test,
 * because this process can resolve React. It blocks `react` and `react-dom` at resolution, proves the block is live, and then
 * imports each entry through its package specifier (the package resolves itself by name from inside its own folder) and runs a
 * grid, in both module systems.
 */
describe('the headless entries with React made unavailable', () => {
    let directory = '';

    beforeAll(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-smoke-'));
        fs.writeFileSync(
            path.join(directory, 'hooks.mjs'),
            "export async function resolve(specifier, context, next) {\n" +
                "    if (/^(react|react-dom)(\\/|$)/.test(specifier)) throw new Error('BLOCKED ' + specifier);\n" +
                "    return next(specifier, context);\n}\n",
        );
        fs.writeFileSync(path.join(directory, 'block.mjs'), "import { register } from 'node:module';\nregister('./hooks.mjs', import.meta.url);\n");
        fs.writeFileSync(
            path.join(directory, 'block.cjs'),
            "const Module = require('node:module');\nconst resolve = Module._resolveFilename;\n" +
                "Module._resolveFilename = function (request, ...rest) {\n" +
                "    if (/^(react|react-dom)(\\/|$)/.test(request)) throw new Error('BLOCKED ' + request);\n" +
                "    return resolve.call(this, request, ...rest);\n};\n",
        );
    });

    afterAll(() => {
        if (directory) fs.rmSync(directory, { recursive: true, force: true });
    });

    // A loader hook is given as a URL: on Windows a drive-letter path is read as a URL scheme.
    const blockModule = (): string => pathToFileURL(path.join(directory, 'block.mjs')).href;

    const run = (args: string[]): string =>
        execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });

    const PROBE =
        "const out = { dom: typeof document + typeof window };\n" +
        "const view = __VIEW__; const kit = __KIT__;\n" +
        "const host = view.createGridHost({ columns: [{ id: 'n', header: 'N' }], data: [{ n: 'a' }, { n: 'b' }], pageSize: 1, coreAddons: false, addons: [view.sorting(), view.pagination()] });\n" +
        "out.text = view.renderToText(view.tableNode(host.getModel())).text;\n" +
        "out.scenarios = kit.allScenarios.length;\n" +
        "console.log(JSON.stringify(out));\n";

    it('proves the block is live: importing react in that process fails', () => {
        const message = (() => {
            try {
                run(['--import', blockModule(), '--input-type=module', '-e', "await import('react')"]);
                return 'did not fail';
            } catch (error) {
                return String((error as { stderr?: string }).stderr ?? error);
            }
        })();
        expect(message).toContain('BLOCKED react');
    });

    it('imports and runs as an ES module, through the package specifiers', () => {
        const code = PROBE.replace('__VIEW__', "await import('@apsw/gridwright/view')").replace('__KIT__', "await import('@apsw/gridwright/conformance')");
        const result = JSON.parse(run(['--import', blockModule(), '--input-type=module', '-e', code]).trim()) as { dom: string; text: string; scenarios: number };
        expect(result.dom).toBe('undefinedundefined');
        expect(result.text).toContain('Next page');
        expect(result.scenarios).toBeGreaterThanOrEqual(17);
    });

    it('imports and runs as CommonJS, through the package specifiers', () => {
        const code = PROBE.replace('__VIEW__', "require('@apsw/gridwright/view')").replace('__KIT__', "require('@apsw/gridwright/conformance')");
        const result = JSON.parse(run(['--require', path.join(directory, 'block.cjs'), '-e', code]).trim()) as { dom: string; text: string; scenarios: number };
        expect(result.dom).toBe('undefinedundefined');
        expect(result.text).toContain('Next page');
        expect(result.scenarios).toBeGreaterThanOrEqual(17);
    });
});
