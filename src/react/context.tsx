import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createTranslator } from '../i18n/translator';
import type { Translator } from '../i18n/translator';
import { mergeLabels } from './labels';
import type {
    GridwrightClassNames,
    GridwrightI18nProps,
    GridwrightInstance,
    GridwrightLabels,
} from './types';

export interface GridwrightContextValue<TRow> extends GridwrightInstance<TRow> {
    readonly classNames: Partial<GridwrightClassNames>;
    readonly labels: GridwrightLabels;
    /** Exposed so a consumer's own parts can translate with the same catalog the grid uses. */
    readonly translator: Translator;
}

const GridwrightContext = createContext<GridwrightContextValue<unknown> | null>(null);

export interface GridwrightProviderProps<TRow> extends GridwrightI18nProps {
    readonly instance: GridwrightInstance<TRow>;
    readonly classNames?: Partial<GridwrightClassNames>;
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
    children,
    ...i18n
}: GridwrightProviderProps<TRow>) {
    const translator = useTranslator(i18n);
    const overrides = i18n.labels;

    const value = useMemo<GridwrightContextValue<TRow>>(
        () => ({
            ...instance,
            classNames: classNames ?? {},
            labels: mergeLabels(translator, overrides),
            translator,
        }),
        [instance, classNames, translator, overrides],
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
