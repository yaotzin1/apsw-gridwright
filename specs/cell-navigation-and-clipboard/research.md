# Research: 2D cell navigation and clipboard copy

## Options considered

### Option A — `aria-activedescendant`

**How it works.** One container holds DOM focus permanently and carries
`aria-activedescendant="<cell id>"`; moving the cursor rewrites that attribute and every cell needs
a stable `id`.

**Rejected because.** The cell is never really focused, so a screen reader announces what the
package tells it rather than what the browser knows: the header association a `<td>` gets from its
`<th>` for free has to be reconstructed, and support for `aria-activedescendant` on a `grid` is
uneven across screen reader and browser pairs. It also needs a generated `id` on every cell, which
is markup this package does not otherwise emit.

### Option B — roving `tabIndex` (chosen)

**How it works.** Exactly one data cell holds `tabIndex={0}` and the rest hold `-1`; a key handler
moves that attribute and calls `focus()` on the new cell. The grid is one Tab stop because only one
cell is tabbable.

**Chosen because.** The focused cell is really focused, so the header association, the row position
and the cell's text are announced by the browser from the markup that already exists. It is what the
WAI-ARIA authoring practices describe for a grid, and it needs no `id` on any cell. The cost is that
a cell has to exist in the DOM to be focused, which is what makes the windowed case (AC-05) a
scroll-then-focus rather than a single state write -- an acceptable trade for not reimplementing
screen reader announcements.

## Prior art

AG Grid and TanStack Table both expose a cell cursor; AG Grid uses roving focus on real cells for
the same reason as above. Both also offer clipboard *paste* into a range, which this package
deliberately does not (spec §4): pasting a block edits many cells at once and needs bulk validation
and rollback, which is an editing capability rather than a navigation one.

Where this package deliberately differs: neither of those grids has to answer what "the last row"
means when the source sends no total, because both assume a known row count. This one does have to,
and answers it by refusing to guess (C-2).

## Measurements

Not required: nothing here is justified by speed. The cursor is two strings of state and the key
handler runs once per keypress. The one per-cell cost is a `tabIndex` in `cellAttributes`, which is
one comparison per rendered cell against the active cell's ids, on a path that already merges
contributed attributes per cell.

| Scenario | Rows | Before | After |
| :--- | ---: | ---: | ---: |
| — | — | — | — |

## Open questions

None. C-1 (extra columns) and C-2 (`Ctrl+End` with no total) were resolved at stage 3 and are
recorded in `spec.md` §8 and `api-surface.md`. Clipboard copy (AC-06, AC-07) is specified but is
being built as a second change on top of this one, which is a sequencing decision rather than an
open question.
