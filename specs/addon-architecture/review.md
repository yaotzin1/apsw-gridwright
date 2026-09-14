# Self-review: add-on architecture

See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

- The engine seams (`suppressStage`, `skip`, additive `plugins`, `corePlugins`, `removePlugin`) are in
  `src/core` and stay DOM- and React-free; lint enforces it.
- `Gridwright.tsx` and every file under `src/react/parts/` import no feature. The shell renders the
  table, rows, cells, status rows and one live region, and reads everything else from contributions.
- Every built-in feature is an add-on built from exported names only. `tests/react/third-party-addon.test.tsx`
  builds an add-on from `src/react/index` that reaches every slot, replaces a built-in by suppression,
  pins another add-on's extra column, and survives a throwing slot.
- `tests/smoke/tree-shaking.test.ts` bundles the built entry the way an application would: importing
  only `Gridwright` ships no filter, export, row action, editing, tree, virtual or search code.
- Column options are declared by augmentation from the add-on's own module (`edit` in
  `plugins/InlineEdit.tsx`, `filter` in `filters/types.ts`), the same way a third-party add-on does.
  Both survive into `dist/react/index.d.ts` and `.d.cts`.

## 2. The local/remote seam

Unchanged. The tree suppresses the core filter, search and sort stages by id instead of replacing the
plugin list, so it composes with pagination and with the application's plugins for both data paths.
No add-on branches on where rows came from.

## 3. Public surface and semver

**major**, recorded in `api-surface.md` and CHANGELOG (Unreleased, "Breaking: every feature is an
add-on"). The package is unpublished, so nothing is deprecated first. Additions made during stage 6
are listed in `api-surface.md` and explained in `spec.md` §8. `check:exports` asserts the new names
and that `TreeGridwright` and `useTreeGridwright` stay removed.

## 4. Accessibility and i18n

- One live region. The pagination range stopped being a second one.
- Announcement contributors replace the sort and filter special cases. Found and fixed in the
  browser: a debounced remote sort was announced before its rows arrived and the result said the row
  range. The baseline now moves only when a fetch settles, a pending query holds the last sentence, and
  a language change re-speaks it. Tests cover each.
- A windowed tree now carries `aria-level`, `aria-posinset`, `aria-setsize` and `aria-expanded`;
  both bodies render rows through `GridRowView`.
- The shell catalog holds seven keys. Every built-in add-on's English strings are in the add-on, and
  every bundled pack translates every built-in add-on under `addons`, audited by `auditAddonMessages`
  in `tests/unit/i18n.test.ts`. The report format suffixes ("(Markdown)", "(PDF)") and the row menu's
  accessible name, previously English literals, are now strings.

## 5. Supply chain and packaging

No dependency added. Security gate clean on source, manifest and dist. Attributes contributed by
add-ons pass a runtime allowlist, so no extension point can introduce a markup sink, a URL attribute
or a string handler.

## 6. Honest output

No invented totals, no placeholder content. The playground's own add-on (`pay-band.js`) is written
against public exports only and reads rows through `rowDataOf`, so it is correct under the tree too.

## 7. Verification

```
> npm run verify
✨ All 16 skills validated successfully! (0 Security Threats / 0 Syntax Errors)
.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync (8 stages, 16 skills, 7 gates, 13 rules)
security audit: no findings (source, manifest)
 Test Files  33 passed (33)
      Tests  527 passed (527)
 Test Files  2 passed (2)          (smoke, against dist/)
      Tests  25 passed (25)
the published package resolves cleanly.
security audit: no findings (source, manifest, dist)
exit 0
```

Chrome, against the built package on the playground server:

- Employees page: every add-on switched on and off (row actions, inline edit, virtual, tree, column
  filters, export, pay band). Real hover opened the row menu beside the pointer, right-click pinned it,
  and an item ran. Sorting by salary produced "Loading rows", "Salary, sorted ascending", "Loading rows",
  "Salary, sorted descending". Tree with virtual, filters, export, editing and the pay band together:
  `treegrid`, `aria-level` in the windowed body, 2 highlighted salaries. Polish: filter, export, tree
  toggle, search and the pay band legend all translated.
- Features page: tree, virtual, row actions, inline edit, icons, export and column filters each
  switched on and off with no console error; lazy children loaded on expand.

## Known gaps

- **Scrolling ten million rows was not re-checked in Chrome.** The tab became hidden, where
  `requestAnimationFrame` never fires, and the windowed body reads the scroll position on animation
  frames. The windowed-source tests in `tests/react/composition.test.tsx` cover the behaviour; a visible
  browser check is still owed (AC-23).
- **Branch protection names old checks.** `main` requires "Verify on Node 18/20/22" while CI now runs
  Node 22 and 24 plus a dependency audit job; the required checks need updating by the repository
  owner before a pull request can merge.
- **i18next namespace separator.** Add-on keys contain `:` (`gridwright:filters.apply`), which i18next
  reads as a namespace by default; documented in `docs/i18n.md`.
- **Draft specs** (column layout, cell navigation, grouping, view-state sync, multi-column sort badges,
  selection controls) are rewritten onto the add-on contract but not built. Their other artifacts
  besides `spec.md` and `plan.md` are still template copies.
