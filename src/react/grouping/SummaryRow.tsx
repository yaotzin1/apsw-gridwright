import type { AddonTranslate } from '../addons/context';
import { useAddonMessages } from '../addons/context';
import type { GridContext } from '../addons/types';
import { classes, useGridwrightContext } from '../context';
import { extraColumnsOf } from '../parts/slots';
import type { GroupedRow } from '../../grouping';
import { GROUPING_ADDON, groupingMessages } from './messages';

function formatAggregate(aggregate: string | undefined, value: unknown, t: AddonTranslate, formatNumber: (value: number) => string): string {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : String(value);
    return aggregate === 'avg' ? `${t('summaryAverage')}: ${text}` : text;
}

export interface SummaryRowProps<TRow> {
    readonly summary: Readonly<Record<string, unknown>>;
    readonly aggregateOf: (columnId: string) => string | undefined;
    readonly grid: GridContext<GroupedRow<TRow>>;
}

/** The `<tfoot>` grand-total row: one cell per column, aligned the same as the body's. */
export function SummaryRow<TRow>({ summary, aggregateOf, grid }: SummaryRowProps<TRow>) {
    const t = useAddonMessages(GROUPING_ADDON, groupingMessages);
    const { translator } = useGridwrightContext();
    const { columns, classNames } = grid;
    const extras = extraColumnsOf(grid);
    const visible = columns.filter((column) => !column.hidden);

    return (
        <tfoot className="gw-tfoot">
            <tr className={classes('gw-row', 'gw-summary-row', classNames.row)}>
                {extras.start.map((column) => (
                    <td key={column.id} className={classes('gw-cell', classNames.cell)} />
                ))}
                {visible.map((column, index) => (
                    <td key={column.id} className={classes('gw-cell', classNames.cell)} style={column.align ? { textAlign: column.align } : undefined}>
                        {index === 0 && summary[column.id] === undefined ? t('summaryTotal') : formatAggregate(aggregateOf(column.id), summary[column.id], t, translator.formatNumber)}
                    </td>
                ))}
                {extras.end.map((column) => (
                    <td key={column.id} className={classes('gw-cell', classNames.cell)} />
                ))}
            </tr>
        </tfoot>
    );
}
