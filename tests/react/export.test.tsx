import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { pl } from '../../src/locales/pl';
import type { ExportContext, ExportSerializer } from '../../src/react/export/types';
import type { DataSource } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

interface SavedFile {
    readonly name: string;
    readonly type: string;
    readonly content: string;
}

let saved: SavedFile[] = [];

/**
 * Captures what the browser would have been asked to save.
 *
 * jsdom has no object URLs and no downloads, and its Blob cannot be read back synchronously, so
 * the blob is stubbed to keep its own parts and the anchor's click is intercepted. What is
 * asserted is the file the grid produced, which is the part worth testing.
 */
beforeEach(() => {
    saved = [];
    const urls = new Map<string, { type: string; content: string }>();

    class CapturedBlob {
        readonly type: string;

        readonly content: string;

        constructor(parts: readonly string[], options?: { type?: string }) {
            this.type = options?.type ?? '';
            this.content = parts.join('');
        }
    }

    vi.stubGlobal('Blob', CapturedBlob);
    vi.stubGlobal('URL', {
        createObjectURL: (blob: CapturedBlob) => {
            const url = `blob:${urls.size}`;
            urls.set(url, { type: blob.type, content: blob.content });
            return url;
        },
        revokeObjectURL: () => undefined,
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        const file = urls.get(this.getAttribute('href') ?? '');
        if (file) saved.push({ name: this.download, type: file.type, content: file.content });
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Export' }));
    return screen.getByRole('menu', { name: 'Export' });
};

describe('<Gridwright export />', () => {
    it('renders a trigger that opens a menu of the formats it was given', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                export={{ formats: ['csv', 'excel', 'markdown', 'print'] }}
            />,
        );

        const trigger = screen.getByRole('button', { name: 'Export' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await openMenu(user);

        expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
            'Export as CSV',
            'Export as Excel',
            'Export as Markdown',
            'Print',
        ]);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('moves through the menu with the arrow keys and closes on Escape, focus back on the trigger', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} export={{ scope: 'all' }} />);

        await openMenu(user);
        expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();

        await user.keyboard('{ArrowDown}');
        expect(screen.getAllByRole('menuitem')[1]).toHaveFocus();

        await user.keyboard('{ArrowUp}{ArrowUp}');
        expect(screen.getAllByRole('menuitem')[2]).toHaveFocus();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus();
    });

    it('saves every matching row rather than the page on screen', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={2}
                export={{ formats: ['csv'], filename: 'people' }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

        await waitFor(() => expect(saved).toHaveLength(1));
        await waitFor(() => expect(saved[0]?.content).toContain('Ada Lovelace'));

        expect(saved[0]?.name).toBe('people.csv');
        expect(saved[0]?.type).toContain('text/csv');
        // Two rows are on screen. Every row is in the file.
        expect(saved[0]?.content.trim().split('\r\n')).toHaveLength(people.length + 1);
    });

    it('honours a page scope when that is what was asked for', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={2}
                export={{ formats: ['csv'], scope: 'page', filename: 'page' }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

        await waitFor(() => expect(saved[0]?.content).toContain('Ada Lovelace'));
        expect(saved[0]?.content.trim().split('\r\n')).toHaveLength(3);
    });

    it('announces the export through a live region and returns focus to the trigger', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} export={{ formats: ['csv'] }} />);

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

        await waitFor(() =>
            expect(screen.getAllByRole('status').map((node) => node.textContent)).toContain(
                'CSV export ready',
            ),
        );
        expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus();
    });

    it('refuses a fixed "all" the source cannot answer, in words for the reader, and tells the developer why', async () => {
        const user = userEvent.setup();
        const onError = vi.fn();
        const source: DataSource<Person> = {
            kind: 'test:paging',
            capabilities: { sort: true, filter: true, search: true, paginate: true },
            fetch: () => ({ rows: people.slice(0, 2), totalRows: people.length }),
        };

        render(
            <Gridwright<Person>
                columns={personColumns}
                dataSource={source}
                export={{ formats: ['csv'], scope: 'all', onError }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Only this page or the selected rows can be exported from here');
        // The developer message names internals, so it is not on screen, but it is not lost either.
        expect(alert).not.toHaveTextContent(/fetchAll|test:paging/);
        expect(String(onError.mock.calls[0]?.[0])).toMatch(/fetchAll/);
        expect(saved).toHaveLength(0);
    });

    describe('choosing the rows', () => {
        const pagingSource = (fetchAll?: boolean): DataSource<Person> => ({
            kind: 'test:paging',
            capabilities: { sort: true, filter: true, search: true, paginate: true },
            fetch: ({ query }) => {
                const { pageIndex, pageSize } = query.pagination;
                return { rows: people.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), totalRows: people.length };
            },
            ...(fetchAll ? { fetchAll: () => ({ rows: people }) } : {}),
        });

        const lines = (file: SavedFile | undefined) => file?.content.trim().split('\r\n') ?? [];

        it('offers every matching row, this page and the selection above the formats, starting on all', async () => {
            const user = userEvent.setup();
            render(
                <Gridwright<Person>
                    columns={personColumns}
                    data={people}
                    selectionMode="multiple"
                    export={{ formats: ['csv'] }}
                />,
            );

            await openMenu(user);
            const group = screen.getByRole('group', { name: 'Rows' });
            const radios = within(group).getAllByRole('menuitemradio');

            expect(radios.map((radio) => radio.textContent)).toEqual([
                'All matching rows',
                'This page',
                'Selected rows (none)',
            ]);
            expect(radios[0]).toHaveAttribute('aria-checked', 'true');
            expect(radios[2]).toHaveAttribute('aria-disabled', 'true');
            // Focus starts on the scope, which is the first decision in the menu.
            expect(radios[0]).toHaveFocus();
        });

        it('exports this page when the reader chooses it, and keeps the menu open while they do', async () => {
            const user = userEvent.setup();
            render(<Gridwright<Person> columns={personColumns} data={people} pageSize={2} export={{ formats: ['csv'] }} />);

            await openMenu(user);
            await user.click(screen.getByRole('menuitemradio', { name: 'This page' }));

            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(screen.getByRole('menuitemradio', { name: 'This page' })).toHaveAttribute('aria-checked', 'true');

            await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));
            await waitFor(() => expect(saved).toHaveLength(1));
            expect(lines(saved[0])).toHaveLength(3);
        });

        it('exports the selection, counting the rows it will write', async () => {
            const user = userEvent.setup();
            render(
                <Gridwright<Person>
                    columns={personColumns}
                    data={people}
                    selectionMode="multiple"
                    export={{ formats: ['csv'] }}
                />,
            );

            const [first, second] = screen.getAllByRole('checkbox', { name: 'Select row' });
            await user.click(first!);
            await user.click(second!);

            await openMenu(user);
            const selected = screen.getByRole('menuitemradio', { name: '2 selected rows' });
            expect(selected).not.toHaveAttribute('aria-disabled');
            await user.click(selected);
            await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

            await waitFor(() => expect(saved).toHaveLength(1));
            expect(lines(saved[0])).toHaveLength(3);
            expect(saved[0]?.content).toContain('Ada Lovelace');
        });

        it('does not draw a selection choice on a grid with no selection', async () => {
            const user = userEvent.setup();
            render(<Gridwright<Person> columns={personColumns} data={people} export={{ formats: ['csv'] }} />);

            await openMenu(user);
            expect(screen.getAllByRole('menuitemradio').map((radio) => radio.textContent)).toEqual([
                'All matching rows',
                'This page',
            ]);
        });

        it('says why all matching rows are off when the source pages without fetchAll, and chooses the page instead', async () => {
            const user = userEvent.setup();
            render(<Gridwright<Person> columns={personColumns} dataSource={pagingSource()} export={{ formats: ['csv'] }} />);

            await openMenu(user);
            const all = screen.getByRole('menuitemradio', { name: 'All matching rows' });

            expect(all).toHaveAttribute('aria-disabled', 'true');
            expect(all).toHaveAccessibleDescription('Only this page or the selected rows can be exported from here');
            expect(screen.getByRole('menuitemradio', { name: 'This page' })).toHaveAttribute('aria-checked', 'true');

            // Clicking the disabled item changes nothing.
            await user.click(all);
            expect(all).toHaveAttribute('aria-checked', 'false');

            await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));
            await waitFor(() => expect(saved).toHaveLength(1));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('offers all matching rows from a paging source that can hand them over', async () => {
            const user = userEvent.setup();
            render(
                <Gridwright<Person> columns={personColumns} dataSource={pagingSource(true)} pageSize={2} export={{ formats: ['csv'] }} />,
            );

            await openMenu(user);
            expect(screen.getByRole('menuitemradio', { name: 'All matching rows' })).toHaveAttribute('aria-checked', 'true');

            await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));
            await waitFor(() => expect(saved).toHaveLength(1));
            expect(lines(saved[0])).toHaveLength(people.length + 1);
        });

        it('hides the choice when the scope was fixed', async () => {
            const user = userEvent.setup();
            render(<Gridwright<Person> columns={personColumns} data={people} export={{ formats: ['csv'], scope: 'page' }} />);

            await openMenu(user);
            expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
            expect(screen.queryByRole('group')).not.toBeInTheDocument();
        });

        it('translates the choice and a failure', async () => {
            const user = userEvent.setup();
            const onError = vi.fn();
            render(
                <Gridwright<Person>
                    columns={personColumns}
                    data={people}
                    locale={pl}
                    selectionMode="multiple"
                    export={{ formats: ['csv'], serializers: { csv: () => Promise.reject(new Error('disk full')) }, onError }}
                />,
            );

            await user.click(screen.getByRole('button', { name: 'Eksportuj' }));
            expect(screen.getByRole('group', { name: 'Wiersze' })).toBeInTheDocument();
            expect(screen.getAllByRole('menuitemradio').map((radio) => radio.textContent)).toEqual([
                'Wszystkie pasujące wiersze',
                'Ta strona',
                'Zaznaczone wiersze (brak)',
            ]);

            await user.click(screen.getByRole('menuitem', { name: 'Eksportuj do CSV' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się przygotować eksportu CSV');
            expect(onError).toHaveBeenCalledWith(new Error('disk full'));
        });
    });

    it('builds a print document of every row instead of printing the page', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={2}
                export={{ formats: ['print'] }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Print' }));

        const frame = await waitFor(() => {
            const found = document.querySelector('iframe');
            expect(found).not.toBeNull();
            return found as HTMLIFrameElement;
        });

        expect(frame.srcdoc).toContain('Dorothy Vaughan');
        expect(frame.srcdoc).toContain('table-header-group');
        expect(saved).toHaveLength(0);
    });

    it('hands the rows to a serializer of your own and saves nothing when it returns nothing', async () => {
        const user = userEvent.setup();
        const serialize = vi.fn((_context: unknown) => undefined);

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                export={{ formats: ['csv'], serializers: { csv: serialize } }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

        await waitFor(() => expect(serialize).toHaveBeenCalledTimes(1));
        const context = serialize.mock.calls[0]![0] as ExportContext<Person>;

        expect(context.rows).toHaveLength(people.length);
        expect(context.table.columns.map((column) => column.id)).toEqual([
            'name',
            'department',
            'salary',
            'startedOn',
        ]);
        expect(context.scope).toBe('all');
        expect(saved).toHaveLength(0);
    });

    it('translates its labels from the catalogue', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                locale={pl}
                export={{ formats: ['csv', 'print'] }}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Eksportuj' }));

        expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
            'Eksportuj do CSV',
            'Drukuj',
        ]);
    });

    it('offers a format of your own beside the built-in ones, and hands it the rows', async () => {
        const user = userEvent.setup();
        const serialize = vi.fn<ExportSerializer<Person>>(({ rows }) => ({
            content: ['# Report', '', ...rows.map((row) => `- ${row.name}`)].join('\n'),
            mimeType: 'text/markdown',
            extension: '.report.md',
        }));

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={2}
                export={{
                    filename: 'monthly',
                    formats: [
                        'csv',
                        { id: 'acme:report', label: 'Monthly report', serialize },
                    ],
                }}
            />,
        );

        await openMenu(user);
        expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
            'Export as CSV',
            'Monthly report',
        ]);

        await user.click(screen.getByRole('menuitem', { name: 'Monthly report' }));

        await waitFor(() => expect(saved).toHaveLength(1));
        expect(serialize.mock.calls[0]![0].format).toBe('acme:report');
        expect(serialize.mock.calls[0]![0].rows).toHaveLength(people.length);
        expect(saved[0]?.name).toBe('monthly.report.md');
        expect(saved[0]?.content).toContain('# Report');
        expect(screen.getAllByRole('status').map((node) => node.textContent)).toContain(
            'Monthly report export ready',
        );
    });

    it('says so when a format nobody registered is asked for', async () => {
        const user = userEvent.setup();
        const onError = vi.fn();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                export={{ formats: [{ id: 'acme:typo', label: 'Report', serialize: undefined as never }], onError }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Report' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('The Report export could not be produced');
        expect(String(onError.mock.calls[0]?.[0])).toMatch(/acme:typo/);
        expect(saved).toHaveLength(0);
    });

    it('writes an unhandled failure to the console rather than swallowing it', async () => {
        const user = userEvent.setup();
        const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                export={{ formats: ['csv'], serializers: { csv: () => Promise.reject(new Error('disk full')) } }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

        await screen.findByRole('alert');
        expect(logged).toHaveBeenCalledWith(new Error('disk full'));
    });

    it('leaves out a column that opted out of exporting', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={[...personColumns, { id: 'active', header: 'Active', exportable: false }]}
                data={people}
                export={{ formats: ['csv'], filename: 'subset' }}
            />,
        );

        await openMenu(user);
        await user.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));

        await waitFor(() => expect(saved[0]?.content).toContain('Name'));
        expect(saved[0]?.content).not.toContain('Active');
    });
});
