const ENTITIES: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/**
 * Control characters XML rejects outright: everything below a space except tab, newline and
 * return. A cell holding one produces a file the spreadsheet refuses to open at all.
 */
const isForbiddenControl = (code: number): boolean =>
    code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;

/**
 * Escapes text for XML and HTML alike.
 *
 * Rows come from somewhere else. A cell holding `</Data><Data>` would end the element it was
 * written into, and a cell holding a script tag would run when the printed page is opened, so
 * every cell and every header passes through here before it reaches markup.
 *
 * One pass over the string rather than five replacements, because the first of those five has to
 * be the ampersand and a reader has to know that to see why the order is not arbitrary.
 */
export function escapeMarkup(value: string): string {
    let out = '';

    for (const character of value) {
        const entity = ENTITIES[character];
        if (entity !== undefined) {
            out += entity;
            continue;
        }
        if (isForbiddenControl(character.charCodeAt(0))) continue;
        out += character;
    }

    return out;
}
