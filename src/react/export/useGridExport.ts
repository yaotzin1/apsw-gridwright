import { useCallback, useRef, useState } from 'react';
import {
    buildExportTable,
    EXPORT_MIME_TYPES,
    formatCsv,
    formatExcelXml,
    formatMarkdownTable,
    formatPrintHtml,
} from '../../core/export';
import type { ExportFormat, ExportScope, ExportTable } from '../../core/export';
import { GridwrightError } from '../../core/errors';
import type { GridApi } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import { useGridwrightContext } from '../context';
import { downloadFile, printHtmlDocument } from './download';
import { DEFAULT_FORMATS, isBuiltIn, resolveFormats } from './formats';
import { EXPORT_ADDON, exportMessages } from './messages';
import type { ExportFile, GridExportController, GridExportOptions } from './types';

const EXTENSIONS: Record<ExportFormat, string> = {
    csv: '.csv',
    excel: '.xls',
    markdown: '.md',
    print: '.html',
};

/**
 * Turns what the grid is showing into a file.
 *
 * The hook owns four decisions and nothing else: which scope is on offer, which rows that scope
 * means, which serializer the format means, and what the reader is told while it happens. The
 * serializers are headless and the delivery is two small browser utilities, so this is short on
 * purpose. The scope lives here rather than in the menu so a toolbar of your own gets the same
 * choice, the same availability and the same fallback.
 */
export function useGridExport<TRow>(options: GridExportOptions<TRow> = {}): GridExportController {
    // `state` is read so the availability below is re-derived when the selection or the source
    // changes; the context re-renders this hook on every state publish.
    const { api, state, columns, announce } = useGridwrightContext<TRow>();
    const t = useAddonMessages(EXPORT_ADDON, exportMessages);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chosen, setChosen] = useState<ExportScope>('all');

    // Read through a ref so an options object written inline does not give every render a new
    // `exportAs`, which is the identity a consumer's own toolbar would put in a dependency array.
    const latest = useRef(options);
    latest.current = options;

    const selectedCount = state.selectedIds.length === 0 ? 0 : api.getSelectedRows().length;
    const available: Record<ExportScope, boolean> = {
        all: api.canFetchAllRows(),
        page: true,
        selected: api.getSelectionMode() !== 'none' && selectedCount > 0,
    };

    // A fixed scope is the developer's decision and is never second-guessed: a fixed `all` that
    // cannot be answered still refuses. A chosen scope that stopped being available falls back to
    // one that is, and the menu shows that fallback checked, so nothing happens out of sight.
    const scope: ExportScope =
        options.scope ?? (available[chosen] ? chosen : available.all ? 'all' : 'page');

    // Read by `exportAs` through a ref, for the same reason as the options: its identity stays stable.
    const latestScope = useRef(scope);
    latestScope.current = scope;

    const exportAs = useCallback(
        async (format: string, exportOptions?: { scope?: ExportScope }): Promise<void> => {
            const settings = latest.current;
            const entry = resolveFormats(settings.formats ?? DEFAULT_FORMATS, t).find(
                (candidate) => candidate.id === format,
            );
            const name = entry?.name ?? format;

            setBusy(true);
            setError(null);
            // Through the grid's own live region. An export is not grid state, but a second region
            // beside the grid's would be two regions speaking over each other.
            announce(t('inProgress', { format: name }));

            const scope = exportOptions?.scope ?? latestScope.current;

            try {
                const rows = await rowsForScope(api, scope);
                const table = buildExportTable({ rows, columns });
                const filename = resolveFilename(settings.filename);

                // The override wins, then the format's own serializer, then the built-in. A format
                // that is none of those is a typo rather than a format, and saying so beats
                // producing nothing and looking like a broken button.
                const serialize = settings.serializers?.[format] ?? entry?.custom?.serialize;
                if (!serialize && !isBuiltIn(format)) {
                    throw new GridwrightError(
                        `[gridwright] no export format "${format}" is registered. Add it to formats, or give it a serializer.`,
                        { retryable: false },
                    );
                }

                const file = serialize
                    ? await serialize({ format, table, rows, columns, scope, filename })
                    : builtIn(format as ExportFormat, table, filename, settings);

                // A serializer that returns nothing delivered the export itself. Saving a second
                // copy of it would be the grid overruling the consumer's own integration.
                if (file) {
                    downloadFile({
                        content: file.content,
                        filename: `${filename}${file.extension}`,
                        mimeType: file.mimeType,
                    });
                }

                announce(t('complete', { format: name }));
            } catch (cause) {
                announce('');
                // The screen gets a sentence in the reader's language about their rows. What was
                // thrown is written for a developer, names internals like a source's `kind`, and is
                // English whatever the locale, so it goes to `onError` instead of the alert.
                // Which sentence is decided from what the source declared, not by parsing the
                // message, so rewording a developer message can never change what a reader is told.
                const unavailable = scope === 'all' && !api.canFetchAllRows();
                setError(unavailable ? t('allUnavailable') : t('failed', { format: name }));
                // Not swallowed: without an `onError` a developer would otherwise see a translated
                // sentence and nothing to debug it with.
                if (settings.onError) settings.onError(cause);
                else console.error(cause);
            } finally {
                setBusy(false);
            }
        },
        [api, columns, announce, t],
    );

    const setScope = useCallback((next: ExportScope) => setChosen(next), []);

    return {
        exportAs,
        busy,
        error,
        scope,
        setScope,
        isScopeAvailable: (candidate) => available[candidate],
        selectedCount,
    };
}

/**
 * Which rows a scope means.
 *
 * `all` is the one with a trap in it. The rows matching the query are in memory only when the
 * source did not paginate; when it did, `fetchAllRows` asks the source for the rest and refuses
 * rather than passing off the page on screen as the whole result.
 */
async function rowsForScope<TRow>(api: GridApi<TRow>, scope: ExportScope): Promise<readonly TRow[]> {
    if (scope === 'page') return api.getState().rows.map((row) => row.data);
    if (scope === 'selected') return api.getSelectedRows();

    const matching = api.getMatchingRows();
    return matching.isComplete ? matching.rows : api.fetchAllRows();
}

function builtIn<TRow>(
    format: ExportFormat,
    table: ExportTable,
    filename: string,
    settings: GridExportOptions<TRow>,
): ExportFile | void {
    if (format === 'csv') {
        return {
            content: formatCsv(table, settings.csv),
            mimeType: EXPORT_MIME_TYPES.csv,
            extension: EXTENSIONS.csv,
        };
    }

    if (format === 'excel') {
        return {
            content: formatExcelXml(table, settings.excel),
            mimeType: EXPORT_MIME_TYPES.excel,
            extension: EXTENSIONS.excel,
        };
    }

    if (format === 'markdown') {
        return {
            content: formatMarkdownTable(table),
            mimeType: EXPORT_MIME_TYPES.markdown,
            extension: EXTENSIONS.markdown,
        };
    }

    // Printing saves no file of its own: the browser's dialog is the export, and what it writes is
    // decided there rather than here.
    printHtmlDocument(formatPrintHtml(table, { title: filename, ...settings.print }), {
        documentTitle: filename,
    });
}

const resolveFilename = (filename: GridExportOptions<unknown>['filename']): string => {
    if (typeof filename === 'function') return filename();
    if (filename) return filename;
    return `export-${new Date().toISOString().slice(0, 10)}`;
};
