# Plan: responsive layout

Modules touched and the seams, for stage 6. The contract is `api-surface.md`; this file is how.

## Phase 1

1. **`src/styles/styles.css`**
   - `.gw-root { container-type: inline-size; container-name: gw; }` (spec C-1).
   - `@container gw (max-width: ...)` rules for `.gw-toolbar` and `.gw-pagination`: wrap, the search
     field takes the row. The thresholds are tokens-free constants kept in one commented block, since
     a container query cannot read a custom property.
   - `@media (pointer: coarse)`: a `min-block-size` and `min-inline-size` of `var(--gw-touch-target)`
     on `.gw-sort-button`, `.gw-bubble-item`, the pagination buttons and the add-ons' icon buttons.
     Enlarge the hit area without moving the glyph (padding or a pseudo-element), so a pointer device
     is unchanged.
   - Overlays: `max-inline-size: calc(100vw - 16px)`, `max-block-size` with `overflow: auto`.
   - `--gw-row-height` read as `min-height` on `.gw-row`, not `height`. Check `GridVirtualBody`, which
     sets an inline `height` of its own and must keep winning.
   - Dark mode and forced colours: no new colour, so nothing to define twice; confirm.
2. **`src/react/responsive/`**: `addon.tsx` (`responsive()`), `useContainerWidth.ts`, `messages.ts`,
   `index.ts`.
   - A zero-size sentinel rendered by the add-on in `aboveTable` observes its `closest('.gw-root')`
     with one `ResizeObserver`. It does **not** take the table wrapper's ref (CLAUDE.md trap).
   - The width is state in a small context so `useContainerWidth()` and the contributions read it.
   - Created and disconnected in an effect, safe under Strict Mode's mount-destroy-mount.
3. **Hiding columns.** Reuse the visibility path `columnLayout()` uses (read `src/react/layout/` first
   to find it). The width layer is separate from the reader's saved layout, so `onChange` never sees
   it (AC-09). Any effect that pushes columns keys on `columnSignature`.
4. **`GridwrightColumn`** gains `responsive`; `columnSignature` includes `hideBelow` so a change
   rebuilds, and nothing else does.
5. **Pinned cap (AC-11).** Computed in the add-on from the resolved column widths and the container
   width; it does not edit `columnLayout()`'s state, it only suppresses the pin at that width.
6. **Touch row-menu trigger (C-6)** in `src/react/plugins/BubbleMenu.tsx`, gated on
   `matchMedia('(hover: none)')`, subscribed with `useSyncExternalStore` and a server snapshot of
   `false`.
7. **Examples and docs.** Add `responsive()` and a `hideBelow` column to the playground and the MUI
   showcase, with a width control (a resizable container) so it can be operated. Add
   `docs/responsive.md`, a section in `docs/api.md`, the README feature list, `CHANGELOG.md` under
   Unreleased, and `specs/DEPENDENCY_MAP.md`.

## Phase 2

1. `rootAttributes` sets `data-gw-stacked`; `tableAttributes` adds `gw-table--stacked`.
2. CSS for `.gw-table--stacked`: `display: block` on table, body and row, `display: grid` on a row,
   the header row visually hidden but present. **Restore roles explicitly** on `<table>`, `<tr>`,
   `<th>` and `<td>` through the existing attribute contributions, because `display: block` removes
   table semantics in several browsers (AC-21).
3. `cellAttributes` supplies `data-gw-label`; the label is also exposed once to assistive technology
   (AC-22). Decide between a visually hidden element in the cell and `aria-label`; measure with a
   screen reader before choosing, and record the result in `review.md`.
4. `toolbar` contribution renders the sort control, reading and writing through the existing sorting
   API, so multi-sort priority and the announcement come for free.
5. `cellNavigation()`: skip the header row while stacked (`useCellNavigation`'s existing cursor model);
   the arrow keys follow DOM order.
6. `virtualRows()` check: `responsive()` reads whether the add-on is listed (`addonNamesOf`) and does
   not stack (C-4).

## Trade-offs

- A width observer in the adapter, not the engine: the query must not depend on a screen (spec 7).
- Container queries for the chrome and a React observer for the structure: CSS is enough where only
  appearance changes; structure (which columns exist) has to be in the React tree.
- Phase 1 first, because it is mostly CSS and has no structural risk. Phase 2 is where regressions
  would be, so it gets its own release and its own browser pass.
