# Accessibility

What the grid tells assistive technology, why each decision was made, and what is deliberately
absent. A grid nobody can operate by keyboard is a broken grid, not an unpolished one.

Every feature of the React grid is an add-on, and so is the ARIA each feature needs: the sorting
add-on puts `aria-sort` on the header cells, the selection add-on puts `aria-selected` and
`aria-multiselectable` where they belong, and the tree add-on makes the table a `treegrid`. What the
shell owns is the table markup, the row positions, the status rows and the one live region. An
add-on of your own contributes attributes and sentences through the same slots, so it cannot end up
speaking over the grid.

## Markup first, ARIA second

`role="grid"` goes on a real `<table>` with a real `<thead>`, `<th scope="col">` and `<td>`. The row
and column relationships a screen reader announces then come from the markup, instead of from
attributes somebody has to keep in sync by hand. A stack of divs with `role="row"` is more code and
worse output.

This holds under virtualization too. The virtualized body renders two spacer `<tr>` rows carrying
the height of everything above and below, so the element stays a table with real rows. Absolutely
positioning rows would be simpler to write and would throw away both the column alignment and the
grid semantics.

A tree is `role="treegrid"` instead, set by the `treeData()` add-on through `tableAttributes`. The
role is what tells a screen reader to expect `aria-level` and `aria-expanded` on the rows and to
offer the expand and collapse keys for them; the same attributes inside a plain `grid` are ignored.

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

Sorting from the headers is the `sorting()` add-on, one of the core add-ons every grid starts with.
With `coreAddons={false}` the headers are plain labels and carry no `aria-sort`, because there is no
control to announce.

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

## Resizing a column

`columnLayout()` puts a control at the trailing edge of every resizable header:

```html
<div class="gw-resize-handle" role="separator" aria-orientation="vertical"
     aria-label="Resize Salary" aria-valuenow="170" aria-valuemin="50" tabindex="0"></div>
```

A focusable `separator`, not a `<button>`. The separator role is the one that carries a value, and a
button role would replace the semantics holding the width with semantics holding a press.
`aria-valuemax` appears only where the column declared a `maxWidth`: a maximum nobody set is a limit
invented.

It is reachable with Tab and driven with the arrow keys (5px, or 20px with Shift), `Home` for the
minimum and `Enter` to fit the content, so the feature does not depend on a pointer. Every change is
announced as "{column} width: {n} pixels", on each keyboard step and once on release of a drag.

## The live region

One visually hidden `role="status"` region, rendered by `GridRoot`, carrying one sentence, in this
order:

1. **Loading** while a fetch is in flight. Anything else said now describes rows about to be
   replaced.
2. **Nothing on failure**, because an alert is already announcing it. See below.
3. **What an add-on says about the change**, once the grid settles. The reader caused it from a
   control their focus has already left, and is waiting to hear whether it applied, so it outranks a
   row count they did not ask for.
4. **The result summary** otherwise: the range and the total for a paginated grid, the total alone
   for a windowed one, or the empty message when there are no rows.

Add-ons do not render announcement regions of their own; they contribute to this one. Each contributor has a `priority`, an optional `key` saying which state its sentence
depends on, and a `describe` function asked with the previous and the next settled state. The
highest-priority sentence that is not null wins, a tie goes to the add-on listed earlier, and the
summary is said when nobody has anything. The built-in contributors:

| Add-on | Priority | Says |
| :--- | :--- | :--- |
| `sorting()` | 20 | "{column}, sorted ascending", "{column}, sorted descending", "{column}, not sorted" |
| `columnLayout()` | 15 | "{column} hidden", "{column} shown" |
| `columnFilters()` | 10 | "{column}, filtered", "{column}, filter removed" |

A sort outranks a filter because both are caused from a header, and a sort is the one a row count
says nothing about. Showing or hiding several columns at once says nothing: naming one of them would
tell the reader the others are still hidden.

Something that is not grid state, such as an export starting and finishing or a column being
resized, is said through the same region with `instance.announce(sentence)`, and the next change to
the grid replaces it. Two regions speaking at once are heard as neither, which is why the export menu
has none of its own.

Which of the two an add-on should use follows from that last sentence. A column width changes nothing
the engine knows, so nothing will speak over it and `announce` is right. A column shown or hidden
changes which columns exist, which settles new state a moment later; said through `announce` it would
be overwritten by the row range before anyone read it, so it is a contributor.

A windowed grid (`virtualRows()`, which declares `navigation: 'window'`) says the total rather than a
range. The rows in the DOM are a window onto the result, and reading the window's bounds aloud tells
the reader where the scroller is, not where they are.

