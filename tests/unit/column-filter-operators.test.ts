import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { matchesFilter } from '../../src/core/values';
import { createLocalDataSource } from '../../src/data/local';
import { COLUMN_FILTER_OPERATORS, draftFrom, operatorsFor, specFrom } from '../../src/react/filters/operators';
import type { ColumnFilterOptions } from '../../src/react/filters/types';
import type { FilterOperator } from '../../src/core/types';
import { englishMessages } from '../../src/i18n/messages';
import { defaultLabels } from '../../src/react/labels';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const draft = (operator: FilterOperator, value = '', to = '', picked: number[] = []) => ({
    operator,
    value,
    to,
    picked,
});

describe('the conditions a column offers', () => {
    it('offers only operators the core already defines and names', () => {
        for (const operators of Object.values(COLUMN_FILTER_OPERATORS)) {
            for (const operator of operators) {
                // A condition without a message would render its id; one the core did not know would
                // keep every row. The label lookup covers the first, matchesFilter the second.
                expect(defaultLabels.filterOperator(operator, 'text')).not.toContain('filter.op');
                expect(() => matchesFilter('x', { columnId: 'c', operator, value: 'x' })).not.toThrow();
            }
        }
    });

    it('defaults to text, and lets a column narrow and reorder the list', () => {
        expect(operatorsFor(undefined)).toEqual(COLUMN_FILTER_OPERATORS.text);
        expect(operatorsFor({ type: 'number' })).toEqual(COLUMN_FILTER_OPERATORS.number);
        expect(operatorsFor({ type: 'number', operators: ['gte', 'lte'] })).toEqual(['gte', 'lte']);
        // An empty list is a mistake, not a request for a filter with no conditions.
        expect(operatorsFor({ type: 'date', operators: [] })).toEqual(COLUMN_FILTER_OPERATORS.date);
    });

    it('names the same operator differently on a date', () => {
        expect(defaultLabels.filterOperator('gt', 'number')).toBe(englishMessages['filter.op.gt']);
        expect(defaultLabels.filterOperator('gt', 'date')).toBe('After');
        expect(defaultLabels.filterOperator('lt', 'date')).toBe('Before');
        expect(defaultLabels.filterOperator('eq', 'date')).toBe('On');
    });
});

describe('a draft becomes a filter only when it is complete', () => {
    it('sends text as typed, and nothing for a blank', () => {
        expect(specFrom(draft('contains', 'Ada'), undefined)).toEqual({ operator: 'contains', value: 'Ada' });
        expect(specFrom(draft('contains', '   '), undefined)).toBeNull();
    });

    it('sends numbers as numbers, and nothing for one that does not parse', () => {
        const number: ColumnFilterOptions = { type: 'number' };
        expect(specFrom(draft('gt', '100000'), number)).toEqual({ operator: 'gt', value: 100000 });
        expect(specFrom(draft('gt', '1e'), number)).toBeNull();
        expect(specFrom(draft('between', '10', '20'), number)).toEqual({ operator: 'between', value: [10, 20] });
        expect(specFrom(draft('between', '10', ''), number)).toBeNull();
    });

    it('keeps dates as ISO strings, which survive JSON and compare as timestamps', () => {
        const date: ColumnFilterOptions = { type: 'date' };
        expect(specFrom(draft('lt', '2020-01-01'), date)).toEqual({ operator: 'lt', value: '2020-01-01' });
        expect(JSON.parse(JSON.stringify(specFrom(draft('between', '2019-01-01', '2020-12-31'), date)))).toEqual({
            operator: 'between',
            value: ['2019-01-01', '2020-12-31'],
        });
    });

    it('sends the chosen values of a select, whatever their type, and nothing when none is ticked', () => {
        const status: ColumnFilterOptions = {
            type: 'select',
            choices: [
                { value: true, label: 'Active' },
                { value: false, label: 'Inactive' },
            ],
        };
        expect(specFrom(draft('in', '', '', [1]), status)).toEqual({ operator: 'in', value: [false] });
        expect(specFrom(draft('in'), status)).toBeNull();
    });

    it('needs no value to ask for an empty cell', () => {
        expect(specFrom(draft('isEmpty'), { type: 'number' })).toEqual({ operator: 'isEmpty' });
    });
});

describe('a dialog opens on the filter already there', () => {
    const status: ColumnFilterOptions = {
        type: 'select',
        choices: [
            { value: 'Engineering', label: 'Engineering' },
            { value: 'Research', label: 'Research' },
        ],
    };

    it('round-trips every kind of value', () => {
        const cases: [ColumnFilterOptions | undefined, FilterOperator, unknown][] = [
            [undefined, 'startsWith', 'Gr'],
            [{ type: 'number' }, 'between', [95000, 120000]],
            [{ type: 'date' }, 'gt', '2019-01-01'],
            [status, 'notIn', ['Research']],
            [{ type: 'number' }, 'isNotEmpty', undefined],
        ];

        for (const [options, operator, value] of cases) {
            const spec = { columnId: 'c', operator, ...(value === undefined ? {} : { value }) };
            expect(specFrom(draftFrom(spec, options), options)).toEqual({ operator, ...(value === undefined ? {} : { value }) });
        }
    });

    it('starts blank rather than rewriting a filter on a condition the column does not offer', () => {
        const opened = draftFrom({ columnId: 'c', operator: 'endsWith', value: 'x' }, { type: 'number' });
        expect(opened).toEqual(draft('eq'));
    });
});

describe('what the controls rely on in the engine, unchanged', () => {
    const grid = () =>
        createGridEngine<Person>({
            columns: personColumns,
            dataSource: createLocalDataSource(people),
            initialQuery: { pagination: { pageIndex: 0, pageSize: 2 } },
        });
    const ready = (api: ReturnType<typeof grid>) => vi.waitFor(() => expect(api.getState().status).toBe('ready'));
    const names = (api: ReturnType<typeof grid>) => api.getMatchingRows().rows.map((row) => row.name);

    it('filters on exactly what the dialog sends, for every type', async () => {
        const api = grid();
        await ready(api);

        api.setFilter('salary', specFrom(draft('between', '100000', '125000'), { type: 'number' }));
        expect(names(api)).toEqual(['Ada Lovelace', 'Katherine Johnson', 'Dorothy Vaughan']);

        api.setFilter('salary', null);
        api.setFilter('startedOn', specFrom(draft('lt', '2018-01-01'), { type: 'date' }));
        expect(names(api)).toEqual(['Grace Hopper', 'Evelyn Boyd']);

        api.setFilter('startedOn', null);
        api.setFilter(
            'department',
            specFrom(draft('in', '', '', [0, 1]), {
                type: 'select',
                choices: [
                    { value: 'Operations', label: 'Operations' },
                    { value: 'Research', label: 'Research' },
                ],
            }),
        );
        expect(names(api)).toHaveLength(5);
        api.destroy();
    });

    it('returns to the first page when a filter changes', async () => {
        const api = grid();
        await ready(api);

        api.setPage(2);
        expect(api.getState().query.pagination.pageIndex).toBe(2);

        api.setFilter('name', { operator: 'contains', value: 'a' });
        expect(api.getState().query.pagination.pageIndex).toBe(0);
        api.destroy();
    });
});
