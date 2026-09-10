import { describe, expect, it } from 'vitest';
import { findColumn, resolveColumns, visibleColumns } from '../../src/core/columns';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

const first = people[0]!;

describe('resolveColumns', () => {
    it('reads a value by the column id when no accessor is given', () => {
        const [column] = resolveColumns<Person>([{ id: 'name' }]);
        expect(column!.getValue(first)).toBe('Ada Lovelace');
    });

    it('reads a value through a key accessor', () => {
        const [column] = resolveColumns<Person>([{ id: 'label', accessor: 'department' }]);
        expect(column!.getValue(first)).toBe('Engineering');
    });

    it('reads a value through a function accessor', () => {
        const [column] = resolveColumns<Person>([
            { id: 'initials', accessor: (row) => row.name.split(' ').map((part) => part[0]).join('') },
        ]);
        expect(column!.getValue(first)).toBe('AL');
    });

    it('defaults sortable, filterable, searchable to true and hidden to false', () => {
        const [column] = resolveColumns<Person>([{ id: 'name' }]);
        expect(column).toMatchObject({ sortable: true, filterable: true, searchable: true, hidden: false });
    });

    it('uses the id as the header when no header is given', () => {
        const [column] = resolveColumns<Person>([{ id: 'department' }]);
        expect(column!.header).toBe('department');
    });

    it('routes getText through formatValue so search sees what the reader sees', () => {
        const [column] = resolveColumns<Person>([
            { id: 'salary', formatValue: (value) => `$${Number(value).toLocaleString('en-US')}` },
        ]);
        expect(column!.getText(first)).toBe('$120,000');
    });

    it('rejects a duplicate column id', () => {
        // Two columns with one id make sort and filter state ambiguous, and the resulting bug
        // shows up as a filter applying to the wrong column.
        expect(() => resolveColumns<Person>([{ id: 'name' }, { id: 'name' }])).toThrow(/duplicate column id/i);
    });

    it('rejects a column with no id', () => {
        expect(() => resolveColumns<Person>([{ id: '' }])).toThrow(/has no id/i);
    });
});

describe('column helpers', () => {
    const columns = resolveColumns<Person>([{ id: 'name' }, { id: 'department', hidden: true }]);

    it('finds a column by id', () => {
        expect(findColumn(columns, 'department')?.hidden).toBe(true);
        expect(findColumn(columns, 'missing')).toBeUndefined();
    });

    it('omits hidden columns from the visible set', () => {
        expect(visibleColumns(columns).map((column) => column.id)).toEqual(['name']);
    });
});
