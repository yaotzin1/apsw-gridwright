import type {
    CsvOptions,
    ExcelOptions,
    ExportFormat,
    ExportScope,
    ExportTable,
    PrintOptions,
} from '../../core/export';
import type { ColumnValue, ResolvedColumn } from '../../core/types';

/** Everything a serializer is given. The table is resolved once and shared by every format. */
export interface ExportContext<TRow> {
    /** A built-in format, or the id of a custom one. */
    readonly format: string;
    readonly table: ExportTable;
    readonly rows: readonly TRow[];
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly scope: ExportScope;
    /** Without an extension: the serializer's own file decides that. */
    readonly filename: string;
}

export interface ExportFile {
    /**
     * The file itself. A string for the formats this package writes, a `Blob` for anything that
     * is not text: a workbook or a PDF answered by a service of your own.
     */
    readonly content: string | Blob;
    readonly mimeType: string;
    /** Appended to the filename, with its dot: `.csv`, `.md`. */
    readonly extension: string;
}

/**
 * A format of your own, on equal footing with the four built in.
 *
 * It appears in the menu under its own label, it is given the same resolved rows, and it delivers
 * whatever it likes: a Markdown report printed for a PDF, a workbook built by a library the
 * application already bundles, a file a service answers with. Nothing the built-in formats can do
 * is closed to it, which is the same rule pipeline plugins follow.
 */
export interface CustomExportFormat<TRow> {
    /** Namespaced like a plugin: `acme:report`, never `report`. */
    readonly id: string;
    /**
     * What the menu shows. Not a message key: a format nobody but you defines is a string only you
     * can translate, so pass it already translated.
     */
    readonly label: string;
    readonly serialize: ExportSerializer<TRow>;
    /** What the live region calls it. Defaults to the label. */
    readonly name?: string;
}

/** A built-in format named by its id, or one of your own defined inline. */
export type ExportFormatOption<TRow> = ExportFormat | CustomExportFormat<TRow>;

/**
 * A serializer of your own.
 *
 * Return a file and the grid saves it. Return nothing and the grid assumes you delivered it
 * yourself, which is what an upload to a reporting service or a call into a bundled workbook
 * library looks like.
 */
export type ExportSerializer<TRow> = (
    context: ExportContext<TRow>,
) => ExportFile | void | Promise<ExportFile | void>;

export interface GridExportOptions<TRow> {
    /** Default `['csv', 'markdown', 'print']`. Order is the order of the menu. */
    readonly formats?: readonly ExportFormatOption<TRow>[];
    /** Default `export-YYYY-MM-DD`, without an extension. */
    readonly filename?: string | (() => string);
    /** Default `all`: every row matching the query, not only the page on screen. */
    readonly scope?: ExportScope;
    readonly csv?: CsvOptions;
    readonly excel?: ExcelOptions;
    readonly print?: PrintOptions;
    /** Replaces the built-in serializer for a format, by id. */
    readonly serializers?: Readonly<Record<string, ExportSerializer<TRow>>>;
    readonly onError?: (error: unknown) => void;
}

export interface GridExportController {
    /**
     * Resolves when the file has been handed to the browser, or the export has failed.
     *
     * Takes a built-in format's id, or the id of a custom format declared in `formats`.
     */
    readonly exportAs: (format: string) => Promise<void>;
    readonly busy: boolean;
    /** The sentence for the live region. Empty when there is nothing to say. */
    readonly message: string;
    /**
     * Why the last export produced no file, or null.
     *
     * The commonest cause by far is a paginating source with no `fetchAll`, where exporting
     * everything would mean exporting page one and calling it everything.
     */
    readonly error: string | null;
}
