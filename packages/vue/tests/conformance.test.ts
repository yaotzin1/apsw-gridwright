import { describe, it } from 'vitest';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createApp, h, nextTick } from 'vue';
import type { App } from 'vue';
import { conformanceSuite } from '@apsw/gridwright/conformance';
import type { ConformanceDriver, DriverElement, DriverGrid, DriverMountOptions } from '@apsw/gridwright/conformance';
import { Gridwright, pagination, selection } from '@apsw/gridwright-vue';
import type { GridwrightColumn } from '@apsw/gridwright-vue';

type Row = Record<string, string | number>;

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
    ...({ element } as object),
});

const elementOf = (wrapped: DriverElement): HTMLElement => (wrapped as unknown as { element: HTMLElement }).element;

const settle = async (): Promise<void> => {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
};

function vueDriver(): ConformanceDriver {
    let app: App<Element> | null = null;
    let container: HTMLElement | null = null;

    return {
        async mount(options: DriverMountOptions): Promise<DriverGrid> {
            const first = options.columns[0]!.id;
            const columns: GridwrightColumn<Row>[] = options.columns.map((column) => ({
                id: column.id,
                header: column.header,
                ...(column.sortable === false ? { sortable: false } : {}),
            }));

            container = document.createElement('div');
            document.body.append(container);

            app = createApp({
                render: () =>
                    h(Gridwright, {
                        columns,
                        data: options.rows as Row[],
                        getRowId: (row) => String(row[first]),
                        pageSize: options.pageSize ?? options.rows.length,
                        addons: [
                            pagination<Row>(),
                            ...(options.selection ? [selection<Row>({ selectOnRowClick: options.selection.onRowClick === true })] : []),
                        ],
                        ...(options.selection ? { selectionMode: options.selection.mode } : {}),
                    }),
            });
            app.mount(container);
            await settle();

            const root = container;
            const user = userEvent.setup();
            const matching = (role: string, name?: string): Element[] =>
                within(root).queryAllByRole(role, name === undefined ? {} : { name });

            return {
                text: () => root.textContent ?? '',
                query: (role, name) => {
                    const found = matching(role, name)[0];
                    return found ? wrap(found, role) : null;
                },
                queryAll: (role) => matching(role).map((found) => wrap(found, role)),
                rows: () =>
                    Array.from(root.querySelectorAll('tbody tr')).map((row) =>
                        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent ?? ''),
                    ),
                click: async (on, click) => {
                    if (click?.shift) await user.keyboard('{Shift>}');
                    await user.click(elementOf(on));
                    if (click?.shift) await user.keyboard('{/Shift}');
                    await settle();
                },
                choose: async (on, value) => {
                    await user.selectOptions(elementOf(on) as unknown as HTMLSelectElement, value);
                    await settle();
                },
                press: async (key, on) => {
                    if (on) elementOf(on).focus();
                    if (key === 'Tab') await user.tab();
                    else await user.keyboard(`{${key}}`);
                    await settle();
                },
                focused: () =>
                    document.activeElement && document.activeElement !== document.body && root.contains(document.activeElement)
                        ? wrap(document.activeElement)
                        : null,
                liveRegionText: () => within(root).getByRole('status').textContent ?? '',
            };
        },
        unmount: () => {
            app?.unmount();
            container?.remove();
            app = null;
            container = null;
        },
    };
}

conformanceSuite(vueDriver(), { describe, it });
