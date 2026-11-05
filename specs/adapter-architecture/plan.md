# Plan: framework-neutral adapter architecture

## Target shape

```
engine (src/core, data, plugins …)         headless, unchanged
   │
view layer (src/view)                       headless: nodes, stores, add-on contract, resolve,
   │                                        table model, behaviour functions, string renderer
   ├── React renderer   (src/react)         thin: ViewNode -> React elements, store -> useSyncExternalStore
   ├── <any other>      (separate package)  thin: the same two functions in that framework
   └── conformance kit  (src/conformance)   one suite, a driver per renderer
```

A new framework needs: a `ViewNode` renderer, a store binding, an event adapter, a driver for the
conformance kit. Nothing else.

## Modules touched

- **New `src/view/`**: `node.ts`, `events.ts`, `store.ts`, `addon.ts` (types), `resolve.ts` (moved from
  `src/react/addons/resolve.ts` and generic), `attributes.ts` (`mergeAttributes`, the allowlist),
  `model/` (table model), `behaviour/` (sorting, selection, pagination, announcement), `addons/`
  (the three core add-ons), `string-renderer.ts`.
- **New `src/conformance/`**: driver interface, scenarios.
- **`src/react/`**: `addons/types.ts` becomes aliases over the view types; `addons/resolve.ts` and the
  `*-logic.ts` files become re-exports; a `renderNode.tsx` renders `ViewNode`; `useGridwright` binds
  stores. `GridHeader`/`GridBody`/`GridPagination` read the table model for the three core features.
  Feature add-ons not migrated are untouched.
- **Build and gates**: `tsup.config.ts` (two entries, `splitting: true` stays), `package.json` export map
  and `.d.cts`, `scripts/check-exports.mjs` (no `react` in view bundles, one module instance),
  `eslint.config.js` (the headless ban extended to `src/view` and `src/conformance`),
  `tests/smoke/`.
- **Docs**: `docs/adapters.md` (new), AGENTS.md repository map, README, CHANGELOG, `docs/api.md`,
  `specs/DEPENDENCY_MAP.md`.
- **Rules**: `workflow.ai.yml` architecture lines (C-8) via a `Workflow-Change:` commit.

## Seams

1. **Engine to view layer**: `GridApi` only. No change.
2. **View layer to renderer**: `ViewNode` out, `ViewEvent` in, `Store` for state. That is the whole
   interface an adapter author learns.
3. **Add-on to view layer**: `ViewAddon`. A React add-on stays valid (C-7).
4. **Escape hatch**: `component` nodes, resolved by the adapter by id.

## Why not the alternatives

| Alternative | Why not |
| :--- | :--- |
| Only move the pure logic files to the core entry | Fixes the import problem, not the structure: each new adapter still re-implements the shell, the add-on resolution and the hook-held state. Useful as step one, not enough |
| Make `AddonContribution` generic and nothing else | The slots still call hooks in `setup`, and the table structure is still in JSX |
| A virtual-DOM library as the shared layer | A runtime dependency, a second reconciler beside each framework's own, and it conflicts with the zero-dependency rule |
| Web component wrapping React | One product, not an architecture; shadow DOM breaks the shared stylesheet; a second runtime in every host |
| Template-string rendering | HTML strings are banned by the security rules |

## Stage 4: order of delivery

Each is a separate PR, green alone. See tasks.md.
1. Workflow-rule change (after approval).
2. Move the pure logic and `resolve` to `src/view`, re-export from React. No behaviour change.
3. Stores and node description, and the string renderer, with tests.
4. Sorting add-on neutral, React renders it through `renderNode`. First vertical slice; existing React
   sorting tests pass unchanged. **Checkpoint: measure and review before continuing.**
5. Conformance kit with the sorting scenarios, run by React and by the string renderer.
6. Table model; the React shell consumes it for the core features.
7. Selection and pagination neutral.
8. `docs/adapters.md`, release.

## Stage 5: Analyze (2026-10-31)

| Question | Result |
| :--- | :--- |
| Breaks a published signature? | No, provided `GridAddon` stays the same members (C-4) and every name keeps exporting from `/react`. Guard: a type test compiles an add-on written against today's types, and the exports audit lists the React entry's names before and after. Minor. |
| DOM or React under the headless directories? | The view layer must not import either. Risk: `ContributedAttributes<E>` is parameterised by React's HTML types and `ViewEvent` replaces `KeyboardEvent`. Both are rewritten structurally (T-04). Lint extended to the new directories. |
| Could a built-in need something a third-party add-on can't reach? | The core add-ons use only `ViewAddon`, nodes and stores, all exported. The React renderer's `component` registry is public (T-10), or the built-in views would have a private path. |
| Runtime dependency? | None. Stores and nodes are plain TypeScript. |
| Regresses keyboard reachability or announced state? | Risk **high-value**: the header cell cursor, tab index handoff (`useHeaderCellTabIndex`) and focus after a page change currently live in React context and refs. The behaviour functions return a focus *action* and the React renderer applies it; the conformance scenarios and the existing `a11y-axe` and `accessible-state` suites are the guard. Not migrated to neutral until T-14 passes them unchanged. |
| Per-row work on the hot path? | Risk: building row models eagerly would allocate per row. Mitigation: `row(index)` is lazy, memoised, and the windowed body asks only for what it mounts. AC-11 sets a benchmark gate. If the React render slows beyond noise, the plan returns to stage 3 and the table model is narrowed to header and status only. |
| Security | One allowlist for tags and attributes (US-06). No HTML string and no raw-markup kind exist in `ViewNode`, so the banned sinks cannot be expressed. `component` nodes are resolved by id from an adapter-owned registry, never by name from data. The security audit scans `src/view` and `src/conformance`. |
| Does it contradict `workflow.ai.yml`? | Yes, two lines (C-8). Blocking dependency, recorded as T-01, not worked around. |
| Unproven assumption | That a plain-data node description is expressive enough for the three core add-ons without `component`. The sorting slice (stage 4 checkpoint) is designed to disprove it cheaply before the rest is built. |

Outcome: **proceeds to Implement after T-01 and the OPEN items (C-1 name, C-2 `component` in v1, C-9 where
the kit ships) are answered.** The plan has a stop at the delivery step 4 checkpoint; if the sorting
slice shows the node description is not enough, the design returns to stage 3 rather than growing
`ViewNode` ad hoc.
