---
name: react_adapter
description: Use when writing or reviewing anything under src/react: components, hooks, context, cell renderers. Covers Strict Mode, useSyncExternalStore, and keeping props from rebuilding the engine.
---

# React Adapter Specialist

The adapter renders engine state and forwards intent. It owns no grid logic.

## The shell and its add-ons

`<Gridwright />` is a shell: `useGridwright` plus the parts, rendering a table, its rows and cells,
the loading, empty and error rows, and one live region. Every feature is an add-on passed through
`addons={[...]}`: `search()`, `columnFilters()`, `exportMenu()`, `rowActions()`, `inlineEditing()`,
`treeData()`, `virtualRows()`, and the default `coreAddons()` (`sorting()`, `selection()`,
`pagination()`, `staleNotice()`). `coreAddons={[...]}` replaces the default set and
`coreAddons={false}` removes it.

- **Never add a feature prop to `<Gridwright />`.** Its props are data, engine options, i18n,
  presentation, the consumer's own `toolbar`, `footer` and `caption`, `addons` and `coreAddons`.
  A new feature is a new add-on; a missing seam is a new slot in the contribution contract.
- **The shell and the parts import no add-on.** Parts render contributions from context
  (`useGridContributions`), so a hand-composed layout under `GridwrightProvider` gets every add-on.
  `tests/smoke/tree-shaking.test.ts` fails the moment a part imports a feature.
- **No privileged access.** A built-in add-on uses only what `src/react/index.ts` exports.
  `tests/react/third-party-addon.test.tsx` proves a third party reaches every slot; extend it
  whenever a slot is added.

The contract is in `docs/addons.md`; the authoring rules are in the `extensibility` skill. The ones
that bite in this directory:

- `setup` runs on every render and may call hooks. Write it as a named function expression starting
  with `use` so the hooks lint rule checks it. **Slot functions must not call hooks**: they run as
  often as the shell renders them. Return elements of module-level components from them, never a
  component defined inside `setup`, whose identity would change every render and remount.
- The list of add-on **names** is the hook order, so `<Gridwright />` keys itself on it and a changed
  list remounts the grid. `useGridwright` throws a `GridwrightError` on a changed list; key the
  calling component on `addonNamesOf(options)`.
- Attribute contributions go through `mergeAttributes`, an allowlist. Do not bypass it by spreading a
  contribution onto an element.
- `headerLabel` and `body` are one-owner slots. Header content from add-ons renders beside the sort
  button, never inside it.
- `suppresses` hides another add-on's rendering only; its `configure`, plugins and strings still
  apply.
- Both bodies render rows through `GridRowView` / `GridRowOrCustom`, so row and cell attributes,
  extra columns and custom rows are identical in the paged and the windowed body. A body of your own
  must do the same.

## Subscribing

The engine lives outside React and is read through `useSyncExternalStore`. Do not mirror engine
state into `useState`: two copies tear under concurrent rendering, and the copy React holds is
always the stale one.

## The engine must outlive renders

It is created once in a `useState` initializer. Strict Mode runs effects twice on mount and
destroys the engine in between, so the mount effect rebuilds when it finds a destroyed engine:

```ts
useEffect(() => {
    if (api.destroyed) { setApi(createEngine()); return; }
    return () => api.destroy();
}, [api, createEngine]);
```

Without that branch the grid renders empty in development and correctly in production, which is the
worst possible pairing of symptoms to debug. An add-on that owns a long-lived object (the tree
controller) has the same problem, and defers its own destruction past the Strict Mode remount.

## Props change; identity does not

Column arrays are written inline, so their reference changes every render. Keying the sync effect
on the reference loops: `setColumns` publishes state, the state publishes a render, the render
makes a new array. `columnSignature` reduces the array to the parts the engine actually reads, and
the effect keys on that string. An add-on whose `configure` reads a column option contributes to
the signature through its own `columnSignature`. Renderers are read from props at render time
instead, so a `cell` closure is never stale.

The same rule applies to add-on objects and plugin lists: add-ons may be new objects every render
(only names matter), and plugins are reconciled by name. Ask what identity means for anything new
that reaches the engine before writing the effect.

## Renderers and column options

`ColumnDef` in the core carries no renderer. `GridwrightColumn` adds `cell`, `headerCell` and `icon`,
and they receive a context object, never positional arguments. Adding a field to that context is a
minor version; changing one is a major.

A feature's column option (`edit`, `filter`) is declared by its add-on through module augmentation of
`GridwrightColumn` via `declare module 'apsw-gridwright/react'`, not added to the base interface. A
relative-path augmentation does not survive the `.d.ts` bundle.

## Strings

The core catalog and `GridwrightLabels` hold the shell's strings only. Each add-on ships its own
`messages` in all five bundled languages and reads them with `useAddonMessages`; each locale pack
carries them again under `addons[name]`. A literal in JSX is a defect.

## Composition over configuration

When the default arrangement does not fit, a consumer drops to `GridwrightProvider` and places
`GridRoot`, `GridToolbar`, `GridSlot`, `GridTable`, `GridHeader` and `GridBody` themselves. Keep every
part usable on its own and rendering contributions from context. Leaving out `GridRoot` drops the
add-ons' providers and overlays, which is documented, not a bug to work around.

## Interaction details that matter

- Stop propagation on the selection checkbox click, or selecting a row also fires `onRowClick` and
  navigates away from the grid being selected in.
- The search input holds its own text and pushes to the engine. Reading it back from engine state
  makes typing wait for a round trip on a debounced grid.
- One live region per grid. An add-on contributes `announce` or calls `grid.announce`; it never
  renders a region of its own.
