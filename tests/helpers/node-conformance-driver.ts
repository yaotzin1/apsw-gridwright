import type { ConformanceDriver, DriverElement, DriverGrid, DriverMountOptions } from '../../src/conformance';
import { createGridHost, sanitizeNode, tableNode, viewEvent } from '../../src/view';
import type { GridHost, ViewNode } from '../../src/view';

/**
 * A conformance driver with no DOM and no framework: the grid is drawn as a node description and the
 * driver reads it the way a browser and an assistive technology would, by role and name, and delivers
 * clicks and keys by calling the handlers the nodes carry.
 *
 * If this driver passes the same scenarios as the React one, the table model and the neutral add-ons
 * describe a grid completely enough that a second renderer needs nothing from React.
 */

type Element = Extract<ViewNode, { kind: 'element' }>;
interface Found {
    readonly node: Element;
    /** Nearest first, so a click can bubble the way the browser's does. */
    readonly ancestors: readonly Element[];
}

const IMPLIED_ROLE: Readonly<Record<string, string>> = { button: 'button', th: 'columnheader', td: 'cell', tr: 'row', tbody: 'rowgroup', thead: 'rowgroup' };

const roleOf = (node: Element): string => {
    const explicit = node.attrs?.role;
    if (typeof explicit === 'string' && explicit) return explicit;
    return IMPLIED_ROLE[node.tag] ?? node.tag;
};

/** The name a reader hears: `aria-label`, else the text that is not hidden from assistive technology. */
function textOf(node: ViewNode): string {
    switch (node.kind) {
        case 'text':
            return node.value;
        case 'element':
            return node.attrs?.['aria-hidden'] === 'true' ? '' : (node.children ?? []).map(textOf).join('');
        case 'fragment':
            return node.children.map(textOf).join('');
        default:
            return '';
    }
}

const nameOf = (node: Element): string => {
    const label = node.attrs?.['aria-label'];
    return typeof label === 'string' && label ? label : textOf(node).trim();
};

function walk(node: ViewNode, ancestors: readonly Element[], out: Found[]): void {
    if (node.kind === 'fragment') {
        for (const child of node.children) walk(child, ancestors, out);
    } else if (node.kind === 'element') {
        out.push({ node, ancestors });
        for (const child of node.children ?? []) walk(child, [node, ...ancestors], out);
    }
}

const isFocusable = ({ node }: Found): boolean =>
    (node.tag === 'button' || node.tag === 'input') && node.attrs?.disabled !== true && node.attrs?.tabIndex !== -1;

function wrap(found: Found): DriverElement {
    const { node } = found;
    const element: DriverElement & { readonly found: Found } = {
        role: roleOf(node),
        name: nameOf(node),
        text: () => textOf(node),
        attribute: (name) => {
            const value = node.attrs?.[name];
            return value === undefined || value === null ? null : String(value);
        },
        found,
    };
    return element;
}

const foundOf = (element: DriverElement): Found => (element as unknown as { found: Found }).found;

export function nodeDriver(): ConformanceDriver {
    let host: GridHost<Record<string, string | number>> | null = null;

    return {
        async mount(options: DriverMountOptions): Promise<DriverGrid> {
            const first = options.columns[0]!.id;
            host = createGridHost<Record<string, string | number>>({
                columns: options.columns.map((column) => ({
                    id: column.id,
                    header: column.header,
                    ...(column.sortable === false ? { sortable: false } : {}),
                })),
                data: options.rows,
                getRowId: (row) => String(row[first]),
                pageSize: options.pageSize ?? options.rows.length,
            });
            const mounted = host;

            // What the renderer would draw now, through the one allowlist every renderer runs first.
            const all = (): Found[] => {
                const found: Found[] = [];
                const { node } = sanitizeNode(tableNode(mounted.getModel()));
                if (node) walk(node, [], found);
                return found;
            };
            const byRole = (role: string, name?: string): Found[] =>
                all().filter((candidate) => roleOf(candidate.node) === role && (name === undefined || nameOf(candidate.node) === name));

            // Focus is a position in the tab order, so it survives the redraws a click causes.
            let focusAt = -1;
            const tabOrder = (): Found[] => all().filter(isFocusable);

            const activate = (found: Found, shiftKey: boolean): void => {
                for (const candidate of [found.node, ...found.ancestors]) {
                    const click = candidate.on?.click;
                    if (click) {
                        click(viewEvent({ shiftKey }));
                        return;
                    }
                }
            };

            return {
                text: () => all().filter(({ node }) => node.tag === 'div' && node.attrs?.className === 'gw-root').map(({ node }) => textOf(node)).join(' '),
                query: (role, name) => {
                    const found = byRole(role, name)[0];
                    return found ? wrap(found) : null;
                },
                queryAll: (role) => byRole(role).map(wrap),
                rows: () =>
                    all()
                        .filter(({ node, ancestors }) => node.tag === 'tr' && ancestors.some((ancestor) => ancestor.tag === 'tbody'))
                        .map(({ node }) => (node.children ?? []).map((cell) => textOf(cell).trim())),
                click: async (on, click) => {
                    const target = foundOf(on);
                    const index = tabOrder().findIndex((candidate) => candidate.node === target.node);
                    if (index >= 0) focusAt = index;
                    activate(target, click?.shift === true);
                },
                press: async (key, on) => {
                    if (on) {
                        const target = foundOf(on);
                        const index = tabOrder().findIndex((candidate) => candidate.node === target.node);
                        if (index >= 0) focusAt = index;
                    }
                    const order = tabOrder();
                    if (key === 'Tab') {
                        focusAt = order.length === 0 ? -1 : (focusAt + 1) % order.length;
                        return;
                    }
                    // A focused button is activated by Enter and Space, as the browser does it.
                    if ((key === 'Enter' || key === ' ' || key === 'Space') && focusAt >= 0) {
                        const target = order[focusAt];
                        if (target?.node.tag === 'button') activate(target, false);
                    }
                },
                focused: () => {
                    const target = tabOrder()[focusAt];
                    return target ? wrap(target) : null;
                },
                liveRegionText: () => {
                    const region = byRole('status')[0];
                    return region ? textOf(region.node).trim() : '';
                },
            };
        },
        unmount: () => {
            host?.destroy();
            host = null;
        },
    };
}
