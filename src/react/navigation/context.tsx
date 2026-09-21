import { createContext, useContext } from 'react';
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
