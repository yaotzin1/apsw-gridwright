# Architecture Rules

Binding. Elaborates `antigravity.yml`; where the two disagree, the YAML wins.

## 1. The headless boundary

`src/core`, `src/data` and `src/plugins` must not reference `document`, `window` or `react`. The
ESLint config enforces all three with `no-restricted-globals` and `no-restricted-imports`. An
exception is not granted; the change belongs in an adapter.

## 2. Three layers, one direction

```
src/core       engine, state, pipeline, values, columns, query, errors
src/data       data sources, built on core types only
src/plugins    pipeline stages, built on core types only
src/react      adapter: imports everything above, imported by nothing above
```

Imports point one way. `src/core` importing from `src/react` is a defect, not a shortcut.

`src/core/engine.ts` imports `corePlugins` from `src/plugins` for its default plugin set. That is
the single intentional exception, and it stays an exception: the plugins depend only on core types,
so there is no cycle at the type level.

## 3. Where a behaviour belongs

1. A transformation of rows is a pipeline stage, therefore a plugin.
2. Query state a server would also need belongs in `GridQuery`.
3. Grid state no server needs belongs in `GridState`.
4. Appearance and interaction belong in `src/react`.

## 4. Engine invariants

- One state object, published whole.
- Every fetch carries a sequence number and an `AbortController`; a stale response is dropped
  without touching state.
- A synchronous data source resolves synchronously, with no loading state published.
- `recomputeFromCache` runs only from a `ready` status.
- The engine never disposes a data source it did not create.

## 5. Rendering belongs to the adapter

`ColumnDef` carries no `ReactNode`. Renderers live on `GridwrightColumn` in `src/react/types.ts`.

## 6. Zero runtime dependencies

`dependencies` stays empty. React is an optional peer dependency. Adding a runtime dependency
requires a recorded decision in the feature's spec, and `scripts/check-exports.mjs` fails the build
if the field is not empty.
