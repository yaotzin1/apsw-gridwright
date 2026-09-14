import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { createWindowedDataSource } from '../../src/data/windowed';
import { useGridwright } from '../../src/react/useGridwright';
import { inlineEditing, rowActions } from '../../src/react/plugins/addons';
import { treeData } from '../../src/react/tree/addon';
import { virtualRows } from '../../src/react/virtual/addon';
import { rowDataOf } from '../../src/react/tree/rowData';
import type { GridRow } from '../../src/core/types';
import type { TreeNode } from '../../src/tree/types';
import type { DataSource } from '../../src/core/types';
import type { TreeController } from '../../src/tree/controller';
import type { GridwrightColumn } from '../../src/react/types';

/**
 * Every capability is an add-on on one component, so what has to be proved is that they compose.
 * A tree that stops working once virtualized, or a menu that only appears on a flat grid, is the
 * failure mode this file exists to catch.
 */

interface Item {
    id: string;
    name: string;
    kind: 'folder' | 'file';
    size: number;
    children?: Item[];
}

const items: Item[] = [
    {
        id: 'docs',
        name: 'Documents',
        kind: 'folder',
        size: 0,
        children: [
            { id: 'cv', name: 'CV.pdf', kind: 'file', size: 220 },
            { id: 'plan', name: 'Plan.md', kind: 'file', size: 12 },
        ],
    },
    { id: 'photos', name: 'Photos', kind: 'folder', size: 0, children: [{ id: 'beach', name: 'Beach.jpg', kind: 'file', size: 3400 }] },
];

const columns: readonly GridwrightColumn<Item>[] = [
    { id: 'name', header: 'Name', edit: { editable: true } },
    { id: 'size', header: 'Size', align: 'end' },
];

const labelOf = (row: HTMLElement): string => {
    const cell = within(row).getAllByRole('cell')[0]!;
    const target = cell.querySelector('.gw-tree-label') ?? cell.querySelector('.gw-cell-text') ?? cell;

    // Without the icon, which is decoration: it sits inside the editable trigger so that clicking
    // it starts editing, which also puts its glyph inside the label's text content.
    const text = target.cloneNode(true) as HTMLElement;
    text.querySelectorAll('.gw-icon').forEach((icon) => icon.remove());
    return text.textContent ?? '';
};

const names = (): string[] => screen.getAllByRole('row').slice(1).map(labelOf);

