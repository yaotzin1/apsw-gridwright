import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TreeGridwright } from '../../src/react/tree/TreeGridwright';
import { useTreeGridwright } from '../../src/react/tree/useTreeGridwright';
import { TreeProvider } from '../../src/react/tree/context';
import { GridwrightProvider } from '../../src/react/context';
import { GridTable } from '../../src/react/parts/GridTable';
import { GridHeader } from '../../src/react/parts/GridHeader';
import { GridBody } from '../../src/react/parts/GridBody';
import { BubbleMenu } from '../../src/react/plugins/BubbleMenu';
import { InlineEditProvider, editableColumns } from '../../src/react/plugins/InlineEdit';
import { pl } from '../../src/locales';
import type { GridwrightColumn } from '../../src/react/types';
import type { TreeNode } from '../../src/tree/types';

interface Item {
    id: string;
    name: string;
    owner: string;
    children?: Item[];
}

const items: Item[] = [
    {
        id: 'docs',
        name: 'Documents',
        owner: 'Ada',
        children: [
            { id: 'cv', name: 'CV.pdf', owner: 'Ada' },
            { id: 'work', name: 'Work', owner: 'Grace', children: [{ id: 'plan', name: 'Plan.md', owner: 'Grace' }] },
        ],
    },
    { id: 'photos', name: 'Photos', owner: 'Mary', children: [{ id: 'beach', name: 'Beach.jpg', owner: 'Mary' }] },
];

const columns: readonly GridwrightColumn<Item>[] = [
    { id: 'name', header: 'Name' },
    { id: 'owner', header: 'Owner' },
];

/** The visible label. The cell also carries a visually hidden child count for screen readers. */
const names = (): string[] =>
    screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => {
            const cell = within(row).getAllByRole('cell')[0]!;
            return (cell.querySelector('.gw-tree-label') ?? cell).textContent ?? '';
        });

const tree = (props: Record<string, unknown> = {}) =>
    render(
        <TreeGridwright<Item>
            columns={columns}
            data={items}
            getRowId={(row) => row.id}
            getChildren={(row) => row.children}
            pageSize={100}
            aria-label="Files"
            {...props}
        />,
    );

