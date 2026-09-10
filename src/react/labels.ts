import type { GridwrightLabels } from './types';

/**
 * Defaults for every visible string.
 *
 * They live in one exported object so a consumer can translate the grid by passing `labels`,
 * without forking a component to reach a string buried in JSX. `pageRange` is a function because
 * word order around numbers differs by language and a template split into fragments cannot be
 * translated correctly.
 */
export const defaultLabels: GridwrightLabels = {
    searchPlaceholder: 'Search',
    searchAriaLabel: 'Search rows',
    loading: 'Loading rows',
    empty: 'No rows to show',
    errorTitle: 'The rows could not be loaded',
    retry: 'Try again',
    selectRow: 'Select row',
    selectAll: 'Select all rows on this page',
    selectedCount: (count) => `${count} selected`,
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    clearSort: 'Clear sort',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    rowsPerPage: 'Rows per page',
    pageRange: (from, to, total, exact) =>
        exact ? `${from}-${to} of ${total}` : `${from}-${to} of many`,
};

export function mergeLabels(overrides?: Partial<GridwrightLabels>): GridwrightLabels {
    return overrides ? { ...defaultLabels, ...overrides } : defaultLabels;
}
