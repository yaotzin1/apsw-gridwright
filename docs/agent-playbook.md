# Agent playbook

For an AI coding agent writing `apsw-gridwright` code in someone's React application. Rules and
canonical snippets, no narrative. The reasoning behind every rule is in
[the React playbook](react-playbook.md); follow the rule, read the reasoning only when a request
seems to need an exception.

> This file is about **using** the package in an application. It is not the repository's own
> operating cycle — that is `workflow.ai.yml` and `AGENTS.md`, and it applies to changing this
> package, not to consuming it.

## Imports

```ts
import { Gridwright, /* add-ons, hooks, parts */ } from 'apsw-gridwright/react'; // build with this
import { createRestDataSource, /* engine, sources */ } from 'apsw-gridwright';   // headless engine
import { pl } from 'apsw-gridwright/locales';                                    // translations
import 'apsw-gridwright/styles.css';                                             // once, at the entry
```

Peer dependency: React 18 or 19. No runtime dependencies.

## Always

- Give every grid an `aria-label` or a `caption`.
- Build a data source in `useMemo` (deps = what it reads) or at module scope. **Never inline in JSX.**
- Declare `capabilities` truthfully. Unstated facets default to all-true for remote sources.
- Use `formatValue` when the cell's answer is text; `cell` only for real React.
- Pass `signal` from the fetcher into `fetch`.
- Pass `getRowId` when rows have no `id` property.
- Put a feature in `addons={[...]}`; put per-column configuration on the column.
- Keep `virtualRows({ rowHeight })` equal to `--gw-row-height`.
- Let `inlineEditing`'s `commit` throw to reject an edit. Do not also mutate local state.

## Never

- Never compute or fake a total the source did not supply. No `totalRows` means the grid says
  "of many", and that is correct.
- Never claim a capability the endpoint does not implement.
- Never list `rowDetail()` with `virtualRows()` — it throws by design.
- Never give an add-on's extra `<tr>` `role="row"`; use `role="presentation"` with a labelled
  `role="region"` inside.
- Never assert on class names or DOM structure in tests. Query by role and accessible name.
- Never add a runtime dependency to make a recipe work.
- Never render a visible string as a JSX literal inside an add-on; use `messages` / `labels`.
- Never reach into the grid's DOM to attach behaviour. Use the add-on contract.
- Never rebuild the column picker to change one rule. `columnLayout({ canChange })` refuses a
  change; `picker: false` is for replacing the control, not the policy.
- Never render a control that a guard will refuse as though it were available. Ask
  `useColumnLayout().allows(change)` and set `aria-disabled` — not `disabled`, which drops the item
  out of the menu's arrow-key order.
- Never count `canChange`'s `layout.pinned` / `layout.hidden` to decide a rule — those are the
  reader's overrides, not the effective state. Use the third argument, `resolved`.

## Decision rules

```
rows come from an array                    -> data={rows}
rows come from REST                        -> createRestDataSource({ url })
rows come from GraphQL / SDK / tRPC        -> createRemoteDataSource({ fetcher })
server accepts only page+pageSize          -> capabilities: { paginate: true, sort: false, filter: false, search: false }
> ~10k rows rendered at once               -> virtualRows()
result set too large to hold in memory     -> createWindowedDataSource
both                                       -> createWindowedDataSource + virtualRows()
a panel under a row                        -> rowDetail()
nested rows of the same shape              -> treeData()
keyboard users must cross many columns     -> cellNavigation()
a feature that does not exist              -> a GridAddon of your own
a row transformation for local and remote  -> an engine plugin (registerStage)
one column must not be resized/hidden/moved-> column layout: { resizable, hideable, movable }
one column must not be pinned              -> columnLayout({ canChange }) — no column option for it
a rule about more than one column          -> columnLayout({ canChange })
```

## Canonical snippets

### Grid over an array

```tsx
const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (v) => money.format(Number(v)) },
];

<Gridwright<Person> columns={columns} data={people} pageSize={25} aria-label="People" />;
```

### Grid over REST

