# Self-review: React-only surface, accessible grid state

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Nothing under `src/core`, `src/data` or `src/plugins` changed except `src/i18n/messages.ts` and the
four locale files, which are string tables and reference neither the DOM nor React. The lint rule
that enforces the headless boundary passed unchanged.

Every new module is under `src/react/a11y/`. Imports still point one way: `a11y/rows.ts` imports
nothing, `a11y/announcement.ts` imports only its own types, `a11y/tree.ts` imports the tree
controller and node types from `src/tree`, and `a11y/useAnnouncement.ts` imports React. No core
module imports anything from `a11y/`.

Nothing that belongs in a plugin ended up in the engine, because nothing went into the engine at
all. The one design question worth recording is the tree hierarchy: the depth and the sibling
counts could have been published as ARIA-shaped fields from `src/tree`, and were not. `a11y/tree.ts`
reads them out of the nested set the controller already holds, so the core still knows nothing about
why anyone wants a level.

## 2. The local/remote seam

The feature reads `GridState` and touches neither `GridQuery` nor any capability, so no data source
had to change and none was changed. `specs/react-only-accessible-state/tasks.md` records that as
T-03 rather than omitting it, because "no change" is the claim.

No new code branches on where the rows came from. There is one branch that looks like it might, and
does not: the announcement takes a `paginated` flag, which comes from whether windowing is switched
on, not from the data source. A virtualized grid over a local array and one over a windowed remote
source produce the same sentence.

Both sides are covered by tests. `tests/unit/a11y-state.test.ts` asserts the exact-total and
inexact-total wording; `tests/react/accessible-state.test.tsx` renders a remote source that omits
`totalRows` and asserts `aria-rowcount` is `-1`.

No stage narrows rows here, so there is no new total to report.

## 3. Public surface and semver

**Gained.** Three members on `GridwrightLabels` and six keys on `MessageKey`. **Lost.** Nothing.
**Changed.** No signature. Classified as **minor** in `api-surface.md`, on the rule recorded in
`messages.ts` that adding a key is a minor.

`SortDirection` appears in the new `sortAnnouncement` signature and was already exported from both
the core entry and the React entry; that was checked before the contract was written rather than
after. The new modules under `src/react/a11y/` export nothing from either entry point, and
`isTreeNode` was exported from its module for internal reuse but deliberately not added to
`src/react/index.ts`: it is a duck type, and a duck type in the public surface is a promise about
the shape of a row this package cannot keep.

Both module conditions still resolve types. `npm run check:exports` verified all twelve
type/default pairs, that the core bundle still contains no React import, and that both entries
share one module instance.

The honest caveat, and it is in the CHANGELOG under **Changed** and **Fixed** rather than buried:
the rendered ARIA changed. `aria-rowcount` went from `totalRows` to `totalRows + 1`, virtualized row
indices from `absolute + 1` to `absolute + 2`, and `aria-expanded` moved off the tree toggle onto
the row. None of that is an API change by this repository's table, and all of it will break a
consumer test that asserted the old values. Six tests in this repository asserted them and were
updated; every one was encoding a bug.

## 4. Accessibility and i18n

This is the feature, so the answer is longer than usual.

No new control was added, so there is nothing new to reach by keyboard. One existing focus
behaviour was repaired: activating a page control that disables itself now moves focus to its
sibling instead of dropping it to `<body>`. It is deliberately narrow, firing only when the reader
activated the control that became disabled, so a page change driven through the API never steals
focus. Both halves are tested.

`aria-sort` is still on the `<th>` and was not touched. What changed is that the resulting state is
now also announced, because `aria-sort` sits on a cell the reader has left by the time the sort
applies, and a control that is activated and says nothing is a control that appears broken.

Every string added is in the message catalogue, in all five shipped locales, and reachable through
`labels`. Nothing was written into JSX. The existing i18n test asserting that every locale carries
every key covered the six new ones without modification, which is the test doing its job.

One consequence worth stating plainly: the live region can now hold the same words as a visible
element, most obviously the empty-state label. That is correct, because the visible one is not
announced when rows are replaced under a reader, but it means `getByText` on a status string finds
two nodes. It is in the CHANGELOG.

