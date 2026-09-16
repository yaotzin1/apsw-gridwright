import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { GridRow } from '../core/types';
import { createTranslator } from '../i18n/translator';
import type { Translator } from '../i18n/translator';
import { mergeLabels } from './labels';
import type { GridwrightClassNames, GridwrightI18nProps, GridwrightInstance, GridwrightLabels } from './types';

export interface GridwrightContextValue<TRow> extends GridwrightInstance<TRow> {
    readonly classNames: Partial<GridwrightClassNames>;
    readonly labels: GridwrightLabels;
    /** Exposed so a consumer's own parts can translate with the same catalog the grid uses. */
    readonly translator: Translator;
    /** The grid's row click handler, which every body calls the same way. */
    readonly onRowClick: ((row: GridRow<TRow>) => void) | undefined;
}

const GridwrightContext = createContext<GridwrightContextValue<unknown> | null>(null);

export interface GridwrightProviderProps<TRow> extends GridwrightI18nProps {
    readonly instance: GridwrightInstance<TRow>;
    readonly classNames?: Partial<GridwrightClassNames>;
    readonly onRowClick?: (row: GridRow<TRow>) => void;
    readonly children: ReactNode;
}

/**
 * Builds a translator from the i18n props.
 *
 * `locale` takes either a tag or a catalog, because passing the imported pack is the common case
 * and asking for both the pack and its own tag would be asking twice for the same thing.
 */
export function useTranslator(props: GridwrightI18nProps): Translator {
    const { locale, messages, translate } = props;

    return useMemo(() => {
        const catalog = typeof locale === 'object' ? locale : undefined;
        const tag = typeof locale === 'string' ? locale : catalog?.locale;

        return createTranslator({
            ...(tag ? { locale: tag } : {}),
            ...(catalog ? { catalog } : {}),
            ...(messages ? { messages } : {}),
            ...(translate ? { translate } : {}),
        });
    }, [locale, messages, translate]);
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
    onRowClick,
    children,
    ...i18n
}: GridwrightProviderProps<TRow>) {
    const translator = useTranslator(i18n);
    const overrides = i18n.labels;

    // Memoised on what it is actually built from, and not on the instance.
    //
    // The instance is a new object on every render -- `useGridwright` returns an object literal --
    // so labels built inside the memo below would have a new identity every render too. The live
    // region watches `labels` for a language change, and a `labels` that always changes made the
    // region re-evaluate on every render: a sentence said through `instance.announce`, which is for
    // things the grid's own state does not cover, was overwritten by the row range before anyone
    // could read it, and only when something else happened to render in the same tick.
    const labels = useMemo(() => mergeLabels(translator, overrides), [translator, overrides]);

    const value = useMemo<GridwrightContextValue<TRow>>(
        () => ({
            ...instance,
            classNames: classNames ?? {},
            labels,
            translator,
            onRowClick,
        }),
        [instance, classNames, labels, translator, onRowClick],
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
        throw new Error('[gridwright] this component must be rendered inside <GridwrightProvider> or <Gridwright />.');
    }
    return value as unknown as GridwrightContextValue<TRow>;
}

export const classes = (...values: (string | false | null | undefined)[]): string | undefined =>
    values.filter(Boolean).join(' ') || undefined;
