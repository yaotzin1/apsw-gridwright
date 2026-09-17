import { useAddonMessages } from '../addons/context';
import { classes, useGridwrightContext } from '../context';
import { columnCountOf } from '../parts/slots';
import { usePanelId, useRowLabel } from './context';
import { ROW_DETAIL_ADDON, rowDetailMessages } from './messages';
import type { GridRowDetailProps } from './types';

/**
 * One row's panel: a row of the table that is deliberately not a row of the grid.
 *
 * `aria-rowcount` and every `aria-rowindex` this package emits describe the whole result set, not
 * what is mounted (`src/react/a11y/rows.ts`). A panel given `role="row"` would therefore claim a
 * position in that set — and the count would have to include panels on pages the grid has never
 * fetched, which is a number computed from one page. So the `<tr>` and its `<td>` are
 * presentational and the numbering is untouched, while the content inside is a named `region` a
 * reader can move into. `role="presentation"` removes an element's own semantics and not its
 * descendants', so a nested grid, a form or a set of links inside keeps all of its own.
 */
export function GridRowDetail({ rowId, children, className }: GridRowDetailProps) {
    const grid = useGridwrightContext();
    const t = useAddonMessages(ROW_DETAIL_ADDON, rowDetailMessages);
    const panelId = usePanelId(rowId);
    const label = useRowLabel()(rowId);

    return (
        <tr className="gw-detail-row" role="presentation" data-detail-for={String(rowId)}>
            <td className="gw-detail-cell" role="presentation" colSpan={columnCountOf(grid)}>
                <div id={panelId} className={classes('gw-detail-panel', className)} role="region" aria-label={t('panel', { row: label })}>
                    {children}
                </div>
            </td>
        </tr>
    );
}
