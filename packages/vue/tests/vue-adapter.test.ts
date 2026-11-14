import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { component, defineAddon, h as viewH, slot } from '@apsw/gridwright/view';
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

    describe('keeping the query when the parent re-renders', () => {
        const rowNames = (root: HTMLElement): string[] => [...root.querySelectorAll('tbody tr td:first-child')].map((cell) => cell.textContent ?? '');
        const sortByName = async (root: HTMLElement): Promise<void> => {
            // Descending needs two activations: ascending, then descending.
            const button = root.querySelector('thead th button') as HTMLButtonElement;
            button.click();
            await nextTick();
            (root.querySelector('thead th button') as HTMLButtonElement).click();
            await nextTick();
        };

        it('does not rebuild the grid when columns and labels are new arrays and objects with the same content', async () => {
            const tick = ref(0);
            const root = await mountVue(() =>
                h(Gridwright, {
                    // Written inline on purpose: a new array and a new object on every parent render.
                    columns: [{ id: 'name', header: 'Name', accessor: (row: Person) => row.name }],
                    labels: { retry: 'Again' },
                    data: sampleData,
                    'data-tick': tick.value,
                }),
            );
            await sortByName(root);
            expect(rowNames(root)).toEqual(['Grace Hopper', 'Ada Lovelace']);

            tick.value += 1;
            await nextTick();
            await nextTick();

            expect(rowNames(root)).toEqual(['Grace Hopper', 'Ada Lovelace']);
            expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');
        });

        it('applies a changed column set to the live grid and keeps the sort', async () => {
            const header = ref('Name');
            const root = await mountVue(() =>
                h(Gridwright, {
                    columns: [{ id: 'name', header: header.value, accessor: (row: Person) => row.name }],
                    data: sampleData,
                }),
            );
            await sortByName(root);

            header.value = 'Full name';
            await nextTick();
            await nextTick();

            expect(root.querySelector('thead th')?.textContent).toContain('Full name');
            expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');
            expect(rowNames(root)).toEqual(['Grace Hopper', 'Ada Lovelace']);
        });

        it('shows new rows under the same sort', async () => {
            const rows = ref<Person[]>([...sampleData]);
            const root = await mountVue(() =>
                h(Gridwright, {
                    columns: [{ id: 'name', header: 'Name', accessor: (row: Person) => row.name }],
                    data: rows.value,
                }),
            );
            await sortByName(root);

            rows.value = [
                { id: 3, name: 'Margaret Hamilton', role: 'Engineer' },
                { id: 4, name: 'Katherine Johnson', role: 'Mathematician' },
                { id: 5, name: 'Annie Easley', role: 'Engineer' },
            ];
            await nextTick();
            await nextTick();

            expect(rowNames(root)).toEqual(['Margaret Hamilton', 'Katherine Johnson', 'Annie Easley']);
            expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');

            rows.value = [{ id: 6, name: 'Dorothy Vaughan', role: 'Mathematician' }];
            await nextTick();
            await nextTick();
            expect(rowNames(root)).toEqual(['Dorothy Vaughan']);
        });

        it('rebuilds when a baked-in option changes by value', async () => {
            const caption = ref('People');
            const root = await mountVue(() =>
                h(Gridwright, {
                    columns: [{ id: 'name', header: 'Name', accessor: (row: Person) => row.name }],
                    data: sampleData,
                    caption: caption.value,
                }),
            );
            expect(root.querySelector('caption')?.textContent).toBe('People');

            caption.value = 'Scientists';
            await nextTick();
            await nextTick();

            expect(root.querySelector('caption')?.textContent).toBe('Scientists');
        });
    });

    it('passes add-on attributes through the allowlist in the custom-cell table too', async () => {
        const hostile = defineAddon<Person>({
            name: 'test:hostile-attributes',
            setup: () => ({
                rowAttributes: () => ({ innerHTML: '<b id="injected">x</b>', 'data-ok': 'kept' }) as never,
                headerAttributes: () => ({ innerHTML: '<b id="injected">x</b>', 'data-ok': 'kept' }) as never,
                tableAttributes: () => ({ innerHTML: '<b id="injected">x</b>', 'data-ok': 'kept' }) as never,
            }),
        });
        const columns: GridwrightColumn<Person>[] = [
            { id: 'name', header: 'Name', accessor: (row) => row.name, render: ({ value }) => h('span', String(value)) },
        ];

        const root = await mountVue(() => h(Gridwright, { columns, data: sampleData, addons: [hostile] }));

        expect(root.querySelector('tbody td span')?.textContent).toBe('Ada Lovelace');
        expect(root.querySelector('#injected')).toBeNull();
        expect(root.querySelector('tbody tr')?.getAttribute('data-ok')).toBe('kept');
        expect(root.querySelector('table')?.getAttribute('data-ok')).toBe('kept');
    });

    it('useGridwright outside a component scope does not warn and leaves destruction to the caller', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const { host } = useGridwright<Person>({
                columns: [{ id: 'name', header: 'Name', accessor: (row) => row.name }],
                data: sampleData,
            });
            expect(warn).not.toHaveBeenCalled();
            host.destroy();
        } finally {
            warn.mockRestore();
        }
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
