# Self-review: multi-column sorting

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

The badge, the hint and the announcement are all in the `sorting()` add-on (`src/react/core-addons`),
through the `headerLabel`, `announce` and `messages` slots a third-party add-on has as well. The one
core change is in `toggleSort` in `src/core/engine.ts`: plain array work, no DOM and no React, and it
passes the headless lint.

## 2. The local/remote seam

Nothing branches on where the rows come from. The badge and the announcement read `query.sort`,
which is the same array the local `core:sort` stage applies and a source with `capabilities.sort`
receives. The `toggleSort` fix changes that array for both sides at once: after a Shift-reversal a
server now receives the columns in the order the badges show. Checked in the playground with the
server resolving the sort (the mock API's `?sort=` sorts by every entry).

## 3. Public surface and semver

Minor for the feature, patch for the fix; both recorded in `api-surface.md` and `CHANGELOG.md`. No
export, type or option changes. Three messages are added; existing overrides keep resolving. The
sort button's `title` text changes while `multiSort` is on. That is copy, not an option's default,
and `actionWithShift: '{action}'` restores the old text. The `toggleSort` reversal order was never
documented, and the spec already said "in place".

## 4. Accessibility and i18n

The badge is `aria-hidden`, so the button's accessible name stays the header text (tested). The
priority reaches assistive technology through the live region, while more than one column is sorted
only. The Shift hint is in `title`, which is the button's accessible description (tested). Every new
string is a message in all five locales, and the locale completeness test passes. The priority
sentence is a whole sentence per direction, not a spliced direction word.

## 5. Supply chain and packaging

No dependencies. `npm run check:exports`: no runtime dependencies, both entries share one module
instance, the core bundle has no React import. The badge's CSS uses existing tokens only, and a
transparent border keeps it outlined under forced colours.

## 6. Honest output

The badge shows the actual index in `query.sort`, and nothing is shown for a single sorted column.
Nothing is computed that the grid does not know.

## 7. Verification

`npm run verify` on 2026-09-25, exit 0:

```
.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync (4 tracks, 8 stages, 16 skills, 8 gates, 14 rules)
workflow.ai.yml matches the repository
security audit: no findings (source, manifest)
 Test Files  45 passed (45)
      Tests  805 passed (805)
 Test Files  2 passed (2)          (smoke, against dist/)
      Tests  28 passed (28)
  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   both entries share one module instance
security audit: no findings (source, manifest, dist)
```

Playground in Chrome (Employees page, server resolving the sort, 400 ms latency): plain click, then
Shift-clicks adding a second and third column (badges 1/2/3, "Name, sort priority 3, sorted
ascending"); Shift-reversal in place; Shift-removal renumbering the rest; two Shift-clicks inside one
debounce window naming the first changed column; the multi-sort switch off (no hint in the title,
Shift replaces the sort) and on again; Polish ("Name, priorytet sortowania 3, posortowano
rosnąco").

## Known gaps

- **The badge was not seen on screen.** The automation tab reports `visibilityState: hidden` and
  screenshots time out, so the badge's rendering was checked through the DOM, not by eye. A look at
  it in light, dark and forced-colours modes is still owed.
- **One unexplained announcement.** In the very first Shift-click sequence after the page loaded,
  the live region held the row summary rather than the sort sentence. It did not recur in any later
  sequence, fast or slow. It may be the first settled state after the initial load, which is
  announced as a summary by design; not confirmed.
