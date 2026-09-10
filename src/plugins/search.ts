import { STAGE_ORDER } from '../core/pipeline';
import type { GridPlugin } from '../core/types';

export const SEARCH_STAGE_ID = 'core:search';

export interface SearchPluginOptions {
    /** Match on whole words only. Default false, which matches substrings. */
    readonly wholeWord?: boolean;
    /** Restrict the search to these column ids. Default: every column marked searchable. */
    readonly columnIds?: readonly string[];
}

/**
 * Global text search across the searchable columns.
 *
 * It reads each column through `getText`, so a column with a `formatValue` is searched by what the
 * reader actually sees. Searching "1,234" against a raw `1234` finds nothing, and the reader
 * concludes the grid is broken rather than that they searched the storage format.
 */
export function searchPlugin<TRow>(options: SearchPluginOptions = {}): GridPlugin<TRow> {
    return {
        name: 'gridwright:search',
        setup(context) {
            return context.registerStage({
                id: SEARCH_STAGE_ID,
                order: STAGE_ORDER.SEARCH,
                capability: 'search',
                run(rows, pipeline) {
                    const term = pipeline.query.search.trim().toLowerCase();
                    if (term === '') return { rows, totalRows: rows.length };

                    const columns = (pipeline.columns).filter(
                        (column) =>
                            column.searchable &&
                            (options.columnIds === undefined || options.columnIds.includes(column.id)),
                    );
                    if (columns.length === 0) return { rows, totalRows: rows.length };

                    const matched = rows.filter((row) =>
                        columns.some((column) => {
                            const text = column.getText(row).toLowerCase();
                            return options.wholeWord ? hasWord(text, term) : text.includes(term);
                        }),
                    );

                    return { rows: matched, totalRows: matched.length };
                },
            });
        },
    };
}

function hasWord(haystack: string, needle: string): boolean {
    let from = 0;
    for (;;) {
        const at = haystack.indexOf(needle, from);
        if (at === -1) return false;
        const before = at === 0 ? ' ' : haystack[at - 1]!;
        const afterIndex = at + needle.length;
        const after = afterIndex >= haystack.length ? ' ' : haystack[afterIndex]!;
        if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
        from = at + 1;
    }
}

const isWordCharacter = (character: string): boolean => /[\p{L}\p{N}_]/u.test(character);
