# Architecture Rules

Binding. Elaborates `workflow.ai.yml`; where the two disagree, the YAML wins.

## 1. The headless boundary

`src/core`, `src/data`, `src/plugins`, `src/tree`, `src/i18n` and `src/locales` must not reference
`document`, `window` or `react`. The ESLint config enforces all three with `no-restricted-globals`
and `no-restricted-imports`. An exception is not granted; the change belongs in an adapter.

## 2. Layers, one direction

```
src/core                engine, state, pipeline, values, columns, query, errors, export serializers
src/data                data sources, built on core types only
src/plugins             the core pipeline stages, built on core types only
src/tree, src/i18n,     headless features and translation, built on core types only
src/locales
src/react               the shell, the add-on contract (addons/), the core add-ons (core-addons/)
                        and one directory per feature add-on; imports everything above
```

Imports point one way. `src/core` importing from `src/react` is a defect, not a shortcut. Inside
`src/react`, the shell and its parts import no feature add-on; `tests/smoke/tree-shaking.test.ts`
fails when one does.

`src/core/engine.ts` imports `corePlugins` from `src/plugins` for its default plugin set. That is
the single intentional exception, and it stays an exception: the plugins depend only on core types,
so there is no cycle at the type level.

## 3. Where a behaviour belongs

1. A transformation of rows is a pipeline stage, therefore an engine plugin.
2. Query state a server would also need belongs in `GridQuery`.
3. Grid state no server needs belongs in `GridState`.
4. Appearance and interaction belong in a React add-on, never in a prop or a branch of the shell.

## 4. Every feature is a plugin, an add-on, or both

`<Gridwright />` renders a table and nothing else. A feature arrives as an engine plugin (rows,
stages, `state.meta`), a React add-on (anything a person sees or operates), or an add-on that brings
its plugin through the `plugins` contribution. State or an operation every renderer needs, with
nothing about it a choice, is a core service on `GridApi` (selection, `getMatchingRows`); its UI is
still an add-on.

**No privileged access.** A built-in plugin or add-on uses only public exports. When a feature needs
a seam that does not exist, the seam is added to the public contract for everyone, classified like
any other export, and `tests/react/third-party-addon.test.tsx` is extended to reach it. How to
write either kind is in `.agents/skills/extensibility/SKILL.md`.

## 5. Engine invariants

- One state object, published whole.
- Every fetch carries a sequence number and an `AbortController`; a stale response is dropped
  without touching state.
- A synchronous data source resolves synchronously, with no loading state published.
- `recomputeFromCache` runs only from a `ready` status.
- The engine never disposes a data source it did not create.

## 6. Rendering belongs to the adapter

`ColumnDef` carries no `ReactNode`. Renderers live on `GridwrightColumn` in `src/react/types.ts`.

## 7. Zero runtime dependencies

`dependencies` stays empty. React is an optional peer dependency. Adding a runtime dependency
requires a recorded decision in the feature's spec, and `scripts/check-exports.mjs` fails the build
if the field is not empty.

## 8. An add-on's logic does not live in its components

Inside an add-on's directory, what the add-on *decides* goes in plain `.ts` files that import
nothing from React, and the `.tsx` files render it and wire it to events. Deciding covers state
transitions, which key does what, geometry and measurement arithmetic, what a format writes, and the
text of an announcement. `export/formats.ts`, `layout/layout.ts`, `navigation/clipboard.ts` and
`a11y/announcement.ts` are the shape; a movement rule written inside a `useEffect` is not.

Two reasons. Logic in a plain function is tested with a call and an assertion instead of a render.
And React is the only adapter today, but the engine is headless so that it need not stay the only
one: a Vue or Angular adapter would rewrite the views and reuse these files, and every add-on that
buried its behaviour in hooks is one more to rewrite whole and keep in agreement by hand.

This is not a new layer or a new export. The files stay in the add-on's directory under `src/react`
and are exported only if a consumer needs them for another reason. Nor is it a reason to split a
five-line handler: logic that is only rendering stays with the rendering. An existing add-on that
predates this is brought in line when its logic is next changed, not refactored for its own sake.
Enforced by review (`.agents/rules/review.md`, dimension 1).