describe('expandable rows', () => {
    it('renders the roots collapsed', () => {
        tree();
        expect(names()).toEqual(['Documents', 'Photos']);
    });

    it('expands and collapses from the toggle', async () => {
        const user = userEvent.setup();
        tree();

        await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);
        expect(names()).toEqual(['Documents', 'CV.pdf', 'Work', 'Photos']);

        await user.click(screen.getByRole('button', { name: 'Collapse' }));
        expect(names()).toEqual(['Documents', 'Photos']);
    });

    it('announces the state on the toggle rather than only drawing an arrow', async () => {
        const user = userEvent.setup();
        tree();

        const toggle = screen.getAllByRole('button', { name: 'Expand' })[0]!;
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        await user.click(toggle);
        expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('reaches the toggle by keyboard', async () => {
        // A row that can only be opened with a mouse is a row some people cannot open.
        const user = userEvent.setup();
        tree();

        await user.tab();
        await user.tab();
        await user.tab();
        expect(screen.getAllByRole('button', { name: 'Expand' })[0]!).toHaveFocus();

        await user.keyboard('{Enter}');
        expect(names()).toContain('CV.pdf');
    });

    it('gives leaves no toggle', () => {
        tree({ defaultExpandedDepth: 1 });
        // Two folders at depth 0, one folder at depth 1: three toggles, not five.
        expect(screen.getAllByRole('button', { name: /Expand|Collapse/ })).toHaveLength(3);
    });

    it('opens to a starting depth', () => {
        tree({ defaultExpandedDepth: 1 });
        expect(names()).toEqual(['Documents', 'CV.pdf', 'Work', 'Photos', 'Beach.jpg']);
    });

    it('indents by depth', () => {
        const { container } = tree({ defaultExpandedDepth: 2 });
        const cells = [...container.querySelectorAll<HTMLElement>('.gw-tree-cell')];
        expect(cells[0]!.style.paddingInlineStart).toBe('0px');
        expect(cells[1]!.style.paddingInlineStart).toBe('16px');
        expect(cells[3]!.style.paddingInlineStart).toBe('32px');
    });

    it('translates the toggle', async () => {
        const user = userEvent.setup();
        tree({ locale: pl });

        const toggle = screen.getAllByRole('button', { name: 'Rozwiń' })[0]!;
        await user.click(toggle);
        expect(screen.getByRole('button', { name: 'Zwiń' })).toBeInTheDocument();
    });
});

describe('searching a tree', () => {
    it('keeps the ancestors of a match and opens them', async () => {
        const user = userEvent.setup();
        tree({ searchable: true });

        await user.type(screen.getByRole('searchbox'), 'plan');
        await waitFor(() => expect(names()).toEqual(['Documents', 'Work', 'Plan.md']));
    });
});

describe('lazy children', () => {
    it('loads on first expand and shows the result', async () => {
        const user = userEvent.setup();
        const loadChildren = vi.fn(async () => [{ id: 'lazy', name: 'Loaded.txt', owner: 'Ada' }]);

        render(
            <TreeGridwright<Item>
                columns={columns}
                data={[{ id: 'folder', name: 'Folder', owner: 'Ada' }]}
                getRowId={(row) => row.id}
                hasChildren={() => true}
                loadChildren={loadChildren as never}
                pageSize={100}
            />,
        );

        expect(names()).toEqual(['Folder']);
        await user.click(screen.getByRole('button', { name: 'Expand' }));
        await waitFor(() => expect(names()).toEqual(['Folder', 'Loaded.txt']));
        expect(loadChildren).toHaveBeenCalledOnce();
    });

    it('shows the failure on the node and keeps it open', async () => {
        const user = userEvent.setup();

        render(
            <TreeGridwright<Item>
                columns={columns}
                data={[{ id: 'folder', name: 'Folder', owner: 'Ada' }]}
                getRowId={(row) => row.id}
                hasChildren={() => true}
                loadChildren={async () => {
                    throw new Error('The folder is unavailable.');
                }}
                pageSize={100}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Expand' }));
        await screen.findByRole('alert');
        expect(screen.getByText('The folder is unavailable.')).toBeInTheDocument();
    });
});

describe('a row under several parents', () => {
    interface Member {
        id: string;
        name: string;
        owner: string;
        parentIds?: string[];
    }

    const members: Member[] = [
        { id: 'eng', name: 'Engineering', owner: '-' },
        { id: 'design', name: 'Design', owner: '-' },
        { id: 'ada', name: 'Ada', owner: 'Ada', parentIds: ['eng', 'design'] },
    ];

    it('renders the row under each parent and expands them independently', async () => {
        const user = userEvent.setup();
        render(
            <TreeGridwright<Member>
                columns={columns as never}
                data={members}
                getRowId={(row) => row.id}
                getParentIds={(row) => row.parentIds}
                pageSize={100}
            />,
        );

        const toggles = screen.getAllByRole('button', { name: 'Expand' });
        await user.click(toggles[0]!);

        expect(names()).toEqual(['Engineering', 'Ada', 'Design']);
        // Only the first placement opened, which is the whole point of a placement having its own
        // identity rather than sharing the row's.
        expect(screen.getAllByRole('button', { name: 'Expand' })).toHaveLength(1);
    });
});

describe('the bubble menu', () => {
    it('opens over the row under the pointer and runs an action', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        function Host() {
            const instance = useTreeGridwright<Item>({
                columns,
                data: items,
                getRowId: (row) => row.id,
                getChildren: (row) => row.children,
                pageSize: 100,
            });

            return (
                <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
                    <GridwrightProvider instance={instance}>
                        <BubbleMenu<TreeNode<Item>>
                            aria-label="Row actions"
                            items={[{ id: 'open', label: 'Open', onSelect }]}
                        />
                        <GridTable aria-label="Files">
                            <GridHeader />
                            <GridBody<TreeNode<Item>> />
                        </GridTable>
                    </GridwrightProvider>
                </TreeProvider>
            );
        }

        render(<Host />);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        await user.hover(screen.getAllByRole('row')[1]!);
        const menu = await screen.findByRole('menu', { name: 'Row actions' });

        await user.click(within(menu).getByRole('menuitem', { name: 'Open' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'docs' }));
    });

    it('renders its actions as a real menu of buttons', async () => {
        const user = userEvent.setup();

        function Host() {
            const instance = useTreeGridwright<Item>({
                columns,
                data: items,
                getRowId: (row) => row.id,
                getChildren: (row) => row.children,
                pageSize: 100,
            });
            return (
                <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
                <GridwrightProvider instance={instance}>
                    <BubbleMenu<TreeNode<Item>>
                        aria-label="Row actions"
                        items={[
                            { id: 'open', label: 'Open', onSelect: () => undefined },
                            { id: 'delete', label: 'Delete', destructive: true, onSelect: () => undefined },
                        ]}
                    />
                    <GridTable aria-label="Files">
                        <GridHeader />
                        <GridBody<TreeNode<Item>> />
                    </GridTable>
                </GridwrightProvider>
                </TreeProvider>
            );
        }

        render(<Host />);
        await user.hover(screen.getAllByRole('row')[1]!);

        const menu = await screen.findByRole('menu');
        // Not a div with an onClick: every action is a button, so a keyboard reaches all of them.
        expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
    });

    it('hides an item that does not apply to the row', async () => {
        const user = userEvent.setup();

        function Host() {
            const instance = useTreeGridwright<Item>({
                columns,
                data: items,
                getRowId: (row) => row.id,
                getChildren: (row) => row.children,
                pageSize: 100,
            });
            return (
                <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
                <GridwrightProvider instance={instance}>
                    <BubbleMenu<TreeNode<Item>>
                        items={[
                            { id: 'open', label: 'Open', onSelect: () => undefined },
                            {
                                id: 'add',
                                label: 'Add child',
                                onSelect: () => undefined,
                                hidden: (row) => !row.data.hasChildren,
                            },
                        ]}
                    />
                    <GridTable aria-label="Files">
                        <GridHeader />
                        <GridBody<TreeNode<Item>> />
                    </GridTable>
                </GridwrightProvider>
                </TreeProvider>
            );
        }

        render(<Host />);
        await user.hover(screen.getAllByRole('row')[1]!);

        const menu = await screen.findByRole('menu');
        expect(within(menu).getByRole('menuitem', { name: 'Add child' })).toBeInTheDocument();
    });
});

describe('inline editing', () => {
    function EditableHost({ onCommit }: { onCommit?: (rowId: string, value: unknown) => Promise<void> }) {
        // Deliberately not re-set after a commit. The controller already holds the applied edit,
        // and handing the original array back would undo it.
        const [data] = useState(items);

        const instance = useTreeGridwright<Item>({
            columns: editableColumns<Item>([
                { id: 'name', header: 'Name', edit: { editable: true } },
                { id: 'owner', header: 'Owner' },
            ]) as never,
            data,
            getRowId: (row) => row.id,
            getChildren: (row) => row.children,
            defaultExpandedDepth: 1,
            pageSize: 100,
            onCommit: async (change) => {
                if (change.type === 'update' && onCommit) await onCommit(String(change.rowId), change.row);
            },
        });

        return (
            <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
                <GridwrightProvider instance={instance}>
                    <InlineEditProvider
                        commit={(rowId, columnId, value) =>
                            instance.tree.updateRow(rowId, { [columnId]: value } as Partial<Item>)
                        }
                    >
                        <GridTable aria-label="Files">
                            <GridHeader />
                            <GridBody<TreeNode<Item>> />
                        </GridTable>
                    </InlineEditProvider>
                </GridwrightProvider>
            </TreeProvider>
        );
    }

    it('opens an editor on an editable cell and writes the value', async () => {
        const user = userEvent.setup();
        render(<EditableHost />);

        await user.click(screen.getByRole('button', { name: 'CV.pdf' }));
        const input = screen.getByRole('textbox', { name: 'Name' });

        await user.clear(input);
        await user.type(input, 'Resume.pdf{Enter}');

        await waitFor(() => expect(screen.getByRole('button', { name: 'Resume.pdf' })).toBeInTheDocument());
    });

    it('cancels on Escape and keeps the original value', async () => {
        const user = userEvent.setup();
        render(<EditableHost />);

        await user.click(screen.getByRole('button', { name: 'CV.pdf' }));
        await user.type(screen.getByRole('textbox', { name: 'Name' }), 'nonsense{Escape}');

        expect(screen.getByRole('button', { name: 'CV.pdf' })).toBeInTheDocument();
    });

    it('leaves a non-editable column alone', () => {
        render(<EditableHost />);
        // The owner column has no `edit`, so it renders text rather than an activatable control.
        expect(screen.queryByRole('button', { name: 'Ada' })).not.toBeInTheDocument();
    });

    it('reverts and reports when the commit rejects', async () => {
        const user = userEvent.setup();
        render(
            <EditableHost
                onCommit={async () => {
                    throw new Error('Read-only.');
                }}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'CV.pdf' }));
        const input = screen.getByRole('textbox', { name: 'Name' });
        await user.clear(input);
        await user.type(input, 'Resume.pdf{Enter}');

        // A half-applied edit is worse than a refused one.
        await waitFor(() => expect(screen.getByRole('button', { name: /CV\.pdf/ })).toBeInTheDocument());
        expect(await screen.findByRole('alert')).toHaveTextContent('Read-only.');
    });

    it('reaches an editable cell by keyboard', async () => {
        const user = userEvent.setup();
        render(<EditableHost />);

        const trigger = screen.getByRole('button', { name: 'CV.pdf' });
        trigger.focus();
        await user.keyboard('{Enter}');

        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });
});

