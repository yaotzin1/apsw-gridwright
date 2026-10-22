/** A spreadsheet evaluates a cell starting with one of these the moment the file is opened. */
const FORMULA_LEAD = new Set(['=', '+', '-', '@']);

/** Unicode separators (no-break space, the line and paragraph separators) and format characters (soft hyphen, zero-width, bidi marks, the byte order mark). */
const UNICODE_BLANK = /^[\p{Z}\p{Cf}]$/u;

/**
 * Space and the ASCII controls, DEL included, and the Unicode characters that read as blank: what an
 * importer that trims may strip first. ASCII is answered without a regular expression, so a cell that
 * starts with an ordinary letter or digit costs one comparison.
 */
const isTrimmable = (code: number): boolean =>
    code <= 0x20 || code === 0x7f || (code >= 0xa0 && UNICODE_BLANK.test(String.fromCodePoint(code)));

/**
 * The cell's text with an apostrophe in front when a spreadsheet would run it as a formula.
 *
 * One rule for every place that hands text to a spreadsheet: the CSV export, and both flavours of
 * a clipboard copy, because a spreadsheet given both flavours pastes the HTML one.
 *
 * A leading tab, line feed, or return is defused whatever follows it, as OWASP advises. Past that, leading
 * spaces and control characters are skipped before looking: Excel reads `   =1+1` as text, but
 * LibreOffice with "Trim spaces" and the Sheets importer trim first and then see a formula. The same
 * goes for the characters that read as blank, a no-break space or a zero-width one: no importer is
 * known to skip them, but a cell that starts with one before `=` is never a value worth keeping as
 * typed, so it is guarded too, which can only add an apostrophe. `|` and
 * `%` are not on the list, because no spreadsheet starts a formula with either; a DDE payload
 * needs `=` first, and prefixing them would only put an apostrophe in front of ordinary values.
 */
export function defuseFormula(value: string): string {
    const first = value.charCodeAt(0);
    if (first === 0x09 || first === 0x0a || first === 0x0d) return `'${value}`;

    let index = 0;
    while (index < value.length && isTrimmable(value.charCodeAt(index))) index += 1;
    return index < value.length && FORMULA_LEAD.has(value[index]!) ? `'${value}` : value;
}
