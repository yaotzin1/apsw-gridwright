# Accessibility

What the grid tells assistive technology, why each decision was made, and what is deliberately
absent. A grid nobody can operate by keyboard is a broken grid, not an unpolished one.

## Markup first, ARIA second

`role="grid"` goes on a real `<table>` with a real `<thead>`, `<th scope="col">` and `<td>`. The row
and column relationships a screen reader announces then come from the markup, instead of from
attributes somebody has to keep in sync by hand. A stack of divs with `role="row"` is more code and
worse output.

This holds under virtualization too. The virtualized body renders two spacer `<tr>` rows carrying
the height of everything above and below, so the element stays a table with real rows. Absolutely
positioning rows would be simpler to write and would throw away both the column alignment and the
grid semantics.

A tree is `role="treegrid"` instead. The role is what tells a screen reader to expect `aria-level`
and `aria-expanded` on the rows and to offer the expand and collapse keys for them; the same
attributes inside a plain `grid` are ignored.

## Row position

Two attributes, and they have to agree.

```
aria-rowindex = absolute position + 2      // +1 for one-based, +1 for the header row
aria-rowcount = isTotalExact ? totalRows + 1 : -1
```

WAI-ARIA counts every row of the table, header rows included, which is why the header row is
`aria-rowindex="1"` and the data rows begin at 2.

The position is absolute across the whole result set, not within the page. On page two of eight, the
first row on screen is row 26, and saying "row 1" there tells a reader that paging moved them
nowhere. Under virtualization the same rule applies to the row's true index, which is why the row a
reader is on can be row four million rather than row four of what happens to be mounted.

`aria-rowcount` is `-1` when the total is not exact. That is the ARIA value for "not known", and it
is the honest answer when a paginating source sends no count. A number computed from one page is a
number the reader would act on, and it would be wrong.

## Sorting

- The control is a `<button>` inside the `<th>`, so it is reached by Tab and activated by Enter and
  Space with no key handling of this package's own.
- `aria-sort` goes on the `<th>`, not on the button. That is where assistive technology looks.
- Its values are `ascending`, `descending` and `none`. The arrow is `aria-hidden`: it is decoration,
  and it is not the accessible state.
- The button's `title` names the next action rather than the current state, because a reader wants
  to know what activating it will do.
- **The resulting state is announced**, because `aria-sort` is on a cell the reader has already left
  by the time the sort applies. Without the announcement, activating the control is silent.

Shift-activating adds a column to the sort rather than replacing it, on the keyboard as well as the
mouse, because the modifier reaches the button either way.

## The live region

One visually hidden `role="status"` region, carrying one sentence, in this order:

1. **Loading** while a fetch is in flight. Anything else said now describes rows about to be
   replaced.
2. **The error title** when the fetch failed, whether or not stale rows are still on screen. The
   `role="alert"` in the table only renders when the grid has nothing left to show, so a refresh
   that failed over a full page was otherwise silent and the reader kept reading stale data.
3. **The sort that just changed**, named by its column. The reader caused it and is waiting to hear
   whether it applied, so it outranks a row count they did not ask for.
4. **The result summary** otherwise: the range and the total for a paginated grid, the total alone
   for a virtualized one, or the empty message when there are no rows.

A change that leaves the sentence identical announces nothing. Selecting a row publishes new state
without changing anything the sentence describes, and a region that repeats itself on every click is
a region people switch off.

The region never contains the rows. Putting `aria-live` on the `<tbody>` instead would announce its
whole subtree on every change, which on a page of 25 rows and six columns is 150 cells read aloud
for every page turn, every sort and every keystroke of the search box. It is the most common way a
grid becomes unusable with a screen reader while appearing conscientious about it.

One consequence worth knowing when writing tests: the region can hold the same words as a visible
element, most obviously the empty-state label, so `getByText` on a status string finds two nodes.
Use `getAllByText`, or scope the query to the table.

## Selection

`aria-multiselectable` is on the table when the selection mode is `multiple`. Checkboxes do not
convey it: a single-selection grid has them too.

Every checkbox has a label. The header checkbox is `indeterminate` when part of the page is
selected, set through a ref because it is a property rather than an attribute. `aria-selected` is on
the row, and absent when the grid has no selection at all rather than present and false.

## Tree hierarchy

The indentation in a tree cell is padding on a spacer, and padding conveys nothing. The row carries
the shape:

| Attribute | Value |
| :--- | :--- |
| `aria-level` | the node's depth, plus one, because ARIA levels are one-based |
| `aria-setsize` | how many siblings this node has at its level |
| `aria-posinset` | which of them it is |
| `aria-expanded` | present only when the node has children |

`aria-expanded` is on the row, not on the toggle button inside it. In a `treegrid` the row is where
the pattern puts it, and a row and a button both carrying it is the same fact announced twice.

A cyclic node, one repeating a row already on its own path, has children in the data and can never
be expanded. It carries no `aria-expanded`, because to a reader it is a leaf, and the cell says so
in words.

## Focus

Loading, empty and error states render as a row inside the table rather than replacing it, so the
header and the column widths hold still. A table that collapses to a centred spinner and springs
back on every page change is the most common way a working grid feels broken.

Activating a page control that disables itself moves focus to its sibling. A focused element that
becomes disabled sends focus to `<body>`, which ejects a keyboard user from the grid at the exact
moment they reach its last page. The move is deliberately narrow: it fires only when the reader
activated the control that became disabled, so a page change driven through the API never steals
focus from wherever they actually are.

## Every string is translated

Nothing announced is a literal in JSX. The announcement labels are `sortAnnouncement`, `rowsShown`
and `rowsTotal` on `GridwrightLabels`, behind the `a11y.*` keys in the message catalogue, and they
are translated in all five shipped locales along with everything else. See
[Translation](i18n.md).

```tsx
<Gridwright
    columns={columns}
    data={people}
    aria-label="People"
    labels={{
        sortAnnouncement: (column, direction) =>
            direction === null ? `${column} unsorted` : `${column} sorted ${direction}`,
    }}
/>
```

`aria-label` on the component names the grid itself. Give it one: a table announced as "table" among
several tables is a table nobody can find.

## Testing it

Assert with `getByRole` and accessible names, never on class names or DOM structure. A test that
finds the sort control by role is also a test that the control is reachable at all.

```tsx
expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '201');
expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-rowindex', '2');
expect(screen.getByRole('status')).toHaveTextContent('Showing 1 to 25 of 200');
```

`tests/react/accessible-state.test.tsx` is the whole contract written out, and the smoke suite
asserts the same behaviour against the built bundle, because a build that tree-shook the
announcement away would leave every source test green.

## Deliberately absent

- **Roving tabindex and arrow-key cell navigation.** The full ARIA grid interaction pattern is a
  separate feature with its own focus-management design. What is here fixes the state a reader is
  told about, not how they move through it.
- **`aria-colcount` and `aria-colindex`.** They exist for tables whose columns are windowed. This
  grid renders every visible column, so the DOM order is already the truth and the attributes would
  add nothing but something to keep in sync. Column virtualization would make them required.
- **A screen-reader-tested claim.** Every behaviour here is asserted against the accessibility tree
  as the DOM exposes it. That is not the same as having heard NVDA or VoiceOver read the grid, and
  the announcement priority in particular is a judgement about what is useful to hear.
