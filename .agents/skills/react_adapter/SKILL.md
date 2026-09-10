---
name: react_adapter
description: Use when writing or reviewing anything under src/react: components, hooks, context, cell renderers. Covers Strict Mode, useSyncExternalStore, and keeping props from rebuilding the engine.
---

# React Adapter Specialist

The adapter renders engine state and forwards intent. It owns no grid logic.

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
worst possible pairing of symptoms to debug.

## Props change; identity does not

Column arrays are written inline, so their reference changes every render. Keying the sync effect
on the reference loops: `setColumns` publishes state, the state publishes a render, the render
makes a new array. `columnSignature` reduces the array to the parts the engine actually reads, and
the effect keys on that string. Renderers are read from props at render time instead, so a `cell`
closure is never stale.

The same rule applies to any new prop that reaches the engine. Ask what identity means for it
before writing the effect.

## Renderers

`ColumnDef` in the core carries no renderer. `GridwrightColumn` adds `cell` and `headerCell`, and
they receive a context object, never positional arguments. Adding a field to that context is a
minor version; changing one is a major.

## Composition over configuration

`<Gridwright />` is `useGridwright` plus the parts in a default arrangement. When a layout does not
fit, a consumer drops to `GridwrightProvider` and places `GridToolbar`, `GridTable`, `GridHeader`,
`GridBody` and `GridPagination` themselves. Keep every part usable on its own, and keep the props
that configure a part on the part, rather than only on the assembled component.

## Interaction details that matter

- Stop propagation on the selection checkbox click, or selecting a row also fires `onRowClick` and
  navigates away from the grid being selected in.
- The search input holds its own text and pushes to the engine. Reading it back from engine state
  makes typing wait for a round trip on a debounced grid.
