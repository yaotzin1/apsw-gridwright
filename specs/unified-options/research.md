# Research: unified options, virtualization and windowing

## Options considered

### Option A — a `mode` prop

**How it works.** `<Gridwright mode="tree" />`, `mode="virtual"`, and a mode for each combination
somebody asks for.

**Rejected because.** The combinations are the point. A virtualized tree with a row menu is one of
sixteen combinations of four switches, and a mode enumeration has to name each one. It also encodes
the exact mistake being undone here: capabilities that exclude each other because of how they were
packaged, not because of what they do.

### Option B — keep separate components, add a shared internals module

**How it works.** `TreeGridwright` and `Gridwright` both import a shared body, and each grows the
new options separately.

**Rejected because.** Two components that must be kept in step are two components that will not be.
The tree fell behind exactly this way: the flat grid gained things the tree could not use. Sharing
internals fixes duplication and leaves the consumer still choosing a component before choosing a
behaviour.

### Option C — options on one component, each also exported on its own

**How it works.** `<Gridwright />` owns a default arrangement: `tree` calls `useTreeGridwright`,
`virtual` swaps `GridBody` for `GridVirtualBody`, `rowActions` renders `BubbleMenu`, `onCellEdit`
wraps the columns and provides `InlineEditProvider`. Every piece stays exported, and the component
has no privileged access to any of them.

**Chosen because.** The common case is one element with a few props, the uncommon case is composing
the same pieces by hand, and there is one implementation under both. `TreeGridwright` survives as a
name because a tree is a common enough starting point to deserve one.

### Option D for scale — virtualize only

**How it works.** Render a window over an array of every row.

**Rejected as sufficient.** It is necessary but not enough. Measured on this machine, ten million
rows of five fields:

| Scenario | Rows | Cost |
| :--- | ---: | :--- |
| Array in memory | 10,000,000 | ~1.5 GB |
| One sort pass | 10,000,000 | ~3.9 s |
| Rendering, virtualized | 10,000,000 | irrelevant, ~40 rows |

The DOM was never the binding constraint at that size. Holding the rows was.

### Option E for scale — a source that holds blocks

**How it works.** The source is asked for ranges, keeps the blocks covering the window plus
neighbours, and evicts the rest.

**Chosen because.** Memory becomes `blockSize * maxBlocks`, independent of the total. It composes
with Option D rather than replacing it: one solves rendering, the other solves holding, and a
consumer with a large array needs only the first.

## Prior art

**AG Grid's infinite row model** blocks and caches the same way, and its block size and cache size
are the same two numbers. Its behaviour on cache invalidation is the same as the one chosen here:
drop everything, because a block describes positions.

**TanStack Virtual** is measurement-first and supports variable heights. That flexibility costs a
`ResizeObserver` per row and DOM reads during scroll. A grid is the one place where fixed row height
is normal rather than a compromise, so this package takes the arithmetic and states the limitation
instead of paying for generality nobody asked for.

**Most virtualizers position rows absolutely** inside a scrolled container. That is easier and it
throws away column alignment and the `role="grid"` semantics a screen reader depends on. Spacer rows
keep a real table, which is why they were chosen despite being slightly more arithmetic.

**Browsers cap element height.** This is folklore rather than specification, and every large-list
implementation eventually meets it: Chrome at 2^24 pixels, Firefox not far above. The usual answer
is to scale scroll position into row space above the cap, which is what is done here, and to say so
rather than let the last rows be silently unreachable.

## Measurements

| Scenario | Rows | Before | After |
| :--- | ---: | ---: | ---: |
| Rendered `<tr>` elements | 5,000 | 5,000 | under 80 |
| Rendered `<tr>` elements | 10,000,000 | not possible | 23 |
| Rows resident in the browser | 10,000,000 | ~1.5 GB | 400 rows, 2 blocks |
| Range requests to show the last page | 10,000,000 | — | 2 |
| Reachable scroll depth at 40px rows | 10,000,000 | row ~419,000 | row 10,000,000 |

The first figure comes from a test; the rest were read off the running playground page, whose panel
counts blocks and requests from the source itself.

## Open questions

None blocking. Two noted for later:

- **Selection across a windowed source** is by loaded id only. Whether "select all" should become a
  query predicate rather than a set of ids is a design question, not an oversight, and it is a
  non-goal here.
- **Scaled scrolling and keyboard navigation.** Arrow keys move by row, which is finer than one
  pixel in scaled mode. Focus management is currently the browser's; making row-by-row movement
  exact would need the grid to own it.