```tsx
const source = useMemo(() => createRestDataSource<Person>({ url: '/api/people' }), []);

<Gridwright<Person> columns={columns} dataSource={source} pageSize={25} aria-label="People" addons={[search()]} />;
```

Wire format sent: `page` (**one-based**), `pageSize`, `sort=col:asc,other:desc`, `search`,
`filters` (JSON array of `{ columnId, operator, value }`). Accepted back: an array, `{ data, total }`,
`{ items, count }`, `meta.total`, or an `X-Total-Count` header. Override with `buildParams` /
`parseResponse`.

### Grid over anything async

```tsx
const source = useMemo(
    () =>
        createRemoteDataSource<Person>({
            capabilities: { paginate: true, sort: false, filter: false, search: false },
            fetcher: async ({ query, signal }) => {
                const { pageIndex, pageSize } = query.pagination;
                const body = await client.people.list({ page: pageIndex + 1, size: pageSize }, { signal });
                return body.total === undefined ? { rows: body.rows } : { rows: body.rows, totalRows: body.total };
            },
        }),
    [client],
);
```

### Add-ons

```tsx
addons={[search(), columnFilters(), exportMenu({ filename: 'people' }), rowActions({ items })]}
```

Core four (`sorting`, `selection`, `pagination`, `staleNotice`) are on by default. Configure:
`coreAddons={coreAddons<Person>({ selection: { checkboxes: false }, pagination: { pageSizeOptions: [10, 50] } })}`.
Remove all: `coreAddons={false}`.

Changing which add-on **names** are listed remounts the grid. This is by design; it resets the page.

### Selection

```tsx
<Gridwright<Person>
    selectionMode="multiple"
    onSelectionChange={(ids, rows) => setSelected(rows)}
    getRowId={(row) => row.uuid}
    /* ... */
/>
```

Selection is engine state. `selection({ checkboxes: false })` removes the column, not the state —
but nothing built in then selects a row, so drive it yourself via `api.toggleRowSelection`.

### Editable cells

```tsx
// column
{ id: 'salary', header: 'Salary', edit: { inputType: 'number', editable: (row) => row.canEditPay } }

// add-on
inlineEditing({
    commit: async (rowId, columnId, value) => {
        const response = await fetch(`/api/people/${rowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [columnId]: value }),
        });
        if (!response.ok) throw new Error(await response.text()); // throwing reverts the cell
        source.invalidate();
    },
})
```

`edit` fields: `editable`, `inputType` (`text | number | date | checkbox | select`), `choices`,
`parse`, `editor`.

### Expandable rows / master–detail

```tsx
rowDetail<Order>({
    hasDetail: (row) => row.data.lineCount > 0,
    render: ({ data, close }) => <OrderLines orderId={data.id} />,
})
```

`render` runs only while open; a collapsed panel is unmounted, so the panel component *is* the lazy
load. Options: `single`, `toggle: 'start' | 'end' | 'none'`, `canToggle`, `persistAcrossPages`,
`initialExpanded` + `onExpandedChange`, `rowLabel`, `controllerRef`. `useRowDetail()` gives the
controller.

### Keyboard cell navigation

```tsx
addons={[cellNavigation()]}          // one Tab stop, then the arrows
```

Arrows move cell to cell, `Home`/`End` along the row, `Ctrl`+them to the first/last cell,
`PageUp`/`PageDown` by a page. Over `treeData()`, right and left expand and collapse a node.

- **No key fetches a page.** `Ctrl+End` stops at the last *loaded* row, because a source with no
  total has no known last row.
- **Arrow keys inside an `<input>` stay there**, so `inlineEditing()` keeps its caret.
- Extra columns (the `selection()` checkbox) are reachable; `includeExtraColumns: false` excludes
  them.
- `useCellNavigation()` gives your own control the same cursor: `activeCell`, `columnIds`,
  `isActive`, `focusCell`.
- Nothing is announced on a move — the browser already announces the focused cell.

### Column layout, and locking it

```tsx
// Per column, read on every render — so `hideable: user.isAdmin` works.
{ id: 'name', header: 'Name', layout: { resizable: false, hideable: false, movable: false, pinned: 'left', maxWidth: 400 } }

