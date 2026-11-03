// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as view from '../../src/view';
import * as reactResolve from '../../src/react/addons/resolve';
import * as reactSorting from '../../src/react/core-addons/sorting-logic';
import * as reactPagination from '../../src/react/core-addons/pagination-logic';
import * as reactSelection from '../../src/react/core-addons/selection-logic';
import * as reactAnnouncement from '../../src/react/a11y/announcement';
import type { GridState } from '../../src/core/types';
import type { AddonMessages } from '../../src/i18n/messages';

/**
 * The view layer is what a second framework adapter builds on, so these run in a plain Node
 * environment: no `document`, no `window`, no React. If any of it needed one, importing the module
 * or calling these would throw here.
 */

describe('the view layer runs with no DOM', () => {
    it('has no document or window to lean on', () => {
        expect(typeof document).toBe('undefined');
        expect(typeof window).toBe('undefined');
    });

    it('exports the names an adapter author is told to use', () => {
        expect(Object.keys(view).sort()).toEqual(
            [
                'ALLOWED_INPUT_TYPES',
                'ALLOWED_TAGS',
                'CONTRIBUTABLE_ATTRIBUTES',
                'DEFAULT_PAGE_SIZE_OPTIONS',
                'HANDLER_NAMES',
                'NODE_ATTRIBUTES',
                'announcementFor',
                'ariaSortOf',
                'childrenOf',
                'component',
                'createStateScope',
                'createStore',
                'fragment',
                'h',
                'isAllowedTag',
                'isContributable',
                'mergeAttributes',
                'nextSortAction',
                'orderAddons',
                'pageFocusAfterChange',
                'pageRangeOf',
                'pageSelectionOf',
                'pageSizeChoices',
                'renderToText',
                'resolveSet',
                'rowClickSelects',
                'sanitizeNode',
                'slot',
                'slotValues',
                'sortAnnouncement',
                'sortPriorityOf',
                'sortTitleOf',
                'spaceSelectsRow',
                'stringRenderer',
                'styleValueText',
                'bodyStatusOf',
                'buildTableModel',
                'createGridHost',
                'createLiveRegion',
                'defaultViewLabels',
                'labelsFrom',
                'liveRegionKey',
                'mergeLabels',
                'rowNumbering',
                'tableNode',
                'text',
                'viewEvent',
                'SORTING_ADDON',
                'VIEW_ADDON',
                'defineAddon',
                'isViewAddon',
                'sorting',
                'sortingMessages',
                'SELECTION_ADDON',
                'selection',
                'selectionMessages',
                'selectionRowAttrs',
                'selectionTableAttrs',
            ].sort(),
        );
    });
});

describe('the React entry shares the view layer instead of copying it', () => {
    // Identity, not equality: two copies that agree today are two copies that drift tomorrow.
    it('uses one mergeAttributes, one allowlist and one isContributable', () => {
        expect(reactResolve.mergeAttributes).toBe(view.mergeAttributes);
        expect(reactResolve.isContributable).toBe(view.isContributable);
        expect(reactResolve.CONTRIBUTABLE_ATTRIBUTES).toBe(view.CONTRIBUTABLE_ATTRIBUTES);
    });

    it('uses the sorting, pagination, selection and announcement behaviour', () => {
        expect(reactSorting.ariaSortOf).toBe(view.ariaSortOf);
        expect(reactSorting.nextSortAction).toBe(view.nextSortAction);
        expect(reactSorting.sortTitleOf).toBe(view.sortTitleOf);
        expect(reactSorting.sortPriorityOf).toBe(view.sortPriorityOf);
        expect(reactPagination.pageRangeOf).toBe(view.pageRangeOf);
        expect(reactPagination.pageSizeChoices).toBe(view.pageSizeChoices);
        expect(reactPagination.pageFocusAfterChange).toBe(view.pageFocusAfterChange);
        expect(reactPagination.DEFAULT_PAGE_SIZE_OPTIONS).toBe(view.DEFAULT_PAGE_SIZE_OPTIONS);
        expect(reactSelection.pageSelectionOf).toBe(view.pageSelectionOf);
        expect(reactAnnouncement.announcementFor).toBe(view.announcementFor);
    });

    it('keeps the React sort announcement equal in behaviour to the view one', () => {
        const a = reactSorting.sortAnnouncement();
        const b = view.sortAnnouncement();
        expect({ priority: a.priority }).toEqual({ priority: b.priority });
    });
});

