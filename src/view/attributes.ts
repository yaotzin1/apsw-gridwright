/**
 * The attributes an add-on may put on an element the shell renders, by the names the DOM gives them
 * (`className`, `tabIndex`, `colSpan`) whichever framework draws them, besides event handlers,
 * `aria-*` and `data-*`. An allowlist rather than a list of what is refused: nothing here can carry
 * markup, a URL or a script, so an attribute the platform adds tomorrow is refused until someone decides
 * it is safe, instead of being allowed until someone notices it is not.
 */
export const CONTRIBUTABLE_ATTRIBUTES: ReadonlySet<string> = new Set([
    'className',
    'style',
    'role',
    'id',
    'title',
    'tabIndex',
    'hidden',
    'dir',
    'lang',
    'draggable',
    'scope',
    'colSpan',
    'rowSpan',
    'abbr',
    'headers',
]);

/** Whether an add-on may contribute this attribute with this value. */
export function isContributable(key: string, value: unknown): boolean {
    if (/^on[A-Z][A-Za-z]*$/.test(key)) return typeof value === 'function';
    if (/^(aria|data)-[a-z][a-z0-9-]*$/.test(key)) {
        return value === null || ['string', 'number', 'boolean'].includes(typeof value);
    }
    if (key === 'style') return typeof value === 'object' && value !== null;
    return CONTRIBUTABLE_ATTRIBUTES.has(key) && (value === null || typeof value !== 'object') && typeof value !== 'function';
}

/**
 * Merges attribute contributions onto an element's own attributes.
 *
 * Class names join, styles merge with the later value winning, event handlers run in order (the
 * element's own first), and every other attribute takes the last value.
 *
 * The element's own attributes are the shell's and pass as they are. A contribution passes through
 * `isContributable` whatever its types said, so an add-on can never hand the grid an HTML sink,
 * a URL attribute, children or a handler written as a string: the types are a courtesy, this is
 * the rule.
 */
export function mergeAttributes<T extends object>(base: T, ...contributions: readonly (object | null | undefined)[]): T {
    const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };

    for (const contribution of contributions) {
        if (!contribution) continue;
        for (const [key, value] of Object.entries(contribution)) {
            if (value === undefined || !isContributable(key, value)) continue;

            if (key === 'className') {
                merged.className = [merged.className, value].filter(Boolean).join(' ') || undefined;
            } else if (key === 'style' && typeof value === 'object') {
                merged.style = { ...(merged.style as object | undefined), ...(value as object) };
            } else if (/^on[A-Z]/.test(key) && typeof value === 'function') {
                const previous = merged[key];
                merged[key] =
                    typeof previous === 'function'
                        ? (...args: unknown[]) => {
                              (previous as (...a: unknown[]) => void)(...args);
                              (value as (...a: unknown[]) => void)(...args);
                          }
                        : value;
            } else {
                merged[key] = value;
            }
        }
    }

    return merged as T;
}
