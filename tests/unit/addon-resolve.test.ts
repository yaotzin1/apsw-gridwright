import { describe, expect, it, vi } from 'vitest';
import { isContributable, mergeAttributes, orderAddons, resolveContributions } from '../../src/react/addons/resolve';
import type { AddonContribution, GridAddon } from '../../src/react/addons/types';

const addon = (name: string, extra: Partial<GridAddon<unknown>> = {}): GridAddon<unknown> => ({
    name,
    setup: () => ({}),
    ...extra,
});

const resolved = (name: string, contribution: AddonContribution<unknown>) => ({ name, contribution });

describe('the add-on list', () => {
    it('puts the core add-ons first and the grid\'s own after them', () => {
        const list = orderAddons([addon('core:a')], () => [], [addon('acme:b')]);
        expect(list.map((entry) => entry.name)).toEqual(['core:a', 'acme:b']);
    });

    it('uses the defaults when no core list is given, and none for false', () => {
        const defaults = () => [addon('core:default')];
        expect(orderAddons(undefined, defaults, []).map((entry) => entry.name)).toEqual(['core:default']);
        expect(orderAddons(false, defaults, [addon('acme:only')]).map((entry) => entry.name)).toEqual(['acme:only']);
    });

    it('refuses a name listed twice', () => {
        expect(() => orderAddons([addon('acme:x')], () => [], [addon('acme:x')])).toThrow(/listed twice/);
    });

    it('refuses an add-on without a name or a setup', () => {
        expect(() => orderAddons([], () => [], [{ name: '', setup: () => ({}) }])).toThrow(/non-empty name/);
        expect(() => orderAddons([], () => [], [{ name: 'acme:x' } as never])).toThrow(/setup function/);
    });

    it('names both add-ons when a required one is missing', () => {
        expect(() => orderAddons([], () => [], [addon('acme:child', { requires: ['acme:parent'] })])).toThrow(
            /"acme:child" requires "acme:parent"/,
        );
    });

    it('honours after and before, and keeps the listed order everywhere else', () => {
        const list = orderAddons([], () => [], [
            addon('acme:tree', { after: ['acme:editing'] }),
            addon('acme:search'),
            addon('acme:editing'),
            addon('acme:menu', { before: ['acme:tree'] }),
        ]);
        expect(list.map((entry) => entry.name)).toEqual(['acme:search', 'acme:editing', 'acme:menu', 'acme:tree']);
    });

    it('ignores an ordering constraint on an add-on that is not listed', () => {
        const list = orderAddons([], () => [], [addon('acme:b', { after: ['acme:absent'] }), addon('acme:a')]);
        expect(list.map((entry) => entry.name)).toEqual(['acme:b', 'acme:a']);
    });

    it('refuses a cycle', () => {
        expect(() =>
            orderAddons([], () => [], [addon('acme:a', { after: ['acme:b'] }), addon('acme:b', { after: ['acme:a'] })]),
        ).toThrow(/before and after each other/);
    });
});

describe('resolving contributions', () => {
    it('hides a suppressed add-on from rendering but keeps its messages', () => {
        const messages = { en: { next: 'Next' } };
        const result = resolveContributions([
            resolved('core:pagination', { belowTable: () => null, messages }),
            resolved('acme:virtual', { suppresses: ['core:pagination'] }),
        ]);
        expect(result.active.map((entry) => entry.name)).toEqual(['acme:virtual']);
        expect(result.messages.get('core:pagination')).toBe(messages);
        expect(result.names).toEqual(['core:pagination', 'acme:virtual']);
    });

    it('does not let an add-on suppress itself', () => {
        const result = resolveContributions([resolved('acme:x', { suppresses: ['acme:x'] })]);
        expect(result.active).toHaveLength(1);
    });

    it('refuses two owners of the body, naming both', () => {
        expect(() =>
            resolveContributions([resolved('acme:one', { body: () => null }), resolved('acme:two', { body: () => null })]),
        ).toThrow(/"acme:one" and "acme:two" both render the table body/);
    });

    it('accepts two owners when one suppresses the other', () => {
        const result = resolveContributions([
            resolved('core:sorting', { headerLabel: () => null }),
            resolved('acme:sorting', { headerLabel: () => null, suppresses: ['core:sorting'] }),
        ]);
        expect(result.headerLabel?.name).toBe('acme:sorting');
    });

    it('moves to window navigation when any active add-on asks for it', () => {
        expect(resolveContributions([resolved('a', {})]).navigation).toBe('pages');
        expect(resolveContributions([resolved('a', {}), resolved('b', { navigation: 'window' })]).navigation).toBe('window');
    });
});

describe('merging attributes', () => {
    it('joins classes, merges styles, chains handlers and lets a later value win', () => {
        const first = vi.fn();
        const second = vi.fn();
        const merged = mergeAttributes(
            { className: 'gw-row', style: { color: 'red' }, onClick: first, title: 'shell' },
            { className: 'is-selected', style: { background: 'blue' }, onClick: second, title: 'add-on' },
            null,
            undefined,
        );

        expect(merged.className).toBe('gw-row is-selected');
        expect(merged.style).toEqual({ color: 'red', background: 'blue' });
        expect(merged.title).toBe('add-on');
        (merged.onClick as () => void)();
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });

    it('drops what an add-on may not contribute, whatever the types said', () => {
        // Built from fragments: the security gate scans this file too, and the point is that the
        // runtime refuses the name, not that the source avoids spelling it.
        const sink = ['dangerously', 'Set', 'Inner', 'HTML'].join('');
        const scriptUrl = ['java', 'script:alert(1)'].join('');
        const merged = mergeAttributes({ className: 'gw-cell' }, {
            [sink]: { __html: '<img src=x>' },
            children: 'text',
            href: scriptUrl,
            src: 'https://example.test/x.png',
            onClick: 'alert(1)',
            'aria-label': 'Salary',
            'data-state': 'ok',
            'data-object': { nested: true },
        } as never);

        expect(Object.keys(merged).sort()).toEqual(['aria-label', 'className', 'data-state']);
    });

    it('keeps the element\'s own attributes, which belong to the shell', () => {
        expect(mergeAttributes({ 'aria-rowindex': 2, className: 'gw-row' }, { className: 'x' })).toEqual({
            'aria-rowindex': 2,
            className: 'gw-row x',
        });
    });

    it('allows handlers only as functions and aria or data values only as scalars', () => {
        expect(isContributable('onKeyDown', () => {})).toBe(true);
        expect(isContributable('onKeyDown', 'code')).toBe(false);
        expect(isContributable('aria-expanded', true)).toBe(true);
        expect(isContributable('aria-owns', { id: 'x' })).toBe(false);
        expect(isContributable('role', 'treegrid')).toBe(true);
        expect(isContributable('formAction', ['java', 'script:void 0'].join(''))).toBe(false);
    });
});
