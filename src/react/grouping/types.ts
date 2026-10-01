import type { AggregateSpecFn } from '../../grouping/types';

declare module 'apsw-gridwright/react' {
    interface GridwrightColumn<TRow, TValue> {
        /**
         * Aggregates this column within each group and across the grand total, when the grid lists
         * `grouping()`. A built-in name (`sum`, `avg`, `min`, `max`, `count`), or your own
         * `(values, rows) => unknown`. A column with no `aggregate` reports nothing.
         */
        readonly aggregate?: AggregateSpecFn<TRow, TValue>;
    }
}

export type { AggregateSpecFn };
