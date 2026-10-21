import { describe, expect, it } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { runPipeline } from '../../src/core/pipeline';
import { createQuery, DEFAULT_PAGE_SIZE, normalizeQuery } from '../../src/core/query';
import { compareValues, toText } from '../../src/core/values';
import { createLocalDataSource } from '../../src/data/local';
import type { DataSource, DataSourceResult, PipelineStage } from '../../src/core/types';
import type { Person } from '../fixtures';
import { deferred, people, personColumns } from '../fixtures';

describe('values that used to give the sort an undefined order', () => {
    it('orders infinities instead of returning NaN', () => {
        expect(compareValues(Infinity, Infinity)).toBe(0);
        expect(compareValues(-Infinity, Infinity)).toBe(-1);
        expect(compareValues(Infinity, 5)).toBe(1);
    });

    it('ranks an invalid Date like a blank, and does not throw in toText', () => {
        const bad = new Date('nope');
        const good = new Date('2020-01-01');
        expect(compareValues(bad, bad)).toBe(0);
        expect(compareValues(bad, good)).toBeGreaterThan(0);
        expect(compareValues(good, bad)).toBeLessThan(0);
        expect(toText(bad)).toBe('');
    });
});

describe('page size normalisation', () => {
    it('treats every unusable size the same way', () => {
        for (const pageSize of [0, -5, NaN, Infinity]) {
            const q = normalizeQuery(createQuery({ pagination: { pageIndex: 0, pageSize } }));
            expect(q.pagination.pageSize).toBe(DEFAULT_PAGE_SIZE);
        }
    });
});

describe('a stage that returns a malformed structured result', () => {
    it('loses its own effect and reports the error', () => {
        const bad: PipelineStage<Person> = {
            id: 'bad',
            order: 10,
            run: () => ({ rows: undefined as unknown as Person[] }),
        };
        const next: PipelineStage<Person> = { id: 'next', order: 20, run: (rows) => rows.slice(0, 1) };
        const errors: string[] = [];
        const result = runPipeline<Person>({
            stages: [bad, next],
            rows: people,
            context: { query: createQuery(), columns: [], capabilities: { sort: false, filter: false, search: false, paginate: false }, totalRows: people.length },
            onStageError: (id) => errors.push(id),
        });
        expect(errors).toEqual(['bad']);
        expect(result.rows).toHaveLength(1);
    });
});

describe('engine caches', () => {
    it('forgets the old source rows when the source is replaced', async () => {
        const settle = deferred<DataSourceResult<Person>>();
        const slow: DataSource<Person> = {
            kind: 'slow',
            capabilities: { sort: false, filter: false, search: false, paginate: false },
            fetch: () => settle.promise,
        };
        const engine = createGridEngine<Person>({ columns: personColumns, dataSource: createLocalDataSource<Person>(people) });
        await new Promise((r) => setTimeout(r, 0));
        expect(engine.getMatchingRows().rows.length).toBe(people.length);
        engine.setDataSource(slow);
        expect(engine.getMatchingRows().rows).toHaveLength(0);
        engine.destroy();
        settle.resolve({ rows: [] });
    });

    it('shapes cached rows against the query they were fetched for', async () => {
        const engine = createGridEngine<Person>({ columns: personColumns, dataSource: createLocalDataSource<Person>(people) });
        await new Promise((r) => setTimeout(r, 0));
        const before = engine.getMatchingRows().rows.length;
        engine.setQuery({ search: 'zzzz-no-match' });
        // Whatever the debounce state, the rows handed out must agree with the query they answer.
        const during = engine.getMatchingRows().rows.length;
        await new Promise((r) => setTimeout(r, 0));
        expect(during === before || during === 0).toBe(true);
        expect(engine.getMatchingRows().rows).toHaveLength(0);
        engine.destroy();
    });

    it('removes a plugin\'s meta keys when the plugin is removed', () => {
        const engine = createGridEngine<Person>({ columns: personColumns, dataSource: createLocalDataSource<Person>(people) });
        const remove = engine.use({
            name: 'probe',
            setup: ({ setMeta }) => {
                setMeta('k', 1);
            },
        });
        expect(engine.getState().meta['probe:k']).toBe(1);
        remove();
        expect(engine.getState().meta).not.toHaveProperty('probe:k');
        engine.destroy();
    });
});
