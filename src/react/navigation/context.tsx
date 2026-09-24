import { createContext, useContext } from 'react';
import { cellTabIndex } from './cell-control';
import type { CellNavigationController } from './types';

const CellNavigationContext = createContext<CellNavigationController | null>(null);

export const CellNavigationProvider = CellNavigationContext.Provider;

/**
 * The cursor, from inside a grid that lists `cellNavigation()`.
 *
 * Throws when the add-on is not listed, naming both, because a hook that returned null would push
 * the same check into every caller and a control built on it has nothing useful to render without
 * one. Use `useOptionalCellNavigation()` where the add-on is genuinely optional.
 */
export function useCellNavigation(): CellNavigationController {
    const value = useContext(CellNavigationContext);
    if (value === null) {
        throw new Error('useCellNavigation() requires the cellNavigation() add-on in addons={[...]}.');
    }
    return value;
}

/** The cursor, or null when the grid does not list `cellNavigation()`. */
export function useOptionalCellNavigation(): CellNavigationController | null {
    return useContext(CellNavigationContext);
}

/**
 * The `tabIndex` for a button, link or checkbox rendered inside a body cell: `-1` while
 * `cellNavigation()` moves focus to that cell, `undefined` otherwise.
 *
 *     <a href={url} tabIndex={useCellTabIndex()}>{name}</a>
 *
 * Pass the column id from an extra column of your own; leave it out in a data cell. Here rather than
 * beside the add-on so the controls that call it -- the selection checkbox among them -- bundle
 * this and not the add-on.
 */
export function useCellTabIndex(columnId?: string): -1 | undefined {
    return cellTabIndex(useContext(CellNavigationContext), columnId);
}
