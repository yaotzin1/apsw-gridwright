import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createRemoteDataSource } from '../../src/data/remote';
import { Gridwright } from '../../src/react/Gridwright';
import { virtualColumns } from '../../src/react/virtual';
import type { GridAddon } from '../../src/react/addons/types';
import { loadingIndicator, Spinner } from '../../src/react/loading';
import { treeData } from '../../src/react/tree/addon';
import { skeletonLength, skeletonRowCount } from '../../src/react/loading/Skeleton';
import type { LoadingIndicatorOptions, SpinnerVariant } from '../../src/react/loading';
import type { Person } from '../fixtures';
import { deferred, people, personColumns } from '../fixtures';

type Page = { rows: readonly Person[]; totalRows: number };

function pending(addon?: GridAddon<Person>, extra: readonly GridAddon<Person>[] = []) {
    const gate = deferred<Page>();
    const dataSource = createRemoteDataSource<Person>({ fetcher: () => gate.promise, retry: { attempts: 0 } });
    const view = render(
        <Gridwright<Person>
            columns={personColumns}
            dataSource={dataSource}
            pageSize={3}
            aria-label="People"
            addons={addon ? [addon, ...extra] : extra}
        />,
    );
    return { gate, ...view };
}

const options = (extra: LoadingIndicatorOptions = {}) => loadingIndicator<Person>({ delay: 0, ...extra });
const grid = () => screen.getByRole('grid');
const spinner = (): Element | null => grid().querySelector('.gw-spinner');

describe('loadingIndicator(): the spinner', () => {
    it('changes nothing about a grid that does not list it (AC-01)', () => {
        pending();

        expect(spinner()).toBeNull();
        expect(within(grid()).getByText('Loading rows')).toBeInTheDocument();
    });

    it('draws a ring by default, hidden from assistive technology, beside the grid’s own text (AC-02, AC-14)', async () => {
        pending(options());

        await waitFor(() => expect(spinner()).not.toBeNull());
        expect(spinner()).toHaveAttribute('aria-hidden', 'true');
        expect(spinner()!.querySelector('.gw-spin-arc')).not.toBeNull();
        // The text is still in the table, and the live region still says it once.
        expect(within(grid()).getByText('Loading rows')).toBeInTheDocument();
        expect(screen.getAllByText('Loading rows')).toHaveLength(2);
    });

    it.each<[SpinnerVariant, string]>([
        ['ring', '.gw-spin-arc'],
        ['dot-walk', '.gw-spin-dot'],
        ['draw-g', '.gw-spin-draw'],
        ['cell-colors', '.gw-spin-cell--color'],
    ])('draws the %s spinner (AC-08)', async (name, selector) => {
        pending(options({ spinner: name }));

        await waitFor(() => expect(spinner()!.querySelector(selector)).not.toBeNull());
    });

    it('draws the mark’s nine cells in the grid-shaped spinners (AC-08)', async () => {
        pending(options({ spinner: 'cell-colors' }));

        await waitFor(() => expect(spinner()).not.toBeNull());
        expect(spinner()!.querySelectorAll('rect')).toHaveLength(9);
    });

    it('waits for the delay, so a fast response never shows one (AC-13)', async () => {
        const { gate } = pending(loadingIndicator<Person>({ delay: 60 }));

        expect(spinner()).toBeNull();
        await waitFor(() => expect(spinner()).not.toBeNull());
        gate.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await screen.findByText('Ada Lovelace');
        expect(spinner()).toBeNull();
    });

    it('shows nothing when the data arrives inside the delay (AC-13)', async () => {
        const { gate } = pending(loadingIndicator<Person>({ delay: 400 }));

        gate.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await screen.findByText('Ada Lovelace');
        expect(spinner()).toBeNull();
    });

    it('accepts a spinner of the consumer’s own and wraps it in the grid’s rules (AC-11a, AC-11c)', async () => {
        pending(options({ spinner: ({ className, color }) => <i data-testid="mine" className={className} data-color={color} /> }));

        const mine = await screen.findByTestId('mine');
        expect(mine.closest('.gw-spinner')).toHaveAttribute('aria-hidden', 'true');
        expect(mine).toHaveAttribute('data-color', 'currentColor');
    });

    it('lets the consumer draw the whole indicator with render (AC-20)', async () => {
        pending(options({ render: ({ status }) => <b data-testid="custom">{status}</b> }));

        expect((await screen.findByTestId('custom')).parentElement).toHaveAttribute('aria-hidden', 'true');
        expect(within(grid()).getByText('Loading rows')).toBeInTheDocument();
    });

    it('draws nothing with variant none (AC-02)', async () => {
        pending(options({ variant: 'none' }));

        expect(within(grid()).getByText('Loading rows')).toBeInTheDocument();
        expect(spinner()).toBeNull();
    });
});

