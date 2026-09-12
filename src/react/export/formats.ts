import type { ExportFormat } from '../../core/export';
import type { GridwrightLabels } from '../types';
import type { CustomExportFormat, ExportFormatOption } from './types';

const BUILT_IN: readonly ExportFormat[] = ['csv', 'excel', 'markdown', 'print'];

/** What the menu offers when nothing was named: the two files everyone wants, and paper. */
export const DEFAULT_FORMATS: readonly ExportFormat[] = ['csv', 'markdown', 'print'];

export const isBuiltIn = (format: string): format is ExportFormat =>
    (BUILT_IN as readonly string[]).includes(format);

/**
 * What the live region calls each built-in format.
 *
 * Product names rather than translated words, which is why they are spliced into the message
 * instead of being four more keys: "CSV" is "CSV" in every locale the package ships. `print` is
 * announced as PDF because that is what the reader ends up with when they choose it.
 */
const BUILT_IN_NAMES: Record<ExportFormat, string> = {
    csv: 'CSV',
    excel: 'Excel',
    markdown: 'Markdown',
    print: 'PDF',
};

/** One entry of the menu, whether it came from this package or from the consumer. */
export interface ResolvedFormat<TRow> {
    readonly id: string;
    readonly label: string;
    /** The name spliced into the announcements. */
    readonly name: string;
    readonly custom: CustomExportFormat<TRow> | null;
}

export function resolveFormats<TRow>(
    formats: readonly ExportFormatOption<TRow>[],
    labels: GridwrightLabels,
): readonly ResolvedFormat<TRow>[] {
    return formats.map((format) =>
        typeof format === 'string'
            ? {
                  id: format,
                  label: builtInLabel(format, labels),
                  name: BUILT_IN_NAMES[format] ?? format,
                  custom: null,
              }
            : {
                  id: format.id,
                  label: format.label,
                  name: format.name ?? format.label,
                  custom: format,
              },
    );
}

const builtInLabel = (format: string, labels: GridwrightLabels): string =>
    format === 'csv'
        ? labels.exportCsv
        : format === 'excel'
          ? labels.exportExcel
          : format === 'markdown'
            ? labels.exportMarkdown
            : format === 'print'
              ? labels.exportPrint
              : format;
