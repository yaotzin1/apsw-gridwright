import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Gridwright } from '../../src/react/index';
import { coreAddons } from '../../src/react/core-addons';
import type { ConformanceDriver, DriverElement, DriverGrid, DriverMountOptions } from '../../src/conformance';

type Row = Readonly<Record<string, string | number>>;

const roleOf = (element: Element): string => {
    const explicit = element.getAttribute('role');
    if (explicit) return explicit;
    switch (element.localName) {
        case 'button':
            return 'button';
        case 'th':
            return 'columnheader';
        case 'td':
            return 'cell';
        case 'tr':
            return 'row';
        case 'select':
            return (element as HTMLSelectElement).multiple ? 'listbox' : 'combobox';
        case 'option':
            return 'option';
        case 'input':
            return (element as HTMLInputElement).type === 'checkbox' ? 'checkbox' : 'textbox';
        default:
            return element.localName;
    }
};

/** The name a reader hears: `aria-label`, else the text that is not hidden from assistive technology. */
function nameOf(element: Element): string {
    const label = element.getAttribute('aria-label');
    if (label) return label;
    const parts: string[] = [];
    const walk = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '');
        else if (node instanceof Element && node.getAttribute('aria-hidden') !== 'true') node.childNodes.forEach(walk);
    };
    element.childNodes.forEach(walk);
    return parts.join('').trim();
}

const wrap = (element: Element, role = roleOf(element)): DriverElement => ({
    role,
    name: nameOf(element),
    text: () => element.textContent ?? '',
    attribute: (name) => element.getAttribute(name),
    value: () => (element instanceof HTMLSelectElement || element instanceof HTMLInputElement ? element.value : null),
    checked: () => (element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : null),
    indeterminate: () => element instanceof HTMLInputElement && element.indeterminate,
    // The wrapper keeps its element, so the driver can act on what the scenario holds.
    ...({ element } as object),
});

const elementOf = (wrapped: DriverElement): Element => (wrapped as unknown as { element: Element }).element;

/** The React grid as a conformance driver, through Testing Library: the same questions a reader could ask. */
export function reactDriver(): ConformanceDriver {
    return {
        async mount(options: DriverMountOptions): Promise<DriverGrid> {
            const first = options.columns[0]!.id;
            const columns = options.columns.map((column) => ({
                id: column.id,
                header: column.header,
                ...(column.sortable === false ? { sortable: false } : {}),
            }));
            render(
                <Gridwright<Row>
                    columns={columns}
                    data={options.rows as Row[]}
                    getRowId={(row) => String(row[first])}
                    pageSize={options.pageSize ?? options.rows.length}
                    {...(options.selection
                        ? {
                              selectionMode: options.selection.mode,
                              coreAddons: coreAddons<Row>({ selection: { selectOnRowClick: options.selection.onRowClick === true } }),
                          }
                        : {})}
                />,
            );
            const user = userEvent.setup();
            const matching = (role: string, name?: string): Element[] =>
                screen.queryAllByRole(role, name === undefined ? {} : { name });

            return {
                text: () => document.body.textContent ?? '',
                query: (role, name) => {
                    const found = matching(role, name)[0];
                    return found ? wrap(found, role) : null;
                },
                queryAll: (role) => matching(role).map((found) => wrap(found, role)),
                rows: () =>
                    Array.from(document.querySelectorAll('tbody tr')).map((row) =>
                        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent ?? ''),
                    ),
                click: async (on, click) => {
                    if (click?.shift) await user.keyboard('{Shift>}');
                    await user.click(elementOf(on) as HTMLElement);
                    if (click?.shift) await user.keyboard('{/Shift}');
                },
                choose: async (on, value) => {
                    await user.selectOptions(elementOf(on) as HTMLSelectElement, value);
                },
                press: async (key, on) => {
                    if (on) (elementOf(on) as HTMLElement).focus();
                    if (key === 'Tab') await user.tab();
                    else await user.keyboard(`{${key}}`);
                },
                focused: () => (document.activeElement && document.activeElement !== document.body ? wrap(document.activeElement) : null),
                liveRegionText: () => screen.getByRole('status').textContent ?? '',
            };
        },
        unmount: () => cleanup(),
    };
}
