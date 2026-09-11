import { loadPackage } from './shared/load-package.js';

const root = document.getElementById('root');
const { React, createRoot, gridwright, core, locales } = await loadPackage(root);

const { Gridwright, rowDataOf } = gridwright;
const { createRemoteDataSource } = core;
const { createElement: h, useMemo, useState } = React;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });

// No JSX here, because there is no build step on this page. `cell` receives a context object and
// returns a React node, exactly as it would in a compiled application.
// `icon` is a renderer like `cell` is, so it is decided per row rather than per column. The grid
// puts it before the text and hides it from assistive technology, since the text already says it.
const PersonIcon = ({ active }) =>
    h('svg', { viewBox: '0 0 16 16', fill: 'currentColor', style: { color: active ? '#16a34a' : '#94a3b8' } },
        h('circle', { cx: 8, cy: 5.2, r: 3.1 }),
        h('path', { d: 'M2.4 14.2a5.6 5.6 0 0 1 11.2 0z' }));

const columns = [
    // `edit` marks a column editable; `onCellEdit` on the component switches editing on. Both are
    // needed, so a column with no `edit` stays read-only however the grid is configured.
    { id: 'name', header: 'Name', edit: { editable: true }, icon: ({ row }) => h(PersonIcon, { active: row.active }) },
    {
        id: 'department',
        header: 'Department',
        edit: {
            inputType: 'select',
            choices: ['Engineering', 'Research', 'Operations', 'Design', 'Finance']
                .map((value) => ({ value, label: value })),
        },
    },
    { id: 'city', header: 'City', edit: { editable: true } },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(value) },
    { id: 'startedOn', header: 'Started', formatValue: (value) => date.format(new Date(value)) },
    {
        id: 'active',
        header: 'Status',
        formatValue: (value) => (value ? 'Active' : 'Inactive'),
        cell: ({ value, row }) =>
            h('span', { className: 'badge-cell', 'data-active': String(row.active) }, value ? 'Active' : 'Inactive'),
    },
];

// What the server would be storing. An edit here is applied to every row the API answers with, so
// editing over a remote source survives the next fetch instead of being undone by it.
const edits = new Map();

// A small hierarchy, so the same component can be shown as a tree without leaving this page. The
// tree is an option on `<Gridwright />`, not a different component: everything else on this page
// keeps working over it.
const TEAM = [
    {
        id: 'eng', name: 'Engineering', kind: 'team', city: 'Kraków', salary: 0, active: true,
        children: [
            { id: 'ada', name: 'Ada Lovelace', kind: 'person', city: 'Kraków', salary: 141_000, active: true },
            {
                id: 'platform', name: 'Platform', kind: 'team', city: 'Warsaw', salary: 0, active: true,
                children: [
                    { id: 'grace', name: 'Grace Hopper', kind: 'person', city: 'Warsaw', salary: 138_000, active: true },
                    { id: 'radia', name: 'Radia Perlman', kind: 'person', city: 'Lisbon', salary: 132_000, active: false },
                ],
            },
        ],
    },
    {
        id: 'research', name: 'Research', kind: 'team', city: 'Berlin', salary: 0, active: true,
        children: [
            { id: 'katherine', name: 'Katherine Johnson', kind: 'person', city: 'Berlin', salary: 129_000, active: true },
            { id: 'barbara', name: 'Barbara Liskov', kind: 'person', city: 'Toronto', salary: 145_000, active: true },
        ],
    },
];

const TeamIcon = () =>
    h('svg', { viewBox: '0 0 16 16', fill: 'currentColor', style: { color: '#f59e0b' } },
        h('path', { d: 'M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.4 1.7H13A1.5 1.5 0 0 1 14.5 5.7v5.8A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5V4Z' }));

const treeColumns = [
    {
        id: 'name',
        header: 'Name',
        edit: { editable: true },
        icon: ({ row }) => (row.kind === 'team' ? h(TeamIcon) : h(PersonIcon, { active: row.active })),
    },
    { id: 'city', header: 'City', edit: { editable: true } },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        formatValue: (value) => (value ? money.format(value) : ''),
        // Asked per row, so a team's empty salary cell stays read-only.
        edit: { editable: (row) => row.kind === 'person', inputType: 'number' },
    },
];

