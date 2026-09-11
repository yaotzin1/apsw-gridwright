import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Deliberately the package specifiers, resolved to `dist/` by vitest.smoke.config.ts. Nothing in
// this file may reach into `src/`: the point of a smoke suite is to exercise the artifact a
// consumer installs, including its export map, its bundling and its type entry points.
import {
    buildExportTable,
    buildTreeIndex,
    corePlugins,
    createGridEngine,
    createLocalDataSource,
    createRemoteDataSource,
    createRestDataSource,
    formatCsv,
    formatExcelXml,
    formatMarkdownDocument,
    formatMarkdownTable,
    formatMarkdownTemplate,
    formatPrintHtml,
    markdownToHtml,
    GridwrightError,
    STAGE_ORDER,
    VERSION,
} from 'apsw-gridwright';
import {
    BubbleMenu,
    defaultLabels,
    GridExportMenu,
    useGridExport,
    GridStaleNotice,
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

    it('announces its state through the built bundle, in every shipped locale', async () => {
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={2} aria-label="Rows" />);

        // The live region is part of the artifact, not of the source tree. A build that tree-shook
        // the announcement away would leave every unit test green.
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Showing 1 to 2 of 3'));

        // The three announcement labels resolve through the export map and are translated.
        expect(typeof defaultLabels.sortAnnouncement).toBe('function');
        expect(defaultLabels.sortAnnouncement('Score', 'asc')).toBe('Score, sorted ascending');
        expect(defaultLabels.rowsShown(1, 2, 3, false)).toContain('many');

        for (const catalog of [en, de, es, fr, pl]) {
            expect(catalog.messages['a11y.sortedAscending']).toBeTruthy();
            expect(catalog.messages['a11y.rowsTotal']).toBeTruthy();
        }
    });

    it('numbers its rows for assistive technology in the built bundle', () => {
        render(<Gridwright<Row> columns={columns} data={rows} pageSize={2} aria-label="Rows" />);

        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '4');
        expect(screen.getAllByRole('row')[0]).toHaveAttribute('aria-rowindex', '1');
        expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-rowindex', '2');
    });

    it('warns through the built bundle when a refresh fails over rows on screen', async () => {
        let failing = false;
        const source = createRemoteDataSource<Row>({
            fetcher: async () => {
                if (failing) throw new Error('the server said no');
                return { rows, totalRows: rows.length };
            },
            retry: { attempts: 0 },
        });

        const user = userEvent.setup();
        render(<Gridwright<Row> columns={columns} dataSource={source} pageSize={10} aria-label="Rows" />);
        await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

        failing = true;
        await user.click(screen.getByRole('button', { name: /Score/ }));

        // A grid that goes on showing stale rows without saying so is the failure this guards.
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('The rows could not be updated');
        expect(screen.getByText('Alpha')).toBeInTheDocument();

        expect(typeof GridStaleNotice).toBe('function');
    });

    it('serializes rows through the built core entry, with no browser in reach', () => {
        const engine = createGridEngine<Row>({ columns, dataSource: createLocalDataSource(rows) });
        const table = buildExportTable({ rows, columns: engine.getColumns() });

        expect(formatCsv(table, { bom: false })).toBe(
            ['Name,Score', 'Alpha,30', 'Bravo,10', 'Charlie,20'].join('\r\n'),
        );
        expect(formatMarkdownTable(table)).toContain('| :--- | :--- |');
        expect(formatExcelXml(table)).toContain('<Data ss:Type="Number">30</Data>');
        expect(formatPrintHtml(table)).toContain('table-header-group');
        engine.destroy();
    });

    it('answers for rows beyond the page through the built engine', async () => {
        const engine = createGridEngine<Row>({
            columns,
            dataSource: createLocalDataSource(rows),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 1 } },
        });
        await vi.waitFor(() => expect(engine.getState().status).toBe('ready'));

        expect(engine.getState().rows).toHaveLength(1);
        expect(engine.getMatchingRows()).toEqual({ rows, isComplete: true });
        await expect(engine.fetchAllRows()).resolves.toHaveLength(3);
        engine.destroy();
    });

    it('renders the export menu from the built react bundle', async () => {
        const user = userEvent.setup();
        expect(typeof useGridExport).toBe('function');
        expect(typeof GridExportMenu).toBe('function');

        render(<Gridwright<Row> columns={columns} data={rows} export={{ formats: ['csv', 'print'] }} />);

        await user.click(screen.getByRole('button', { name: 'Export' }));

        expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
            'Export as CSV',
            'Print',
        ]);
        expect(defaultLabels.exportAction).toBe('Export');
    });

    it('builds a Markdown report and renders it through the built core entry', () => {
        const engine = createGridEngine<Row>({ columns, dataSource: createLocalDataSource(rows) });

        const report = formatMarkdownTemplate({
            rows,
            columns: engine.getColumns(),
            header: (covered) => `# ${covered.length} records`,
            template: '- **{name}**: {score}',
        });

        expect(report.startsWith('# 3 records')).toBe(true);

        const html = markdownToHtml(report);
        expect(html).toContain('<h1>3 records</h1>');
        expect(html).toContain('<strong>Alpha</strong>');

        const document = formatMarkdownDocument(report, { title: 'Records' });
        expect(document).toContain('<title>Records</title>');
        expect(document).toContain('break-inside: avoid');
        engine.destroy();
    });

    it('offers a format of its own in the menu from the built react bundle', async () => {
        const user = userEvent.setup();
        const serialize = vi.fn(() => undefined);

        render(
            <Gridwright<Row>
                columns={columns}
                data={rows}
                export={{ formats: [{ id: 'acme:report', label: 'Monthly report', serialize }] }}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Export' }));
        await user.click(screen.getByRole('menuitem', { name: 'Monthly report' }));

        await vi.waitFor(() => expect(serialize).toHaveBeenCalledTimes(1));
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
