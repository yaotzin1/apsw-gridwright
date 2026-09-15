import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { GridwrightProvider } from '../../src/react/context';
import { search } from '../../src/react/core-addons';
import { GridTable } from '../../src/react/parts/GridTable';
import { GridHeader } from '../../src/react/parts/GridHeader';
import { GridBody } from '../../src/react/parts/GridBody';
import { GridRoot } from '../../src/react/parts/GridRoot';
import { inlineEditing, rowActions } from '../../src/react/plugins/addons';
import type { BubbleMenuItem } from '../../src/react/plugins/BubbleMenu';
import { treeData } from '../../src/react/tree/addon';
import type { TreeDataOptions } from '../../src/react/tree/addon';
import { useGridwright } from '../../src/react/useGridwright';
import { pl } from '../../src/locales';
import type { TreeController } from '../../src/tree/controller';
import type { GridwrightColumn } from '../../src/react/types';
import type { GridAddon } from '../../src/react/addons/types';

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

const nested = (extra: Partial<TreeDataOptions<Item>> = {}) =>
    treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children, ...extra });

const tree = ({ tree: options = {}, addons = [], ...props }: { tree?: Partial<TreeDataOptions<Item>>; addons?: GridAddon<Item>[]; locale?: typeof pl } = {}) =>
    render(
        <Gridwright<Item>
            columns={columns}
            data={items}
            pageSize={100}
            aria-label="Files"
            addons={[nested(options), ...addons]}
            {...props}
        />,
    );

/**
 * A layout composed by hand from the parts, with the tree controller in reach.
 *
 * The root is what applies the add-ons' providers, the tree's among them, so a hand-made layout
 * includes it rather than rebuilding the tree context itself.
 */
function ComposedTree({
    data = items,
    options = {},
    addons = [],
    toolbar,
}: {
    data?: readonly Item[];
    options?: Partial<TreeDataOptions<Item>>;
    addons?: GridAddon<Item>[];
    toolbar?: (controller: () => TreeController<Item>) => ReactNode;
}) {
    const controller = useRef<TreeController<Item> | null>(null);
    const instance = useGridwright<Item>({
        columns,
        data,
        pageSize: 100,
        addons: [
            nested({
                ...options,
                controllerRef: (next) => {
                    controller.current = next;
                },
            }),
            ...addons,
        ],
    });

    return (
        <GridwrightProvider instance={instance}>
            <GridRoot>
                {toolbar?.(() => controller.current!)}
                <GridTable aria-label="Files">
                    <GridHeader />
                    <GridBody />
                </GridTable>
            </GridRoot>
        </GridwrightProvider>
    );
}

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

    it('announces the expanded state on the row rather than only drawing an arrow', async () => {
        // In a treegrid the expanded state belongs to the row. Carrying it on the toggle as well
        // is the same fact twice, and a screen reader reads it twice.
        const user = userEvent.setup();
        tree();

        const toggle = screen.getAllByRole('button', { name: 'Expand' })[0]!;
        expect(toggle).not.toHaveAttribute('aria-expanded');
        expect(toggle.closest('tr')).toHaveAttribute('aria-expanded', 'false');

        await user.click(toggle);

        const collapse = screen.getByRole('button', { name: 'Collapse' });
        expect(collapse.closest('tr')).toHaveAttribute('aria-expanded', 'true');
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
        tree({ tree: { defaultExpandedDepth: 1 } });
        // Two folders at depth 0, one folder at depth 1: three toggles, not five.
        expect(screen.getAllByRole('button', { name: /Expand|Collapse/ })).toHaveLength(3);
    });

    it('opens to a starting depth', () => {
        tree({ tree: { defaultExpandedDepth: 1 } });
        expect(names()).toEqual(['Documents', 'CV.pdf', 'Work', 'Photos', 'Beach.jpg']);
    });

    it('indents by depth', () => {
        const { container } = tree({ tree: { defaultExpandedDepth: 2 } });
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
        tree({ addons: [search<Item>()] });

        await user.type(screen.getByRole('searchbox'), 'plan');
        await waitFor(() => expect(names()).toEqual(['Documents', 'Work', 'Plan.md']));
    });
});