describe('one component, features switched on by add-on', () => {
    it('is a flat grid with nothing enabled', () => {
        render(<Gridwright<Item> columns={columns} data={items} pageSize={10} aria-label="Files" />);

        expect(names()).toEqual(['Documents', 'Photos']);
        expect(screen.queryByRole('button', { name: 'Expand' })).not.toBeInTheDocument();
        expect(screen.getByText('Rows per page')).toBeInTheDocument();
    });

    it('becomes a tree with one add-on, and nothing else changes', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                pageSize={10}
                addons={[treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children })]}
                aria-label="Files"
            />,
        );

        await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);
        expect(names()).toEqual(['Documents', 'CV.pdf', 'Plan.md', 'Photos']);
    });

    it('gives a row action the consumer row, tree or not', async () => {
        const user = userEvent.setup();
        const seen: string[] = [];
        // Deliberately typed for both: a wider parameter is assignable to the narrower one, which
        // is what lets a single handler be passed to a flat grid and to a tree.
        const onSelect = (row: GridRow<Item> | GridRow<TreeNode<Item>>): void => {
            seen.push(rowDataOf<Item>(row).name);
        };
        const action = { id: 'open', label: 'Open', onSelect };

        const { unmount } = render(
            <Gridwright<Item> columns={columns} data={items} pageSize={10} addons={[rowActions<Item>({ items: [action] })]} />,
        );
        await user.hover(screen.getAllByRole('row')[1]!);
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Open' }));
        unmount();

        render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                pageSize={10}
                addons={[treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children }), rowActions<Item>({ items: [action] })]}
            />,
        );
        await user.hover(screen.getAllByRole('row')[1]!);
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Open' }));

        // One handler, both grids. A tree's rows are placements, and a menu written for a flat grid
        // has to keep working when the tree is switched on, or the option is not a switch.
        expect(seen).toEqual(['Documents', 'Documents']);
    });

    it('adds row actions to a flat grid', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                pageSize={10}
                aria-label="Files"
                addons={[rowActions<Item>({ items: [{ id: 'open', label: 'Open', onSelect }] })]}
            />,
        );

        await user.hover(screen.getAllByRole('row')[1]!);
        const menu = await screen.findByRole('menu');
        await user.click(within(menu).getByRole('menuitem', { name: 'Open' }));

        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'docs' }));
    });

    it('adds inline editing to a flat grid with one add-on', async () => {
        const user = userEvent.setup();
        const onCellEdit = vi.fn();

        render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                pageSize={10}
                aria-label="Files"
                addons={[inlineEditing<Item>({ commit: onCellEdit })]}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Documents' }));
        const input = screen.getByRole('textbox', { name: 'Name' });
        await user.clear(input);
        await user.type(input, 'Papers{Enter}');

        expect(onCellEdit).toHaveBeenCalledWith('docs', 'name', 'Papers');
    });

    it('leaves a column without `edit` read-only', () => {
        render(<Gridwright<Item> columns={columns} data={items} pageSize={10} addons={[inlineEditing<Item>({ commit: vi.fn() })]} />);
        // Size has no `edit`, so it is text rather than an activatable control.
        expect(screen.queryByRole('button', { name: '0' })).not.toBeInTheDocument();
    });

    it('starts editing when the icon itself is clicked', async () => {
        const user = userEvent.setup();
        const onCellEdit = vi.fn();

        render(
            <Gridwright<Item>
                columns={[
                    {
                        id: 'name',
                        header: 'Name',
                        edit: { editable: true },
                        icon: () => <span data-testid="icon">*</span>,
                    },
                ]}
                data={items}
                pageSize={10}
                addons={[inlineEditing<Item>({ commit: onCellEdit })]}
            />,
        );

        // The icon lives inside the trigger. Beside it, it is a dead patch in the middle of a
        // control, and whoever aimed at it concludes the cell is not editable.
        await user.click(screen.getAllByTestId('icon')[0]!);
        expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    });

    it('renders a per-row icon on any grid', () => {
        render(
            <Gridwright<Item>
                columns={[
                    {
                        id: 'name',
                        header: 'Name',
                        icon: ({ row }) => <span data-testid={`icon-${row.kind}`}>{row.kind === 'folder' ? '📁' : '📄'}</span>,
                    },
                ]}
                data={items}
                pageSize={10}
            />,
        );

        expect(screen.getAllByTestId('icon-folder')).toHaveLength(2);
    });

    it('combines a tree, row actions, editing and icons at once', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        render(
            <Gridwright<Item>
                columns={[
                    {
                        id: 'name',
                        header: 'Name',
                        edit: { editable: true },
                        icon: ({ row }) => <span data-testid="icon">{row.kind === 'folder' ? '📁' : '📄'}</span>,
                    },
                    { id: 'size', header: 'Size' },
                ]}
                data={items}
                pageSize={20}
                // Listed with the tree first on purpose: editing asks to be placed before it, so the
                // editor still lands inside the tree cell whatever order a consumer writes.
                addons={[
                    treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children, defaultExpandedDepth: 1 }),
                    rowActions<Item>({ items: [{ id: 'open', label: 'Open', onSelect }] }),
                    inlineEditing<Item>({ commit: vi.fn() }),
                ]}
                aria-label="Files"
            />,
        );

        // The tree renders, the icon sits inside the indented cell, the editable trigger is a
        // button, and the menu still opens. Four add-ons, one element.
        expect(names()).toEqual(['Documents', 'CV.pdf', 'Plan.md', 'Photos', 'Beach.jpg']);
        expect(screen.getAllByTestId('icon').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /CV\.pdf/ })).toBeInTheDocument();

        await user.hover(screen.getAllByRole('row')[1]!);
        expect(await screen.findByRole('menu')).toBeInTheDocument();
    });
});

