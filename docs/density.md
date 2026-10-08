# Density

`density()` lets a person choose how much room a row takes: **compact**, **comfortable** or **spacious**. It
gives the grid a labelled select in the toolbar, one state, the styles for each level, and a number that
`virtualRows()` uses, so a windowed grid stays in step with its scrollbar.

```tsx
import { Gridwright, density } from 'apsw-gridwright/react';

<Gridwright columns={columns} data={rows} addons={[density()]} />;
```

Without the add-on nothing changes: the grid has no `data-gw-density` attribute and the spacing it always had.

## The levels

| Level | Row height | Cell padding (y / x) | |
| :--- | :--- | :--- | :--- |
| `compact` | 32 px | 4 px / 8 px | more rows on screen |
| `comfortable` | whatever the grid has (40 px) | 8 px / 12 px | **the grid as it is** |
| `spacious` | 52 px | 14 px / 16 px | easier to read, easier to hit |

`comfortable` sets nothing. A grid that adds `density()` and stays on it looks and measures exactly as before,
including any `--gw-row-height` your own CSS sets. Font size, colours and the size of controls are the same at
every level, and on a touch screen interactive controls still keep `--gw-touch-target` (44 px).

## Options

| Option | Default | What it does |
| :--- | :--- | :--- |
| `initial` | `'comfortable'` | The level to start on. A level that is not in `levels` starts on the first one. |
| `levels` | all three | The levels the control offers, in this order. |
| `rowHeights` | `{ compact: 32, spacious: 52 }` | Row height in pixels per level. Any level, `comfortable` included. A value that is not a positive finite number is ignored. |
| `control` | `true` | `false` draws no select; drive it with `useDensity()` instead. |
| `onChange` | none | Called with the new level when the person chooses one. Not called for the initial level. |

With a single level there is no select to draw, and the add-on still sets the attribute and the height.

## Remembering the choice

The package never touches `localStorage`. `initial` and `onChange` are the whole contract, so you decide where a
preference lives:

```tsx
const stored = (localStorage.getItem('grid-density') as DensityLevel | null) ?? 'comfortable';

<Gridwright
    columns={columns}
    data={rows}
    addons={[density({ initial: stored, onChange: (level) => localStorage.setItem('grid-density', level) })]}
/>;
```

`initial` is read once. Writing it differently on a later render does not undo what the person chose; to start
over, give the grid a new `key`.

## Your own control

`useDensity()` returns `{ level, levels, setLevel }` from inside a grid that lists the add-on, so a button
of your own can drive it. It throws a message naming the add-on where `density()` is not listed;
`useOptionalDensity()` returns `null` there instead. `setLevel` ignores a level that is not on offer.

```tsx
function Tighter() {
    const { level, setLevel } = useDensity();
    return <button disabled={level === 'compact'} onClick={() => setLevel('compact')}>Tighter</button>;
}
```

Render it with `density({ control: false })` and place it wherever you want, in a slot of your own add-on.

## With `virtualRows()`

A windowed body places rows by one fixed pixel height. `density()` publishes the active level's height to the
add-ons listed after it, and `virtualRows()` uses it before its own `rowHeight` option, so rows and scrollbar
stay in step at every level. The order you list them in does not matter: `density()` asks to go first.

While the level is `comfortable` and you gave no height for it, `virtualRows({ rowHeight })` is in charge, then
`40`, as before.

An add-on of your own that places rows by a height can read the same number: `setup({ rowHeight })`, with
`after: ['gridwright:density']`. See [add-ons](addons.md).

## Styling

`density()` puts `data-gw-density="compact | comfortable | spacious"` on the grid's root, and the stylesheet reads
it. The padding of the other two levels is four tokens on `.gw-root`:

```css
.gw-root {
    --gw-density-compact-padding-y: 4px;
    --gw-density-compact-padding-x: 8px;
    --gw-density-spacious-padding-y: 14px;
    --gw-density-spacious-padding-x: 16px;
}
```

Every part that already reads `--gw-cell-padding-*` follows: cells, group rows, tree rows, the detail panel, the
loading and empty rows. You can also style against the attribute yourself.

The **row height is not a token you set in CSS.** The add-on writes it to `--gw-row-height` on the root, because
`virtualRows()` needs the same number in JavaScript. A `--gw-row-height` on an ancestor loses to it at `compact`
and `spacious`; pass `rowHeights` instead.

The stacked card layout of [`responsive()`](responsive.md) is spaced by `--gw-card-gap`, which density leaves alone.

## Accessibility

The control is a native `<select>` with a `<label>`: reached by Tab, changed with the arrow keys, Home and End,
and announced with its name and value by every screen reader. Choosing a level says nothing in the grid's live
region, because no row changed. The label and the three level names are in `gridwright:density`, translated in
the German, Spanish, French and Polish packs.

Server and client render the same markup: the level comes from the options, never from a media query or a
measurement. A grid does not pick a density for the person.
