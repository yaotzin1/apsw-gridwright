import { EXPORT_MIME_TYPES, formatMarkdownTemplate } from '../../core/export';
import type { MarkdownTemplateOptions, PrintOptions } from '../../core/export';
import { printMarkdownDocument } from './download';
import type { CustomExportFormat, ExportContext } from './types';

/** The ways a report can leave the grid. */
export type MarkdownReportOutput = 'markdown' | 'pdf';

export interface MarkdownReportOptions<TRow> {
    /** Namespaced like a plugin, `acme:roster`. The entries are `<id>:markdown` and `<id>:pdf`. */
    readonly id: string;
    /** The report's name, already translated. The menu shows `<label> (Markdown)` and `<label> (PDF)`. */
    readonly label: string;
    /**
     * One block per row. `{columnId}` reads that column for the row, through `exportValue` then
     * `formatValue`, the same text every other export writes. A function gets the row itself.
     */
    readonly template: MarkdownTemplateOptions<TRow>['template'];
    /** Above the rows: a title, a summary. A function receives the rows the report covers. */
    readonly header?: MarkdownTemplateOptions<TRow>['header'];
    /** Below the rows. */
    readonly footer?: MarkdownTemplateOptions<TRow>['footer'];
    /** Between row blocks. Default a blank line, which ends a Markdown block. */
    readonly separator?: string;
    /** The printed document's title, which browsers offer as the PDF's name. Default the label. */
    readonly title?: string | ((rows: readonly TRow[]) => string);
    /** Passed to the printable document: `styles`, `lang`, `direction`. */
    readonly print?: Omit<PrintOptions, 'title'>;
    /** Which entries to offer, in this order. Default both. */
    readonly outputs?: readonly MarkdownReportOutput[];
    /** Replaces an entry's whole label, for a language that orders it differently. */
    readonly labels?: Partial<Record<MarkdownReportOutput, string>>;
}

/**
 * One report template, offered in the export menu as a Markdown file and as a PDF.
 *
 *     export={{
 *         formats: [
 *             'csv',
 *             ...markdownReportFormats({
 *                 id: 'acme:roster',
 *                 label: 'Team roster',
 *                 header: (rows) => `# Team roster\n\n${rows.length} people`,
 *                 template: '## {name}\n\n- Department: {department}\n- Salary: {salary}',
 *             }),
 *         ],
 *     }}
 *
 * Both entries render the same Markdown from the same rows, so the file and the PDF cannot
 * disagree. The Markdown entry downloads `<filename>.md`. The PDF entry opens the browser's print
 * dialog, where the reader saves a PDF: no PDF engine is bundled, and the browser's page settings
 * apply. For a PDF that must look identical everywhere, send `formatMarkdownTemplate`'s output to a
 * service from a custom format instead.
 */
export function markdownReportFormats<TRow>(options: MarkdownReportOptions<TRow>): CustomExportFormat<TRow>[] {
    const outputs = options.outputs ?? ['markdown', 'pdf'];

    const render = ({ rows, columns }: ExportContext<TRow>): string =>
        formatMarkdownTemplate({
            rows,
            columns,
            template: options.template,
            separator: options.separator ?? '\n\n',
            ...(options.header !== undefined ? { header: options.header } : {}),
            ...(options.footer !== undefined ? { footer: options.footer } : {}),
        });

    const entries: Record<MarkdownReportOutput, CustomExportFormat<TRow>> = {
        markdown: {
            id: `${options.id}:markdown`,
            label: options.labels?.markdown ?? `${options.label} (Markdown)`,
            name: `${options.label} Markdown`,
            serialize: (context) => ({
                content: render(context),
                mimeType: EXPORT_MIME_TYPES.markdown,
                extension: '.md',
            }),
        },
        pdf: {
            id: `${options.id}:pdf`,
            label: options.labels?.pdf ?? `${options.label} (PDF)`,
            name: `${options.label} PDF`,
            serialize: (context) => {
                const title = typeof options.title === 'function' ? options.title(context.rows) : (options.title ?? options.label);
                printMarkdownDocument(render(context), { ...options.print, title });
                // Nothing returned: the print dialog is the delivery, and a second copy saved as a
                // file would be the grid overruling it.
            },
        },
    };

    return outputs.map((output) => entries[output]);
}
