import { describe, expect, it } from 'vitest';
import { mockApi } from '../../examples/playground/mock-api.js';

const call = async (query: string, method = 'GET', text = '') => {
    const url = new URL(`http://playground.test${query}`);
    return mockApi.handle({ method, pathname: url.pathname, searchParams: url.searchParams, text });
};

const salaries = async (query: string) => {
    const result = await call(query);
    return (JSON.parse(result!.body).data as { salary: number }[]).map((row) => row.salary);
};

describe('the playground mock API, shared by the Node server and the hosted demo', () => {
    it('sorts only when the source says the server sorts', async () => {
        const sorted = await salaries('/api/people?serverDoes=sort,paginate&sort=salary:desc&pageSize=10');
        const unsorted = await salaries('/api/people?serverDoes=paginate&sort=salary:desc&pageSize=10');

        expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
        expect(unsorted).not.toEqual([...unsorted].sort((a, b) => b - a));
    });

    it('returns one page when it paginates and omits the total on request', async () => {
        const page = JSON.parse((await call('/api/people?serverDoes=paginate&pageSize=7&withTotal=false'))!.body);

        expect(page.data).toHaveLength(7);
        expect(page).not.toHaveProperty('total');
    });

    it('answers a range of the ten-million-row table', async () => {
        const range = JSON.parse((await call('/api/people/range?offset=9999998&limit=10'))!.body);

        expect(range.total).toBe(10_000_000);
        expect(range.data).toHaveLength(2);
    });

    it('refuses an empty edit and a body that is not JSON', async () => {
        expect((await call('/api/people/edit', 'POST', '{"rowId":1,"columnId":"name","value":" "}'))!.status).toBe(422);
        expect((await call('/api/people/edit', 'POST', 'not json'))!.status).toBe(400);
    });

    it('renders a report with the formatter it is given, and leaves other paths alone', async () => {
        const url = new URL('http://playground.test/api/reports');
        const rendered = await mockApi.handle({
            method: 'POST',
            pathname: url.pathname,
            searchParams: url.searchParams,
            text: '# Report',
            formatMarkdownDocument: (markdown: string) => `<h1>${markdown}</h1>`,
        });

        expect(rendered!.status).toBe(200);
        expect(await call('/api/unknown')).toBeNull();
    });
});
