import { useAddonMessages } from '../addons/context';
import { useGridwrightContext } from '../context';
import { COLUMN_LAYOUT_ADDON, columnLayoutMessages } from './messages';
import type { ColumnLayoutController } from './types';

/** The control to give focus back to once the row it was in has been rebuilt. */
export interface Refocus {
    readonly columnId: string;
    readonly key: string;
}

/** How far one press of "narrower" or "wider" moves a column's edge, in pixels. */
const WIDTH_STEP = 16;

/**
 * A column's pointer routes to a move and a resize: four buttons that do what a drag does (WCAG 2.5.7).
 *
 * Rendered by the column picker under `wcag()` only. The move goes through the controller, which
 * records the mover, so the add-on's own sentence names the column even when two neighbours swap. A
 * width change is said the way the resize handle says it. Each button asks the controller whether the
 * change is allowed before it is pressed, as the pins do, and a column that cannot move or resize gets
 * no such button rather than one that does nothing.
 */
export function PointerRoutes({
    columnId,
    header,
    layout,
    refocus,
}: {
    columnId: string;
    header: string;
    layout: ColumnLayoutController;
    refocus: { current: Refocus | null };
}) {
    const t = useAddonMessages(COLUMN_LAYOUT_ADDON, columnLayoutMessages);
    const grid = useGridwrightContext();
    const at = layout.indexOf(columnId);
    const width = layout.widthOf(columnId);
    const bounds = layout.boundsOf(columnId);

    const moveButton = (key: 'moveEarlier' | 'moveLater', delta: -1 | 1, glyph: string) => {
        const toIndex = at + delta;
        const refused = toIndex < 0 || toIndex >= layout.order.length || !layout.allows({ type: 'move', columnId, toIndex });
        return (
            <button
                type="button"
                role="menuitem"
                className="gw-column-picker-step"
                data-column-id={columnId}
                data-key={key}
                aria-disabled={refused ? true : undefined}
                aria-label={t(key, { column: header })}
                onClick={() => {
                    if (refused) return;
                    refocus.current = { columnId, key };
                    layout.moveColumn(columnId, toIndex);
                }}
            >
                <span aria-hidden="true">{glyph}</span>
            </button>
        );
    };

    const widthButton = (key: 'narrower' | 'wider', delta: -1 | 1, glyph: string) => {
        const next = Math.min(bounds.max, Math.max(bounds.min, width + delta * WIDTH_STEP));
        const refused = next === width || !layout.allows({ type: 'width', columnId, width: next });
        return (
            <button
                type="button"
                role="menuitem"
                className="gw-column-picker-step"
                data-column-id={columnId}
                data-key={key}
                aria-disabled={refused ? true : undefined}
                aria-label={t(key, { column: header })}
                onClick={() => {
                    if (refused) return;
                    refocus.current = { columnId, key };
                    layout.setWidth(columnId, next);
                    grid.announce(t('width', { column: header, width: next }));
                }}
            >
                <span aria-hidden="true">{glyph}</span>
            </button>
        );
    };

    return (
        <>
            {layout.canMove(columnId) && (
                <>
                    {moveButton('moveEarlier', -1, '‹')}
                    {moveButton('moveLater', 1, '›')}
                </>
            )}
            {layout.canResize(columnId) && (
                <>
                    {widthButton('narrower', -1, '−')}
                    {widthButton('wider', 1, '+')}
                </>
            )}
        </>
    );
}