A change that leaves the sentence identical announces nothing. The region is re-evaluated only when
the shell's inputs or a contributor's `key` change, so selecting a row, which publishes new state
without changing anything the sentence describes, says nothing. A region that repeats itself on
every click is a region people switch off. An announcement contributor that throws loses its own
sentence and nothing else.

The region never contains the rows. Putting `aria-live` on the `<tbody>` instead would announce its
whole subtree on every change, which on a page of 25 rows and six columns is 150 cells read aloud
for every page turn, every sort and every keystroke of the search box. It is the most common way a
grid becomes unusable with a screen reader while appearing conscientious about it.

One consequence worth knowing when writing tests: the region can hold the same words as a visible
element, most obviously the empty-state label, so `getByText` on a status string finds two nodes.
Use `getAllByText`, or scope the query to the table.

## Failure, and stale rows

`keepPreviousData` is on by default, so a failed refresh leaves the previous rows on screen rather
than emptying the grid. Losing the reader's place buys nothing. The cost is that the grid is now
presenting rows that are no longer current, and it has to say so, or it is quietly lying.

Which of the two error presentations renders depends on whether anything survived:

| Rows after the failure | What renders |
| :--- | :--- |
| none | the full error state as a row inside the table, with `role="alert"` and a retry button |
| some | `GridStaleNotice`, a banner above the table from the `staleNotice()` core add-on, with `role="alert"` and a retry button |

The banner sits above the table rather than inside it, so the rows, the header and the column
widths do not move. A banner that displaces the data it is warning about makes the reader lose their
place, which is the thing `keepPreviousData` exists to prevent.

Exactly one of these announces, and the live region stays silent for errors because of it. Two
announcements of one failure is one too many. A grid without the stale-notice add-on still keeps
its rows, but has nothing marking them as stale, which is why the add-on is in the core set. Both clear on the next successful fetch; there is no
dismiss control, because dismissing a stale-data warning would leave stale data with nothing marking
it.

## Selection

Selection is the `selection()` core add-on. The selection itself stays in the engine; the add-on is
its view.

`aria-multiselectable` is on the table when the selection mode is `multiple`. Checkboxes do not
convey it: a single-selection grid has them too.

Every checkbox has a label. The header checkbox is `indeterminate` when part of the page is
selected, set through a ref because it is a property rather than an attribute. `aria-selected` is on
the row, and absent when the grid has no selection at all rather than present and false.

## Tree hierarchy

The indentation in a tree cell is padding on a spacer, and padding conveys nothing. The row carries
the shape, contributed by the tree add-on through `rowAttributes`:

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

Activating a page control of the pagination add-on that disables itself moves focus to its sibling. A focused element that
becomes disabled sends focus to `<body>`, which ejects a keyboard user from the grid at the exact
moment they reach its last page. The move is deliberately narrow: it fires only when the reader
activated the control that became disabled, so a page change driven through the API never steals
focus from wherever they actually are.

## Every string is translated

Nothing announced is a literal in JSX. The shell's sentences are `rowsShown` and `rowsTotal` on
`GridwrightLabels`, behind the `a11y.*` keys in the message catalogue. Each add-on's sentences are
its own strings: the sort announcement is `sortedAscending`, `sortedDescending` and `sortCleared`
under `gridwright:sorting`. All of them are translated in all five shipped locales along with
everything else. See [Translation](i18n.md).

```tsx
<Gridwright
    columns={columns}
    data={people}
    aria-label="People"
    labels={{ rowsTotal: (count) => `${count} people` }}
    messages={{
        'gridwright:sorting.sortedAscending': '{column}, lowest first',
        'gridwright:sorting.sortedDescending': '{column}, highest first',
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

An add-on of your own is tested the same way: its attributes are on the elements a role query
finds, and its sentence is in the one `status` region.

`tests/react/accessible-state.test.tsx` is the whole contract written out, and the smoke suite
asserts the same behaviour against the built bundle, because a build that tree-shook the
announcement away would leave every source test green.

## Deliberately absent

- **Roving tabindex and arrow-key cell navigation.** The full ARIA grid interaction pattern is a
  separate feature with its own focus-management design. What is here fixes the state a reader is
  told about, not how they move through it.
- **`aria-colcount` and `aria-colindex`.** They exist for tables whose columns are windowed. This
  grid renders every visible column, so the DOM order is already the truth and the attributes would
  add nothing but something to keep in sync. A column hidden by `columnLayout()` is not rendered at
  all, which keeps that true. Column virtualization would make them required.
- **A screen-reader-tested claim.** Every behaviour here is asserted against the accessibility tree
  as the DOM exposes it. That is not the same as having heard NVDA or VoiceOver read the grid, and
  the announcement priority in particular is a judgement about what is useful to hear.
