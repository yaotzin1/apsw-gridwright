import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright, renderNode, sorting } from '../../src/react/index';
import type { GridAddon } from '../../src/react/index';
import { paginationMessages } from '../../src/react/core-addons/messages';
import { GridPagination } from '../../src/react/parts/GridPagination';
import { createGridHost, defineAddon, h, pagination, renderToText, tableNode } from '../../src/view';
import { serializeDom } from '../helpers/serialize-dom';

interface Row {
    readonly id: number;
    readonly name: string;
}
const rows: readonly Row[] = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, name: `Person ${index + 1}` }));
const columns = [
    { id: 'name', header: 'Name' },
    { id: 'id', header: 'Id', sortable: false },
];

/** The pager as it was written before it became a neutral add-on: the React component, in the slot, under the same name. */
const legacyPager = (): GridAddon<Row> => ({
    name: 'gridwright:pagination',
    setup: () => ({ messages: paginationMessages, belowTable: () => <GridPagination /> }),
});

describe('the neutral pager draws what the React pager drew', () => {
    // `selected` on an option and `checked` are properties React sets after mount; a string renderer prints them as HTML does.
    const withoutProperties = (text: string): string => text.replaceAll(' selected=""', '');

    it('on the first, a middle and the last page, and after the page size changes', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={2} coreAddons={[sorting<Row>()]} addons={[legacyPager()]} />);
        const host = createGridHost<Row>({ columns, data: rows, pageSize: 2, addons: [pagination<Row>()] });
        const tree = (): string => serializeDom(document.querySelector('.gw-root')!);
        const same = (label: string): void => {
            const drawn = withoutProperties(renderToText(tableNode(host.getModel())).text);
            expect(drawn, label).toBe(withoutProperties(tree()));
            // Guards against agreeing on nothing.
            expect(drawn, label).toContain('gw-pagination');
        };

        same('first page');
        await user.click(screen.getByRole('button', { name: 'Next page' }));
        host.api.nextPage();
        same('middle page');
        await user.click(screen.getByRole('button', { name: 'Next page' }));
        host.api.nextPage();
        same('last page');
        await user.selectOptions(screen.getByRole('combobox'), '10');
        host.api.setPageSize(10);
        same('after choosing 10 per page');
        host.destroy();
    });
});

describe('renderNode and a select', () => {
    it('shows the option marked selected as the select value, and does not hand React a selected option', () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { container } = render(
            <>
                {renderNode(
                    h(
                        'select',
                        { on: { change: () => undefined } },
                        h('option', { attrs: { value: 10 } }, '10'),
                        h('option', { attrs: { value: 25, selected: true } }, '25'),
                    ),
                )}
            </>,
        );
        expect(container.querySelector('select')!.value).toBe('25');
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

    it('passes the chosen value to the change handler', async () => {
        const seen: Array<string | undefined> = [];
        render(
            <>
                {renderNode(
                    h(
                        'select',
                        { on: { change: (event) => void seen.push(event.value) } },
                        h('option', { attrs: { value: 10, selected: true } }, '10'),
                        h('option', { attrs: { value: 25 } }, '25'),
                    ),
                )}
            </>,
        );
        await userEvent.selectOptions(screen.getByRole('combobox'), '25');
        expect(seen).toEqual(['25']);
    });

    it('reports the elements that have a key, and stops reporting them when they go', () => {
        const events: Array<[string, boolean]> = [];
        const options = { onKeyedElement: (key: string, element: Element | null) => void events.push([key, element !== null]) };
        const { rerender } = render(<>{renderNode(h('div', {}, h('button', { key: 'one' }, 'x')), options)}</>);
        expect(events).toEqual([['one', true]]);
        rerender(<>{renderNode(h('div', {}), options)}</>);
        expect(events).toContainEqual(['one', false]);
    });

    it('draws no extra attribute for a key, which is how focus can be asked for without changing the markup', () => {
        const { container } = render(<>{renderNode(h('button', { key: 'next', attrs: { type: 'button' } }, 'x'), { onKeyedElement: () => undefined })}</>);
        expect(serializeDom(container.firstElementChild!)).toBe(['<button type="button">', '  "x"', ''].join('\n'));
    });
});

describe('where a settled add-on can move focus', () => {
    const focusing = (key: string, spent = { value: false }) =>
        defineAddon<Row>({
            name: 'acme:focus',
            setup: () => ({
                belowTable: () => h('div', {}, h('button', { key: 'mine', attrs: { type: 'button' } }, 'mine')),
                settled: () => {
                    if (spent.value) return;
                    spent.value = true;
                    return { type: 'focus', key };
                },
            }),
        });

    it('focuses an element the add-on drew, by its key', async () => {
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={2} addons={[focusing('mine')]} />);
        await act(async () => undefined);
        expect(screen.getByRole('button', { name: 'mine' })).toHaveFocus();
    });

    it('cannot focus an element it did not draw, whatever key it names', async () => {
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={2} addons={[focusing('previous')]} />);
        await act(async () => undefined);
        expect(document.body).toHaveFocus();
    });

    it('keeps two grids apart: a press in one moves focus within that one', async () => {
        const user = userEvent.setup();
        render(
            <>
                <section aria-label="first">
                    <Gridwright<Row> columns={columns} data={rows} pageSize={4} />
                </section>
                <section aria-label="second">
                    <Gridwright<Row> columns={columns} data={rows} pageSize={4} />
                </section>
            </>,
        );
        const first = within(screen.getByRole('region', { name: 'first' }));
        const second = within(screen.getByRole('region', { name: 'second' }));
        await user.click(first.getByRole('button', { name: 'Next page' }));
        // Five rows in pages of four: the next page is the last, so next disables itself and focus moves to previous, in the first grid.
        expect(first.getByRole('button', { name: 'Previous page' })).toHaveFocus();
        expect(second.getByRole('button', { name: 'Previous page' })).not.toHaveFocus();
        expect(second.getByRole('button', { name: 'Next page' })).not.toHaveFocus();
    });
});
