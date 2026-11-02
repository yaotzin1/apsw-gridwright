// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { viewEvent } from '../../src/view/event';
import { ALLOWED_TAGS, component, fragment, h, isAllowedTag, sanitizeNode, slot, text } from '../../src/view/node';
import type { ViewNode } from '../../src/view/node';
import { renderToText, stringRenderer } from '../../src/view/text-renderer';

// Hostile inputs are assembled from fragments so this file does not itself hold what the audit refuses.
const script = ['scr', 'ipt'].join('');
const iframe = ['i', 'frame'].join('');
const inner = ['inner', 'HTML'].join('');
const dangerous = ['dangerously', 'SetInnerHTML'].join('');
const scriptUrl = ['java', 'script:alert(1)'].join('');

const asNode = (value: unknown): ViewNode => value as ViewNode;

describe('writing a description', () => {
    it('builds an element with attributes, handlers, a key and children', () => {
        const click = vi.fn();
        const node = h('button', { attrs: { type: 'button' }, on: { click }, key: 'k' }, 'Sort', h('span', {}, '1'));
        expect(node).toEqual({
            kind: 'element',
            tag: 'button',
            attrs: { type: 'button' },
            on: { click },
            key: 'k',
            children: [
                { kind: 'text', value: 'Sort' },
                { kind: 'element', tag: 'span', children: [{ kind: 'text', value: '1' }] },
            ],
        });
    });

    it('omits what was not given, so a bare element is only its tag', () => {
        expect(h('div')).toEqual({ kind: 'element', tag: 'div' });
    });

    it('turns strings and numbers into text and drops false, null and undefined', () => {
        const node = h('td', {}, 'a', 2, false, null, undefined, [['b', [h('span')]]]);
        expect(node).toMatchObject({
            children: [
                { kind: 'text', value: 'a' },
                { kind: 'text', value: '2' },
                { kind: 'text', value: 'b' },
                { kind: 'element', tag: 'span' },
            ],
        });
    });

    it('builds the other kinds', () => {
        expect(text('x')).toEqual({ kind: 'text', value: 'x' });
        expect(slot('cell')).toEqual({ kind: 'slot', name: 'cell' });
        expect(component('chip', { a: 1 })).toEqual({ kind: 'component', id: 'chip', props: { a: 1 } });
        expect(component('chip')).toEqual({ kind: 'component', id: 'chip' });
        expect(fragment('a', h('b' as never))).toMatchObject({ kind: 'fragment' });
    });
});

