import type { ReactNode } from 'react';
import { rendersSomething } from '../addons/resolve';
import { classes, useGridwrightContext } from '../context';
import { renderSlot } from './slots';

export interface GridToolbarProps {
    /** Your own content, after every add-on's. */
    readonly children?: ReactNode;
}

/**
 * The toolbar: every add-on's toolbar items, then yours.
 *
 * Renders nothing when nobody has anything to put in it, so a grid without a search box or an
 * export menu does not carry an empty bar above its header. Status items, such as the selection
 * count, are shown only while the toolbar is there for something else: a bar that appears when a
 * row is ticked pushes the row being ticked out from under the pointer.
 */
export function GridToolbar({ children }: GridToolbarProps) {
    const grid = useGridwrightContext();
    const items = renderSlot(grid, 'toolbar');

    if (items.length === 0 && !rendersSomething(children)) return null;

    return (
        <div className={classes('gw-toolbar', grid.classNames.toolbar)}>
            {items}
            {renderSlot(grid, 'toolbarStatus')}
            {children}
        </div>
    );
}