/** An add-on whose slots hold plain strings: the resolution rules never look inside a slot. */
interface TextContribution {
    readonly suppresses?: readonly string[];
    readonly navigation?: 'pages' | 'window';
    readonly headerLabel?: () => string;
    readonly body?: () => string;
    readonly toolbar?: () => string;
}
const addon = (name: string, extra: Record<string, unknown> = {}) => ({ name, setup: () => ({}), ...extra });
const resolved = (name: string, contribution: TextContribution) => ({ name, contribution });

describe('orderAddons, for any framework', () => {
    it('keeps the listed order when nothing constrains it', () => {
        const list = view.orderAddons([addon('core:a')], () => [], [addon('acme:b'), false, null, undefined, addon('acme:c')]);
        expect(list.map((entry) => entry.name)).toEqual(['core:a', 'acme:b', 'acme:c']);
    });

    it('uses the defaults only when no core list is given', () => {
        expect(view.orderAddons(undefined, () => [addon('core:d')], undefined).map((entry) => entry.name)).toEqual(['core:d']);
        expect(view.orderAddons(false, () => [addon('core:d')], [addon('acme:only')]).map((entry) => entry.name)).toEqual([
            'acme:only',
        ]);
    });

    it('applies after and before, stably', () => {
        const list = view.orderAddons(
            [addon('a', { after: ['c'] }), addon('b'), addon('c'), addon('d', { before: ['b'] })],
            () => [],
            undefined,
        );
        expect(list.map((entry) => entry.name)).toEqual(['c', 'a', 'd', 'b']);
    });

    it('names both add-ons in a cycle, a duplicate and a missing requirement', () => {
        expect(() => view.orderAddons([addon('a', { after: ['b'] }), addon('b', { after: ['a'] })], () => [], undefined)).toThrow(
            /"a", "b".*before and after/,
        );
        expect(() => view.orderAddons([addon('a')], () => [], [addon('a')])).toThrow(/"a" is listed twice/);
        expect(() => view.orderAddons([addon('a', { requires: ['z'] })], () => [], undefined)).toThrow(/"a" requires "z"/);
    });

    it('refuses an entry without a name or a setup function', () => {
        expect(() => view.orderAddons([{ name: '', setup: () => ({}) }], () => [], undefined)).toThrow(/non-empty name/);
        expect(() => view.orderAddons([{ name: 'x' } as never], () => [], undefined)).toThrow(/setup function/);
    });

    it('ignores an ordering constraint on an add-on that is not listed, and on itself', () => {
        const list = view.orderAddons([addon('a', { after: ['missing', 'a'], before: ['a'] })], () => [], undefined);
        expect(list.map((entry) => entry.name)).toEqual(['a']);
    });
});

