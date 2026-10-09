import { rowNumbering } from '../a11y/rows';
import { useAddonMessages } from '../addons/context';
import type { GridContext } from '../addons/types';
import { classes, useGridwrightContext } from '../context';
import { columnCountOf } from '../parts/slots';
import type { GroupedRow, GroupHeaderRow, GroupingController } from '../../grouping';
import { GROUPING_ADDON, groupingMessages } from './messages';

/** A number reads with the grid's own separators, not the browser's; anything else is its own string. */
function formatAggregate(value: unknown, formatNumber: (value: number) => string): string {
    if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value) : '';
    if (value === null || value === undefined) return '';
    return String(value);
}

export interface GroupRowProps<TRow> {
    readonly header: GroupHeaderRow;
    readonly position: number;
    readonly controller: GroupingController;
    readonly grid: GridContext<GroupedRow<TRow>>;
}

/**
 * A group header row: the toggle, the group's title and count, and its aggregates.
 *
 * Renders as one cell spanning every column rather than one cell per column, per the spec's decided
 * layout (`specs/grouping-and-aggregation/spec.md`, clarifications). It owns the whole `<tr>` — the
 * shell does not merge `rowAttributes` onto a row a `renderRow` contribution rendered itself — so
 * every attribute a group row needs is set here.
 */
export function GroupRow<TRow>({ header, position, controller, grid }: GroupRowProps<TRow>) {
    const t = useAddonMessages(GROUPING_ADDON, groupingMessages);
    const { translator } = useGridwrightContext();
    const { state, classNames, definitions } = grid;
    const numbering = rowNumbering(state.totalRows, state.isTotalExact);

    const aggregateEntries = Object.entries(header.aggregates);

    return (
        <tr
            className={classes('gw-row', 'gw-row--group', classNames.row)}
            aria-expanded={header.expanded}
            aria-level={header.depth + 1}
            aria-rowindex={numbering.indexOf(position)}
            data-row-id={header.groupId}
        >
            <td
                className={classes('gw-cell', 'gw-group-cell', classNames.cell)}
                colSpan={columnCountOf(grid)}
                // The whole header toggles, so a click on its text does what the hint says. The button
                // below stays the keyboard and screen-reader control; its click bubbles up to here.
                onClick={() => controller.toggle(header.groupId)}
            >
                <div className="gw-group-cell-inner" style={{ paddingInlineStart: `${header.depth * 16}px` }}>
                    <button
                        type="button"
                        className="gw-group-toggle"
                        aria-label={header.expanded ? t('collapse', { group: header.key }) : t('expand', { group: header.key })}
                    >
                        <span className="gw-group-chevron" aria-hidden="true" />
                    </button>
                    <span className="gw-group-title">{header.key}</span>
                    <span className="gw-group-count">{t('itemsCount', { count: header.count })}</span>
                    {aggregateEntries.length > 0 && (
                        <span className="gw-group-aggregates">
                            {aggregateEntries.map(([columnId, value]) => (
                                <span key={columnId} className="gw-group-aggregate">
                                    <span className="gw-group-aggregate-label">{definitions.get(columnId)?.header ?? columnId}</span>
                                    <span className="gw-group-aggregate-value">{formatAggregate(value, translator.formatNumber)}</span>
                                </span>
                            ))}
                        </span>
                    )}
                </div>
            </td>
        </tr>
    );
}