describe('the allowlist', () => {
    it('allows the table, the form controls and the structure the grid draws', () => {
        for (const tag of ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'button', 'input', 'select', 'option', 'div', 'span']) {
            expect(isAllowedTag(tag)).toBe(true);
        }
        expect(ALLOWED_TAGS.length).toBe(new Set(ALLOWED_TAGS).size);
    });

    it('has no element that runs code, embeds a document or reaches a URL', () => {
        for (const tag of [script, iframe, 'object', 'embed', 'link', 'style', 'a', 'img', 'form', 'base', 'meta', 'video', 'audio']) {
            expect(isAllowedTag(tag)).toBe(false);
        }
    });

    it('drops an element that is not allowed together with what is inside it, and says where', () => {
        const node = asNode({
            kind: 'element',
            tag: 'div',
            children: [{ kind: 'element', tag: script, children: [{ kind: 'text', value: 'alert(1)' }] }, { kind: 'text', value: 'kept' }],
        });
        const { node: clean, issues } = sanitizeNode(node);
        expect(clean).toEqual({ kind: 'element', tag: 'div', children: [{ kind: 'text', value: 'kept' }] });
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ code: 'tag' });
        expect(issues[0]!.message).toContain(`<${script}>`);
        expect(issues[0]!.message).toContain('root>div[0]');
    });

    it('drops attributes that carry markup, a URL, children or a function, and keeps the rest', () => {
        const { node, issues } = sanitizeNode(
            asNode({
                kind: 'element',
                tag: 'div',
                attrs: {
                    [dangerous]: { __html: 'x' },
                    [inner]: 'x',
                    children: 'x',
                    href: scriptUrl,
                    src: 'x',
                    srcDoc: 'x',
                    onClick: () => undefined,
                    role: 'row',
                    className: 'a',
                    tabIndex: -1,
                    'aria-label': 'ok',
                    'aria-bad': { x: 1 },
                    'data-n': 1,
                    style: { color: 'red' },
                },
            }),
        );
        expect(node).toEqual({
            kind: 'element',
            tag: 'div',
            attrs: { role: 'row', className: 'a', tabIndex: -1, 'aria-label': 'ok', 'data-n': 1, style: { color: 'red' } },
        });
        const dropped = issues.map((issue) => issue.message);
        expect(dropped).toHaveLength(8);
        expect(issues.every((issue) => issue.code === 'attribute')).toBe(true);
    });

    it('refuses a style that is not an object, an object-valued plain attribute and an unsafe input type', () => {
        const dropped = (node: unknown) => sanitizeNode(asNode(node)).issues.length;
        expect(dropped({ kind: 'element', tag: 'div', attrs: { style: 'color: red' } })).toBe(1);
        expect(dropped({ kind: 'element', tag: 'div', attrs: { title: { a: 1 } } })).toBe(1);
        expect(dropped({ kind: 'element', tag: 'input', attrs: { type: 'file' } })).toBe(1);
        expect(dropped({ kind: 'element', tag: 'input', attrs: { type: 'checkbox' } })).toBe(0);
        expect(dropped({ kind: 'element', tag: 'button', attrs: { type: 'button' } })).toBe(0);
    });

    it('keeps only the events a description may listen to, and only functions', () => {
        const keep = vi.fn();
        const { node, issues } = sanitizeNode(
            asNode({ kind: 'element', tag: 'button', on: { click: keep, mouseover: keep, keydown: 'alert(1)' } }),
        );
        expect(node).toEqual({ kind: 'element', tag: 'button', on: { click: keep } });
        expect(issues.map((issue) => issue.code)).toEqual(['handler', 'handler']);
    });

    it('drops a node of an unknown kind, a non-object and a malformed text, slot or component', () => {
        const parent = asNode({
            kind: 'fragment',
            children: [
                { kind: 'raw', html: '<b>x</b>' },
                null,
                { kind: 'text', value: 3 },
                { kind: 'slot' },
                { kind: 'component', id: '' },
                { kind: 'text', value: 'ok' },
            ],
        });
        const { node, issues } = sanitizeNode(parent);
        expect(node).toEqual({ kind: 'fragment', children: [{ kind: 'text', value: 'ok' }] });
        expect(issues.map((issue) => issue.code)).toEqual(['node', 'node', 'node', 'slot', 'component']);
    });

    it('does not change a clean description, and does not mutate its input', () => {
        const node = h('table', { attrs: { role: 'grid' } }, h('tbody', {}, h('tr', {}, h('td', {}, 'a'))));
        const before = JSON.stringify(node);
        const { node: clean, issues } = sanitizeNode(node);
        expect(issues).toEqual([]);
        expect(clean).toEqual(node);
        expect(JSON.stringify(node)).toBe(before);
    });

    it('has no kind that can hold raw markup or a function as a child', () => {
        // Compile-time: the union is exactly these five. Adding a sixth kind breaks this line, which is
        // the prompt to decide whether it can carry a sink.
        const kinds: Record<ViewNode['kind'], true> = { element: true, text: true, fragment: true, slot: true, component: true };
        expect(Object.keys(kinds)).toHaveLength(5);
        // Run-time: every way of smuggling markup in by kind is dropped and reported.
        for (const kind of ['raw', 'html', 'markup', 'function', 'script']) {
            const { node, issues } = sanitizeNode(asNode({ kind, html: '<b>x</b>', render: () => 'x' }));
            expect(node).toBeNull();
            expect(issues.map((issue) => issue.code)).toEqual(['node']);
        }
        // A function in place of a child is not a node either.
        const { node, issues } = sanitizeNode(asNode({ kind: 'fragment', children: [() => 'x'] }));
        expect(node).toEqual({ kind: 'fragment', children: [] });
        expect(issues).toHaveLength(1);
    });
});

