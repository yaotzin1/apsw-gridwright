import type { DataSourceCapabilities } from '../core/types';

const FACETS: readonly (keyof DataSourceCapabilities)[] = ['sort', 'filter', 'search', 'paginate'];

/**
 * A source's declared capabilities over its defaults, saying so when a declaration cannot be read.
 *
 * TypeScript rejects `{ pagination: false }`; a JavaScript consumer gets no such help, and the
 * spread that used to do this kept the default for the facet they meant and ignored the one they
 * wrote. The grid then quietly disagreed with the server about who pages, which is found only by
 * wondering why a switch does nothing. The playground shipped with exactly that typo.
 */
export function resolveCapabilities(
    defaults: DataSourceCapabilities,
    declared: Partial<DataSourceCapabilities> | undefined,
    kind: string,
): DataSourceCapabilities {
    if (!declared) return { ...defaults };

    const resolved: Record<keyof DataSourceCapabilities, boolean> = { ...defaults };

    for (const [key, value] of Object.entries(declared) as [string, unknown][]) {
        if (!FACETS.includes(key as keyof DataSourceCapabilities)) {
            console.warn(
                `[gridwright] the "${kind}" source declares an unknown capability "${key}", which is ignored. ` +
                    `The capabilities are ${FACETS.join(', ')}.`,
            );
            continue;
        }
        if (value === undefined) continue;
        if (typeof value !== 'boolean') {
            console.warn(
                `[gridwright] the "${kind}" source declares capability "${key}" as ${JSON.stringify(value)}; ` +
                    `expected true or false, so the default is kept.`,
            );
            continue;
        }
        resolved[key as keyof DataSourceCapabilities] = value;
    }

    return resolved;
}
