# Self-review: selection controls

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Adapter only. Everything is in the `selection()` add-on, through `columns`, `rowAttributes` and
`tableKeyDown`, which a third-party add-on has as well. No core change: the handlers call the public
`api.toggleRowSelection`. The keyboard route reuses `cellControlOf` from `cellNavigation()`, so both
add-ons agree on what counts as a control in a cell.

## 2. The local/remote seam

Nothing branches on the source. Selection operates on loaded row ids either way; the playground was
checked against the paginating mock API.

## 3. Public surface and semver

Minor. Two optional fields on `SelectionOptions`, both defaulting to today's behaviour (`selectAll:
true`, `selectOnRowClick: false`), one message and one class. Recorded in `api-surface.md` and
`CHANGELOG.md`. A default `coreAddons()` grid renders exactly as before (existing suites unchanged).

## 4. Accessibility and i18n

- `selectAll: false` keeps a named column header (visually hidden `selectColumn`), tested.
- Row-click selection has a keyboard route: `Space` on a cell focused by `cellNavigation()`, tested
  with and without a control in the cell. Without `cellNavigation()` rows cannot take focus, and
  `docs/api.md`, `docs/accessibility.md` and the playground hint say to pair them. That is a
  documented condition, not a built-in guarantee; see Known gaps.
- `aria-selected` and `aria-multiselectable` are unchanged. `selectColumn` is translated in all five
  locales, and the completeness test passes.

## 5. Supply chain and packaging

No dependencies. `npm run check:exports`: no runtime dependencies, one shared module instance. No
HTML sinks; the handlers read `closest()` and the document selection only.

## 6. Honest output

Nothing computed or displayed changes. A click that ends a text selection selects nothing, so
copying a value does not silently change what is selected.

## 7. Verification

`npm run verify` on 2026-09-25, exit 0:

```
security audit: no findings (source, manifest)
 Test Files  46 passed (46)
      Tests  817 passed (817)
 Test Files  2 passed (2)          (smoke, against dist/)
      Tests  28 passed (28)
  ok   no runtime dependencies
  ok   both entries share one module instance
security audit: no findings (source, manifest, dist)
```

Playground in Chrome (Employees page, paginating mock API): `select-all` off (header holds
"Selection", no header checkbox, hint shown) and on again; `select on row click` on (25 rows
`.gw-row--selectable`, `cursor: pointer`, two rows selected by clicking, one released by clicking
again) and off (a row click selects nothing, no class); checkbox column off with row click on (hint
says there is no keyboard route yet); `cell navigation` on, `Space`, `ArrowDown`, `Space` selecting two
rows; `row detail` on, its toggle button opening the panel without selecting the row; the checkbox
releasing its row exactly once with row click on.

## Known gaps

- **`checkboxes: false` without `cellNavigation()` is still not keyboard-operable.** The add-on does
  not warn at runtime; the documentation does. A roving row focus of its own (spec C-1 option a) would
  close it at the cost of a second focus model, which was the reason to choose (b).
- **Shift-click range selection** is out of scope (spec §4) and would build on the same handler.
- **Seen through the DOM, not by eye.** The automation tab is hidden, so the pointer cursor and the
  hidden header were checked through computed style and markup rather than a screenshot.