describe('switching an add-on off on a live grid', () => {
    /**
     * The engine resolves columns in an effect, so the rows lag the props by a render. Anything
     * that reads the prop immediately and the rows eventually can disagree for that one frame, and
     * a cell that throws in it takes the whole grid down. A changed add-on list remounts the grid,
     * which is what keeps that frame from existing.
     */
    function Toggling({ editing, icons, tree }: { editing: boolean; icons: boolean; tree?: boolean }) {
        const columns: readonly GridwrightColumn<Item>[] = [
            {
                id: 'name',
                header: 'Name',
                ...(editing ? { edit: { editable: true } } : {}),
                ...(icons ? { icon: () => <span data-testid="icon">*</span> } : {}),
            },
            { id: 'size', header: 'Size' },
        ];

        return (
            <Gridwright<Item>
                columns={columns}
                data={items}
                pageSize={10}
                aria-label="Files"
                addons={[
                    ...(tree ? [treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children })] : []),
                    ...(editing ? [inlineEditing<Item>({ commit: vi.fn() })] : []),
                ]}
            />
        );
    }

    it('survives editing being switched off', async () => {
        const { rerender } = render(<Toggling editing icons={false} />);
        expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();

        rerender(<Toggling editing={false} icons={false} />);

        // The rows are still there. Before, the stale editable cell threw for want of a provider
        // and React unmounted the grid, leaving an empty page and a console full of nothing useful.
        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
        expect(screen.queryByRole('button', { name: 'Documents' })).not.toBeInTheDocument();
    });

    it('survives editing being switched off on a tree', async () => {
        const { rerender } = render(<Toggling editing icons={false} tree />);
        expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();

        rerender(<Toggling editing={false} icons={false} tree />);

        // The tree wraps the already-wrapped columns, so its own memo has to notice too.
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Documents' })).not.toBeInTheDocument());
        expect(names()).toEqual(['Documents', 'Photos']);
    });

    it('survives editing being switched on', async () => {
        const { rerender } = render(<Toggling editing={false} icons={false} />);
        rerender(<Toggling editing icons={false} />);

        await waitFor(() => expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument());
    });

    it('notices a column that gains an icon', async () => {
        const { rerender } = render(<Toggling editing icons={false} />);
        expect(screen.queryAllByTestId('icon')).toHaveLength(0);

        rerender(<Toggling editing icons />);

        // The wrapped column carries a copy of the renderer, so wrapping has to happen again.
        await waitFor(() => expect(screen.getAllByTestId('icon').length).toBeGreaterThan(0));
    });
});

describe('reaching the grid the component owns', () => {
    it('hands the tree controller back through `controllerRef`', async () => {
        const user = userEvent.setup();
        let controller: TreeController<Item> | null = null;

        render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                pageSize={20}
                addons={[
                    treeData<Item>({
                        getRowId: (row) => row.id,
                        getChildren: (row) => row.children,
                        controllerRef: (next) => {
                            controller = next;
                        },
                    }),
                ]}
                aria-label="Files"
            />,
        );

        // Insertion, movement and removal live on the controller, so enabling the tree by add-on
        // would otherwise put them out of reach.
        expect(controller).not.toBeNull();
        await act(async () => {
            await controller!.insertRow(
                { id: 'new', name: 'New.md', kind: 'file', size: 1 },
                { referenceNodeId: 'docs', position: 'child' },
            );
        });

        await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);
        expect(names()).toContain('New.md');
    });

    it('clears the controller ref when the grid goes away', () => {
        const seen: Array<TreeController<Item> | null> = [];
        const { unmount } = render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                addons={[treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children, controllerRef: (next) => seen.push(next) })]}
            />,
        );

        unmount();
        expect(seen.at(-1)).toBeNull();
    });

    it('renders a tree instance the caller built, rather than a flat list of nodes', async () => {
        const user = userEvent.setup();

        function Owned() {
            const grid = useGridwright<Item>({
                columns,
                data: items,
                pageSize: 20,
                addons: [treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children })],
            });

            // The instance carries its add-ons, the tree's provider among them, so passing it as
            // `instance` is the same grid as listing the add-on on the component.
            return <Gridwright<Item> columns={columns} instance={grid} aria-label="Files" />;
        }

        render(<Owned />);
        await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);
        expect(names()).toEqual(['Documents', 'CV.pdf', 'Plan.md', 'Photos']);
    });
});

