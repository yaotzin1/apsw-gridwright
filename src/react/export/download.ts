import { formatMarkdownDocument } from '../../core/export';
import type { PrintOptions } from '../../core/export';

export interface DownloadOptions {
    /** Text, or a `Blob` for anything that is not text: a workbook, a PDF from a service. */
    readonly content: string | Blob;
    readonly filename: string;
    readonly mimeType: string;
}

/**
 * Hands content to the browser as a file.
 *
 * An anchor with a `download` attribute and an object URL, which is the only way a page can save a
 * file without a server. The URL is revoked in the same task, because every one that is not is a
 * copy of the file held in memory until the tab closes.
 */
export function downloadFile({ content, filename, mimeType }: DownloadOptions): void {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    // Off-screen rather than hidden: a display:none anchor is not clickable in every browser.
    anchor.style.position = 'fixed';
    anchor.style.left = '-9999px';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

/**
 * Prints a standalone HTML document without navigating away from the page.
 *
 * An offscreen iframe rather than a new window: a popup blocker stops `window.open`, and printing
 * the current document would print the application around the grid. The frame is removed once the
 * dialog is done with it, and on a fallback timer for the browsers that report nothing when the
 * dialog is dismissed.
 */
export function printHtmlDocument(html: string, options: { documentTitle?: string } = {}): () => void {
    const frame = document.createElement('iframe');

    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', options.documentTitle ?? 'Export');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.srcdoc = html;

    let removed = false;
    const remove = (): void => {
        if (removed) return;
        removed = true;
        frame.remove();
    };

    frame.addEventListener('load', () => {
        const view = frame.contentWindow;
        // No print in this environment, a test renderer for instance. The document was still
        // built correctly, so there is nothing to report and nothing to leave behind.
        if (!view || typeof view.print !== 'function') {
            remove();
            return;
        }

        view.addEventListener('afterprint', remove);
        view.focus();
        view.print();
    });

    document.body.appendChild(frame);
    return remove;
}

/**
 * Renders a Markdown report and sends it to the print dialog, where the reader saves a PDF.
 *
 * The frontend half of "Markdown as a PDF template", and the reason no PDF engine is bundled: the
 * browser already has one. A report that has to look identical on every machine belongs on a
 * service instead, which takes the same Markdown.
 */
export function printMarkdownDocument(markdown: string, options: PrintOptions = {}): () => void {
    return printHtmlDocument(formatMarkdownDocument(markdown, options), {
        ...(options.title !== undefined ? { documentTitle: options.title } : {}),
    });
}
