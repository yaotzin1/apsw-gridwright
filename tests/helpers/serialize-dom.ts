/**
 * An indented, attribute-sorted text form of a DOM subtree, for snapshots.
 *
 * It walks nodes instead of reading the markup string, which keeps it clear of the HTML-sink ban,
 * and it names generated ids (`:r1:`) by order of appearance so a snapshot does not depend on how
 * many components rendered earlier in the same file.
 */
export function serializeDom(root: Element): string {
    const ids = new Map<string, string>();
    const normalise = (value: string): string =>
        value.replace(/:r[0-9a-z]+:/g, (match) => {
            if (!ids.has(match)) ids.set(match, `:id${ids.size + 1}:`);
            return ids.get(match)!;
        });

    const lines: string[] = [];
    const visit = (node: Node, depth: number): void => {
        const pad = '  '.repeat(depth);
        if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent ?? '').trim();
            if (text) lines.push(`${pad}"${normalise(text)}"`);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const element = node as Element;
        const attributes = Array.from(element.attributes)
            .map((attribute) => `${attribute.name}="${normalise(attribute.value)}"`)
            .sort();
        lines.push(`${pad}<${element.localName}${attributes.length ? ' ' + attributes.join(' ') : ''}>`);
        element.childNodes.forEach((child) => visit(child, depth + 1));
    };
    visit(root, 0);
    return lines.join('\n') + '\n';
}