describe('lazy children', () => {
    it('loads on first expand and shows the result', async () => {
        const user = userEvent.setup();
        const loadChildren = vi.fn(async () => [{ id: 'lazy', name: 'Loaded.txt', owner: 'Ada' }]);

        render(
            <Gridwright<Item>
                columns={columns}
                data={[{ id: 'folder', name: 'Folder', owner: 'Ada' }]}
                pageSize={100}
                addons={[treeData<Item>({ getRowId: (row) => row.id, hasChildren: () => true, loadChildren })]}
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
            <Gridwright<Item>
                columns={columns}
                data={[{ id: 'folder', name: 'Folder', owner: 'Ada' }]}
                pageSize={100}
                addons={[
                    treeData<Item>({
                        getRowId: (row) => row.id,
                        hasChildren: () => true,
                        loadChildren: async () => {
                            throw new Error('The folder is unavailable.');
                        },
                    }),
                ]}
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
            <Gridwright<Member>
                columns={columns as never}
                data={members}
                pageSize={100}
                addons={[treeData<Member>({ getRowId: (row) => row.id, getParentIds: (row) => row.parentIds })]}
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

describe('changing the shape of the data', () => {
    interface Mixed {
        id: string;
        name: string;
        owner: string;
        children?: Mixed[];
        parentIds?: string[];
    }

    const nested: Mixed[] = [{ id: 'a', name: 'A', owner: '-', children: [{ id: 'b', name: 'B', owner: '-' }] }];
    const flat: Mixed[] = [
        { id: 'a', name: 'A', owner: '-' },
        { id: 'b', name: 'B', owner: '-', parentIds: ['a'] },
    ];

    it('rebuilds when children give way to parent references', async () => {
        // The controller decides how to normalise rows from which callback is present, and that is
        // fixed when it is built. Without a rebuild, switching left every row a root, silently.
        function Host() {
            const [shape, setShape] = useState<'nested' | 'flat'>('nested');

            const options =
                shape === 'nested'
                    ? { data: nested, getChildren: (row: Mixed) => row.children }
                    : { data: flat, getParentIds: (row: Mixed) => row.parentIds };

            const instance = useGridwright<Mixed>({
                columns: columns as never,
                pageSize: 100,
                data: options.data,
                addons: [
                    treeData<Mixed>({
                        getRowId: (row) => row.id,
                        defaultExpandedDepth: 2,
                        ...('getChildren' in options ? { getChildren: options.getChildren } : { getParentIds: options.getParentIds }),
                    }),
                ],
            });

            return (
                <GridwrightProvider instance={instance}>
                    <GridRoot>
                        <button type="button" onClick={() => setShape('flat')}>
                            use parent ids
                        </button>
                        <GridTable aria-label="Rows">
                            <GridHeader />
                            <GridBody />
                        </GridTable>
                    </GridRoot>
                </GridwrightProvider>
            );
        }

        const user = userEvent.setup();
        const { container } = render(<Host />);

        const depths = () =>
            [...container.querySelectorAll<HTMLElement>('.gw-tree-cell')].map(
                (cell) => cell.style.paddingInlineStart,
            );

        expect(depths()).toEqual(['0px', '16px']);

        await user.click(screen.getByRole('button', { name: 'use parent ids' }));
        await waitFor(() => expect(depths()).toEqual(['0px', '16px']));
        expect(names()).toEqual(['A', 'B']);
    });
});

describe('row actions on a tree', () => {
    const withMenu = (menuItems: readonly BubbleMenuItem<Item>[]) =>
        render(<ComposedTree addons={[rowActions<Item>({ items: menuItems })]} />);

    it('opens over the row under the pointer and runs an action', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        withMenu([{ id: 'open', label: 'Open', onSelect }]);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        await user.hover(screen.getAllByRole('row')[1]!);
        const menu = await screen.findByRole('menu', { name: 'Row actions' });

        await user.click(within(menu).getByRole('menuitem', { name: 'Open' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'docs' }));
    });

    it('renders its actions as a real menu of buttons', async () => {
        const user = userEvent.setup();
        withMenu([
            { id: 'open', label: 'Open', onSelect: () => undefined },
            { id: 'delete', label: 'Delete', destructive: true, onSelect: () => undefined },
        ]);
        await user.hover(screen.getAllByRole('row')[1]!);

        const menu = await screen.findByRole('menu');
        // Not a div with an onClick: every action is a button, so a keyboard reaches all of them.
        expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
    });

    it('hides an item that does not apply to the row', async () => {
        const user = userEvent.setup();
        withMenu([
            { id: 'open', label: 'Open', onSelect: () => undefined },
            {
                id: 'add',
                label: 'Add child',
                onSelect: () => undefined,
                // A tree's rows are placements; `hasChildren` is the node's.
                hidden: (row) => !(row.data as unknown as { hasChildren: boolean }).hasChildren,
            },
        ]);
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
        const controller = useRef<TreeController<Item> | null>(null);

        return (
            <Gridwright<Item>
                columns={[
                    { id: 'name', header: 'Name', edit: { editable: true } },
                    { id: 'owner', header: 'Owner' },
                ]}
                data={data}
                pageSize={100}
                aria-label="Files"
                addons={[
                    treeData<Item>({
                        getRowId: (row) => row.id,
                        getChildren: (row) => row.children,
                        defaultExpandedDepth: 1,
                        controllerRef: (next) => {
                            controller.current = next;
                        },
                        onCommit: async (change) => {
                            if (change.type === 'update' && onCommit) await onCommit(String(change.rowId), change.row);
                        },
                    }),
                    inlineEditing<Item>({
                        commit: (rowId, columnId, value) =>
                            controller.current!.updateRow(rowId, { [columnId]: value } as Partial<Item>),
                    }),
                ]}
            />
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
        render(
            <ComposedTree
                toolbar={(controller) => (
                    <button
                        type="button"
                        onClick={() =>
                            void controller().insertRow(
                                { id: 'fresh', name: 'Untitled.md', owner: 'Ada' },
                                { referenceNodeId: 'docs', position: 'child' },
                            )
                        }
                    >
                        add child
                    </button>
                )}
            />,
        );
        expect(names()).toEqual(['Documents', 'Photos']);

        await user.click(screen.getByRole('button', { name: 'add child' }));

        // Inserting into a collapsed parent would hide the new row, which reads as a failed insert.
        await waitFor(() => expect(names()).toContain('Untitled.md'));
    });

    it('moves a node to a new parent', async () => {
        const user = userEvent.setup();
        render(
            <ComposedTree
                options={{ defaultExpandedDepth: 2 }}
                toolbar={(controller) => (
                    <button
                        type="button"
                        onClick={() => void controller().moveNode('docs/cv', { referenceNodeId: 'photos', position: 'child' })}
                    >
                        move
                    </button>
                )}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'move' }));

        await waitFor(() =>
            expect(names()).toEqual(['Documents', 'Work', 'Plan.md', 'Photos', 'Beach.jpg', 'CV.pdf']),
        );
    });

    it('forwards the selection as your rows, not as tree nodes', async () => {
        const user = userEvent.setup();
        const onSelectionChange = vi.fn();
        render(
            <Gridwright<Item>
                columns={columns}
                data={items}
                selectionMode="multiple"
                onSelectionChange={onSelectionChange}
                addons={[nested()]}
            />,
        );

        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
        expect(onSelectionChange).toHaveBeenCalledWith(['docs'], [expect.objectContaining({ id: 'docs', name: 'Documents' })]);
    });
});
