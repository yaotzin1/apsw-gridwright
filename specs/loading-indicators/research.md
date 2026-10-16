# Research: loading-indicators

## Options considered

### Option A — a separate project (`apsw-gridwright-spinners`)

**How it works.** A third package in the npm workspace, like `apsw-gridwright-mui`, holding the spinner set and
the skeleton, with its own version.

**Rejected because.** The grid needs a loading indicator to be useful. A grid that imports a sibling for it has
a runtime dependency; a grid that does not ships without one, which is today's gap. The MUI precedent does not
apply: that package skins add-ons the grid already has, and the grid works without it. A second version axis,
CI matrix and trusted-publisher setup buy nothing for a few kilobytes of CSS.

### Option B — inside the grid package (chosen)

**How it works.** `Spinner` and `loadingIndicator()` in `src/react/loading/`, CSS in `src/styles/`, nothing
imported but React. Tree-shaken away when not named.

**Cost accepted.** The set is versioned with the grid, so adding a style is a minor of the grid.

### Option B2 — a small set drawn as SVG, led by a plain ring, with mark-based extras (chosen within B)

**How it works.** Four JSX-built SVG components: `ring` (default), `dot-walk` (a dot over the mark's 3×3 cells),
`draw-g` (the letter G stroked on) and `cell-colors` (cells recolouring). Consumers replace any of them with
a component, including one from a library such as `react-spinners`, which stays the consumer's dependency.

**Why.** `ring` is what readers expect and keeps the add-on's default unsurprising; the other three are the
package's own identity. SVG is needed for `draw-g`, and it keeps four animations small.

**Cost accepted.** Inline SVG is more markup than a CSS shape. It is built from JSX elements only, so nothing
new reaches the security audit. `stroke-dashoffset` is not compositor-only, so `draw-g` is measured at stage 6.

### Option C — animated SVG (revised: adopted inside B2)

**How it works.** Inline SVG with SMIL or CSS animation.

**Now adopted** (see B2), as SVG built from JSX elements with stylesheet animation, because `draw-g` needs a
path and `dot-walk` is simpler as SVG. SMIL is held back as a fallback only: it is deprecated in places and
cannot honour `prefers-reduced-motion` as cleanly as CSS.

### Option D — an optional peer dependency on a spinner library

**Rejected because.** An optional peer still reads as a dependency at install, and it puts a third party's look
and accessibility behaviour inside a grid that guarantees its own.

### Option E — a skeleton only

**Rejected because.** A skeleton needs known column structure. A grid with no columns yet, or a retry state,
still wants a spinner, and `Spinner` is useful outside the grid.

## Measurements to take at stage 6

- Frame rate of a skeleton under `virtualColumns()` with 500 columns (`.agents/rules/performance.md` section 8).
- Gzipped CSS added to `styles.css`.
- Bytes added to a bundle that names `loadingIndicator()`, and zero added to one that does not.
