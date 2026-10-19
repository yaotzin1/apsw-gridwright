# Loading indicators

`loadingIndicator()` draws what the grid shows while it loads: a spinner, or a skeleton of the table's own rows.
`Spinner` is the same set of spinners as a component you can use anywhere in your app. Both are drawn by the
package, from SVG and CSS, with no dependency.

<p align="center">
  <img src="https://raw.githubusercontent.com/yaotzin1/apsw-gridwright/main/site/loading-indicators.gif" width="720" alt="The loading indicators in the playground: a spinner and a skeleton on the first load, then a skeleton and a spinner when the page changes.">
</p>

```tsx
import { Gridwright, loadingIndicator } from 'apsw-gridwright/react';

<Gridwright columns={columns} dataSource={source} addons={[loadingIndicator()]} />;
<Gridwright columns={columns} dataSource={source} addons={[loadingIndicator({ variant: 'skeleton' })]} />;
```

Without the add-on nothing changes: the grid shows the word "Loading rows" in the table, as it always did.

## The spinners

| Name | What it draws |
| :--- | :--- |
| `ring` | A plain circle. The default, and the one to use at small sizes. |
| `dot-walk` | One dot travelling over the nine cells of the Gridwright mark: the keyboard cursor in motion. |
| `draw-g` | The letter G, drawn stroke by stroke and drawn out again. |
| `cell-colors` | The mark's nine cells taking the accent colour in turn. |

Each comes in `sm`, `md` (default) and `lg`, and is also exported as a component: `RingSpinner`,
`DotWalkSpinner`, `DrawGSpinner` and `CellColorsSpinner`.

## Options

| Option | Default | What it does |
| :--- | :--- | :--- |
| `variant` | `'spinner'` | `'spinner'`, `'skeleton'`, or `'none'` to keep the plain text. |
| `spinner` | `'ring'` | A built-in name, or your own component. Used for the loading state and the refresh indicator. |
| `size` | `'md'` | `'sm'`, `'md'` or `'lg'`. |
| `rows` | `8` | Skeleton rows, between 1 and 50, and never more than a page. |
| `shapes` | `'text'` for every column | The skeleton shape by column id: `'text'`, `'number'`, `'badge'`, `'avatar'` or `'none'`. |
| `indicateRefresh` | `false` | A small spinner in the corner while rows are replaced. The rows stay. |
| `refreshVariant` | `'dim'` | What to draw when the rows are replaced (a page change, a sort, a filter, a reload). `'dim'` is the grid's own: the old rows stay, dimmed. `'spinner'` adds a centred spinner over them; `'skeleton'` swaps the rows on screen for placeholders until the new ones arrive. Both wait for `delay`. |
| `expandVariant` | `'none'` | What to draw under a tree node while its children load (`treeData()` with `loadChildren`): `'spinner'` or `'skeleton'`. `'none'` leaves the pulsing toggle. |
| `expandRows` | `3` | Placeholder rows under an expanding node, between 1 and 10. |
| `delay` | `200` | Milliseconds before an indicator appears, so a fast response never flashes one. `0` shows it at once. |
| `render` | none | Draw the indicator yourself. It is hidden from assistive technology; the grid keeps its own text. |

## When rows are replaced, and when a node expands

By default a page change, sort or filter keeps the old rows on screen, dimmed, and says nothing more. Both
options below are opt-in, and neither changes that default.

```tsx
loadingIndicator({ refreshVariant: 'skeleton' });   // the rows on screen become placeholders until the new ones arrive
loadingIndicator({ refreshVariant: 'spinner' });    // a spinner centred over the dimmed rows
loadingIndicator({ expandVariant: 'spinner' });     // under a tree node while its children load
```

`refreshVariant: 'skeleton'` draws as many placeholder rows as there are rows on screen, so the table does not
change height. For a refresh shorter than `delay` the old rows simply stay. It works on the paged body; a
windowed body (`virtualRows()`) already draws its own placeholders for a window that has not arrived. With
`refreshVariant` set to `'spinner'` or `'skeleton'`, `indicateRefresh` is not drawn as well.

