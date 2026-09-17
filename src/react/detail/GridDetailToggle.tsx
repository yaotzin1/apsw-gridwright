import { useAddonMessages } from '../addons/context';
import { classes } from '../context';
import { usePanelId, useRowDetail, useRowLabel } from './context';
import { ROW_DETAIL_ADDON, rowDetailMessages } from './messages';
import type { GridDetailToggleProps } from './types';

/**
 * The control that opens and closes a row's panel.
 *
 * A real `<button>` carrying `aria-expanded`, so Enter and Space come from the platform and a
 * screen reader says what pressing it will do. `aria-controls` names the panel only while the panel
 * is in the document: an IDREF to an element that is not there is worse than none.
 *
 * The add-on renders one of these per row in its own column. Set `toggle: 'none'` and place it
 * yourself — in a cell renderer, say — and it is named and wired exactly the same way.
 */
export function GridDetailToggle({ rowId, className }: GridDetailToggleProps) {
    const controller = useRowDetail();
    const t = useAddonMessages(ROW_DETAIL_ADDON, rowDetailMessages);
    const panelId = usePanelId(rowId);
    const label = useRowLabel()(rowId);

    const expanded = controller.isExpanded(rowId);
    // What the press would do, asked of the controller rather than assumed, so this control and a
    // consumer's own cannot disagree about what the rules allow.
    const allowed = controller.allows(rowId, !expanded);

    return (
        <button
            type="button"
            className={classes('gw-detail-toggle', className)}
            aria-expanded={expanded}
            {...(expanded ? { 'aria-controls': panelId } : {})}
            aria-label={expanded ? t('collapse', { row: label }) : t('expand', { row: label })}
            disabled={!allowed}
            onClick={(event) => {
                // The row underneath may navigate or select. Opening a panel is neither.
                event.stopPropagation();
                controller.toggle(rowId);
            }}
        >
            <span className="gw-detail-chevron" aria-hidden="true" />
        </button>
    );
}
