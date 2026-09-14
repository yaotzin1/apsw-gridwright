import type { AddonMessages } from '../../i18n/messages';

export const EXPORT_ADDON = 'gridwright:export';

/** English. The translations live in `apsw-gridwright/locales`, under `addons['gridwright:export']`. */
export const exportMessages: AddonMessages = {
    en: {
        action: 'Export',
        csv: 'Export as CSV',
        excel: 'Export as Excel',
        markdown: 'Export as Markdown',
        print: 'Print',
        // The format is a product name rather than a word, so splicing it into the sentence is safe:
        // "CSV" does not decline.
        inProgress: 'Preparing the {format} export',
        complete: '{format} export ready',
        // The group heading above the three scopes in the export menu.
        rows: 'Rows',
        scopeAll: 'All matching rows',
        scopePage: 'This page',
        // Counts only the selected rows that are loaded, because those are the ones the file will hold.
        scopeSelected: {
            zero: 'Selected rows (none)',
            one: '{count} selected row',
            other: '{count} selected rows',
        },
        // Shown when a paginating source cannot hand over the rest. Says what the reader can do instead,
        // in words about the rows, not about the source code.
        allUnavailable: 'Only this page or the selected rows can be exported from here',
        failed: 'The {format} export could not be produced',
        // A report template's two entries in the menu. The format names are product names.
        reportMarkdown: '{label} (Markdown)',
        reportPdf: '{label} (PDF)',
    },
};
