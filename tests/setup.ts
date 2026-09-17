import '@testing-library/jest-dom/vitest';

/**
 * jsdom implements neither the print dialog nor moving focus to a window, and reports every call to
 * one as a `jsdomError` on the virtual console, which prints a full stack.
 *
 * The export add-on calls both deliberately: `printHtmlDocument` focuses its offscreen frame and
 * prints it (`src/react/export/download.ts`), and several tests cover that path. So a passing run
 * writes screens of stack about behaviour that is working, which is where a real failure hides.
 *
 * Only jsdom's own "not implemented" report for those two APIs is dropped. Every other `jsdomError`
 * — an uncaught exception inside the document, a resource that would not load, any other API jsdom
 * is missing — is handed to the reporters jsdom installed, unchanged and by the same route.
 */
const SILENCED = new Set(['Not implemented: window.print', 'Not implemented: window.focus']);

interface JsdomError extends Error {
    readonly type?: string;
}

type JsdomErrorListener = (error: JsdomError) => void;

interface VirtualConsole {
    listeners(event: string): readonly JsdomErrorListener[];
    removeAllListeners(event: string): unknown;
    on(event: string, listener: JsdomErrorListener): unknown;
}

// Set by Vitest's jsdom environment. Child frames share the top window's virtual console, which is
// what makes one listener enough to cover the print frame.
const { jsdom } = globalThis as typeof globalThis & { jsdom?: { virtualConsole?: VirtualConsole } };
const virtualConsole = jsdom?.virtualConsole;

if (virtualConsole) {
    // Kept rather than replaced: jsdom's own reporter writes to the console it captured when the
    // environment was built, which is not the one this file sees, so re-implementing it here would
    // send every surviving error somewhere the reporter does not show.
    const reporters = [...virtualConsole.listeners('jsdomError')];

    virtualConsole.removeAllListeners('jsdomError');
    virtualConsole.on('jsdomError', (error) => {
        if (error.type === 'not implemented' && SILENCED.has(error.message)) return;
        for (const report of reporters) report(error);
    });
}
