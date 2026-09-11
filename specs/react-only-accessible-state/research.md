# Research: React-only surface, accessible grid state

## Options considered

### Option A — Collapse the engine into the React adapter

**How it works.** Delete the `.` export, move `src/core`, `src/data` and `src/plugins` under
`src/react`, drop the headless lint boundary, and publish one entry point that requires React.

**Rejected because.** `workflow.ai.yml` declares the headless boundary and "rendering belongs to
the adapter" as architectural rules, and it outranks every other document here. Taking this option
means amending the supreme file first, which the requester was asked about directly and declined.
It is also a major version that buys nothing: the engine is already framework-agnostic, already
tested on its own, and already the seam the plugin and data-source contracts are defined at.
Merging it into the adapter would make the pipeline harder to test, not easier to use.

### Option B — Keep the engine, retire the second implementation and the framing

**How it works.** `src/core`, `src/data` and `src/plugins` stay exactly as they are, lint boundary
included. What changes is what the repository claims and what it demonstrates: the README leads
with the React component, the package description says so, the playground's landing page is the
React grid, and the framework-free page that built a grid by hand from the engine is deleted.

**Chosen because.** It removes the actual cost without paying a major version. The cost was never
that the engine exists; it was that a second, untested, unaudited grid implementation sat in
`examples/playground/js/vanilla-page.js` and `tree-panel.js`, duplicating the header, the status
rows, the row menu and the tree, and diverging from the adapter on every accessibility decision
made in `src/react`. Deleting it means there is one grid to get right.

### Option C — Announce through `aria-live` on the table body

**How it works.** Put `aria-live="polite"` on the `<tbody>` so row replacement is announced by the
rows themselves.

**Rejected because.** A live region announces its whole subtree when it changes. On a page of 25
rows with six columns that is 150 cells read aloud on every page change, every keystroke of the
search box and every sort. It is the single most common way a grid becomes unusable with a screen
reader while appearing to be conscientious about it.

### Option D — A dedicated visually hidden region carrying one derived sentence

**How it works.** `GridRoot` already has a `role="status"` region. It carries the loading label and
nothing else. Extend it to derive one sentence from the settled state, in priority order, and clear
it between announcements so a repeated identical message is still announced.

**Chosen because.** It is bounded: one short sentence per settled change, never the rows
themselves. It also puts the sort announcement somewhere a reader will actually hear it, which
`aria-sort` cannot do, because `aria-sort` lives on a header cell the reader has left by the time
the sort applies.

### Option E — Re-announce sort by changing the sort button's accessible name

**How it works.** Append the current direction to the button's label, so activating it renames it
and a screen reader reads the new name.

**Rejected because.** The button's accessible name is the column header. Changing it to "Salary,
sorted ascending" means the column can no longer be found by its own name, by a user or by a test.
The `title` already names the next action and is the right place for that; the resulting state
belongs in the live region.

## Prior art

**WAI-ARIA Authoring Practices, grid pattern.** The APG data-grid examples that set
`aria-rowcount` give the header row `aria-rowindex="1"` and start data rows at 2, and count the
header row in the total. This package currently does neither consistently, which is what makes the
virtual body's `aria-rowindex` disagree with its own `aria-rowcount`. Followed as written.

**WAI-ARIA `treegrid` pattern.** `aria-expanded` belongs on the row, not on the toggle control
inside it, and `aria-level`, `aria-posinset` and `aria-setsize` describe the row's place in its
level. Followed. The consequence is that the toggle button loses its `aria-expanded`, because a
row and a button both carrying it is announced twice.

**AG Grid and TanStack Table.** Both leave the announcement to the integrator. That is a
defensible choice for a component library with no opinion about copy, and the wrong one here: this
package already owns every visible string through the message catalogue, so it can own the
announcement too and have it translated along with everything else.

**MUI DataGrid.** Uses a dedicated hidden announcer element, close to Option D. Its announcements
concatenate several facts into one sentence, which is the part not copied: the region is read in
full on every change, so one fact at a time is the constraint that matters.

## Measurements

No performance claim is made, so no measurement is required. The announcement is one derived string
per settled state change, and the row attributes are two integers per row already being rendered.
Render counts are unchanged: the announcement is derived during render from state the parts already
subscribe to, and the one new effect is the focus restoration, which runs only on a page control's
own activation.

## Open questions

None. The three that existed at stage 2 are recorded as resolved in `spec.md` section 7: the scope
of "React only", the meaning of "accessible state", and whether the header row counts toward
`aria-rowcount`.
