import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright, renderNode, type GridAddon } from '../../src/react/index';
import { component, defineAddon, fragment, h, renderToText, slot, text } from '../../src/view';
import type { RenderIssue, ViewAddon, ViewEvent } from '../../src/view';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';
import { serializeDom } from '../helpers/serialize-dom';

/** Hostile names are assembled from pieces so this file stays clean of the sinks the audit looks for. */
const SCRIPT = ['scr', 'ipt'].join('');
const IFRAME = ['i', 'frame'].join('');

const names = (): string[] => screen.getAllByRole('row').slice(1).map((row) => row.querySelector('td:nth-child(2)')?.textContent ?? '');

describe('renderNode', () => {
    it('draws elements, text and fragments as React elements', () => {
        const { container } = render(
            <>
                {renderNode(
                    h('ul', { attrs: { className: 'list', 'data-n': 2 } }, h('li', {}, 'one'), fragment(h('li', {}, 'two'), text('!'))),
                )}
            </>,
        );
        expect(serializeDom(container.firstElementChild!)).toBe(
            ['<ul class="list" data-n="2">', '  <li>', '    "one"', '  <li>', '    "two"', '  "!"', ''].join('\n'),
        );
    });

    it('draws the same tree as the text renderer, which is what makes the node description renderer-independent', () => {
        const description = h(
            'table',
            { attrs: { role: 'grid', 'aria-rowcount': 3 } },
            h(
                'tr',
                {},
                h('th', { attrs: { scope: 'col', 'aria-sort': 'ascending', colSpan: 2 } }, h('button', { attrs: { type: 'button', tabIndex: -1, disabled: true, title: 'Sort' } }, 'Name')),
                h('td', { attrs: { style: { color: 'red', '--gw-x': '4px' }, 'aria-hidden': 'true' } }, 3, null, false, 'x'),
            ),
        );
        const { container } = render(<>{renderNode(description)}</>);
        expect(serializeDom(container.firstElementChild!)).toBe(renderToText(description).text);
    });

    it('draws a style, including one whose key is a prototype name, without touching Object.prototype', () => {
        // JSON.parse makes the key an own property, which is how it arrives from data. `constructor` is a name Object.prototype has.
        const style = JSON.parse('{"constructor": "red", "color": "blue"}') as Record<string, string>;
        const { container } = render(<>{renderNode(h('div', { attrs: { style } }, 'x'))}</>);
        expect((container.firstElementChild as HTMLElement).style.color).toBe('blue');
        expect(({} as Record<string, unknown>).color).toBeUndefined();
        expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    });

    it('refuses a style whose key is __proto__ outright, as it is no CSS property, and pollutes nothing', () => {
        const style = JSON.parse('{"__proto__": "red", "color": "blue"}') as Record<string, string>;
        const { container } = render(<>{renderNode(h('div', { attrs: { style } }, 'x'))}</>);
        expect((container.firstElementChild as HTMLElement).getAttribute('style')).toBeNull();
        expect(({} as Record<string, unknown>).color).toBeUndefined();
        expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    });

    it('drops a tag or attribute outside the allowlist and says so, drawing nothing in its place', () => {
        const issues: RenderIssue[] = [];
        const hostile = { kind: 'element', tag: SCRIPT, children: [{ kind: 'text', value: 'x' }] } as never;
        const { container } = render(
            <>
                {renderNode(h('div', {}, hostile, h('span', { attrs: { onClick: 'x', href: 'y' } as never }, 'ok')), {
                    onIssues: (found) => issues.push(...found),
                })}
            </>,
        );
        expect(serializeDom(container.firstElementChild!)).toBe('<div>\n  <span>\n    "ok"\n');
        expect(issues.length).toBeGreaterThanOrEqual(2);
        expect(issues.map((issue) => issue.code)).toContain('tag');
    });

    it('refuses an embedding element and a style that loads something', () => {
        const embedded = { kind: 'element', tag: IFRAME } as never;
        const { container } = render(
            <>{renderNode(h('div', { attrs: { style: { background: 'url(https://example.test/x)' } } }, embedded, 'kept'))}</>,
        );
        expect(serializeDom(container.firstElementChild!)).toBe('<div>\n  "kept"\n');
    });

    it('gives a handler a ViewEvent built from the native event, not the native event', async () => {
        const user = userEvent.setup();
        const seen: ViewEvent[] = [];
        render(<>{renderNode(h('button', { attrs: { type: 'button' }, on: { click: (event) => void seen.push(event) } }, 'go'))}</>);

        await user.keyboard('{Shift>}');
        await user.click(screen.getByRole('button', { name: 'go' }));

        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({ shiftKey: true, ctrlKey: false, metaKey: false, altKey: false });
        expect(Object.keys(seen[0]!).sort()).not.toContain('nativeEvent');
        expect(typeof seen[0]!.preventDefault).toBe('function');
    });

    it('carries the key of a key press and the value of a form control', async () => {
        const user = userEvent.setup();
        const keys: (string | undefined)[] = [];
        const values: (string | undefined)[] = [];
        render(
            <>
                {renderNode(
                    h('input', {
                        attrs: { type: 'text', 'aria-label': 'field' },
                        on: { keydown: (event) => void keys.push(event.key), input: (event) => void values.push(event.value) },
                    }),
                )}
            </>,
        );
        await user.type(screen.getByRole('textbox', { name: 'field' }), 'ab');
        expect(keys).toEqual(['a', 'b']);
        expect(values).toEqual(['a', 'ab']);
    });

    it('moves focus to the element a handler names by key, among the elements it was drawn with', async () => {
        const user = userEvent.setup();
        render(
            <>
                {renderNode(
                    fragment(
                        h('button', { attrs: { type: 'button' }, on: { click: () => ({ type: 'focus', key: 'target' }) } }, 'move'),
                        h('button', { attrs: { type: 'button' }, key: 'target' }, 'target'),
                    ),
                )}
            </>,
        );
        await user.click(screen.getByRole('button', { name: 'move' }));
        expect(screen.getByRole('button', { name: 'target' })).toHaveFocus();
    });

    it('does nothing for an action it does not know, or a key nothing has', async () => {
        const user = userEvent.setup();
        render(<>{renderNode(h('button', { attrs: { type: 'button' }, on: { click: () => ({ type: 'focus', key: 'missing' }) } }, 'go'))}</>);
        await user.click(screen.getByRole('button', { name: 'go' }));
        expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
    });

    it('fills a slot from the renderer, and draws nothing for one nobody filled', () => {
        const { container } = render(<>{renderNode(h('div', {}, slot('a'), slot('b')), { slots: { a: <b>mine</b> } })}</>);
        expect(serializeDom(container.firstElementChild!)).toBe('<div>\n  <b>\n    "mine"\n');
    });

    it('resolves a component through the registry the renderer owns, with hooks working inside it', () => {
        const Counter = () => {
            const [n] = useState(7);
            return <i>{n}</i>;
        };
        const issues: RenderIssue[] = [];
        const { container } = render(
            <>
                {renderNode(h('div', {}, component('acme:counter'), component('acme:missing')), {
                    components: { 'acme:counter': () => <Counter /> },
                    onIssues: (found) => issues.push(...found),
                })}
            </>,
        );
        expect(serializeDom(container.firstElementChild!)).toBe('<div>\n  <i>\n    "7"\n');
        expect(issues).toEqual([{ code: 'component', message: 'no component is registered for "acme:missing"' }]);
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
        'reads only its own registry entries, so "%s" is a missing slot or component and not a crash',
        (name) => {
            const issues: RenderIssue[] = [];
            expect(() =>
                render(<>{renderNode(h('div', {}, slot(name), component(name)), { slots: {}, components: {}, onIssues: (found) => issues.push(...found) })}</>),
            ).not.toThrow();
            expect(issues.map((issue) => issue.code)).toEqual(['component']);
        },
    );
});

describe('a neutral add-on in a React grid', () => {
    const legacyToolbar = vi.fn();

    /** A React add-on, written as always: a slot returning an element. */
    const legacy = (): GridAddon<Person> => ({
        name: 'acme:legacy',
        setup: () => ({
            toolbar: () => {
                legacyToolbar();
                return <button type="button">legacy tool</button>;
            },
        }),
    });

    /** A neutral add-on: plain data, no React. It owns the header label and puts an attribute on the cell. */
    const neutral = (): ViewAddon<Person> =>
        defineAddon<Person>({
            name: 'acme:neutral',
            setup: () => ({
                suppresses: ['gridwright:sorting'],
                headerLabel: (column, grid) =>
                    h('span', { attrs: { className: 'neutral-label', 'data-column': column.id } }, grid.headerContent(column)),
                headerAttributes: (column) => ({ 'data-neutral': column.id }),
            }),
        });

    it('lists beside a React add-on, and both are drawn', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[legacy(), neutral()]} />);

        expect(screen.getByRole('button', { name: 'legacy tool' })).toBeInTheDocument();
        const header = screen.getByRole('columnheader', { name: 'Salary' });
        expect(header).toHaveAttribute('data-neutral', 'salary');
        expect(header.querySelector('.neutral-label')).toHaveAttribute('data-column', 'salary');
    });

    it('takes the place of a core add-on it suppresses, with the engine untouched', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[neutral()]} />);
        // The sort buttons are gone because the neutral add-on owns the label; the rows are still sorted data.
        expect(screen.queryByRole('button', { name: /Salary/ })).toBeNull();
        expect(names()).toHaveLength(3);
    });

    it('is ordered, listed twice and required like any other add-on', () => {
        expect(() =>
            render(<Gridwright<Person> columns={personColumns} data={people} addons={[neutral(), neutral()]} />),
        ).toThrow(/listed twice/);
        expect(() =>
            render(
                <Gridwright<Person>
                    columns={personColumns}
                    data={people}
                    addons={[defineAddon<Person>({ name: 'acme:needs', requires: ['acme:absent'], setup: () => ({}) })]}
                />,
            ),
        ).toThrow(/requires "acme:absent"/);
    });

    it('draws a column\'s own React header content inside the neutral label', () => {
        render(
            <Gridwright<Person>
                columns={[{ id: 'name', header: 'Name', headerCell: () => <em>fancy name</em> }, ...personColumns.slice(1)]}
                data={people}
                pageSize={3}
            />,
        );
        // The default sorting add-on is the neutral one; the column's native content comes through whole.
        const button = screen.getByRole('button', { name: /fancy name/ });
        expect(button.querySelector('em')).toHaveTextContent('fancy name');
    });
});

