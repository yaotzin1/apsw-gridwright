import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { mergeLabels } from './labels';
import type {
    GridwrightClassNames,
    GridwrightInstance,
    GridwrightLabels,
} from './types';

export interface GridwrightContextValue<TRow> extends GridwrightInstance<TRow> {
    readonly classNames: Partial<GridwrightClassNames>;
    readonly labels: GridwrightLabels;
}

const GridwrightContext = createContext<GridwrightContextValue<unknown> | null>(null);

export interface GridwrightProviderProps<TRow> {
    readonly instance: GridwrightInstance<TRow>;
    readonly classNames?: Partial<GridwrightClassNames>;
    readonly labels?: Partial<GridwrightLabels>;
    readonly children: ReactNode;
}

/**
 * Publishes one grid instance to the parts below it.
 *
 * Composition is the point: `<GridwrightProvider>` plus the parts lets a consumer put the toolbar
 * in a page header and the pagination in a sticky footer, which no single monolithic component
 * can express. `<Gridwright />` is that composition already assembled.
 */
export function GridwrightProvider<TRow>({
    instance,
    classNames,
    labels,
    children,
}: GridwrightProviderProps<TRow>) {
    const value = useMemo<GridwrightContextValue<TRow>>(
        () => ({ ...instance, classNames: classNames ?? {}, labels: mergeLabels(labels) }),
        [instance, classNames, labels],
    );

    return (
        <GridwrightContext.Provider value={value as unknown as GridwrightContextValue<unknown>}>
            {children}
        </GridwrightContext.Provider>
    );
}

export function useGridwrightContext<TRow = unknown>(): GridwrightContextValue<TRow> {
    const value = useContext(GridwrightContext);
    if (!value) {
        throw new Error(
            '[gridwright] this component must be rendered inside <GridwrightProvider> or <Gridwright />.',
        );
    }
    return value as unknown as GridwrightContextValue<TRow>;
}

export const classes = (...values: (string | false | null | undefined)[]): string | undefined =>
    values.filter(Boolean).join(' ') || undefined;