describe('virtualization as an add-on', () => {
    const many: Item[] = Array.from({ length: 5_000 }, (_, index) => ({
        id: `row-${index}`,
        name: `Row ${index}`,
        kind: 'file',
        size: index,
    }));

    it('renders a window rather than every row', () => {
        render(
            <Gridwright<Item>
                columns={columns}
                data={many}
                pageSize={5_000}
                addons={[virtualRows<Item>({ rowHeight: 40, height: 400 })]}
                aria-label="Rows"
            />,
        );

        // Five thousand rows exist; a few dozen are in the DOM. That is the whole point.
        const rendered = screen.getAllByRole('row').length;
        expect(rendered).toBeGreaterThan(2);
        expect(rendered).toBeLessThan(80);
        // Five thousand data rows plus the header row, because ARIA counts every row of the table
        // and the row indices below are numbered on the same basis.
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '5001');
    });

    it('carries the true row position, not the position in the DOM', () => {
        render(
            <Gridwright<Item>
                columns={columns}
                data={many}
                pageSize={5_000}
                addons={[virtualRows<Item>()]}
                aria-label="Rows"
            />,
        );

        // A screen reader has to be told this is row one of five thousand, not row one of forty.
        // Index two, because the header above it is row one.
        const first = screen.getAllByRole('row')[1]!;
        expect(first).toHaveAttribute('aria-rowindex', '2');
    });

    it('replaces the pagination footer, rather than showing two navigations', () => {
        render(<Gridwright<Item> columns={columns} data={many} pageSize={5_000} addons={[virtualRows<Item>()]} />);
        expect(screen.queryByText('Rows per page')).not.toBeInTheDocument();
    });

    it('virtualizes a tree too', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                pageSize={50}
                addons={[treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children }), virtualRows<Item>({ rowHeight: 40, height: 400 })]}
                aria-label="Files"
            />,
        );

        expect(names()).toEqual(['Documents', 'Photos']);
        await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);
        await waitFor(() => expect(names()).toEqual(['Documents', 'CV.pdf', 'Plan.md', 'Photos']));
    });
});