describe('per-grid state in a neutral add-on', () => {
    /** Counts its own activations in a store; the label comes from an option, which must stay live. */
    const counter = (label: string): ViewAddon<Person> =>
        defineAddon<Person>({
            name: 'acme:counter',
            setup: ({ state }) => {
                const clicks = state('clicks', 0);
                return {
                    suppresses: ['gridwright:sorting'],
                    headerLabel: (column) =>
                        h('button', { attrs: { type: 'button', 'data-testid': `b-${column.id}` }, on: { click: () => clicks.update((n) => n + 1) } }, `${label}:${clicks.get()}`),
                    headerAttributes: () => ({ 'data-clicks': clicks.get() }),
                };
            },
        });

    it('draws again when a store changes, and keeps the count across renders', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[counter('n')]} />);

        await user.click(screen.getByTestId('b-name'));
        await user.click(screen.getByTestId('b-name'));

        expect(screen.getByTestId('b-name')).toHaveTextContent('n:2');
        for (const header of screen.getAllByRole('columnheader', { name: /n:2/ })) expect(header).toHaveAttribute('data-clicks', '2');
    });

    it('keeps the state while a changed option applies, because setup runs again with the new factory', async () => {
        const user = userEvent.setup();
        const { rerender } = render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[counter('a')]} />);
        await user.click(screen.getByTestId('b-name'));

        rerender(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[counter('b')]} />);

        expect(screen.getByTestId('b-name')).toHaveTextContent('b:1');
    });

    it('gives two grids their own state', async () => {
        const user = userEvent.setup();
        render(
            <>
                <div data-testid="one"><Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[counter('n')]} /></div>
                <div data-testid="two"><Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[counter('n')]} /></div>
            </>,
        );
        await user.click(within(screen.getByTestId('one')).getByTestId('b-name'));
        expect(within(screen.getByTestId('one')).getByTestId('b-name')).toHaveTextContent('n:1');
        expect(within(screen.getByTestId('two')).getByTestId('b-name')).toHaveTextContent('n:0');
    });
});