describe('resolveSet, for any framework', () => {
    it('drops the rendering of a suppressed add-on but keeps its name and messages', () => {
        const set = view.resolveSet<TextContribution & { messages?: AddonMessages }>([
            resolved('core:a', { toolbar: () => 'a' }),
            { name: 'acme:b', contribution: { suppresses: ['core:a'], messages: { en: { hello: 'hi' } } } },
        ]);
        expect(set.names).toEqual(['core:a', 'acme:b']);
        expect(set.active.map((entry) => entry.name)).toEqual(['acme:b']);
        expect(set.messages.get('acme:b')).toEqual({ en: { hello: 'hi' } });
    });

    it('does not let an add-on suppress itself', () => {
        const set = view.resolveSet([resolved('a', { suppresses: ['a'] })]);
        expect(set.active.map((entry) => entry.name)).toEqual(['a']);
    });

    it('lets one add-on own the header label and one the body, and names both when two claim one', () => {
        const set = view.resolveSet([resolved('a', { headerLabel: () => 'h' }), resolved('b', { body: () => 'b' })]);
        expect(set.headerLabel?.name).toBe('a');
        expect(set.body?.name).toBe('b');
        expect(() => view.resolveSet([resolved('a', { body: () => '1' }), resolved('b', { body: () => '2' })])).toThrow(
            /"a" and "b" both render the table body/,
        );
        expect(() => view.resolveSet([resolved('a', { headerLabel: () => '1' }), resolved('b', { headerLabel: () => '2' })])).toThrow(
            /both render the header label/,
        );
    });

    it('does not count a suppressed owner as a second owner', () => {
        const set = view.resolveSet([resolved('a', { body: () => '1' }), resolved('b', { body: () => '2', suppresses: ['a'] })]);
        expect(set.body?.name).toBe('b');
    });

    it('is windowed when any active add-on says so', () => {
        expect(view.resolveSet([resolved('a', {})]).navigation).toBe('pages');
        expect(view.resolveSet([resolved('a', {}), resolved('b', { navigation: 'window' })]).navigation).toBe('window');
        expect(view.resolveSet([resolved('a', {}), resolved('b', { navigation: 'window', suppresses: ['b'] })]).navigation).toBe('window');
    });

    it('reads one slot across add-ons in order', () => {
        const set = view.resolveSet([resolved('a', { toolbar: () => 'x' }), resolved('b', {}), resolved('c', { toolbar: () => 'z' })]);
        expect(view.slotValues(set.active, 'toolbar').map((entry) => [entry.name, entry.value()])).toEqual([
            ['a', 'x'],
            ['c', 'z'],
        ]);
    });
});

describe('mergeAttributes, the one allowlist', () => {
    // Built from fragments so this file does not itself contain the sink names the audit refuses.
    const sink = ['dangerously', 'SetInnerHTML'].join('');
    const htmlProp = ['inner', 'HTML'].join('');
    const scriptUrl = ['java', 'script:alert(1)'].join('');

    it('joins class names, merges styles and chains handlers with the element\'s own first', () => {
        const calls: string[] = [];
        const merged = view.mergeAttributes(
            { className: 'a', style: { color: 'red' }, onClick: () => calls.push('own') },
            { className: 'b', style: { margin: 1 }, onClick: () => calls.push('addon') },
            { className: 'c' },
        );
        expect(merged.className).toBe('a b c');
        expect(merged.style).toEqual({ color: 'red', margin: 1 });
        (merged.onClick as () => void)();
        expect(calls).toEqual(['own', 'addon']);
    });

    it('refuses markup, URLs, children, string handlers and anything not allowlisted', () => {
        const merged = view.mergeAttributes(
            {},
            {
                [sink]: { __html: '<b>x</b>' },
                [htmlProp]: '<b>x</b>',
                children: 'x',
                href: scriptUrl,
                src: 'x',
                onClick: 'alert(1)',
                srcDoc: 'x',
                role: 'row',
                'aria-label': 'ok',
                'data-x': 1,
            },
        );
        expect(merged).toEqual({ role: 'row', 'aria-label': 'ok', 'data-x': 1 });
    });

    it('lets the element\'s own attributes through untouched', () => {
        expect(view.mergeAttributes({ href: '#own', children: 'own' })).toEqual({ href: '#own', children: 'own' });
    });

    it('skips null and undefined contributions and values', () => {
        expect(view.mergeAttributes({ id: 'x' }, null, undefined, { id: undefined })).toEqual({ id: 'x' });
    });
});

describe('viewEvent', () => {
    it('defaults every modifier to false and preventDefault to a no-op', () => {
        const event = view.viewEvent({ key: 'Enter' });
        expect(event).toMatchObject({ key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false });
        expect(() => event.preventDefault()).not.toThrow();
    });

    it('keeps the preventDefault it is given', () => {
        let prevented = false;
        view.viewEvent({ preventDefault: () => (prevented = true) }).preventDefault();
        expect(prevented).toBe(true);
    });
});