describe('building the tree', () => {
    it('adds a child through the controller and opens the parent', async () => {
        const user = userEvent.setup();

        function Host() {
            const instance = useTreeGridwright<Item>({
                columns,
                data: items,
                getRowId: (row) => row.id,
                getChildren: (row) => row.children,
                pageSize: 100,
            });

            return (
                <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
                    <GridwrightProvider instance={instance}>
                        <button
                            type="button"
                            onClick={() =>
                                void instance.tree.insertRow(
                                    { id: 'fresh', name: 'Untitled.md', owner: 'Ada' },
                                    { referenceNodeId: 'docs', position: 'child' },
                                )
                            }
                        >
                            add child
                        </button>
                        <GridTable aria-label="Files">
                            <GridHeader />
                            <GridBody<TreeNode<Item>> />
                        </GridTable>
                    </GridwrightProvider>
                </TreeProvider>
            );
        }

        render(<Host />);
        expect(names()).toEqual(['Documents', 'Photos']);

        await user.click(screen.getByRole('button', { name: 'add child' }));

        // Inserting into a collapsed parent would hide the new row, which reads as a failed insert.
        await waitFor(() => expect(names()).toContain('Untitled.md'));
    });

    it('moves a node to a new parent', async () => {
        const user = userEvent.setup();

        function Host() {
            const instance = useTreeGridwright<Item>({
                columns,
                data: items,
                getRowId: (row) => row.id,
                getChildren: (row) => row.children,
                defaultExpandedDepth: 2,
                pageSize: 100,
            });

            return (
                <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
                    <GridwrightProvider instance={instance}>
                        <button
                            type="button"
                            onClick={() =>
                                void instance.tree.moveNode('docs/cv', {
                                    referenceNodeId: 'photos',
                                    position: 'child',
                                })
                            }
                        >
                            move
                        </button>
                        <GridTable aria-label="Files">
                            <GridHeader />
                            <GridBody<TreeNode<Item>> />
                        </GridTable>
                    </GridwrightProvider>
                </TreeProvider>
            );
        }

        render(<Host />);
        await user.click(screen.getByRole('button', { name: 'move' }));

        await waitFor(() =>
            expect(names()).toEqual(['Documents', 'Work', 'Plan.md', 'Photos', 'Beach.jpg', 'CV.pdf']),
        );
    });
});