`expandVariant` draws under the node that is loading, once `delay` has passed, and removes it when the children
arrive or the load fails. It does nothing in a grid that is not a tree, and it never touches the nodes that
already have their children.

## The skeleton

A skeleton draws placeholder rows with the table's own columns, so when the rows arrive the page changes
content, not layout. It draws one cell per rendered column, the extra columns of other add-ons (the selection
checkbox) on either side, and, under `virtualColumns()`, one gap cell per run of unmounted columns: five hundred
columns draw a dozen cells, not five hundred. Line lengths vary by row and column, and are the same on the
server and the client.

```tsx
loadingIndicator({
    variant: 'skeleton',
    rows: 10,
    shapes: { name: 'avatar', status: 'badge', salary: 'number', actions: 'none' },
});
```

A windowed grid (`virtualRows()`) already draws its own placeholder rows for a window that has not arrived. They
use the same `.gw-skeleton` class, so the tokens below restyle both.

## Your own spinner, or one from a library

`spinner` and `Spinner`'s `variant` take a component. It is given `{ size, className, color }`, where `color` is
`'currentColor'` for a library whose spinner takes a colour prop. The package never imports the library: you add
it to your own app, so the grid's `dependencies` stay empty.

```tsx
import { ClipLoader } from 'react-spinners';

loadingIndicator({ spinner: () => <ClipLoader size={24} color="currentColor" /> });

<Spinner variant={({ className }) => <MyLogoSpinner className={className} />} label="Saving" />;
```

The grid wraps whatever you pass: it is hidden from assistive technology inside the grid, and a standalone
`Spinner` is an image named by its `label` (or hidden when `decorative`). A replacement cannot leave an unnamed
node behind.

## `Spinner` on its own

```tsx
<Spinner label="Saving" />
<Spinner variant="draw-g" size="lg" label="Loading the report" />
<Spinner decorative />   {/* a label next to it says what is happening */}
```

`label` is required unless the spinner is `decorative`; a nameless spinner is a type error. No provider and no
add-on are needed.

## Theming

Every indicator reads custom properties. All are optional.

| Property | Default | Meaning |
| :--- | :--- | :--- |
| `--gw-spinner-size` | `1rem` / `1.5rem` / `2.25rem` | Edge length. |
| `--gw-spinner-color` | `--gw-accent` | The moving part. |
| `--gw-spinner-color-2`, `--gw-spinner-color-3` | `--gw-spinner-color` | `cell-colors` only: the second and third column of cells. Set all three for red, green and blue. |
| `--gw-spinner-track-color` | translucent `currentColor` | The fixed part. |
| `--gw-spinner-thickness` | `4` | Stroke weight, in the drawing's own units. |
| `--gw-spinner-duration` | `900ms` | One cycle. |
| `--gw-skeleton-base`, `--gw-skeleton-shine` | the surface colours | The two skeleton colours. |
| `--gw-skeleton-duration` | `1.4s` | One shimmer sweep. |

## Accessibility and motion

- The grid's live region says "Loading rows" once. Indicators are `aria-hidden` and add nothing to it.
- The "Loading rows" text stays in the table, visually hidden, for as long as the indicator is up.
- Under `prefers-reduced-motion: reduce` every spinner stands still on a frame that still reads as working, a
  skeleton stops shimmering, and the text is shown beside the indicator.
- Under `forced-colors: active` spinners use the system's highlight colours.
- Only `transform`, `opacity`, `fill` and `stroke-dashoffset` animate. Nothing moves the layout.

## What it does not do

No percentage: the grid never has a number for how far along a load is, and a progress bar would have to invent
one. No full-page overlay: the grid stays readable and operable while it refreshes. No spinner from the
package's side for a lazy tree node or an inline edit saving; use `Spinner` at `size="sm"` there.