let created = 0;

function makeSource(latency) {
    return createRemoteDataSource({
        retry: { attempts: 0 },
        fetcher: async ({ query, signal }) => {
            const params = new URLSearchParams({
                page: String(query.pagination.pageIndex + 1),
                pageSize: String(query.pagination.pageSize),
                latency: String(latency),
                serverDoes: 'sort,filter,search,paginate',
            });
            if (query.sort.length > 0) {
                params.set('sort', query.sort.map((spec) => `${spec.columnId}:${spec.direction}`).join(','));
            }
            if (query.search.trim() !== '') params.set('search', query.search);

            const response = await fetch(`/api/people?${params}`, { signal });
            const body = await response.json();
            if (!response.ok) throw Object.assign(new Error(body.message), { status: response.status });

            const rows = edits.size === 0
                ? body.data
                : body.data.map((row) => (edits.has(row.id) ? { ...row, ...edits.get(row.id) } : row));

            return { rows, totalRows: body.total };
        },
    });
}

// Every bundled pack, keyed by tag. Imported from the locales entry point, which is separate so a
// consumer pays only for what they name.
const catalogs = { en: locales.en, de: locales.de, es: locales.es, fr: locales.fr, pl: locales.pl };

function App() {
    const [latency, setLatency] = useState(400);
    const [locale, setLocale] = useState('en');
    const [selected, setSelected] = useState(0);
    const [actions, setActions] = useState(false);
    const [editing, setEditing] = useState(false);
    const [virtual, setVirtual] = useState(false);
    const [tree, setTree] = useState(false);
    const [note, setNote] = useState('');
    // The tree's controller, handed back by the component that owns it. Insertion and removal live
    // on it, so the row menu needs it.
    const [controller, setController] = useState(null);

    // A new source identity means a new request, so it is memoised on what actually changes.
    const dataSource = useMemo(() => makeSource(latency), [latency]);

    return h('div', null,
        h('section', { className: 'panel', style: { marginBottom: '20px' } },
            h('h2', null, 'Controls'),
            h('div', { className: 'row' },
                h('label', { className: 'inline' }, 'Latency',
                    h('select', { value: latency, onChange: (event) => setLatency(Number(event.target.value)) },
                        h('option', { value: 0 }, 'none'),
                        h('option', { value: 400 }, '400ms'),
                        h('option', { value: 1500 }, '1.5s'))),
                h('label', { className: 'inline' }, 'Language',
                    h('select', { value: locale, onChange: (event) => setLocale(event.target.value) },
                        h('option', { value: 'en' }, 'English'),
                        h('option', { value: 'de' }, 'Deutsch'),
                        h('option', { value: 'es' }, 'Español'),
                        h('option', { value: 'fr' }, 'Français'),
                        h('option', { value: 'pl' }, 'Polski'))),
                h('span', { style: { color: 'var(--page-muted)' } },
                    selected > 0
                        ? `${selected} selected, counted by the grid and phrased by the catalog.`
                        : 'Select rows and watch the count: Polish needs four plural forms, and the category comes from Intl.PluralRules rather than from this page.')),

            h('div', { className: 'row', style: { marginTop: '10px' } },
                h('label', { className: 'inline' },
                    h('input', { type: 'checkbox', checked: actions, onChange: (event) => setActions(event.target.checked) }),
                    'row actions'),
                h('label', { className: 'inline' },
                    h('input', { type: 'checkbox', checked: editing, onChange: (event) => setEditing(event.target.checked) }),
                    'inline edit'),
                h('label', { className: 'inline' },
                    h('input', { type: 'checkbox', checked: virtual, onChange: (event) => setVirtual(event.target.checked) }),
                    'virtual'),
                h('label', { className: 'inline' },
                    h('input', { type: 'checkbox', checked: tree, onChange: (event) => setTree(event.target.checked) }),
                    'tree'),
                note && h('span', { style: { color: 'var(--page-muted)' } }, note)),
            h('p', { className: 'hint' },
                'This is the same component as the ',
                h('a', { href: '/examples/playground/tree.html' }, 'features page'),
                ', which puts every option in one place. The switches above are props on the ',
                'component below: over the paginating API, virtual replaces the page controls with ',
                'a scrollbar that moves the fetched page as you scroll, and editing writes to the ',
                'mock table so it survives the next fetch. Tick tree and the same component shows a ',
                'hierarchy instead, with the same menu, the same editors and the same icons.')),

        h('section', { className: 'panel' },
            h('h2', null, 'The component'),
            h(Gridwright, tree ? {
                key: 'tree',
                columns: treeColumns,
                data: TEAM,
                pageSize: 100,
                searchable: true,
                selectionMode: 'multiple',
                locale: catalogs[locale],
                'aria-label': 'Team',
                tree: {
                    getRowId: (row) => row.id,
                    getChildren: (row) => row.children,
                    defaultExpandedDepth: 1,
                    controllerRef: setController,
                    onCommit: async (change) => {
                        setNote(`${change.type} ${change.rowId}`);
                        await new Promise((resolve) => setTimeout(resolve, Number(latency)));
                    },
                },
                ...(virtual ? { virtual: { rowHeight: 40, height: 440 } } : {}),
                ...(actions
                    ? {
                          rowActions: [
                              {
                                  id: 'add',
                                  label: 'Add person',
                                  hidden: (row) => rowDataOf(row).kind !== 'team',
                                  onSelect: (row) =>
                                      void controller?.insertRow(
                                          {
                                              id: `new-${(created += 1)}`,
                                              name: 'New hire',
                                              kind: 'person',
                                              city: 'Kraków',
                                              salary: 90_000,
                                              active: true,
                                          },
                                          { referenceNodeId: String(row.id), position: 'child' },
                                      ),
                              },
                              {
                                  id: 'inspect',
                                  label: 'Inspect',
                                  separatorBefore: true,
                                  onSelect: (row) => setNote(`${rowDataOf(row).name}, ${rowDataOf(row).city}`),
                              },
                              {
                                  id: 'remove',
                                  label: 'Remove',
                                  destructive: true,
                                  onSelect: (row) => void controller?.removeNode(String(row.id)),
                              },
                          ],
                      }
                    : {}),
                ...(editing
                    ? {
                          onCellEdit: (rowId, columnId, value) =>
                              controller?.updateRow(rowId, { [columnId]: value }),
                      }
                    : {}),
            } : {
                key: 'flat',
                columns,
                dataSource,
                // Under `virtual` this is the size of the data window the body moves, not a page
                // anyone turns, so it is worth more rows per request.
                pageSize: virtual ? 100 : 25,
                searchable: true,
                selectionMode: 'multiple',
                queryDebounceMs: 250,
                // One prop switches the text, the plural rules, the number formatting and the
                // text direction together.
                locale: catalogs[locale],
                'aria-label': 'Employees',
                onSelectionChange: (ids) => setSelected(ids.length),
                onRowClick: (row) => console.log('row clicked', row.data.name),
                ...(virtual ? { virtual: { rowHeight: 40, height: 440 } } : {}),
                ...(actions
                    ? {
                          rowActions: [
                              {
                                  id: 'inspect',
                                  label: 'Inspect',
                                  onSelect: (row) => setNote(`${row.data.name}, ${row.data.city}`),
                              },
                              {
                                  id: 'deactivate',
                                  label: 'Deactivate',
                                  destructive: true,
                                  hidden: (row) => !row.data.active,
                                  onSelect: (row) => {
                                      edits.set(row.data.id, { active: false });
                                      dataSource.invalidate();
                                  },
                              },
                          ],
                      }
                    : {}),
                ...(editing
                    ? {
                          onCellEdit: (rowId, columnId, value) => {
                              edits.set(rowId, { ...edits.get(rowId), [columnId]: value });
                              // The source notifies the grid, which asks again. The row that comes
                              // back carries the edit, because the mock table now has it.
                              dataSource.invalidate();
                              setNote(`saved ${columnId} on row ${rowId}`);
                          },
                      }
                    : {}),
            })));
}

createRoot(root).render(h(React.StrictMode, null, h(App)));
