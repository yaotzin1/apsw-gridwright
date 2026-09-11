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
import { toGridError } from '../../core/errors';
import type { GridApi } from '../../core/types';
import { useGridwrightContext } from '../context';
import { downloadFile, printHtmlDocument } from './download';
import { DEFAULT_FORMATS, isBuiltIn, resolveFormats } from './formats';
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
 * The hook owns three decisions and nothing else: which rows the scope means, which serializer the
 * format means, and what the live region says while it happens. The serializers are headless and
 * the delivery is two small browser utilities, so this is short on purpose.
 */
export function useGridExport<TRow>(options: GridExportOptions<TRow> = {}): GridExportController {
    const { api, columns, labels } = useGridwrightContext<TRow>();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Read through a ref so an options object written inline does not give every render a new
    // `exportAs`, which is the identity a consumer's own toolbar would put in a dependency array.
    const latest = useRef(options);
    latest.current = options;

    const exportAs = useCallback(
        async (format: string): Promise<void> => {
            const settings = latest.current;
            const entry = resolveFormats(settings.formats ?? DEFAULT_FORMATS, labels).find(
                (candidate) => candidate.id === format,
            );
            const name = entry?.name ?? format;

            setBusy(true);
            setError(null);
            setMessage(labels.exportInProgress(name));

            try {
                const scope = settings.scope ?? 'all';
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

                setMessage(labels.exportComplete(name));
            } catch (cause) {
                const failure = toGridError(cause);
                setMessage('');
                setError(failure.message);
                settings.onError?.(cause);
            } finally {
                setBusy(false);
            }
        },
        [api, columns, labels],
    );

    return { exportAs, busy, message, error };
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
