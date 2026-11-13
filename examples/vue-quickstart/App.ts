import { defineComponent, h } from 'vue';
import { Gridwright, pagination, selection, sorting } from '@apsw/gridwright-vue';
import type { GridwrightColumn } from '@apsw/gridwright-vue';

interface Person {
    readonly id: number;
    readonly name: string;
    readonly role: string;
}

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', accessor: (row) => row.name },
    { id: 'role', header: 'Role', accessor: (row) => row.role },
];

const people: Person[] = [
    { id: 1, name: 'Ada Lovelace', role: 'Mathematician' },
    { id: 2, name: 'Grace Hopper', role: 'Computer Scientist' },
    { id: 3, name: 'Margaret Hamilton', role: 'Software Engineer' },
    { id: 4, name: 'Barbara Liskov', role: 'Computer Scientist' },
];

export const App = defineComponent({
    name: 'VueQuickstartApp',
    setup() {
        return () =>
            h('main', { style: 'max-width: 720px; margin: 2rem auto; font-family: system-ui, sans-serif;' }, [
                h('h1', '@apsw/gridwright-vue quickstart'),
                h(Gridwright, {
                    columns,
                    data: people,
                    getRowId: (row: Person) => row.id,
                    pageSize: 10,
                    selectionMode: 'multiple',
                    coreAddons: [sorting<Person>(), pagination<Person>()],
                    addons: [selection<Person>()],
                }),
            ]);
    },
});
