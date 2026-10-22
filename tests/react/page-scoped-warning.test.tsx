import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteDataSource } from '../../src/data/remote';
import { Gridwright } from '../../src/react/Gridwright';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const onlyPages = () =>
    createRemoteDataSource<Person>({
        capabilities: { sort: false, filter: false, search: false, paginate: true },
        fetcher: async ({ query }) => {
            const start = query.pagination.pageIndex * query.pagination.pageSize;
            return { rows: people.slice(start, start + query.pagination.pageSize), totalRows: people.length };
        },
    });

const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

const warned = (spy: ReturnType<typeof quiet>): string[] =>
    spy.mock.calls.map((call: unknown[]) => String(call[0])).filter((text: string) => text.includes('applied to the'));

afterEach(() => vi.restoreAllMocks());

describe('the page-scoped warning through the component', () => {
    it('warns when the reader clicks a header on a source that only pages', async () => {
        const user = userEvent.setup();
        const warn = quiet();
        render(<Gridwright<Person> columns={personColumns} dataSource={onlyPages()} pageSize={3} aria-label="People" />);
        await screen.findByText('Ada Lovelace');
        expect(warned(warn)).toEqual([]);

        await user.click(screen.getByRole('button', { name: /Salary/ }));

        await waitFor(() => expect(warned(warn)).toHaveLength(1));
        expect(warned(warn)[0]).toContain('sorting is applied to the 3 rows of the page received');
    });

    it('is silent with warnOnPageScopedQuery={false}, and still sorts the page', async () => {
        const user = userEvent.setup();
        const warn = quiet();
        render(
            <Gridwright<Person> columns={personColumns} dataSource={onlyPages()} pageSize={3} warnOnPageScopedQuery={false} aria-label="People" />,
        );
        await screen.findByText('Ada Lovelace');

        await user.click(screen.getByRole('button', { name: /Salary/ }));

        await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('Katherine Johnson'));
        expect(warned(warn)).toEqual([]);
    });

    it('does not warn for an array', async () => {
        const user = userEvent.setup();
        const warn = quiet();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        await user.click(screen.getByRole('button', { name: /Salary/ }));

        expect(warned(warn)).toEqual([]);
    });
});