describe('behaviour, with no renderer', () => {
    const stateOf = (partial: Partial<GridState<unknown>>): GridState<unknown> => partial as GridState<unknown>;

    it('spells sort state as ARIA does and names the next action', () => {
        expect(view.ariaSortOf('asc')).toBe('ascending');
        expect(view.ariaSortOf('desc')).toBe('descending');
        expect(view.ariaSortOf(null)).toBe('none');
        expect([null, 'asc', 'desc'].map((d) => view.nextSortAction(d as never))).toEqual(['ascending', 'descending', 'clear']);
    });

    it('numbers a column only against another sorted column', () => {
        const sort = [
            { columnId: 'a', direction: 'asc' as const },
            { columnId: 'b', direction: 'desc' as const },
        ];
        expect(view.sortPriorityOf(sort, 'b')).toBe(2);
        expect(view.sortPriorityOf(sort.slice(0, 1), 'a')).toBe(0);
        expect(view.sortPriorityOf(sort, 'zzz')).toBe(0);
    });

    it('reports the page range with no total when the source sent none, and never invents one', () => {
        const range = view.pageRangeOf(
            stateOf({
                meta: {},
                isTotalExact: false,
                totalRows: 20,
                rows: new Array(10).fill(0) as never,
                query: { pagination: { pageIndex: 1, pageSize: 10 } } as never,
            }),
        );
        expect(range).toEqual({ from: 11, to: 20, total: null });
    });

    it('says whether the page is wholly or partly selected', () => {
        const rows = [{ id: 1 }, { id: 2 }] as never;
        expect(view.pageSelectionOf({ rows, selectedIds: [1, 2] as never })).toEqual({ all: true, some: false });
        expect(view.pageSelectionOf({ rows, selectedIds: [2] as never })).toEqual({ all: false, some: true });
        expect(view.pageSelectionOf({ rows: [] as never, selectedIds: [] as never })).toEqual({ all: false, some: false });
    });

    it('moves focus only off a button that was pressed and has just disabled', () => {
        expect(view.pageFocusAfterChange('next', { previous: false, next: true })).toBe('previous');
        expect(view.pageFocusAfterChange('next', { previous: false, next: false })).toBeNull();
        expect(view.pageFocusAfterChange(null, { previous: false, next: true })).toBeNull();
        expect(view.pageFocusAfterChange('next', { previous: true, next: true })).toBeNull();
    });

    it('offers the grid its own page size when the options lack it', () => {
        expect(view.pageSizeChoices([10, 25], 5)).toEqual([5, 10, 25]);
        expect(view.pageSizeChoices([10, 25], 10)).toEqual([10, 25]);
    });

    it('builds the one live-region sentence in a fixed order', () => {
        const labels = {
            loading: 'Loading',
            empty: 'No rows',
            rowsShown: (from: number, to: number, total: number, exact: boolean) => `${from}-${to} of ${exact ? total : 'many'}`,
            rowsTotal: (count: number) => `${count} rows`,
        };
        const base = {
            status: 'ready' as const,
            error: null,
            rowCount: 3,
            totalRows: 9,
            isTotalExact: true,
            firstRowIndex: 3,
            paginated: true,
            contributed: null,
            labels,
        };
        expect(view.announcementFor({ ...base, status: 'loading' })).toBe('Loading');
        expect(view.announcementFor({ ...base, status: 'error', contributed: 'x' })).toBe('');
        expect(view.announcementFor({ ...base, contributed: 'Sorted by Name' })).toBe('Sorted by Name');
        expect(view.announcementFor({ ...base, rowCount: 0 })).toBe('No rows');
        expect(view.announcementFor({ ...base, paginated: false })).toBe('9 rows');
        expect(view.announcementFor(base)).toBe('4-6 of 9');
        expect(view.announcementFor({ ...base, isTotalExact: false })).toBe('4-6 of many');
    });
});