describe('virtualization over an ordinary paginating source', () => {
    interface Person {
        id: number;
        name: string;
    }

    const TOTAL = 2_000;

    /** A source that pages and publishes no window offset, which is every remote source. */
    function pagingSource(): DataSource<Person> {
        return {
            kind: 'test-paging',
            capabilities: { sort: true, filter: true, search: true, paginate: true },
            fetch: ({ query }) => {
                const { pageIndex, pageSize } = query.pagination;
                const start = pageIndex * pageSize;
                const rows: Person[] = [];
                for (let index = start; index < Math.min(start + pageSize, TOTAL); index += 1) {
                    rows.push({ id: index, name: `Person ${index}` });
                }
                return { rows, totalRows: TOTAL };
            },
        };
    }

    it('places the rows the scroll asked for where the scroll is', async () => {
        const { container } = render(
            <Gridwright<Person>
                columns={[{ id: 'name', header: 'Name' }]}
                dataSource={pagingSource()}
                getRowId={(row) => row.id}
                pageSize={100}
                addons={[virtualRows<Person>({ rowHeight: 40, height: 400 })]}
                aria-label="People"
            />,
        );

        await waitFor(() => expect(screen.getByText('Person 0')).toBeInTheDocument());

        const scroller = container.querySelector<HTMLElement>('.gw-table-wrapper')!;
        await act(async () => {
            scroller.scrollTop = 200 * 40;
            scroller.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        });

        // Only a windowed source publishes where its rows start. Without that the query is the only
        // answer, and reading it as zero drew the fetched page over rows one to a hundred while the
        // rows actually on screen stayed skeletons for ever.
        await waitFor(() => expect(screen.getByText('Person 200')).toBeInTheDocument());
        expect(screen.getByText('Person 200').closest('tr')).toHaveAttribute('aria-rowindex', '202');
    });
});

describe('a windowed source', () => {
    interface Person {
        id: number;
        name: string;
    }

    const TOTAL = 10_000_000;

    function makeSource(onRange?: (offset: number, limit: number) => void) {
        return createWindowedDataSource<Person>({
            blockSize: 100,
            maxBlocks: 4,
            fetchRange: async ({ offset, limit }) => {
                onRange?.(offset, limit);
                const rows: Person[] = [];
                for (let index = offset; index < Math.min(offset + limit, TOTAL); index += 1) {
                    rows.push({ id: index, name: `Person ${index}` });
                }
                return { rows, totalRows: TOTAL };
            },
        });
    }

    it('reports ten million rows while holding a few hundred', async () => {
        const source = makeSource();

        render(
            <Gridwright<Person>
                columns={[{ id: 'name', header: 'Name' }]}
                dataSource={source}
                getRowId={(row) => row.id}
                pageSize={200}
                addons={[virtualRows<Person>({ rowHeight: 40, height: 400 })]}
                aria-label="People"
            />,
        );

        await waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', String(TOTAL + 1)));
        await waitFor(() => expect(screen.getByText('Person 0')).toBeInTheDocument());

        // Memory is a function of the cache size, not of how many rows exist.
        expect(source.cachedBlockCount).toBeLessThanOrEqual(4);
        expect(screen.getAllByRole('row').length).toBeLessThan(80);
    });

    it('fetches only the blocks covering the window', async () => {
        const ranges: Array<[number, number]> = [];
        const source = makeSource((offset, limit) => ranges.push([offset, limit]));

        render(
            <Gridwright<Person>
                columns={[{ id: 'name', header: 'Name' }]}
                dataSource={source}
                getRowId={(row) => row.id}
                pageSize={200}
                addons={[virtualRows<Person>({ rowHeight: 40, height: 400 })]}
            />,
        );

        await waitFor(() => expect(ranges.length).toBeGreaterThan(0));
        // A 200-row window over 100-row blocks is two blocks, not ten million rows.
        expect(ranges.every(([, limit]) => limit === 100)).toBe(true);
        expect(ranges.length).toBeLessThanOrEqual(2);
    });

    it('drops every cached block when the sort changes', async () => {
        const source = makeSource();

        const { container } = render(
            <Gridwright<Person>
                columns={[{ id: 'name', header: 'Name' }]}
                dataSource={source}
                getRowId={(row) => row.id}
                pageSize={200}
                addons={[virtualRows<Person>()]}
            />,
        );

        await waitFor(() => expect(source.cachedBlockCount).toBeGreaterThan(0));

        const user = userEvent.setup();
        await user.click(within(container).getByRole('button', { name: /Name/ }));

        // Blocks describe positions in a result set that no longer exists once the order changes.
        await waitFor(() => expect(screen.getByText('Person 0')).toBeInTheDocument());
        expect(source.cachedBlockCount).toBeLessThanOrEqual(4);
    });
});