describe('loadingIndicator(): the skeleton', () => {
    const skeletonRows = (): HTMLElement[] => Array.from(grid().querySelectorAll<HTMLElement>('.gw-skeleton-row'));

    it('draws rows with the table’s own columns, hidden from assistive technology (AC-04, AC-14)', async () => {
        pending(options({ variant: 'skeleton' }));

        await waitFor(() => expect(skeletonRows().length).toBeGreaterThan(0));
        // A page is three rows, so eight asked for is three drawn (AC-06).
        expect(skeletonRows()).toHaveLength(3);
        for (const row of skeletonRows()) {
            expect(row).toHaveAttribute('aria-hidden', 'true');
            expect(row.querySelectorAll('td')).toHaveLength(personColumns.length);
        }
        expect(grid().querySelector('tbody')).toHaveAttribute('aria-busy', 'true');
        expect(within(grid()).getByText('Loading rows')).toBeInTheDocument();
    });

    it('keeps the header while it loads, so the columns do not move (AC-04)', async () => {
        pending(options({ variant: 'skeleton' }));

        await waitFor(() => expect(skeletonRows().length).toBeGreaterThan(0));
        expect(within(grid()).getAllByRole('columnheader')).toHaveLength(personColumns.length);
    });

    it('draws the shape a column asks for (AC-07)', async () => {
        pending(options({ variant: 'skeleton', rows: 1, shapes: { name: 'avatar', department: 'badge', salary: 'none' } }));

        await waitFor(() => expect(skeletonRows()).toHaveLength(1));
        const row = skeletonRows()[0]!;
        expect(row.querySelector('[data-column-id="name"] .gw-skeleton--avatar')).not.toBeNull();
        expect(row.querySelector('[data-column-id="department"] .gw-skeleton--badge')).not.toBeNull();
        expect(row.querySelector('[data-column-id="salary"] .gw-skeleton')).toBeNull();
        expect(row.querySelector('[data-column-id="startedOn"] .gw-skeleton--text')).not.toBeNull();
    });

    it('is replaced by the rows when they arrive', async () => {
        const { gate } = pending(options({ variant: 'skeleton' }));
        await waitFor(() => expect(skeletonRows().length).toBeGreaterThan(0));

        gate.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await screen.findByText('Ada Lovelace');
        expect(skeletonRows()).toHaveLength(0);
    });

    it('counts rows within 1..50 and within a page (AC-04, AC-06)', () => {
        expect(skeletonRowCount(undefined, 100)).toBe(8);
        expect(skeletonRowCount(999, 100)).toBe(50);
        expect(skeletonRowCount(0, 100)).toBe(1);
        expect(skeletonRowCount(20, 5)).toBe(5);
        expect(skeletonRowCount(Number.NaN, 25)).toBe(8);
    });

    it('draws the same lengths on every render (AC-07, AC-19)', () => {
        expect(skeletonLength(2, 3)).toBe(skeletonLength(2, 3));
        const lengths = new Set(Array.from({ length: 8 }, (_, column) => skeletonLength(0, column)));
        expect(lengths.size).toBeGreaterThan(3);
    });
});