// Cross-column rules, and the pin lock no column option has:
columnLayout<Person>({
    // `resolved`, not `layout`: `layout.pinned` holds the reader's overrides only, so a column
    // pinned by its own definition is not in it and the count comes out short.
    canChange: (change, layout, resolved) =>
        change.type !== 'pin' ||
        change.side === null ||
        resolved.order.filter((id) => resolved.pinOf(id) !== null).length < 3,
});
```

`canChange` is asked before every committed change — `width`, `pin`, `visibility`, `move`, `showAll`,
`reset` — and `false` refuses it. It **narrows and never widens**: a `movable: false` column stays
locked whatever the guard returns. It governs the controller too, so your own button cannot step
around your own rule.

**Never count `layout.pinned` or `layout.hidden` to decide a rule.** That is the saved state — the
reader's overrides — and a column pinned or hidden by its own definition is absent from it. The
third argument, `resolved`, has `order`, `pinOf`, `isHidden`, `widthOf` and `indexOf`, and answers
what is actually painted.

Ask `allows` in a control of your own, so it disables itself exactly as the built-in ones do:

```tsx
const layout = useColumnLayout();
const refused = !layout.allows({ type: 'pin', columnId, side: 'left' });
<button aria-disabled={refused || undefined} onClick={() => !refused && layout.setPinned(columnId, 'left')}>Pin</button>;
```

A width and a move are refused only on commit — the gesture decides the number, so nothing can be
disabled in advance. Nothing is announced when a change is refused, and there is no reason string:
say it where your rule is.

### Huge data sets

```tsx
const source = useMemo(
    () =>
        createWindowedDataSource<Person>({
            blockSize: 200,
            maxBlocks: 12,
            fetchRange: async ({ offset, limit, query, signal }) => {
                const body = await api.people({ offset, limit }, { signal });
                return { rows: body.rows, totalRows: body.total }; // totalRows is REQUIRED here
            },
        }),
    [api],
);

<Gridwright<Person> columns={columns} dataSource={source} pageSize={100} aria-label="People" addons={[virtualRows({ rowHeight: 40, height: 600 })]} />;
```

### Persisting state

```tsx
initialQuery={saved}                                            // read once, at engine creation
onQueryChange={(q) => save(q)}                                  // sort, filters, search, page
columnLayout({ initial, onChange })                             // widths, pinning, visibility, order
rowDetail({ initialExpanded, onExpandedChange })                // open panels
```

`onChange` / `onExpandedChange` never fire on mount, so they cannot overwrite a saved value on the
first paint.

### An add-on of your own

```tsx
const highlight = (): GridAddon<Row> => ({
    name: 'acme:highlight',                    // namespaced; also the messages namespace
    setup: function useHighlight() {           // may call hooks; name it use* for the lint rule
        return {
            cellAttributes: (row, column) => (column.id === 'due' && row.data.overdue ? { className: 'is-overdue' } : {}),
            toolbar: () => <MyButton />,       // slot functions must NOT call hooks
            messages: { en: { label: 'Overdue' } },
        };
    },
});
```

Contributable attributes are an allowlist: `on*`, `aria-*`, `data-*`, `className`, `style`, `role`,
`id`, `title`, `tabIndex`, `hidden`, `dir`, `lang`, `draggable`, `scope`, `colSpan`, `rowSpan`,
`abbr`, `headers`. No children, no markup, no URL attributes.

Slots: `configure`, `plugins`, `columnSignature`, `provide`, `suppresses`, `navigation`, `toolbar`,
`toolbarStatus`, `aboveTable`, `belowTable`, `overlay`, `tableAttributes`, `tableWrapper`,
`tableKeyDown`, `tableFooter`, `headerLabel`, `headerBefore`, `headerAfter`, `headerAttributes`,
`columns`, `extraCellAttributes`, `extraHeaderAttributes`, `body`, `rowAttributes`, `renderRow`,
`rowAfter`, `cellAttributes`, `status`, `announce`, `messages`.

A row after a row spans the table with `columnCountOf(grid)` and is presentational:

```tsx
rowAfter: (row, grid) =>
    open.has(row.id) ? (
        <tr role="presentation">
            <td role="presentation" colSpan={columnCountOf(grid)}>
                <div role="region" aria-label={`Details for ${row.data.name}`}>{/* ... */}</div>
            </td>
        </tr>
    ) : undefined,
