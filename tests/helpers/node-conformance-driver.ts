import type { ConformanceDriver, DriverElement, DriverGrid, DriverMountOptions } from '../../src/conformance';
import { createGridHost, pagination, sanitizeNode, selection, tableNode, viewEvent } from '../../src/view';
import type { GridHost, ViewEventOrigin, ViewNode } from '../../src/view';

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

const IMPLIED_ROLE: Readonly<Record<string, string>> = {
    button: 'button',
    th: 'columnheader',
    td: 'cell',
    tr: 'row',
    tbody: 'rowgroup',
    thead: 'rowgroup',
    select: 'combobox',
    option: 'option',
};

const roleOf = (node: Element): string => {
    const explicit = node.attrs?.role;
    if (typeof explicit === 'string' && explicit) return explicit;
    if (node.tag === 'input') return node.attrs?.type === 'checkbox' ? 'checkbox' : 'textbox';
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

/** Elements a click on them operates for themselves, so a click that started on one is not a click on the row. */
const CONTROL_TAGS: ReadonlySet<string> = new Set(['button', 'a', 'input', 'select', 'textarea', 'label']);
const CONTROL_ROLES: ReadonlySet<string> = new Set(['button', 'checkbox', 'switch', 'link', 'menuitem']);
const isControl = (node: Element): boolean => CONTROL_TAGS.has(node.tag) || CONTROL_ROLES.has(String(node.attrs?.role ?? ''));

const holdsControl = (node: ViewNode): boolean =>
    node.kind === 'element'
        ? (CONTROL_TAGS.has(node.tag) && node.attrs?.disabled !== true) || (node.children ?? []).some(holdsControl)
        : node.kind === 'fragment'
          ? node.children.some(holdsControl)
          : false;

/**
 * What a real adapter would answer about an event that started at `target` and is being handled by
 * `current`: the same questions, read from the node tree instead of a DOM. This driver draws one table, so
 * there is no nested grid, and it has no text selection.
 */
function originOf(target: Found, current: Element): ViewEventOrigin {
    const chain = [target.node, ...target.ancestors];
    const here = chain.indexOf(current);
    const within = chain.slice(0, here + 1);
    const cell = chain.find((node) => node.tag === 'td');
    const row = cell === undefined ? undefined : chain.slice(chain.indexOf(cell) + 1).find((node) => node.tag === 'tr');
    const rowId = row?.attrs?.['data-row-id'];
    return {
        ...(cell !== undefined && typeof rowId === 'string'
            ? {
                  cell: {
                      rowId,
                      columnId: String(cell.attrs?.['data-column-id'] ?? ''),
                      holdsControl: holdsControl(cell),
                      targetIsCell: target.node === cell,
                  },
              }
            : {}),
        fromControl: within.some(isControl),
        fromNestedGrid: false,
        textSelected: false,
    };
}

function wrap(found: Found): DriverElement {
    const { node } = found;
    const element: DriverElement & { readonly found: Found } = {
        role: roleOf(node),
        name: nameOf(node),
        text: () => textOf(node),
        attribute: (name) => {
            const value = node.attrs?.[name];
            if (value === undefined || value === null) return null;
            // A boolean attribute is present or absent, as in the DOM; only aria-* and data-* carry the word.
            if (typeof value === 'boolean' && !/^(aria|data)-/.test(name)) return value ? '' : null;
            return String(value);
        },
        value: () => {
            if (node.tag === 'select') {
                const chosen = (node.children ?? []).find((child) => child.kind === 'element' && child.attrs?.selected === true);
                return chosen?.kind === 'element' ? String(chosen.attrs?.value ?? '') : null;
            }
            return node.tag === 'input' && node.attrs?.value !== undefined ? String(node.attrs.value) : null;
        },
        checked: () => (node.tag === 'input' && node.attrs?.type === 'checkbox' ? node.attrs.checked === true : null),
        indeterminate: () => node.tag === 'input' && node.attrs?.indeterminate === true,
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
                // The React grid starts with sorting, selection and pagination; this one is given the same.
                addons: [
                    pagination<Record<string, string | number>>(),
                    ...(options.selection ? [selection<Record<string, string | number>>({ selectOnRowClick: options.selection.onRowClick === true })] : []),
                ],
                ...(options.selection ? { selectionMode: options.selection.mode } : {}),
            });
            const mounted = host;

            // What the renderer would draw now, through the one allowlist every renderer runs first.
            // One drawing per model, so the nodes a scenario holds are the nodes the driver later compares them to.
            let drawing: { readonly model: unknown; readonly found: Found[] } | null = null;
            const all = (): Found[] => {
                const model = mounted.getModel();
                if (drawing?.model === model) return drawing.found;
                const found: Found[] = [];
                const { node } = sanitizeNode(tableNode(model));
                if (node) walk(node, [], found);
                drawing = { model, found };
                return found;
            };
            const byRole = (role: string, name?: string): Found[] =>
                all().filter((candidate) => roleOf(candidate.node) === role && (name === undefined || nameOf(candidate.node) === name));

            // Focus belongs to an element, and the elements are redrawn after every change, so it is remembered by the
            // node `key` where there is one (the pager's buttons) and by position in the tab order where there is not (a
            // sort button never moves). An element that stops being focusable, such as a button that disables itself,
            // loses focus, as in the browser.
            let focusAt = -1;
            let focusKey: string | null = null;
            const tabOrder = (): Found[] => all().filter(isFocusable);
            const focusedIn = (order: readonly Found[]): Found | undefined =>
                focusKey !== null ? order.find((candidate) => candidate.node.key === focusKey) : order[focusAt];
            const focusOn = (order: readonly Found[], index: number): void => {
                focusAt = index;
                focusKey = order[index]?.node.key ?? null;
            };

            // A click reaches the handler on the element, then on each element around it, until one stops it. A
            // checkbox then reports its change, as the browser does after the click.
            const activate = (found: Found, shiftKey: boolean): void => {
                let stopped = false;
                // A disabled control receives no click, as in the browser.
                if (found.node.attrs?.disabled === true) return;
                for (const current of [found.node, ...found.ancestors]) {
                    const click = current.on?.click;
                    if (!click) continue;
                    click(
                        viewEvent({
                            shiftKey,
                            origin: originOf(found, current),
                            stopPropagation: () => {
                                stopped = true;
                            },
                        }),
                    );
                    if (stopped) break;
                }
                const { node } = found;
                if (node.tag === 'input' && node.attrs?.type === 'checkbox') {
                    node.on?.change?.(viewEvent({ checked: node.attrs.checked !== true, origin: originOf(found, node) }));
                }
            };

            // What an add-on asked for once the page settled, applied the way an adapter would: the element it named by
            // `key`, among those that can take focus.
            const applyFocusRequest = (): void => {
                const key = mounted.takeFocusRequest();
                if (key === null) return;
                const order = tabOrder();
                const index = order.findIndex((candidate) => candidate.node.key === key);
                if (index >= 0) focusOn(order, index);
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
                    const order = tabOrder();
                    const index = order.findIndex((candidate) => candidate.node === target.node);
                    if (index >= 0) focusOn(order, index);
                    activate(target, click?.shift === true);
                    applyFocusRequest();
                },
                choose: async (on, value) => {
                    const { node } = foundOf(on);
                    node.on?.change?.(viewEvent({ value }));
                    applyFocusRequest();
                },
                press: async (key, on) => {
                    const order = tabOrder();
                    if (on) {
                        const target = foundOf(on);
                        const index = order.findIndex((candidate) => candidate.node === target.node);
                        if (index >= 0) focusOn(order, index);
                    }
                    if (key === 'Tab') {
                        const here = focusedIn(order);
                        const from = here ? order.indexOf(here) : focusAt;
                        focusOn(order, order.length === 0 ? -1 : (from + 1) % order.length);
                        return;
                    }
                    // A focused button is activated by Enter and Space, as the browser does it.
                    if (key === 'Enter' || key === ' ' || key === 'Space') {
                        const target = focusedIn(order);
                        if (target?.node.tag === 'button') activate(target, false);
                    }
                    applyFocusRequest();
                },
                focused: () => {
                    const target = focusedIn(tabOrder());
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
