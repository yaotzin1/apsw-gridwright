import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { rowDetail } from '../../src/react/detail/addon';
import { useRowDetail } from '../../src/react/detail/context';
import { treeData } from '../../src/react/tree/addon';
import { virtualRows } from '../../src/react/virtual/addon';
import { pl } from '../../src/locales';
import type { RowDetailController } from '../../src/react/detail/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const toggles = (): HTMLElement[] => screen.getAllByRole('button', { name: /details for/i });
const announcement = (): string => screen.getByRole('status').textContent ?? '';

describe('rowDetail()', () => {
    it('opens a panel under its row and closes it again', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[rowDetail<Person>({ render: ({ data }) => <p>{data.department} team</p> })]}
            />,
        );

        const toggle = screen.getByRole('button', { name: 'Show details for Ada Lovelace' });
        expect(screen.queryByText('Engineering team')).not.toBeInTheDocument();

        await user.click(toggle);
        const panel = screen.getByRole('region', { name: 'Details for Ada Lovelace' });
        expect(within(panel).getByText('Engineering team')).toBeInTheDocument();
        // Directly under its own row, not at the end of the body.
        expect(panel.closest('tr')!.previousElementSibling).toBe(screen.getAllByRole('row')[1]);

        await user.click(screen.getByRole('button', { name: 'Hide details for Ada Lovelace' }));
        expect(screen.queryByRole('region', { name: 'Details for Ada Lovelace' })).not.toBeInTheDocument();
    });

    it('renders the panel only while it is open, so a panel that fetches stops when it closes', async () => {
        const user = userEvent.setup();
        const rendered = vi.fn();

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[
                    rowDetail<Person>({
                        render: ({ data }) => {
                            rendered(data.name);
                            return <p>detail</p>;
                        },
                    }),
                ]}
            />,
        );

        expect(rendered).not.toHaveBeenCalled();
        await user.click(toggles()[0]!);
        expect(rendered).toHaveBeenCalledWith('Ada Lovelace');

        rendered.mockClear();
        await user.click(toggles()[0]!);
        expect(rendered).not.toHaveBeenCalled();
    });

    it('draws no toggle for a row hasDetail refuses, and no row for a render that returns nothing', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[
                    rowDetail<Person>({
                        hasDetail: (row) => row.data.department === 'Engineering',
                        render: ({ data }) => (data.name === 'Ada Lovelace' ? <p>detail</p> : null),
                    }),
                ]}
            />,
        );

        // Two Engineering rows on this page, one Research row with no toggle at all.
        expect(toggles()).toHaveLength(2);
        expect(screen.queryByRole('button', { name: /Katherine Johnson/ })).not.toBeInTheDocument();

        // Grace Hopper has a toggle but nothing to show: opening it renders no panel row rather
        // than an empty full-width strip.
        await user.click(screen.getByRole('button', { name: 'Show details for Grace Hopper' }));
        expect(document.querySelectorAll('.gw-detail-row')).toHaveLength(0);
    });

    it('keeps several panels open, and only one under single', async () => {
        const user = userEvent.setup();
        const { unmount } = render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[rowDetail<Person>({ render: ({ data }) => <p>{data.name} detail</p> })]}
            />,
        );

        await user.click(toggles()[0]!);
        await user.click(toggles()[1]!);
        expect(screen.getAllByRole('region', { name: /Details for/ })).toHaveLength(2);
        unmount();

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[rowDetail<Person>({ single: true, render: ({ data }) => <p>{data.name} detail</p> })]}
            />,
        );

        await user.click(toggles()[0]!);
        await user.click(toggles()[1]!);
        const open = screen.getAllByRole('region', { name: /Details for/ });
        expect(open).toHaveLength(1);
        expect(open[0]).toHaveAccessibleName('Details for Grace Hopper');
    });

    it('restores initialExpanded without reporting it as a change', async () => {
        const user = userEvent.setup();
        const changed = vi.fn();

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                getRowId={(row) => row.id}
                aria-label="People"
                addons={[rowDetail<Person>({ initialExpanded: [1], onExpandedChange: changed, render: () => <p>detail</p> })]}
            />,
        );

        expect(screen.getByRole('region', { name: 'Details for Ada Lovelace' })).toBeInTheDocument();
        // A handler that writes to storage must not overwrite a saved set on the first paint.
        expect(changed).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Show details for Grace Hopper' }));
        await waitFor(() => expect(changed).toHaveBeenCalledWith([1, 2]));
    });

    it('refuses a change canToggle refuses, and disables the control that would make it', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                getRowId={(row) => row.id}
                aria-label="People"
                addons={[rowDetail<Person>({ canToggle: (rowId) => rowId !== 2, render: () => <p>detail</p> })]}
            />,
        );

        const refused = screen.getByRole('button', { name: 'Show details for Grace Hopper' });
        expect(refused).toBeDisabled();

        await user.click(refused);
        expect(screen.queryByRole('region', { name: 'Details for Grace Hopper' })).not.toBeInTheDocument();

        // It narrows and never widens: the rows it does not refuse still work.
        await user.click(screen.getByRole('button', { name: 'Show details for Ada Lovelace' }));
        expect(screen.getByRole('region', { name: 'Details for Ada Lovelace' })).toBeInTheDocument();
    });

    it('hands the controller out, and expands only the rows the grid is holding', async () => {
        const user = userEvent.setup();
        let controller: RowDetailController | null = null;

        function ExpandAll() {
            const detail = useRowDetail();
            return (
                <button type="button" onClick={() => detail.expandAll()}>
                    expand all
                </button>
            );
        }

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                getRowId={(row) => row.id}
                aria-label="People"
                toolbar={<ExpandAll />}
                addons={[rowDetail<Person>({ controllerRef: (value) => (controller = value), render: () => <p>detail</p> })]}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'expand all' }));

        // Three rows on this page, seven in the result set. Nothing claims the other four.
        expect(screen.getAllByRole('region', { name: /Details for/ })).toHaveLength(3);
        expect(controller!.expanded).toEqual([1, 2, 3]);

        await user.click(screen.getByRole('button', { name: 'Hide details for Ada Lovelace' }));
        expect(controller!.expanded).toEqual([2, 3]);
    });

    it('keeps an expansion across a page change, unless told not to', async () => {
        const user = userEvent.setup();
        const grid = (persist: boolean) => (
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                getRowId={(row) => row.id}
                aria-label="People"
                addons={[rowDetail<Person>({ persistAcrossPages: persist, render: () => <p>detail</p> })]}
            />
        );

        const { unmount } = render(grid(true));
        await user.click(screen.getByRole('button', { name: 'Show details for Ada Lovelace' }));
        await user.click(screen.getByRole('button', { name: 'Next page' }));
        expect(screen.queryByRole('region', { name: /Details for/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Previous page' }));
        expect(screen.getByRole('region', { name: 'Details for Ada Lovelace' })).toBeInTheDocument();
        unmount();

        render(grid(false));
        await user.click(screen.getByRole('button', { name: 'Show details for Ada Lovelace' }));
        await user.click(screen.getByRole('button', { name: 'Next page' }));
        await user.click(screen.getByRole('button', { name: 'Previous page' }));
        await waitFor(() => expect(screen.queryByRole('region', { name: /Details for/ })).not.toBeInTheDocument());
    });
});

describe('rowDetail() and assistive technology', () => {
    it('leaves the row numbering of the result set exactly as it was', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[rowDetail<Person>({ render: () => <p>detail</p> })]}
            />,
        );

        const before = {
            count: screen.getByRole('grid').getAttribute('aria-rowcount'),
            indices: screen.getAllByRole('row').map((row) => row.getAttribute('aria-rowindex')),
        };

        await user.click(toggles()[0]!);

        // The panel is in the DOM and is not a row, so nothing about the numbering moved. Counting
        // it would make `aria-rowcount` a number computed from the one page that is mounted.
        expect(document.querySelectorAll('.gw-detail-row')).toHaveLength(1);
        expect(screen.getByRole('grid').getAttribute('aria-rowcount')).toBe(before.count);
        expect(screen.getAllByRole('row').map((row) => row.getAttribute('aria-rowindex'))).toEqual(before.indices);
    });

    it('points aria-controls at the panel only while the panel exists', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[rowDetail<Person>({ render: () => <p>detail</p> })]}
            />,
        );

        const toggle = toggles()[0]!;
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).not.toHaveAttribute('aria-controls');

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const panelId = toggle.getAttribute('aria-controls')!;
        expect(document.getElementById(panelId)).toBe(screen.getByRole('region', { name: 'Details for Ada Lovelace' }));
    });

    it('keeps focus on the toggle and announces the change', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                aria-label="People"
                addons={[rowDetail<Person>({ render: () => <p>detail</p> })]}
            />,
        );

        const toggle = toggles()[0]!;
        toggle.focus();
        // Operated from the keyboard, because it is a real button and Enter comes from the platform.
        await user.keyboard('{Enter}');

        expect(screen.getByRole('region', { name: 'Details for Ada Lovelace' })).toBeInTheDocument();
        // The panel is content in a table, not a dialog: focus stays where the reader put it.
        expect(document.activeElement).toBe(toggle);
        await waitFor(() => expect(announcement()).toBe('Ada Lovelace details shown'));

        await user.keyboard('{Enter}');
        await waitFor(() => expect(announcement()).toBe('Ada Lovelace details hidden'));
    });

    it('is translated by a locale pack', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                locale={pl}
                aria-label="Ludzie"
                addons={[rowDetail<Person>({ render: () => <p>szczegóły</p> })]}
            />,
        );

        const toggle = screen.getByRole('button', { name: 'Pokaż szczegóły: Ada Lovelace' });
        await user.click(toggle);
        expect(screen.getByRole('region', { name: 'Szczegóły: Ada Lovelace' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ukryj szczegóły: Ada Lovelace' })).toBe(toggle);
    });
});

