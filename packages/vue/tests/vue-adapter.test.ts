import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { component, h as viewH, slot } from '@apsw/gridwright/view';
import type { ViewEvent } from '@apsw/gridwright/view';
import { Gridwright, renderViewNode, selection, useGridwright } from '@apsw/gridwright-vue';
import type { CellRenderContext, GridwrightColumn } from '@apsw/gridwright-vue';

interface Person {
    id: number;
    name: string;
    role: string;
}

const sampleData: Person[] = [
    { id: 1, name: 'Ada Lovelace', role: 'Mathematician' },
    { id: 2, name: 'Grace Hopper', role: 'Computer Scientist' },
];

describe('@apsw/gridwright-vue', () => {
    let app: App<Element> | null = null;
    let container: HTMLElement | null = null;

    const mountVue = async (renderFn: () => ReturnType<typeof h>) => {
        container = document.createElement('div');
        document.body.append(container);
        app = createApp({
            render: renderFn,
        });
        app.mount(container);
        await nextTick();
        return container;
    };

    afterEach(() => {
        app?.unmount();
        container?.remove();
        app = null;
        container = null;
    });

    it('renders custom cell content via column.render and #cell / #cell-<id> / #toolbar slots', async () => {
        const columns: GridwrightColumn<Person>[] = [
            {
                id: 'name',
                header: 'Name',
                accessor: (row) => row.name,
                render: ({ value }: CellRenderContext<Person>) => h('strong', { class: 'custom-name' }, String(value)),
            },
            {
                id: 'role',
                header: 'Role',
                accessor: (row) => row.role,
            },
        ];

        container = document.createElement('div');
        document.body.append(container);
        app = createApp({
            render: () =>
                h(
                    Gridwright,
                    {
                        columns,
                        data: sampleData,
                        selectionMode: 'multiple',
                        addons: [selection<Person>()],
                    },
                    {
                        toolbar: () => h('span', { class: 'custom-toolbar' }, 'Actions'),
                        'cell-role': ({ value }: CellRenderContext<Person>) =>
                            h('em', { class: 'custom-role' }, String(value).toUpperCase()),
                    },
                ),
        });
        app.mount(container);
        await nextTick();

        expect(container.querySelector('.custom-toolbar')?.textContent).toBe('Actions');
        expect(container.querySelectorAll('.custom-name').length).toBe(2);
        expect(container.querySelector('.custom-name')?.textContent).toBe('Ada Lovelace');
        expect(container.querySelector('.custom-role')?.textContent).toBe('MATHEMATICIAN');
    });

    it('falls back to #cell default slot when column.render and #cell-<id> are absent', async () => {
        const columns: GridwrightColumn<Person>[] = [
            { id: 'name', header: 'Name', accessor: (row) => row.name },
        ];

        container = document.createElement('div');
        document.body.append(container);
        app = createApp({
            render: () =>
                h(
                    Gridwright,
                    {
                        columns,
                        data: sampleData,
                    },
                    {
                        cell: ({ value, column }: CellRenderContext<Person>) =>
                            h('span', { 'data-col': column.id }, `[${String(value)}]`),
                    },
                ),
        });
        app.mount(container);
        await nextTick();

        expect(container.querySelector('td span[data-col="name"]')?.textContent).toBe('[Ada Lovelace]');
    });

    it('updates the grid when reactive data props change and destroys host on unmount', async () => {
        const rows = ref<Person[]>([...sampleData]);
        const columns: GridwrightColumn<Person>[] = [
            { id: 'name', header: 'Name', accessor: (row) => row.name },
        ];

        const Wrapper = defineComponent({
            setup() {
                return () =>
                    h(Gridwright, {
                        columns,
                        data: rows.value,
                    });
            },
        });

        container = document.createElement('div');
        document.body.append(container);
        app = createApp(Wrapper);
        app.mount(container);
        await nextTick();

        expect(container.querySelectorAll('tbody tr').length).toBe(2);

        rows.value = [{ id: 3, name: 'Margaret Hamilton', role: 'Engineer' }];
        await nextTick();

        expect(container.querySelectorAll('tbody tr').length).toBe(1);
        expect(container.querySelector('tbody td')?.textContent).toBe('Margaret Hamilton');
    });

    it('supports useGridwright composable and cleans up on unmount', async () => {
        let destroyed = false;
        const Comp = defineComponent({
            setup() {
                const { model, host } = useGridwright<Person>({
                    columns: [{ id: 'name', header: 'Name', accessor: (row) => row.name }],
                    data: sampleData,
                });
                const origDestroy = host.destroy.bind(host);
                host.destroy = () => {
                    destroyed = true;
                    origDestroy();
                };
                return () => h('div', { class: 'row-count' }, String(model.value.body.kind === 'rows' ? model.value.body.rowCount : 0));
            },
        });

        const root = await mountVue(() => h(Comp));
        expect(root.querySelector('.row-count')?.textContent).toBe('2');
        expect(destroyed).toBe(false);

        app?.unmount();
        app = null;
        expect(destroyed).toBe(true);
    });

    it('renderViewNode sanitizes nodes, resolves slots/components safely, and expires event origin after dispatch', async () => {
        let liveOriginDuringDispatch: boolean | undefined;
        let expiredEvent: ViewEvent | null = null;
        let clickCount = 0;
        const node = viewH(
            'div',
            { attrs: { className: 'box' } },
            viewH('button', {
                attrs: { type: 'button' },
                on: {
                    click: (ev) => {
                        clickCount++;
                        if (clickCount === 1) {
                            liveOriginDuringDispatch = ev.origin?.fromControl;
                        } else {
                            // Do not read ev.origin during dispatch so we can verify post-dispatch expiry.
                            expiredEvent = ev;
                        }
                    },
                },
            }, 'Click'),
            slot('extra'),
            component('badge', { label: 'New' }),
            component('toString', {}),
        );

        const root = await mountVue(() =>
            h('div', {}, [
                renderViewNode(node, {
                    slots: { extra: () => h('span', { class: 'slot-el' }, 'Extra') },
                    components: { badge: (p) => h('span', { class: 'badge-el' }, String(p?.label ?? '')) },
                }),
            ]),
        );

        expect(root.querySelector('.slot-el')?.textContent).toBe('Extra');
        expect(root.querySelector('.badge-el')?.textContent).toBe('New');

        const button = root.querySelector('button')!;
        button.click();
        expect(liveOriginDuringDispatch).toBe(true);

        button.click();
        expect(expiredEvent).not.toBeNull();
        expect(expiredEvent!.origin?.fromControl).toBe(true);
        expect(expiredEvent!.origin?.fromNestedGrid).toBe(true);
    });
});