## 5. Supply chain and packaging

No new runtime dependency, and no new dependency of any kind. `check:exports` confirms the package
still declares none.

No new file enters the tarball. The four new source modules compile into the existing
`dist/react/index.js`; `npm pack --dry-run` lists 35 files, 345.5 kB, and nothing from `examples/`,
`specs/`, `tests/`, `src/` or `.agents/`. The eight files deleted from `examples/playground/` were
never published, so the published artifact loses nothing.

## 6. Honest output

The rule that mattered most here is the one about invented numbers, because an accessibility
announcement is the easiest place to break it: a screen reader user cannot see the table to notice
that the total is wrong.

`aria-rowcount` is `-1` when `isTotalExact` is false, which is the ARIA value for "not known",
rather than a count derived from the page in hand. The announcement uses the "of many" wording in
the same case. Both are asserted, and the unit test additionally asserts that the string does not
contain the page-derived number. The virtualized announcement reports the total rather than the
window bounds, because the bounds describe where the scrollbar is, not the result.

No loading state was added, and the existing synchronous path is untouched. A failure now surfaces a
sentence a person can act on in one more place than before: the live region carries the error title
even when stale rows are still on screen, which was previously silent.

## 7. Verification

`npm run verify` passed end to end, exit code 0. The run: 15 skills validated with 0 security
threats and 0 syntax errors; `.claude/skills` and `AGENTS.md`/`GEMINI.md` both in sync; typecheck
clean; ESLint clean with no warnings; 355 tests in 22 files; 14 smoke tests against `dist/` through
the export map; and 33 `ok` lines from the packaging audit.

```
> npm run clean && npm run validate:skills && npm run sync:check && npm run typecheck && npm run lint && npm run test && npm run test:smoke && npm run check:exports

✨ All 15 skills validated successfully! (0 Security Threats / 0 Syntax Errors)
.claude/skills is in sync (15 skills)
AGENTS.md and GEMINI.md are in sync (8 stages, 15 skills, 6 gates, 12 rules)

 Test Files  22 passed (22)
      Tests  355 passed (355)

 Test Files  1 passed (1)
      Tests  14 passed (14)

  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   core ESM entry exports 16 expected names
  ok   react ESM entry exports 12 expected names
  ok   both entries share one module instance

the published package resolves cleanly.
```

**A test that would have caught this change's absence.** Several, and they are the point: the row
indices, the announcements, the tree hierarchy and the focus move are each asserted by role and by
accessible name rather than by class name or DOM shape, so each is also a test that the thing is
reachable at all. `tests/react/accessible-state.test.tsx` fails against the previous implementation
on every one of its twenty cases.

**A test that would catch its regression.** The smoke suite is the one worth naming, because it is
the only one that would catch the failure mode the unit tests structurally cannot: it renders the
built `dist/` bundle through the package's export map and asserts the live region's text and the row
numbering there. A build that tree-shook the announcement away would leave all 355 source tests
green.

## Known gaps

- **The playground was not clicked through in a browser.** The Chrome extension was not connected
  in this session, so the verification was HTTP-level: every page returns 200, every module each
  page imports resolves, the removed page returns 404, and all six playground modules parse. That is
  what CI checks and it is weaker than a person using the page. The capability controls added to the
  React page in T-18a are the part most worth a human look, because they are new UI rather than a
  moved attribute.
- **No screen reader was used.** Every claim in this feature is asserted against the accessibility
  tree as Testing Library sees it, which is the DOM and the ARIA attributes. It is not the same as
  hearing NVDA or VoiceOver read the grid, and the announcement priority order in particular is a
  judgement about what is useful to hear, not something a test can confirm.
- **Roving tabindex and arrow-key cell navigation are still absent**, as `spec.md` section 4 says.
  This change fixes what a reader is told about the grid's state; it does not change how they move
  through it. The condition that would justify doing it is a report from someone who navigates a
  grid by cell, which is a different pattern with its own focus-management design.
- **`aria-colcount` and `aria-colindex` were deliberately not added.** They exist for tables whose
  columns are windowed, and this grid renders every visible column, so the DOM order is already the
  truth. If column virtualization is ever added, they become required at the same time.
