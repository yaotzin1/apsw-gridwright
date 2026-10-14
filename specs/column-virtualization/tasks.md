# Tasks: column virtualization

1. [x] Core arithmetic and its unit tests (`tests/unit/virtual-columns.test.ts`).
2. [x] Contract seams: `columnGeometry`, `columnWindow`, setup context, wrapper refs.
3. [x] Shell parts and summary row render through `renderedColumnsOf`; `aria-colcount` / `aria-colindex`.
4. [x] `virtualColumns()` and `useVirtualColumnScroll`; `columnLayout()` publishes geometry.
5. [x] `cellNavigation()`: reveal, tab-stop fallback, per-render cache.
6. [x] Stylesheet: gap cells, header containment.
7. [x] React tests (`tests/react/virtual-columns.test.tsx`).
8. [x] Playground: the wide demo.
9. [x] Docs: `docs/virtualization.md`, `docs/api.md`, README, CHANGELOG, DEPENDENCY_MAP, CLAUDE.md trap.
10. [ ] `npm run verify` end to end (blocked where written: npm registry unreachable).