```

### Tests

```tsx
screen.getAllByRole('row')                                   // [0] is the header
within(row).getAllByRole('cell')
screen.getByRole('button', { name: /Salary/ })               // the sort control
screen.getByRole('columnheader', { name: /Salary/ })         // carries aria-sort
screen.getByRole('status')                                   // the live region
screen.getAllByRole('checkbox', { name: 'Select row' })
await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(1 + 25));  // no arbitrary timers
```

### Theming

Override custom properties on any ancestor; do not fork the stylesheet.

`--gw-font-size`, `--gw-line-height`, `--gw-row-height`, `--gw-cell-padding-x`,
`--gw-cell-padding-y`, `--gw-radius`, `--gw-gap`, `--gw-surface`, `--gw-surface-muted`,
`--gw-surface-hover`, `--gw-surface-selected`, `--gw-text`, `--gw-text-muted`, `--gw-border`,
`--gw-border-strong`, `--gw-accent`, `--gw-accent-contrast`, `--gw-danger`, `--gw-focus-ring`.

Per-part classes: `classNames={{ root, toolbar, search, tableWrapper, table, thead, headerRow,
headerCell, tbody, row, rowSelected, cell, pagination, status, stale, filterTrigger, filterDialog }}`.

### Translation

```tsx
<Gridwright locale={pl} /* or */ translate={(key, values) => t(key, values)} /* or */ messages={{ 'status.empty': '…' }} />
```

Packs: `en`, `de`, `es`, `fr`, `pl`. A `translate` that returns the key falls back to the catalog.
Column `header` strings are yours — pass them already translated.

## Failure modes to check before reporting done

| Check | Why |
| :--- | :--- |
| Is every data source inside `useMemo` or at module scope? | An inline one refetches forever |
| Do `capabilities` match what the endpoint actually implements? | Silent no-op sorting and filtering |
| Does every grid have `aria-label` or `caption`? | A screen reader announces only "table" |
| Is `apsw-gridwright/styles.css` imported once? | Otherwise unstyled |
| Do rows have stable ids (or `getRowId`)? | Selection and panels are keyed on them |
| Does `virtualRows({ rowHeight })` match `--gw-row-height`? | Rows drift from the scrollbar |
| Is any total being computed client-side? | Never do this |
| Are tests querying by role rather than class? | Class names are not the contract |
| Does every control a `canChange` guard can refuse ask `allows` first? | Otherwise it looks live and does nothing |
| Does a `canChange` rule read `resolved` rather than counting `layout.pinned`? | A column pinned by its own definition is not in the saved state |

## Escalate to the user, do not guess

- The endpoint's paging contract is unknown (zero- vs one-based, parameter names).
- The endpoint cannot return a total and the user asked for an exact page count. Say the grid will
  show "of many" and why.
- A requirement needs a feature the package refuses on purpose (a total from one page, expandable
  rows under windowing, a runtime dependency). Name the refusal and offer the nearest thing.
- A required seam does not exist in the add-on contract. That is a gap in the package, not a reason
  to reach into the DOM.

## Reference

| Need | Page |
| :--- | :--- |
| Task-indexed recipes with reasoning | [React playbook](react-playbook.md) |
| Every prop, option, field, default | [API reference](api.md) |
| Column widths, pinning, locks and guards | [Column layout](column-layout.md) |
| Tutorial, six steps | [Getting started](getting-started.md) |
| Add-on contract in full | [Add-ons](addons.md) |
| Capabilities, totals, aborts, retries | [Data sources](data-sources.md) |
| What is deliberately closed | [Extensibility](extensibility.md) |
| Keyboard and screen-reader contract | [Accessibility](accessibility.md) |
| Runnable, step by step | [`examples/react-quickstart/`](../examples/react-quickstart/README.md) |