describe('rowDetail() beside other add-ons', () => {
    it('refuses to be listed with virtualRows(), by name', () => {
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            render(
                <Gridwright<Person>
                    columns={personColumns}
                    data={people}
                    aria-label="People"
                    addons={[virtualRows(), rowDetail<Person>({ render: () => <p>detail</p> })]}
                />,
            ),
        ).toThrow(/gridwright:row-detail.*gridwright:virtual|gridwright:virtual/s);
        reported.mockRestore();
    });

    it('works on a tree, with the two expansions independent of each other', async () => {
        const user = userEvent.setup();
        interface Item {
            id: string;
            name: string;
            children?: Item[];
        }
        const items: Item[] = [{ id: 'a', name: 'Folder', children: [{ id: 'b', name: 'File' }] }];

        render(
            <Gridwright<Item>
                columns={[{ id: 'name', header: 'Name' }]}
                data={items}
                aria-label="Files"
                addons={[
                    treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children }),
                    // `render` gets the consumer's row, not the tree node the engine sees.
                    rowDetail<Item>({ render: ({ data }) => <p>{data.name} detail</p> }),
                ]}
            />,
        );

        const detailToggle = screen.getByRole('button', { name: 'Show details for Folder' });
        await user.click(detailToggle);
        expect(screen.getByText('Folder detail')).toBeInTheDocument();

        // The row's own `aria-expanded` is the tree's, about its children, and is untouched by the
        // panel that just opened.
        const row = screen.getAllByRole('row')[1]!;
        expect(row).toHaveAttribute('aria-expanded', 'false');
        expect(detailToggle).toHaveAttribute('aria-expanded', 'true');

        await user.click(screen.getByRole('button', { name: 'Expand' }));
        expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Folder detail')).toBeInTheDocument();
    });

    it('asks hasDetail about the row the consumer wrote, not the node the engine holds', () => {
        interface Item {
            id: string;
            name: string;
            kind: 'team' | 'person';
            children?: Item[];
        }
        const items: Item[] = [
            { id: 'eng', name: 'Engineering', kind: 'team', children: [{ id: 'ada', name: 'Ada', kind: 'person' }] },
        ];

        render(
            <Gridwright<Item>
                columns={[{ id: 'name', header: 'Name' }]}
                data={items}
                aria-label="Team"
                addons={[
                    treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children, defaultExpandedDepth: 1 }),
                    // `row.data` is a `TreeNode` as the engine holds it. A callback typed over
                    // `GridRow<Item>` must be handed the Item, or `row.data.kind` is silently
                    // undefined and every row gets a toggle it should not have.
                    rowDetail<Item>({ hasDetail: (row) => row.data.kind !== 'team', render: () => <p>detail</p> }),
                ]}
            />,
        );

        expect(screen.getByRole('button', { name: 'Show details for Ada' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Show details for Engineering' })).not.toBeInTheDocument();
    });

    it('sits beside the selection checkboxes without either swallowing the other', async () => {
        const user = userEvent.setup();
        const selected = vi.fn();

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                getRowId={(row) => row.id}
                aria-label="People"
                onSelectionChange={selected}
                addons={[rowDetail<Person>({ render: () => <p>detail</p> })]}
            />,
        );

        await user.click(toggles()[0]!);
        expect(selected).not.toHaveBeenCalled();

        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
        await waitFor(() => expect(selected).toHaveBeenCalledWith([1], [people[0]]));
        expect(screen.getByRole('region', { name: 'Details for Ada Lovelace' })).toBeInTheDocument();
    });
});
