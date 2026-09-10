import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Deliberately the package specifiers, resolved to `dist/` by vitest.smoke.config.ts. Nothing in
// this file may reach into `src/`: the point of a smoke suite is to exercise the artifact a
// consumer installs, including its export map, its bundling and its type entry points.
import {
    buildTreeIndex,
    corePlugins,
    createGridEngine,
    createLocalDataSource,
    createRemoteDataSource,
    createRestDataSource,
    GridwrightError,
    STAGE_ORDER,
    VERSION,
} from 'apsw-gridwright';
import {
    BubbleMenu,
    Gridwright,
    GridwrightProvider,
    GridTable,
    TreeGridwright,
    useGridwright,
} from 'apsw-gridwright/react';
import { de, en, es, fr, pl } from 'apsw-gridwright/locales';

interface Row {
    id: number;
    name: string;
    score: number;
}

const rows: Row[] = [
    { id: 1, name: 'Alpha', score: 30 },
    { id: 2, name: 'Bravo', score: 10 },
    { id: 3, name: 'Charlie', score: 20 },
];

const columns = [
    { id: 'name', header: 'Name' },
    { id: 'score', header: 'Score' },
];

const bodyText = (): string[] =>
    screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]!.textContent ?? '');

describe('the built package', () => {
    it('exposes the documented core entry points', () => {
        expect(typeof createGridEngine).toBe('function');
        expect(typeof createLocalDataSource).toBe('function');
        expect(typeof createRemoteDataSource).toBe('function');
        expect(typeof createRestDataSource).toBe('function');
        expect(typeof corePlugins).toBe('function');
        expect(STAGE_ORDER.SORT).toBeLessThan(STAGE_ORDER.PAGINATE);
        expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('runs an end-to-end local grid through the built engine', () => {
        const api = createGridEngine<Row>({
            columns,
            dataSource: createLocalDataSource<Row>(rows),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 2 } },
        });

        expect(api.getState().status).toBe('ready');
        expect(api.getState().totalRows).toBe(3);

        api.toggleSort('score');
        expect(api.getState().rows.map((row) => row.data.name)).toEqual(['Bravo', 'Charlie']);

        api.nextPage();
        expect(api.getState().rows.map((row) => row.data.name)).toEqual(['Alpha']);
        api.destroy();
    });

    it('runs an end-to-end remote grid through the built engine', async () => {
        const api = createGridEngine<Row>({
            columns,
            dataSource: createRemoteDataSource<Row>({
                fetcher: async ({ query }) => ({
                    rows: rows.slice(0, query.pagination.pageSize),
                    totalRows: rows.length,
                }),
                retry: { attempts: 0 },
            }),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 2 } },
        });

        await vi.waitFor(() => expect(api.getState().status).toBe('ready'));
        expect(api.getState().rows).toHaveLength(2);
        expect(api.getState().pageCount).toBe(2);
        api.destroy();
    });

    it('carries the error class across the entry points', async () => {
        // Two bundled copies of the class would make this instanceof fail while every unit test
        // still passed, because the unit suite only ever loads one copy.
        const api = createGridEngine<Row>({
            columns,
            dataSource: createRemoteDataSource<Row>({
                retry: { attempts: 0 },
                fetcher: async () => {
                    throw new GridwrightError('nope', { status: 404 });
                },
            }),
            onError: (error) => {
                expect(error.cause).toBeInstanceOf(GridwrightError);
            },
        });

        await vi.waitFor(() => expect(api.getState().status).toBe('error'));
        expect(api.getState().error?.retryable).toBe(false);
        api.destroy();
    });

    it('renders and drives the React component from the built bundle', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={2} searchable aria-label="Scores" />);

        expect(screen.getByRole('grid', { name: 'Scores' })).toBeInTheDocument();
        expect(bodyText()).toEqual(['Alpha', 'Bravo']);

        await user.click(screen.getByRole('button', { name: /Score/ }));
        expect(bodyText()).toEqual(['Bravo', 'Charlie']);

        await user.type(screen.getByRole('searchbox'), 'alpha');
        await waitFor(() => expect(bodyText()).toEqual(['Alpha']));
    });

    it('composes the exported parts under the exported provider', () => {
        function Composed() {
            const instance = useGridwright<Row>({ columns, data: rows, pageSize: 3 });
            return (
                <GridwrightProvider instance={instance}>
                    <GridTable aria-label="Composed">
                        <tbody>
                            <tr>
                                <td>{instance.state.totalRows} rows</td>
                            </tr>
                        </tbody>
                    </GridTable>
                </GridwrightProvider>
            );
        }

        render(<Composed />);
        expect(screen.getByText('3 rows')).toBeInTheDocument();
    });

    it('ships every locale pack through its own entry point', () => {
        for (const catalog of [en, de, es, fr, pl]) {
            expect(typeof catalog.locale).toBe('string');
            expect(typeof catalog.messages['pagination.rowsPerPage']).toBe('string');
        }
    });

    it('renders a translated grid from the built bundles', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Row>
                columns={columns}
                data={rows}
                pageSize={2}
                searchable
                selectionMode="multiple"
                locale={pl}
            />,
        );

        expect(screen.getByText('Wierszy na stronie')).toBeInTheDocument();
        expect(screen.getByText('1-2 z 3')).toBeInTheDocument();

        // The plural form is the part a template string cannot do, so it is the part worth
        // proving survives the build.
        await user.click(screen.getAllByRole('checkbox', { name: 'Zaznacz wiersz' })[0]!);
        expect(screen.getByText('zaznaczono 1 wiersz')).toBeInTheDocument();
    });

    it('renders a tree from the built bundles and expands it', async () => {
        interface Item {
            id: string;
            name: string;
            children?: Item[];
        }

        const items: Item[] = [
            { id: 'a', name: 'Alpha', children: [{ id: 'a1', name: 'Alpha one' }] },
            { id: 'b', name: 'Bravo' },
        ];

        const user = userEvent.setup();
        render(
            <TreeGridwright<Item>
                columns={[{ id: 'name', header: 'Name' }]}
                data={items}
                getRowId={(row) => row.id}
                getChildren={(row) => row.children}
                pageSize={50}
                aria-label="Tree"
            />,
        );

        expect(screen.getAllByRole('row')).toHaveLength(3);
        await user.click(screen.getByRole('button', { name: 'Expand' }));
        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(4));
        expect(screen.getByText('Alpha one')).toBeInTheDocument();
    });

    it('exposes the nested set helpers through the core entry', () => {
        const index = buildTreeIndex(
            [{ id: 'root', children: [{ id: 'child' }] }] as { id: string; children?: { id: string }[] }[],
            {
                getRowId: (row) => row.id,
                getChildren: (row) => row.children,
            },
        );

        const root = index.byNodeId.get('root')!;
        const child = index.byNodeId.get('root/child')!;
        // The interval arithmetic is the point of the model, so it is what the smoke test checks.
        expect(root.left).toBeLessThan(child.left);
        expect(child.right).toBeLessThan(root.right);
    });

    it('renders the bubble menu from the built bundle', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        function Host() {
            const instance = useGridwright<Row>({ columns, data: rows, pageSize: 10 });
            return (
                <GridwrightProvider instance={instance}>
                    <BubbleMenu<Row>
                        aria-label="Actions"
                        items={[{ id: 'go', label: 'Go', onSelect }]}
                    />
                    <GridTable aria-label="Rows">
                        <tbody>
                            {instance.state.rows.map((row) => (
                                <tr key={String(row.id)} className="gw-row" data-row-id={String(row.id)}>
                                    <td>{row.data.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </GridTable>
                </GridwrightProvider>
            );
        }

        render(<Host />);
        await user.hover(screen.getAllByRole('row')[0]!);

        const menu = await screen.findByRole('menu', { name: 'Actions' });
        await user.click(within(menu).getByRole('menuitem', { name: 'Go' }));
        expect(onSelect).toHaveBeenCalled();
    });

    it('ships a stylesheet with themeable custom properties', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const css = fs.readFileSync(path.join(process.cwd(), 'dist/styles.css'), 'utf8');

        expect(css).toContain('--gw-accent');
        expect(css).toContain('.gw-table');
        expect(css).toContain('prefers-reduced-motion');
    });
});
