/** A spreadsheet evaluates a cell starting with one of these the moment the file is opened. */
const FORMULA_LEAD = new Set(['=', '+', '-', '@']);

/** Space and the ASCII controls, DEL included: what an importer that trims may strip first. */
const isTrimmable = (code: number): boolean => code <= 0x20 || code === 0x7f;

/**
 * The cell's text with an apostrophe in front when a spreadsheet would run it as a formula.
 *
 * One rule for every place that hands text to a spreadsheet: the CSV export, and both flavours of
 * a clipboard copy, because a spreadsheet given both flavours pastes the HTML one.
 *
 * A leading tab or return is defused whatever follows it, as OWASP advises. Past that, leading
 * spaces and control characters are skipped before looking: Excel reads `   =1+1` as text, but
 * LibreOffice with "Trim spaces" and the Sheets importer trim first and then see a formula. `|` and
 * `%` are not on the list, because no spreadsheet starts a formula with either; a DDE payload
 * needs `=` first, and prefixing them would only put an apostrophe in front of ordinary values.
 */
export function defuseFormula(value: string): string {
    const first = value.charCodeAt(0);
    if (first === 0x09 || first === 0x0d) return `'${value}`;

    let index = 0;
    while (index < value.length && isTrimmable(value.charCodeAt(index))) index += 1;
    return index < value.length && FORMULA_LEAD.has(value[index]!) ? `'${value}` : value;
}
