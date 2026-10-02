# API surface contract: responsive layout

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one new add-on, one new optional column field and new tokens and classes, all additive.
No option default changes, no export is removed or renamed, and the core entry's types do not move
(`ColumnDef` is untouched, spec C-2).

Two things are not additive and are classified here rather than hidden:

1. **`.gw-root` becomes `container-type: inline-size`** (spec C-1). A grid in a shrink-to-fit parent
   changes width. It is the one change a consumer's build will not catch. It is called out in the
   CHANGELOG, tested against three shrink-to-fit parents at stage 5, and if it fails there the contract
   changes (the container moves to an inner element) before anything ships.
2. **Touch devices only: `rowActions()` with a `hover` trigger gains a visible trigger** (spec C-6).
   A device with no hover could not open that menu at all, so this restores reachability rather than
   changing a working path. Subject to the maintainer's confirmation of C-6.

The stylesheet changes of phase 1 (wrapping, touch targets, `--gw-row-height` as a minimum) are
rendering changes with no API change. A consumer who overrides `.gw-toolbar` or `.gw-pagination`
with a rule of their own keeps winning on specificity.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `responsive` | `apsw-gridwright/react` | `<TRow>(options?: ResponsiveOptions) => GridwrightAddon<TRow>` |
| `RESPONSIVE_ADDON` | `apsw-gridwright/react` | `'gridwright:responsive'` |
| `responsiveMessages` | `apsw-gridwright/react` | `AddonMessages` (`en`, `de`, `es`, `fr`, `pl`) |
| `useContainerWidth` | `apsw-gridwright/react` | `() => number \| null`: the observed width of the grid's container, `null` before the first observation and without the add-on |
| `ResponsiveOptions` | `apsw-gridwright/react` | type, below |
| `ColumnResponsive` | `apsw-gridwright/react` | type, below |

```ts
interface ResponsiveOptions {
    /**
     * Render each row as a card while the container is narrower than this many pixels. Default
     * `false`: the table is never restructured. Ignored while `virtualRows()` is listed.
     */
    readonly stackBelow?: number | false;
    /** The toolbar's sort control while stacked. Default true; false to place your own. */
    readonly sortControl?: boolean;
    /**
     * The width to assume before the container has been measured (server render and first client
     * render). Default: unmeasured, so every column shows and nothing is stacked.
     */
    readonly initialWidth?: number;
}

interface ColumnResponsive {
    /** Hide this column while the container is narrower than this many pixels. */
    readonly hideBelow?: number;
}
```

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `GridwrightColumn` | `ColumnDef` plus `layout?: ColumnLayoutOptions`, `tree?`, `aggregate?` and the other add-on fields | the same, plus `responsive?: ColumnResponsive` | additive, optional |
| `defaultLabels` / `Labels` | existing keys | one key for the row-menu trigger on a device without hover (C-6) | additive; a consumer overriding `labels` wholesale falls back to the default |
| `rowActions()` (`BubbleMenu`) | a `hover` or `hover-contextmenu` trigger had no route on a device without hover | renders a trigger button there | behaviour change on touch devices only; see classification |
| the stylesheet `apsw-gridwright/styles.css` | one layout for every width | container-query wrapping, coarse-pointer sizes, `--gw-row-height` as a minimum | see classification |

## Exports removed or deprecated

None.

## Defaults introduced or changed

<!-- A changed default breaks consumers without breaking their build. List every one. -->

| Option | Old default | New default |
| :--- | :--- | :--- |
| `.gw-root` `container-type` | none | `inline-size` (spec C-1) |
| `--gw-row-height` meaning | the row's height | the row's minimum height (`virtualRows()` still fixes it) |
| `--gw-touch-target` | n/a | `44px`, used only under `(pointer: coarse)` |
| `--gw-stack-gap` | n/a | `0.5rem`, used only while stacked |
| `responsive({ stackBelow })` | n/a | `false` |
| `responsive({ sortControl })` | n/a | `true` |
| `column.responsive` | n/a | unset: the column is never hidden |

## Markup and class contract (public once shipped)

Class names under `gw-*` are a public contract (`.agents/rules/styling.md` rule 5), so these are
added deliberately and not renamed afterwards.

| Name | On | When |
| :--- | :--- | :--- |
| `data-gw-stacked="true"` | `.gw-root` | the grid is stacked (phase 2) |
| `gw-table--stacked` | `<table>` | the grid is stacked |
| `data-gw-label` | each stacked `gridcell` | carries the column's header text for the visual label |
| `gw-sort-control` | the toolbar's stacked sort control | stacked and `sortControl` is true |
| `gw-row-trigger` | the touch row-menu trigger | `(hover: none)` and a `hover` trigger |

No existing class is renamed. No existing element is removed from the default markup; without
`responsive()` and on a pointer device the markup is byte-identical to the previous release.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported (`ResponsiveOptions`, `ColumnResponsive`)
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes, with the react entry's expected-name count raised by the six names above
- [ ] The core entry's exports and types are unchanged (`ColumnDef` is not touched)
- [ ] `apsw-gridwright-mui`'s peer floor is raised with the release that ships this
