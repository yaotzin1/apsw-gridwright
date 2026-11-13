# @apsw/gridwright-vue

Vue 3 adapter for [`@apsw/gridwright`](../../README.md), built on the framework-neutral `@apsw/gridwright/view` layer.

## Installation

```bash
npm install @apsw/gridwright @apsw/gridwright-vue vue
```

Import the shared unstyled stylesheet once in your app:

```ts
import '@apsw/gridwright/styles.css';
```

## Quick start

```ts
import { defineComponent, h } from 'vue';
import { Gridwright, pagination, selection, sorting } from '@apsw/gridwright-vue';
import type { GridwrightColumn } from '@apsw/gridwright-vue';

interface Person {
    id: number;
    name: string;
    role: string;
}

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', accessor: (row) => row.name },
    { id: 'role', header: 'Role', accessor: (row) => row.role },
];

export default defineComponent({
    setup() {
        const data: Person[] = [
            { id: 1, name: 'Ada Lovelace', role: 'Mathematician' },
            { id: 2, name: 'Grace Hopper', role: 'Computer Scientist' },
        ];
        return () =>
            h(Gridwright, {
                columns,
                data,
                pageSize: 25,
                selectionMode: 'multiple',
                coreAddons: [sorting(), pagination()],
                addons: [selection()],
            });
    },
});
```

## Custom cells & slots

- Column `render`: pass `render: ({ value, row, rowIndex, column }) => ...` on any `GridwrightColumn`.
- Scoped slots: use `#cell="{ value, row, rowIndex, column }"` or `#cell-<columnId>="{ value, row, rowIndex, column }"`.
- Toolbar slot: use `#toolbar` to render content in the grid toolbar (which also enables add-on toolbar status such as selection count).

## Composable (`useGridwright`)

For custom layouts, `useGridwright(options)` creates and manages the `GridHost`, exposes a reactive `ShallowRef<TableModel<TRow>>` (`model`), `api`, `host`, and `takeFocusRequest()`, and destroys the host on scope disposal.
