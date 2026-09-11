import { describe, expect, it } from 'vitest';
import { announcementFor } from '../../src/react/a11y/announcement';
import { rowNumbering } from '../../src/react/a11y/rows';
import type { AnnouncementInput } from '../../src/react/a11y/types';
import { defaultLabels } from '../../src/react/labels';
import { GridwrightError } from '../../src/core/errors';

const input = (overrides: Partial<AnnouncementInput> = {}): AnnouncementInput => ({
    status: 'ready',
    error: null,
    rowCount: 25,
    totalRows: 200,
    isTotalExact: true,
    firstRowIndex: 0,
    paginated: true,
    sortChange: null,
    labels: defaultLabels,
    ...overrides,
});

describe('ARIA row numbering', () => {
    it('counts the header row, because the row indices do', () => {
        // The two have to agree. They did not: the count excluded the header and the virtual body's
        // first row claimed index 1, which is the index the header occupies.
        const numbering = rowNumbering(200, true);

        expect(numbering.rowCount).toBe(201);
        expect(numbering.indexOf(0)).toBe(2);
        expect(numbering.indexOf(199)).toBe(201);
    });

    it('refuses to state a count the source never sent', () => {
        // -1 is the ARIA value for "not known". A number computed from one page would be a number
        // the reader acts on, and it would be wrong.
        expect(rowNumbering(25, false).rowCount).toBe(-1);
    });

    it('numbers a row by its place in the result, not in the page', () => {
        const numbering = rowNumbering(200, true);

        // Page two of a twenty-five row page: the first row on screen is row 26 of 200.
        expect(numbering.indexOf(25)).toBe(27);
    });
});

describe('the grid announcement', () => {
    it('says the range and the total when the result settles', () => {
        expect(announcementFor(input())).toBe('Showing 1 to 25 of 200');
    });

    it('counts from the first row of the page, not the first row of the result', () => {
        expect(announcementFor(input({ firstRowIndex: 25 }))).toBe('Showing 26 to 50 of 200');
    });

    it('never invents a total a paginating source withheld', () => {
        // The source said there is another page and nothing more. "of many" is the whole truth.
        const message = announcementFor(input({ isTotalExact: false, totalRows: 25 }));

        expect(message).toBe('Showing 1 to 25 of many');
        expect(message).not.toContain('25 of 25');
    });

    it('gives a virtualized grid the total rather than the window it happens to be over', () => {
        // The rows in the DOM are where the scrollbar is, which is not a fact about the result.
        expect(announcementFor(input({ paginated: false, totalRows: 10_000 }))).toBe('10,000 rows');
    });

    it('holds the loading label while a fetch is in flight', () => {
        expect(announcementFor(input({ status: 'loading' }))).toBe('Loading rows');
        expect(announcementFor(input({ status: 'refreshing' }))).toBe('Loading rows');
    });

    it('stays silent on failure, because an alert is already announcing it', () => {
        // With rows left, `GridStaleNotice` renders the banner; with none, the body renders the
        // full error state. Both carry `role="alert"`, so saying it here too is one failure
        // announced twice.
        const withRows = input({
            status: 'error',
            error: new GridwrightError('the server said no'),
            rowCount: 25,
        });
        const withoutRows = input({ ...withRows, rowCount: 0, totalRows: 0 });

        expect(announcementFor(withRows)).toBe('');
        expect(announcementFor({ ...withoutRows, status: 'error' })).toBe('');
    });

    it('puts a sort the reader just caused ahead of a row count they did not ask for', () => {
        const sorted = input({ sortChange: { columnHeader: 'Salary', direction: 'asc' } });

        expect(announcementFor(sorted)).toBe('Salary, sorted ascending');
    });

    it('says so when a sort is cleared', () => {
        const cleared = input({ sortChange: { columnHeader: 'Salary', direction: null } });

        expect(announcementFor(cleared)).toBe('Salary, not sorted');
    });

    it('reports an empty result as empty rather than as a range of nothing', () => {
        expect(announcementFor(input({ rowCount: 0, totalRows: 0 }))).toBe('No rows to show');
    });

    it('carries one sentence and never the rows themselves', () => {
        // The constraint that makes a live region usable: it is read out in full on every change.
        const message = announcementFor(input());

        expect(message.split('.').filter(Boolean)).toHaveLength(1);
        expect(message).not.toContain('Ada');
    });
});
