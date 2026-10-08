# API surface contract: density

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: a new add-on and its types are added, and two optional fields join the add-on contract
(`AddonContribution.rowHeight`, `AddonSetupContext.rowHeight`). Nothing is removed or renamed, no default
changes, and a grid that does not list `density()` renders the same markup it did before. `virtualRows()`
gains a read of the published height, which is absent unless `density()` is listed, so its behaviour without
the add-on is identical. New CSS custom properties and one new root attribute are additive; no `gw-*` class is
renamed.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `density` | `apsw-gridwright/react` | `<TRow>(options?: DensityOptions) => GridAddon<TRow>` |
| `useDensity` | `apsw-gridwright/react` | `() => DensityController` |
| `useOptionalDensity` | `apsw-gridwright/react` | `() => DensityController \| null` |
| `DENSITY_ADDON` | `apsw-gridwright/react` | `'gridwright:density'` |
| `densityMessages` | `apsw-gridwright/react` | `AddonMessages` |
| `DensityLevel` | `apsw-gridwright/react` | `'compact' \| 'comfortable' \| 'spacious'` |
| `DensityOptions` | `apsw-gridwright/react` | see below |
| `DensityController` | `apsw-gridwright/react` | see below |

```ts
interface DensityOptions {
    /** The level to start on. Default `comfortable`. A level that is not in `levels` starts on the first. */
    readonly initial?: DensityLevel;
    /** The levels the control offers, in this order. Default all three. */
    readonly levels?: readonly DensityLevel[];
    /** Row height in pixels per level. Default compact 32, spacious 52, comfortable none. */
    readonly rowHeights?: Partial<Record<DensityLevel, number>>;
    /** Render the toolbar select. Default true. `useDensity()` works either way. */
    readonly control?: boolean;
    /** Called when the person chooses a level, never for the initial one. */
    readonly onChange?: (level: DensityLevel) => void;
}

interface DensityController {
    readonly level: DensityLevel;
    readonly levels: readonly DensityLevel[];
    /** Ignored for a level that is not in `levels`. */
    setLevel(level: DensityLevel): void;
}
```

The add-on contract (`apsw-gridwright/react`, existing types):

```ts
interface AddonContribution<TRow> {
    /** The pixel height of one row, published by the add-on that sets it. First add-on to publish wins. */
    readonly rowHeight?: number;
}
interface AddonSetupContext<TRow> {
    /** What an add-on listed earlier published as `rowHeight`, if any. */
    readonly rowHeight?: number;
}
interface GridVirtualOptions {
    /** (comment only) Used when no add-on publishes a row height. Default 40. */
    readonly rowHeight?: number;
}
```

New messages: `gridwright:density` keys `label`, `compact`, `comfortable`, `spacious`, in `en`, `de`, `es`, `fr`, `pl`.

New stylesheet surface (documented in `docs/density.md`): custom properties `--gw-density-compact-padding-y`,
`--gw-density-compact-padding-x`, `--gw-density-spacious-padding-y`, `--gw-density-spacious-padding-x` on
`.gw-root`; the attribute `data-gw-density` on the root; the rules `.gw-root[data-gw-density='compact']` and
`...='spacious'`.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `virtualRows()` | row height is `options.rowHeight ?? 40` | `published ?? options.rowHeight ?? 40`, where `published` exists only when an earlier add-on publishes one | none without `density()` |
| `AddonContribution`, `AddonSetupContext` | no row height | one optional field each | additive |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `initial` | (did not exist) | `comfortable` |
| `levels` | (did not exist) | all three |
| `rowHeights` | (did not exist) | compact 32, spacious 52 |
| `control` | (did not exist) | `true` |

No existing default changes.

## Semantics

```ts
// resolve
levels  = options.levels?.length ? options.levels : ['compact', 'comfortable', 'spacious']
initial = levels.includes(options.initial ?? 'comfortable') ? options.initial ?? 'comfortable' : levels[0]

// per render, level in state
height = { compact: 32, spacious: 52, ...options.rowHeights }[level]        // comfortable: undefined unless given
rootAttributes = { 'data-gw-density': level, style: height ? { '--gw-row-height': `${height}px` } : {} }
contribution.rowHeight = height

// ordering
before: ['gridwright:virtual']   // so virtualRows() sees contribution.rowHeight in its setup context
```

- A `rowHeights` entry that is not a positive finite number is ignored for that level, as if unset.
- `setLevel` calls `onChange` once per change and not when the level is already current.
- `useDensity()` outside a grid that lists the add-on throws `[gridwright] useDensity needs the density() add-on. Add it to the grid's \`addons\`.`

## Type entry points

- [ ] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