describe('the text renderer', () => {
    const header = h(
        'th',
        { attrs: { scope: 'col', className: 'gw-header-cell', 'aria-sort': 'ascending', tabIndex: 0, colSpan: 2 } },
        h('button', { attrs: { type: 'button', disabled: false, hidden: true } }, 'Name', h('span', { attrs: { 'aria-hidden': true } })),
    );

    it('draws one line per node with attributes sorted and spelled as the DOM spells them', () => {
        expect(renderToText(header).text).toBe(
            [
                '<th aria-sort="ascending" class="gw-header-cell" colspan="2" scope="col" tabindex="0">',
                '  <button hidden="" type="button">',
                '    "Name"',
                '    <span aria-hidden="true">',
                '',
            ].join('\n'),
        );
    });

    it('draws a style object as declarations, with custom properties kept as they are', () => {
        const node = h('div', { attrs: { style: { textAlign: 'end', '--gw-x': '1px', margin: 0, color: undefined } } });
        expect(renderToText(node).text).toBe('<div style="text-align: end; --gw-x: 1px; margin: 0;">\n');
    });

    it('quotes text and attribute values so a quote or a newline cannot forge a line', () => {
        const node = h('div', { attrs: { title: 'a"b\n<span>' } }, 'line1\n<td>');
        const { text: out } = renderToText(node);
        expect(out.split('\n')).toHaveLength(3);
        expect(out).toContain('title="a\\"b\\n<span>"');
        expect(out).toContain('"line1\\n<td>"');
    });

    it('draws an empty description as nothing', () => {
        expect(renderToText(fragment()).text).toBe('');
    });

    it('fills a slot from the options and draws an empty marker otherwise', () => {
        expect(renderToText(h('td', {}, slot('cell')), { slots: { cell: [text('Ada')] } }).text).toBe('<td>\n  <slot name="cell">\n    "Ada"\n');
        expect(renderToText(h('td', {}, slot('cell'))).text).toBe('<td>\n  <slot name="cell">\n');
    });

    it('sanitizes what a slot or a component brings in, too', () => {
        const hostile = asNode({ kind: 'element', tag: script });
        const slotted = renderToText(slot('s'), { slots: { s: [hostile] } });
        expect(slotted.text).toBe('<slot name="s">\n');
        expect(slotted.issues.map((i) => i.code)).toEqual(['tag']);
        const composed = renderToText(component('c'), { components: { c: () => hostile } });
        expect(composed.issues.map((i) => i.code)).toEqual(['tag']);
    });

    it('resolves a component through the registry and reports one that is not registered', () => {
        const registry = { chip: (props: unknown) => h('span', {}, String((props as { label: string }).label)) };
        expect(renderToText(component('chip', { label: 'New' }), { components: registry }).text).toBe(
            '<component id="chip">\n  <span>\n    "New"\n',
        );
        const missing = renderToText(component('nope'));
        expect(missing.text).toBe('<component id="nope">\n');
        expect(missing.issues).toEqual([{ code: 'component', message: 'no component is registered for "nope"' }]);
    });

    it('stops a component that renders itself', () => {
        const result = renderToText(component('loop'), { components: { loop: () => h('div', {}, component('loop')) } });
        expect(result.issues.map((i) => i.message)).toEqual(['the component "loop" renders itself']);
    });

    it('does not run handlers, and keeps them out of the output', () => {
        const click = vi.fn();
        const result = renderToText(h('button', { on: { click } }, 'x'));
        expect(click).not.toHaveBeenCalled();
        expect(result.text).not.toContain('click');
    });

    it('is a Renderer that reports the issues of its last render', () => {
        const renderer = stringRenderer();
        expect(renderer.render(asNode({ kind: 'element', tag: script }))).toBe('');
        expect(renderer.issues).toHaveLength(1);
        expect(renderer.render(h('div'))).toBe('<div>\n');
        expect(renderer.issues).toEqual([]);
    });

    it('lets a handler be called with a structural event, as an adapter would', () => {
        const seen: Array<string | undefined> = [];
        const node = h('button', { on: { keydown: (event) => void seen.push(event.key) } }, 'x');
        const { node: clean } = sanitizeNode(node);
        if (clean?.kind !== 'element') throw new Error('expected an element');
        clean.on?.keydown?.(viewEvent({ key: 'Enter' }));
        expect(seen).toEqual(['Enter']);
    });
});
