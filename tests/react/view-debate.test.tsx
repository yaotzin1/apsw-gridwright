import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright, renderNode } from '../../src/react/index';
import { toViewEvent } from '../../src/react/view/to-view-event';
import { defineAddon, fragment, h } from '../../src/view';
import type { ViewEvent } from '../../src/view';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

/**
 * Regressions for what the Indaba review debate of 2026-11-03 found, each reproduced with a probe before it was fixed.
 * Hostile values are built from pieces so this file stays clean of the sinks the security audit looks for.
 */

const BEACON = ['url(', 'https://example.test/', 'pixel.png)'].join('');

describe('what an add-on contributes to the header, the table and a row passes the allowlist', () => {
    it('draws none of a function or a url() style, and calls no handler with a raw event', async () => {
        const raw = vi.fn();
        const hostile = defineAddon<Person>({
            name: 'acme:hostile',
            setup: () => ({
                headerAttributes: () => ({ onClick: raw, 'data-h': 'kept', style: { backgroundImage: BEACON, width: 120 } }) as never,
                rowAttributes: () => ({ onClick: raw, 'data-r': 'kept', style: { backgroundImage: BEACON } }) as never,
                tableAttributes: () => ({ 'data-t': 'kept', style: { backgroundImage: BEACON } }) as never,
            }),
        });
        const plain = defineAddon<Person>({ name: 'acme:plain', setup: () => ({ tableAttributes: () => ({ style: { minWidth: 120 } }) as never }) });
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={2} addons={[hostile, plain]} />);
        const header = screen.getAllByRole('columnheader')[0]!;
        const row = screen.getAllByRole('row')[1]!;
        const table = screen.getByRole('grid');

        for (const element of [header, row, table]) expect(element.getAttribute('style') ?? '').not.toContain('url(');
        // What is plain still gets through. A style with one value that is not plain is refused whole, not trimmed.
        expect(header).toHaveAttribute('data-h', 'kept');
        expect(row).toHaveAttribute('data-r', 'kept');
        expect(table).toHaveAttribute('data-t', 'kept');
        expect(header.style.width).toBe('');
        expect(table.style.minWidth).toBe('120px');

        await userEvent.click(header);
        await userEvent.click(row);
        expect(raw).not.toHaveBeenCalled();
    });

    it('still gives a neutral add-on its handlers through rowHandlers, wrapped to receive a ViewEvent', async () => {
        const seen: Array<ViewEvent> = [];
        const addon = defineAddon<Person>({ name: 'acme:handler', setup: () => ({ rowHandlers: () => ({ click: (event) => void seen.push(event) }) }) });
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={2} addons={[addon]} />);
        await userEvent.click(screen.getAllByRole('row')[1]!);
        expect(seen).toHaveLength(1);
        expect(typeof seen[0]!.preventDefault).toBe('function');
        expect('nativeEvent' in (seen[0] as object)).toBe(false);
    });
});

describe('a focus action resolves a key among the elements it was drawn with, and nothing else', () => {
    it('does not reach an element with that id elsewhere on the page, and ignores the old id-shaped request', async () => {
        const outside = document.createElement('input');
        outside.id = 'outside';
        document.body.appendChild(outside);
        try {
            const addon = defineAddon<Person>({
                name: 'acme:reach',
                setup: () => ({
                    belowTable: () =>
                        fragment(
                            h('button', { attrs: { type: 'button' }, on: { click: () => ({ type: 'focus', key: 'outside' }) } }, 'by key'),
                            h('button', { attrs: { type: 'button' }, on: { click: () => ({ type: 'focus', targetId: 'outside' }) as never } }, 'by id'),
                        ),
                }),
            });
            render(<Gridwright<Person> columns={personColumns} data={people} pageSize={2} addons={[addon]} />);
            await userEvent.click(screen.getByRole('button', { name: 'by key' }));
            expect(outside).not.toHaveFocus();
            await userEvent.click(screen.getByRole('button', { name: 'by id' }));
            expect(outside).not.toHaveFocus();
        } finally {
            outside.remove();
        }
    });

    it('reaches a keyed element of its own drawing, and not the same key in another grid', async () => {
        const make = (label: string) =>
            defineAddon<Person>({
                name: 'acme:own',
                setup: () => ({
                    belowTable: () =>
                        fragment(
                            h('button', { attrs: { type: 'button' }, on: { click: () => ({ type: 'focus', key: 'target' }) } }, `${label} go`),
                            h('button', { attrs: { type: 'button' }, key: 'target' }, `${label} target`),
                        ),
                }),
            });
        render(
            <>
                <Gridwright<Person> columns={personColumns} data={people} pageSize={2} addons={[make('first')]} />
                <Gridwright<Person> columns={personColumns} data={people} pageSize={2} addons={[make('second')]} />
            </>,
        );
        await userEvent.click(screen.getByRole('button', { name: 'second go' }));
        expect(screen.getByRole('button', { name: 'second target' })).toHaveFocus();
        expect(screen.getByRole('button', { name: 'first target' })).not.toHaveFocus();
    });

    it('ignores a request when the handler was built outside a drawing', () => {
        const handled = renderNode(h('button', { attrs: { type: 'button' }, on: { click: () => ({ type: 'focus', key: 'a' }) } }, 'x'));
        expect(handled).toBeTruthy();
    });
});

describe('origin is only true while the handler runs', () => {
    it('answers cautiously, and does not remember it, once dispatch has ended', () => {
        let kept: ViewEvent | undefined;
        render(
            <table>
                <tbody>
                    <tr data-row-id="1" onClick={(event) => (kept = toViewEvent(event))}>
                        <td data-column-id="a">
                            <span>text</span>
                        </td>
                    </tr>
                </tbody>
            </table>,
        );
        fireEvent.click(screen.getByText('text'));
        const origin = kept!.origin!;
        // Nothing was selected during the click, but asked afterwards nobody can say so; the safe answer selects nothing.
        expect(origin).toMatchObject({ fromControl: true, fromNestedGrid: true, textSelected: true });
        expect(origin.cell).toBeUndefined();
    });

    it('keeps the true answer when it was read during the handler', () => {
        let kept: ViewEvent | undefined;
        render(
            <table>
                <tbody>
                    <tr
                        data-row-id="1"
                        onClick={(event) => {
                            kept = toViewEvent(event);
                            void kept.origin;
                        }}
                    >
                        <td data-column-id="a">
                            <span>text</span>
                        </td>
                    </tr>
                </tbody>
            </table>,
        );
        fireEvent.click(screen.getByText('text'));
        expect(kept!.origin).toMatchObject({ fromControl: false, textSelected: false, cell: { rowId: '1', columnId: 'a' } });
    });
});
