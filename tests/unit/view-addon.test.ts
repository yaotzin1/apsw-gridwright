// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { createLocalDataSource } from '../../src/data/local';
import { createTranslator } from '../../src/i18n/translator';
import { createStateScope, VIEW_ADDON, defineAddon, isViewAddon, orderAddons, renderToText, resolveSet, slotValues, sorting, SORTING_ADDON, sortingMessages } from '../../src/view';
import type { ViewAddon, ViewAddonContribution, ViewRenderGrid } from '../../src/view';
import { component, h } from '../../src/view';

/**
 * The neutral add-on contract and the first add-on written against it, run with no DOM and no React.
 * If `sorting()` needed either, importing it or drawing it here would throw.
 */

interface Row {
    readonly id: number;
    readonly name: string;
    readonly note: string;
}

const rows: readonly Row[] = [
    { id: 1, name: 'Ada', note: 'a' },
    { id: 2, name: 'Grace', note: 'b' },
];

function renderGridOf(options: { tabIndex?: -1 } = {}): { grid: ViewRenderGrid<Row>; api: ReturnType<typeof createGridEngine<Row>> } {
    const api = createGridEngine<Row>({
        columns: [
            { id: 'name', header: 'Name' },
            { id: 'note', header: 'Note', sortable: false },
            { id: 'id', header: 'Id' },
        ],
        dataSource: createLocalDataSource<Row>([...rows]),
    });
    const translator = createTranslator({});
    const grid: ViewRenderGrid<Row> = {
        api,
        state: api.getState(),
        messages: (addon, fallback) => (key, values) => translator.translateAddon(addon, key, values, fallback),
        headerContent: (column) => h('span', {}, column.header),
        headerControlTabIndex: options.tabIndex,
        cellControlTabIndex: () => options.tabIndex,
    };
    return { grid, api };
}

const contributionOf = (addon: ViewAddon<Row>): ViewAddonContribution<Row> => addon.setup({ addons: [addon.name], state: createStateScope() }) ?? {};

describe('defineAddon', () => {
    it('brands an add-on without changing what it holds', () => {
        const plain: ViewAddon<Row> = { name: 'acme:x', setup: () => ({}) };
        const branded = defineAddon(plain);
        expect(isViewAddon(branded)).toBe(true);
        expect(branded[VIEW_ADDON]).toBe(true);
        expect(branded.name).toBe('acme:x');
        expect(branded.setup).toBe(plain.setup);
        expect(isViewAddon(plain)).toBe(false);
    });

    it('is not fooled by look-alikes', () => {
        expect(isViewAddon(null)).toBe(false);
        expect(isViewAddon('gridwright:sorting')).toBe(false);
        expect(isViewAddon({ name: 'a', setup: () => ({}) })).toBe(false);
        expect(isViewAddon({ [VIEW_ADDON]: 'yes' })).toBe(false);
    });

    it('shares one resolution with every other kind of add-on', () => {
        const a = defineAddon<Row>({ name: 'acme:a', setup: () => ({}) });
        const b = defineAddon<Row>({ name: 'acme:b', after: ['acme:c'], setup: () => ({}) });
        const c = defineAddon<Row>({ name: 'acme:c', setup: () => ({}) });
        expect(orderAddons([a, b, false, c], () => [], undefined).map((addon) => addon.name)).toEqual(['acme:a', 'acme:c', 'acme:b']);
    });

    it('is resolved for suppression and ownership like any contribution', () => {
        const owner = (name: string) => defineAddon<Row>({ name, setup: () => ({ headerLabel: () => h('span') }) });
        const one = { name: 'acme:one', contribution: contributionOf(owner('acme:one')) };
        const two = { name: 'acme:two', contribution: contributionOf(owner('acme:two')) };
        // Two owners of the header label is the same error a React add-on gets.
        expect(() => resolveSet([one, two])).toThrow(/both render the header label/);
        // And the same remedy: one suppresses the other, and the suppressed one is not asked.
        const resolved = resolveSet([one, { ...two, contribution: { ...two.contribution, suppresses: ['acme:one'] } }]);
        expect(resolved.headerLabel?.name).toBe('acme:two');
        expect(resolved.active.map((addon) => addon.name)).toEqual(['acme:two']);
    });
});

