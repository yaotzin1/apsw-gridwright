/**
 * The two DOM helpers every page here needs.
 *
 * Small enough to have been copied into each page, which is exactly why they were: nothing was a
 * module, so nothing could be shared.
 */

export const element = (id) => document.getElementById(id);

/**
 * Row data is untrusted: it comes from an API, and these pages build markup with strings.
 *
 * The React adapter never needs this, because React escapes for you. A page that concatenates HTML
 * does need it, on every value, and the one it forgets is the one that matters.
 */
export const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
