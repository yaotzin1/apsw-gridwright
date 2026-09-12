import type { ReactNode } from 'react';
import type { FilterOperator } from '../../core/types';

/**
 * What a column holds, which decides the conditions and the input its filter offers.
 *
 * Declared rather than inferred. A type guessed from the rows on one page is a guess the reader
 * would act on, and a column of numbers that happens to hold one blank would be guessed wrong.
 */
export type ColumnFilterType = 'text' | 'number' | 'date' | 'select';

/** One value a `select` column can be filtered to. */
export interface ColumnFilterChoice {
    /** What the filter sends: compared with the row's value, and sent to a server verbatim. */
    readonly value: unknown;
    /**
     * What the reader sees. Not a message key: a choice only you define is a string only you can
     * translate, so pass it already translated.
     */
    readonly label: string;
}

/** How a column is filtered from its header. Read only when column filters are switched on. */
export interface ColumnFilterOptions {
    /** Default `text`. */
    readonly type?: ColumnFilterType;
    /** The values a `select` column offers. Ignored by the other types. */
    readonly choices?: readonly ColumnFilterChoice[];
    /**
     * Narrows or reorders the conditions, from the core's `FilterOperator` vocabulary. The first is
     * the one a new filter starts on. Default: `COLUMN_FILTER_OPERATORS[type]`.
     */
    readonly operators?: readonly FilterOperator[];
}

export interface ColumnFilterProviderProps {
    readonly children: ReactNode;
}

export interface ColumnFilterTriggerProps {
    readonly columnId: string;
    readonly className?: string;
}

export interface GridFilterClearProps {
    readonly className?: string;
}
