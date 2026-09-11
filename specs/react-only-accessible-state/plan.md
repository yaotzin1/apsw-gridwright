# Plan: React-only surface, accessible grid state

## Modules touched

| File | Change |
| :--- | :--- |
| `src/i18n/messages.ts` | Six `a11y.*` keys added to `MessageKey` and `englishMessages` |
| `src/locales/de.ts`, `es.ts`, `fr.ts`, `pl.ts` | The same six keys, translated |
| `src/react/types.ts` | Three label entries on `GridwrightLabels`; `AnnouncementInput` for the new hook |
| `src/react/labels.ts` | The three new labels wired to the catalogue |
| `src/react/a11y/announcement.ts` | **New.** Derives the one sentence from settled state |
| `src/react/a11y/useAnnouncement.ts` | **New.** Holds the sentence, clears it between changes |
| `src/react/a11y/rows.ts` | **New.** `aria-rowcount` and `aria-rowindex` arithmetic, one place |
| `src/react/Gridwright.tsx` | `GridRoot` renders the derived announcement |
| `src/react/parts/GridTable.tsx` | Header-inclusive `aria-rowcount`, `aria-multiselectable`, `role` |
| `src/react/parts/GridHeader.tsx` | `aria-rowindex={1}` on the header row |
| `src/react/parts/GridBody.tsx` | `aria-rowindex` per row; hierarchy attributes when in a tree |
| `src/react/virtual/GridVirtualBody.tsx` | Row index corrected to header-inclusive numbering |
| `src/react/parts/GridPagination.tsx` | Focus moves to the sibling when a control self-disables |
| `src/react/tree/TreeCell.tsx` | `aria-expanded` removed from the toggle; comment corrected |
| `src/react/tree/context.tsx` | Node lookup by row id, for the body to read level and set size |
| `examples/playground/index.html` | Becomes the React playground |
| `examples/playground/react.html` | Deleted; `index.html` is the React page now |
| `examples/playground/js/vanilla-page.js` | Deleted |
| `examples/playground/js/tree-panel.js` | Deleted; imported only by the vanilla page |
| `examples/playground/js/shared/load-package.js` | Failure copy no longer points at a deleted page |
| `.github/workflows/ci.yml` | Playground boot check follows the renamed pages |
| `README.md`, `docs/tree.md`, `docs/virtualization.md` | React-first framing |
| `package.json` | Description and keywords |
| `AGENTS.md`, `CHANGELOG.md`, `specs/DEPENDENCY_MAP.md` | Documentation synchronisation |

## Where the behaviour lives

All of it is in the adapter, and that is the answer to the four questions in
`.agents/rules/architecture.md`:

- **Does the engine need to know?** No. Every input is already on `GridState`: `rows`, `totalRows`,
  `isTotalExact`, `status`, `error`, `query.sort`, `query.pagination`. The adapter is the only
  layer that knows there is a reader.
- **Does it change the query?** No. Nothing here is a pipeline stage, and no facet of the query is
  added, so no data source has to declare a new capability.
- **Is it rendering?** Yes, entirely. ARIA attributes and an announcement are output, and output
  belongs to the adapter by rule.
- **Could a second adapter need it?** The arithmetic in `a11y/rows.ts` could, in principle. It
  stays under `src/react` regardless, because moving it to the core to serve an adapter that this
  same change declares will never exist is speculative generality.

The tree hierarchy attributes are the one place with a real seam question. The depth and the
sibling counts come from the nested-set node, which the tree controller under `src/tree` owns and
which is already headless. The adapter reads them through the existing tree context rather than
having the core publish ARIA-shaped fields, so the core stays ignorant of why anyone wants a
level.

## Trade-offs taken

**The row index changes meaning, and two tests change with it.** `aria-rowcount` becomes
`totalRows + 1` and data rows start at index 2. Anyone asserting on the old numbers has to update,
and the CHANGELOG says so under a "Fixed" heading rather than a "Changed" one, because the old
numbers were internally inconsistent, not merely different. The cost is accepted because leaving
`aria-rowindex` disagreeing with `aria-rowcount` in the same table is worse than a documented
correction.

**The announcement is derived during render, not emitted as an event.** A `GridEmitter` event
would let a consumer replace the announcement entirely, and would also put copy decisions on the
consumer's side of a boundary the message catalogue is meant to own. Derived-in-render keeps it
translated by default; `labels` remains the escape hatch for anyone who wants different words.

**`aria-expanded` moves off the toggle button.** A consumer's test that queries the button by its
expanded state will break. This is the correct ARIA and the alternative is a double announcement,
so the CHANGELOG names it explicitly.

**The playground loses a page and gains nothing visible.** The framework-free page demonstrated
the engine, and some readers valued it. It is deleted rather than fixed because keeping it means
maintaining a second grid that no test covers, which is exactly the condition this change exists
to remove. The engine is still documented; it is documented as an engine.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| The live region becomes chatty and readers turn it off | One sentence, one fact, strict priority order. Asserted in tests by reading the region's full text content, so a concatenation regression fails. |
| Clearing the region to force a repeat causes a double announcement | The clear is a separate committed render with an empty string, which assistive technology does not announce. Covered by a test that repeats an identical result and expects one announcement each time. |
| `role="treegrid"` breaks existing `getByRole('grid')` queries in consumer tests | Only a grid given `tree` becomes a treegrid. Flat grids are untouched, and the tree tests are updated in the same commit. |
| Focus restoration fights a consumer's own focus management | It runs only when the control the user just activated became disabled, and only moves focus to the sibling page control. It never fires on a page change the consumer drove through the API. |
| A locale is missed and falls back to English silently | `validateCatalog` already reports missing keys; the i18n unit test asserts every locale carries every key. |

## Out of scope for this change

Roving tabindex and arrow-key navigation, `aria-colcount` and `aria-colindex`, a controlled state
API, removing or deprecating the core entry, making React a required peer dependency, and any
second framework adapter. Each is argued in `spec.md` section 4.
