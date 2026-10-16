# Loading indicators

`loadingIndicator()` draws what the grid shows while it loads: a spinner, or a skeleton of the table's own rows.
`Spinner` is the same set of spinners as a component you can use anywhere in your app. Both are drawn by the
package, from SVG and CSS, with no dependency.

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
| `indicateRefresh` | `false` | A small spinner over the rows while they are replaced. The rows stay. |
| `delay` | `200` | Milliseconds before an indicator appears, so a fast response never flashes one. `0` shows it at once. |
| `render` | none | Draw the indicator yourself. It is hidden from assistive technology; the grid keeps its own text. |

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
