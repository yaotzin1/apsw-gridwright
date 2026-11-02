# Research: framework-neutral adapter architecture

## What was measured (2026-10-31, `src/react`)

- `sorting.tsx` is a good sample of the split: `ariaSortOf`, `sortAnnouncement`, `sortTitleOf`,
  `sortPriorityOf` and `toggleSort` are neutral; the only React is `SortButton`, a `<button>` with a
  label, an indicator and a priority badge. As a node description that is about fifteen lines.
- `src/react/core-addons/{sorting,pagination}-logic.ts`, `a11y/announcement.ts` and
  `addons/resolve.ts` import no React runtime. `selection-logic.ts` imports React *types* only.
- 36 files under `src/react` call a React state or lifecycle hook. They are spread over 18 directories,
  which is why a single "wrap the hooks" fix would not do: add-on state is the real coupling.
- `AddonContribution` has about thirty fields. Roughly half are data or attribute maps (neutral once the
  HTML types are structural); the slots are `ReactNode`; `setup` and `provide` assume React.
- `apsw-gridwright/react` loads React at import, so helpers exported from it are unreachable without
  React. Moving them is necessary but, on its own, insufficient.

## Prior art (from knowledge, not re-verified here)

- TanStack Table: headless core with per-framework adapters that bind state and leave rendering to the
  user. Adapters stay thin because the table model is built in core. Closest in spirit to this plan.
- Lit/Stencil style web components: portable, but one runtime inside every host and shadow DOM styling.
- Hyperscript-style node descriptions (`h(tag, attrs, children)`) are what Preact, Vue and Solid all
  accept in some form, so a plain-data node maps to each without a library.

These are recalled, not checked; treat them as context for the design, not as claims for the docs.

## Open technical questions

1. **Is a data-only node expressive enough?** The sort button needs a handler, a title and children, all
   expressible. A pagination page-size `<select>` needs controlled value semantics, which frameworks
   handle differently. The stage 4 slice and the pagination task test this.
2. **Controlled inputs.** The select-all checkbox is indeterminate; `indeterminate` is a DOM property,
   not an attribute. The node description needs a `props` channel or a rule for it (React sets it in a
   ref effect today).
3. **Focus.** Returning a focus *action* works for known targets (table, header cell). Focus on an
   element a consumer's `component` rendered needs an id the renderer can resolve.
4. **Measurement.** A baseline of render time and allocations for the 10 000-row and 500-column fixtures
   must be recorded before T-12, so AC-11 compares against a number rather than a feeling.
5. **Hydration and SSR** are renderer concerns; the view layer touches no browser global, so it does not
   block them.

## Deliberately not researched

Packaging of future adapters (workspace or separate repository) and which framework comes first. Neither
changes the architecture, and deciding early would pull the work back toward building one adapter.