describe('loadingIndicator(): refreshing', () => {
    function refreshable(extra: LoadingIndicatorOptions) {
        const second = deferred<Page>();
        let calls = 0;
        const dataSource = createRemoteDataSource<Person>({
            retry: { attempts: 0 },
            fetcher: async () => {
                calls += 1;
                if (calls === 1) return { rows: people.slice(0, 3), totalRows: 7 };
                return second.promise;
            },
        });
        const refresh: GridAddon<Person> = {
            name: 'test:refresh',
            setup: () => ({
                toolbar: (context) => (
                    <button type="button" onClick={() => void context.api.refresh()}>
                        Reload
                    </button>
                ),
            }),
        };
        render(
            <Gridwright<Person>
                columns={personColumns}
                dataSource={dataSource}
                pageSize={3}
                aria-label="People"
                addons={[loadingIndicator<Person>({ delay: 0, ...extra }), refresh]}
            />,
        );
        return second;
    }

    it('shows a small spinner over the rows while they refresh, and keeps the rows (AC-12)', async () => {
        const user = userEvent.setup();
        const second = refreshable({ indicateRefresh: true });
        await screen.findByText('Ada Lovelace');
        expect(document.querySelector('.gw-refresh')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(document.querySelector('.gw-refresh .gw-spinner')).not.toBeNull());
        expect(document.querySelector('.gw-refresh')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

        second.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await waitFor(() => expect(document.querySelector('.gw-refresh')).toBeNull());
    });

    it('draws nothing on a refresh unless asked to (AC-12)', async () => {
        const user = userEvent.setup();
        refreshable({});
        await screen.findByText('Ada Lovelace');

        await user.click(screen.getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(document.querySelector('.gw-tbody')).toHaveAttribute('aria-busy', 'true'));
        expect(document.querySelector('.gw-refresh')).toBeNull();
    });
});

describe('loadingIndicator(): refreshVariant', () => {
    function refreshableWith(extra: LoadingIndicatorOptions) {
        const second = deferred<Page>();
        let calls = 0;
        const dataSource = createRemoteDataSource<Person>({
            retry: { attempts: 0 },
            fetcher: async () => {
                calls += 1;
                if (calls === 1) return { rows: people.slice(0, 3), totalRows: 7 };
                return second.promise;
            },
        });
        const reload: GridAddon<Person> = {
            name: 'test:reload',
            setup: () => ({
                toolbar: (context) => (
                    <button type="button" onClick={() => void context.api.refresh()}>
                        Reload
                    </button>
                ),
            }),
        };
        render(
            <Gridwright<Person>
                columns={personColumns}
                dataSource={dataSource}
                pageSize={3}
                aria-label="People"
                addons={[loadingIndicator<Person>({ delay: 0, ...extra }), reload]}
            />,
        );
        return second;
    }

    it('draws a centred spinner over the rows with refreshVariant "spinner", and keeps the rows', async () => {
        const user = userEvent.setup();
        const second = refreshableWith({ refreshVariant: 'spinner' });
        await screen.findByText('Ada Lovelace');

        await user.click(screen.getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(document.querySelector('.gw-refresh--centre .gw-spinner--md')).not.toBeNull());
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

        second.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await waitFor(() => expect(document.querySelector('.gw-refresh')).toBeNull());
    });

    it('swaps the rows for placeholders of the same number with refreshVariant "skeleton", then restores them', async () => {
        const user = userEvent.setup();
        const second = refreshableWith({ refreshVariant: 'skeleton' });
        await screen.findByText('Ada Lovelace');
        expect(document.querySelector('.gw-skeleton-row')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(document.querySelectorAll('.gw-skeleton-row')).toHaveLength(3));
        expect(screen.queryByText('Ada Lovelace')).toBeNull();
        expect(document.querySelector('.gw-tbody')).toHaveAttribute('aria-busy', 'true');

        second.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await screen.findByText('Ada Lovelace');
        expect(document.querySelector('.gw-skeleton-row')).toBeNull();
    });

    it('keeps the old rows until the delay has passed', async () => {
        const user = userEvent.setup();
        const second = refreshableWith({ refreshVariant: 'skeleton', delay: 400 });
        await screen.findByText('Ada Lovelace');

        await user.click(screen.getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(document.querySelector('.gw-tbody')).toHaveAttribute('aria-busy', 'true'));
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(document.querySelector('.gw-skeleton-row')).toBeNull();

        second.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await waitFor(() => expect(document.querySelector('.gw-tbody')).toHaveAttribute('aria-busy', 'false'));
        expect(document.querySelector('.gw-skeleton-row')).toBeNull();
    });

    it('draws nothing more on a refresh by default ("dim")', async () => {
        const user = userEvent.setup();
        refreshableWith({});
        await screen.findByText('Ada Lovelace');

        await user.click(screen.getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(document.querySelector('.gw-tbody')).toHaveAttribute('aria-busy', 'true'));
        expect(document.querySelector('.gw-refresh')).toBeNull();
        expect(document.querySelector('.gw-skeleton-row')).toBeNull();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });
});

describe('loadingIndicator(): expandVariant', () => {
    interface Folder {
        id: string;
        name: string;
    }
    const folderColumns = [{ id: 'name', header: 'Name', accessor: (row: Folder) => row.name }];

    function lazyTree(extra: LoadingIndicatorOptions) {
        const gate = deferred<Folder[]>();
        render(
            <Gridwright<Folder>
                columns={folderColumns}
                data={[{ id: 'folder', name: 'Folder' }]}
                pageSize={100}
                aria-label="Folders"
                addons={[
                    treeData<Folder>({ getRowId: (row) => row.id, hasChildren: () => true, loadChildren: () => gate.promise }),
                    loadingIndicator<Folder>({ delay: 0, ...extra }),
                ]}
            />,
        );
        return gate;
    }

    it('draws a spinner row under the node while its children load, then the children', async () => {
        const user = userEvent.setup();
        const gate = lazyTree({ expandVariant: 'spinner' });
        expect(document.querySelector('.gw-expand-loading')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Expand' }));
        await waitFor(() => expect(document.querySelector('.gw-expand-loading .gw-spinner')).not.toBeNull());

        gate.resolve([{ id: 'child', name: 'Loaded.txt' }]);
        await screen.findByText('Loaded.txt');
        expect(document.querySelector('.gw-expand-loading')).toBeNull();
    });

    it('draws placeholder rows, as many as expandRows says', async () => {
        const user = userEvent.setup();
        const gate = lazyTree({ expandVariant: 'skeleton', expandRows: 2 });

        await user.click(screen.getByRole('button', { name: 'Expand' }));
        await waitFor(() => expect(document.querySelectorAll('.gw-skeleton-row')).toHaveLength(2));

        gate.resolve([{ id: 'child', name: 'Loaded.txt' }]);
        await screen.findByText('Loaded.txt');
        expect(document.querySelector('.gw-skeleton-row')).toBeNull();
    });

    it('draws only the pulsing toggle by default', async () => {
        const user = userEvent.setup();
        const gate = lazyTree({});

        await user.click(screen.getByRole('button', { name: 'Expand' }));
        await waitFor(() => expect(document.querySelector('.gw-tree-toggle[data-loading="true"]')).not.toBeNull());
        expect(document.querySelector('.gw-expand-loading, .gw-skeleton-row')).toBeNull();

        gate.resolve([]);
    });

    it('does nothing in a grid that is not a tree', async () => {
        pending(options({ expandVariant: 'spinner' }));
        await waitFor(() => expect(spinner()).not.toBeNull());
        expect(document.querySelector('.gw-expand-loading')).toBeNull();
    });
});

describe('<Spinner />', () => {
    it('is an image with the name it was given (AC-10, AC-11)', () => {
        render(<Spinner label="Saving" />);

        expect(screen.getByRole('img', { name: 'Saving' })).toBeInTheDocument();
    });

    it('hides from assistive technology when decorative (AC-11)', () => {
        const { container } = render(<Spinner decorative variant="draw-g" size="lg" />);

        expect(screen.queryByRole('img')).toBeNull();
        expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('.gw-spinner--lg')).not.toBeNull();
    });

    it('needs a label unless decorative, as a type rule (AC-11)', () => {
        // @ts-expect-error a spinner with neither a label nor `decorative` has no name
        const nameless = <Spinner />;
        expect(nameless).toBeTruthy();
    });

    it('renders the same markup on the server (AC-19)', () => {
        const once = renderToString(<Spinner label="Loading" variant="cell-colors" />);

        expect(renderToString(<Spinner label="Loading" variant="cell-colors" />)).toBe(once);
        expect(once).toContain('role="img"');
        expect(once).not.toContain('Math.random');
    });

    it('uses elements only: no script, no foreign object, no external reference (AC-08a)', () => {
        for (const variant of ['ring', 'dot-walk', 'draw-g', 'cell-colors'] as const) {
            const html = renderToString(<Spinner decorative variant={variant} />);
            expect(html).not.toMatch(/<script|foreignObject|href=|xlink:/i);
        }
    });
});

describe('loadingIndicator(): the skeleton over a column window', () => {
    it('draws the mounted columns and one gap cell per run, not a cell per column (AC-05)', async () => {
        const wide = Array.from({ length: 500 }, (_, index) => ({ id: `c${index}`, header: `Column ${index}`, accessor: () => index, width: 160 }));
        const gate = deferred<{ rows: readonly number[][]; totalRows: number }>();
        const dataSource = createRemoteDataSource<number[]>({ fetcher: () => gate.promise, retry: { attempts: 0 } });
        render(
            <Gridwright<number[]>
                columns={wide}
                dataSource={dataSource}
                pageSize={3}
                aria-label="Wide"
                addons={[virtualColumns<number[]>(), loadingIndicator<number[]>({ variant: 'skeleton', delay: 0 })]}
            />,
        );

        await waitFor(() => expect(document.querySelector('.gw-skeleton-row')).not.toBeNull());
        const row = document.querySelector('.gw-skeleton-row')!;
        const header = screen.getByRole('grid').querySelector('thead tr')!;
        expect(row.children.length).toBeLessThan(100);
        expect(row.children.length).toBe(header.children.length);
        expect(row.querySelector('.gw-column-gap')).not.toBeNull();
    });
});