describe('sorting() written once', () => {
    it('is a branded neutral add-on with its own messages', () => {
        const addon = sorting<Row>();
        expect(isViewAddon(addon)).toBe(true);
        expect(addon.name).toBe(SORTING_ADDON);
        expect(contributionOf(addon).messages).toBe(sortingMessages);
    });

    it('draws a real button inside a label for a sortable column, as a description', () => {
        const { grid } = renderGridOf();
        const column = grid.api.getColumns().find((c) => c.id === 'name')!;
        const node = contributionOf(sorting<Row>()).headerLabel!(column, grid);
        expect(renderToText(node).text).toBe(
            [
                '<button class="gw-sort-button" title="Sort ascending (Shift: keep other columns sorted)" type="button">',
                '  <span class="gw-header-label">',
                '    <span>',
                '      "Name"',
                '  <span aria-hidden="true" class="gw-sort-indicator" data-direction="none">',
                '',
            ].join('\n'),
        );
    });

    it('draws only the label for a column that cannot be sorted', () => {
        const { grid } = renderGridOf();
        const column = grid.api.getColumns().find((c) => c.id === 'note')!;
        const node = contributionOf(sorting<Row>()).headerLabel!(column, grid);
        expect(renderToText(node).text).toBe('<span class="gw-header-label">\n  <span>\n    "Note"\n');
    });

    it('leaves the Tab order while navigation visits the header, and not otherwise', () => {
        const column = (grid: ViewRenderGrid<Row>) => grid.api.getColumns().find((c) => c.id === 'name')!;
        const inNav = renderGridOf({ tabIndex: -1 });
        const free = renderGridOf();
        const withNav = renderToText(contributionOf(sorting<Row>()).headerLabel!(column(inNav.grid), inNav.grid)).text;
        const without = renderToText(contributionOf(sorting<Row>()).headerLabel!(column(free.grid), free.grid)).text;
        expect(withNav).toContain('tabindex="-1"');
        expect(without).not.toContain('tabindex');
    });

    it('says what activating it does, and what Shift does only while multi-sort is on', () => {
        const { grid } = renderGridOf();
        const column = grid.api.getColumns().find((c) => c.id === 'name')!;
        const single = renderToText(contributionOf(sorting<Row>({ multiSort: false })).headerLabel!(column, grid)).text;
        expect(single).toContain('title="Sort ascending"');
        expect(single).not.toContain('Shift');
    });

    it('sorts on activation, and adds to the sort only when Shift is held and multi-sort is on', () => {
        const { grid, api } = renderGridOf();
        const column = api.getColumns().find((c) => c.id === 'name')!;
        const press = (multiSort: boolean, shiftKey: boolean) => {
            const node = contributionOf(sorting<Row>({ multiSort })).headerLabel!(column, grid);
            const click = (node as Extract<typeof node, { kind: 'element' }>).on!.click!;
            click({ shiftKey, ctrlKey: false, metaKey: false, altKey: false, preventDefault: () => undefined });
        };
        press(true, false);
        expect(api.getSort('name')).toBe('asc');
        press(true, false);
        expect(api.getSort('name')).toBe('desc');
        press(true, false);
        expect(api.getSort('name')).toBeNull();
        // Shift with multi-sort off is an ordinary press: it never asks the engine to keep other columns.
        const calls: unknown[] = [];
        const spy = { ...grid, api: { ...api, toggleSort: (id: string, options?: unknown) => void calls.push([id, options]) } as typeof api };
        const node = contributionOf(sorting<Row>({ multiSort: false })).headerLabel!(column, spy);
        (node as Extract<typeof node, { kind: 'element' }>).on!.click!({ shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, preventDefault: () => undefined });
        expect(calls).toEqual([['name', { additive: false }]]);
    });

    it('puts aria-sort on the header cell of a sortable column and nothing on another', () => {
        const { grid, api } = renderGridOf();
        const attributes = contributionOf(sorting<Row>()).headerAttributes!;
        const name = api.getColumns().find((c) => c.id === 'name')!;
        const note = api.getColumns().find((c) => c.id === 'note')!;
        expect(attributes(name, grid)).toEqual({ 'aria-sort': 'none' });
        api.toggleSort('name');
        expect(attributes(name, grid)).toEqual({ 'aria-sort': 'ascending' });
        expect(attributes(note, grid)).toEqual({});
    });

    it('shows a priority badge only against another sorted column, hidden from assistive technology', () => {
        const { grid, api } = renderGridOf();
        const name = api.getColumns().find((c) => c.id === 'name')!;
        api.toggleSort('name');
        expect(renderToText(contributionOf(sorting<Row>()).headerLabel!(name, grid)).text).not.toContain('gw-sort-priority');
        api.toggleSort('id', { additive: true });
        const text = renderToText(contributionOf(sorting<Row>()).headerLabel!(name, grid)).text;
        expect(text).toContain('  <span aria-hidden="true" class="gw-sort-priority">\n    "1"');
    });

    it('hands native header content to the renderer as a component, never as markup', () => {
        const { grid } = renderGridOf();
        const column = grid.api.getColumns().find((c) => c.id === 'name')!;
        const withNative: ViewRenderGrid<Row> = { ...grid, headerContent: () => component('acme:native') };
        const node = contributionOf(sorting<Row>()).headerLabel!(column, withNative);
        const drawn = renderToText(node, { components: { 'acme:native': () => h('span', { attrs: { className: 'fancy' } }, 'fancy') } });
        expect(drawn.issues).toEqual([]);
        expect(drawn.text).toContain('class="fancy"');
        expect(renderToText(node).issues.map((issue) => issue.code)).toEqual(['component']);
    });
});

describe('slotValues over neutral contributions', () => {
    it('reads a slot in add-on order, skipping add-ons that leave it out', () => {
        const a = { name: 'a', contribution: contributionOf(sorting<Row>()) };
        const b = { name: 'b', contribution: {} as ViewAddonContribution<Row> };
        expect(slotValues([b, a], 'headerAttributes').map((entry) => entry.name)).toEqual(['a']);
    });
});
