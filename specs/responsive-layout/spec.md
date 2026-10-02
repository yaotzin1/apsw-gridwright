# Specification: responsive layout

> **Status**: Draft (stages 1 and 2 written 2026-10-02; nothing implemented)
> **Stage entry**: 1 & 2
> **Track**: feature
> **Semver impact**: minor (one new add-on, one new column option, new tokens and classes; no option
> default changes. The size-container decision is in C-1.)

---

## 1. The consumer problem

The grid has one answer to a narrow screen: the table wrapper scrolls sideways (`.gw-table-wrapper`,
`overflow-x: auto`). That is the right floor, and it stays. Everything else assumes a desktop:

- **The chrome does not adapt.** The toolbar (search, column picker, export menu, add-on controls) and
  the pagination bar are laid out for one wide row. At 375 px they either overflow or squash.
- **There is no way to drop a column.** A consumer who wants "name and status on a phone, all eight
  columns on a desktop" has to rebuild the `columns` array from a `matchMedia` listener of their own,
  and that array's identity changes every render (`columnSignature` exists because of it).
- **A phone cannot read a wide row.** Scrolling a ten-column table sideways to read one record is the
  case a card layout exists for, and the grid cannot render one.
- **Touch is second-class.** Targets are sized for a pointer (a 40 px row, small icon buttons), and the
  row menu's `hover` triggers have no equivalent on a device without hover.
- **Overlays assume room.** The column picker, filter popover, export menu and row bubble position
  themselves from a trigger and clamp to the grid's edge, not the viewport's.
- **Sizes are fixed in pixels** (`--gw-row-height: 40px`), so a reader who raises their text size to
  200 % clips text instead of getting a taller row.

None of this is exotic: it is a phone, a split-screen window, a sidebar-width widget or a zoomed page.

## 2. User stories

- **US-01.** As a reader on a phone, I want the toolbar and the pagination bar to wrap and stay
  usable, so I do not have to scroll the page sideways to reach a button.
- **US-02.** As a developer, I want to say "this column is not worth showing below 640 px" once, on the
  column, without writing a resize listener or rebuilding `columns`.
- **US-03.** As a reader on a phone, I want each row to read as a card of label and value pairs, so I
  can read a record without scrolling sideways, and still sort.
- **US-04.** As a reader on a touch screen, I want controls I can hit and a row menu I can open
  without a hover.
- **US-05.** As a reader who zooms the page to 400 % or sets a large text size, I want the grid to
  reflow and grow, not clip.
- **US-06.** As a developer, I want the grid to respond to **its own container's width**, not the
  window's, because it lives in sidebars, dialogs and split panes.

## 3. Acceptance criteria

Phase 1 is the stylesheet and the column option; phase 2 is the stacked layout. They ship separately
(see C-3), so a release can carry phase 1 alone.

### Phase 1: chrome, touch, reflow, column priority

- [ ] **AC-01** The toolbar wraps: at a container width of 320 px every control is reachable and none
      is clipped or pushed outside the grid. The search field takes the full row when it has to.
- [ ] **AC-02** The pagination bar wraps the same way. The range text, the page-size choice and the
      previous and next buttons remain, in that reading order, at 320 px.
- [ ] **AC-03** Every overlay the package renders (column picker, filter popover, export menu, row
      bubble, row detail's own controls) stays inside the viewport at 320 px: it never exceeds
      `100vw` minus a gutter, and scrolls inside itself when taller than the viewport.
- [ ] **AC-04** Under `(pointer: coarse)` every interactive control the package renders has a hit area
      of at least `--gw-touch-target` (default 44 px) in both dimensions, without changing how it
      looks on a pointer device.
- [ ] **AC-05** No fixed pixel height clips text. `--gw-row-height` becomes a minimum, so at 200 %
      text size a row grows. (`virtualRows()` keeps a fixed height by contract and says so.)
- [ ] **AC-06** At 400 % page zoom (320 CSS px) the page itself never scrolls horizontally because of
      the grid. Only `.gw-table-wrapper` scrolls, and it can be scrolled from the keyboard.
- [ ] **AC-07** `column.responsive = { hideBelow: <px> }` removes that column from the table, its
      header and its cells, while the grid's container is narrower than `<px>`. It reappears when the
      container widens again.
- [ ] **AC-08** A column hidden by width is still sorted, filtered, searched and **exported**: it is
      hidden from view, not from the query. An active sort or filter on it stays active and its
      indicator stays reachable (see C-5).
- [ ] **AC-09** A column hidden by width never overwrites the reader's own `columnLayout()` choices
      and is not written into the saved layout (`onChange`). Widening restores exactly what the
      reader had.
- [ ] **AC-10** The width comes from the grid's container, observed with a `ResizeObserver`. Resizing
      the window, a split pane or a sidebar all change it; the window's width is never read.
- [ ] **AC-11** Pinned columns are capped: when the pinned columns together exceed half the container,
      pins are dropped for that width instead of leaving a sticky region wider than the viewport.
- [ ] **AC-12** On a device with no hover (`(hover: none)`), a row menu that was configured with a
      `hover` trigger opens from a visible control in the row (C-6), and the rest of the row still
      selects on tap.
- [ ] **AC-13** `responsive()` renders on the server and hydrates without a mismatch: the first render
      uses `initialWidth` (default: the full table), and the observed width applies after mount.
- [ ] **AC-14** Without `responsive()` listed nothing about columns changes. The stylesheet changes
      (AC-01 to AC-06) apply to everyone, and are documented under the semver classification.

### Phase 2: stacked rows

- [ ] **AC-20** `responsive({ stackBelow: <px> })` renders each row as a card while the container is
      narrower than `<px>`: one block per row, one line per visible column, the column's header text as
      the label and the cell as the value.
- [ ] **AC-21** The table keeps its semantics while stacked. `role="grid"` (or `treegrid`) stays, with
      explicit `row`, `columnheader` and `gridcell` roles restored where `display: block` would drop
      them, so a screen reader still announces a grid with a header, rows and cells.
- [ ] **AC-22** Each value's label is exposed to assistive technology exactly once: not zero times
      (the visual header is hidden) and not twice.
- [ ] **AC-23** Sorting survives. The header cells are not on screen when stacked, so `responsive()`
      renders a labelled sort control in the toolbar: the column to sort by, and the direction. It
      reads and writes the same sort state as the header buttons, including multi-sort priority.
- [ ] **AC-24** Selection, row detail, tree expansion, grouping headers and `rowActions()` work in the
      stacked layout; each control sits on the card and keeps its label.
- [ ] **AC-25** `cellNavigation()` keeps working: the arrow keys move between cards' values in reading
      order, and `headerRow` mode is skipped while the header is not shown.
- [ ] **AC-26** With `virtualRows()` listed, `stackBelow` is not applied (the window needs a fixed row
      height), the table stays a scrolling table, and the reason is in the documentation. It does not
      throw.
- [ ] **AC-27** Every new string is in the `gridwright:responsive` add-on messages, in `en`, `de`,
      `es`, `fr` and `pl`.

## 4. Non-goals

- **A second component for mobile.** One `Gridwright`, one markup. A consumer who wants a bespoke
  mobile view builds it from the engine's state, which is already the documented extension point.
- **Reading the window's width.** `window.innerWidth` and `matchMedia` on viewport width are not used
  for layout; the container is what matters (US-06). `matchMedia` is used only for capabilities:
  `(pointer: coarse)` and `(hover: none)`.
- **Named breakpoints and a breakpoint registry.** `hideBelow` and `stackBelow` take pixel numbers. A
  theme's breakpoint vocabulary belongs to the consumer, and the MUI bridge may pass `theme.breakpoints`
  values in itself.
- **Automatic column dropping.** The grid does not guess which column matters. Without `hideBelow`
  on a column, it is never hidden.
- **Gestures.** No swipe-to-act, pull-to-refresh, long-press menus of its own or pinch handling.
- **Horizontal-scroll chrome.** No scroll shadows, arrows or "scroll for more" hints; native scrolling
  is the floor and stays unstyled.
- **A virtualised card list.** See AC-26 and C-4.
- **Container-query support below the baseline.** The grid targets browsers with container queries
  (all current evergreen browsers). Where they are missing the layout is the unwrapped desktop one,
  which scrolls sideways: today's behaviour. No polyfill.

## 5. Behaviour across the capability seam

Responsiveness is a view concern and touches nothing the pipeline resolves.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | Identical. A width-hidden column is still in every row, so search, sort, filter and export see it. |
| everything (server) | Identical. The query sent to the source is unchanged by the width; a sort on a width-hidden column is still sent. |
| pagination only | Identical. The page size is not tied to the width. Stacked rows change what a page looks like, not what it holds. |

## 6. Accessibility and interface copy

- **Reflow, not a second page.** WCAG 1.4.10 exempts a data table from reflow, so scrolling inside
  `.gw-table-wrapper` is conformant. The criteria above make the grid better than the exemption, not
  dependent on it. The scroll region is reachable from the keyboard (AC-06).
- **Target size.** WCAG 2.5.8 asks for 24 px; the package goes to 44 px on coarse pointers (AC-04).
- **A hidden column is not silent.** A width-hidden column's active sort or filter has to remain
  discoverable (C-5), and the column picker lists it with a note rather than offering a control that
  cannot take effect.
- **Stacked rows are a grid.** The semantics are restored explicitly (AC-21), and label exposure is
  checked as a behaviour, not assumed from the CSS (AC-22). A `::before` pseudo-element alone is not
  enough: it is read inconsistently, and it would put an untranslatable literal into the stylesheet.
- **Live region.** A change of layout (the grid stacking, a column appearing or leaving) is not
  announced: it is a response to the reader's own action on the window, and an announcement would be
  noise on every drag of a split pane. A sort made through the stacked control announces as any sort
  does.
- **New strings** (all in `gridwright:responsive`): `sortBy`, `sortDirection`, `sortAscending`,
  `sortDescending`, `sortNone`, `hiddenAtThisWidth`, `rowActions` trigger label.

## 7. Delivery as a plugin

- **Engine plugin: none.** Nothing here is a pipeline stage. The width is a view fact, and putting it
  in the engine would make the query depend on a screen.
- **Stylesheet (`src/styles/styles.css`)**: phase 1 chrome, touch and reflow, as container queries and
  `(pointer: coarse)`. Always on, tokens only, no new runtime code.
- **React add-on `responsive()`** (`src/react/responsive/`): observes the container, resolves which
  columns are hidden and whether the grid is stacked, and contributes through public slots only:
  `toolbar` (the stacked sort control), `rootAttributes` (a `data-gw-stacked` flag), `cellAttributes`
  (the label for a stacked value), `headerAttributes`, and the column visibility mechanism
  `columnLayout()` itself uses (see plan.md).
- **Known seam hazards** (from `CLAUDE.md`, so the plan does not trip on them):
  - Only one add-on may hold the table wrapper's `ref`; `virtualRows()` holds it. `responsive()` does
    not take it. It observes from an element it renders and reaches the grid with `closest()`, the way
    `columnLayout()` does.
  - Column arrays are written inline. Any effect that pushes columns into the engine keys on
    `columnSignature`, never on the array.
  - Strict Mode destroys the engine once on mount. The observer is created and disconnected in an
    effect and must survive that.
- **Core boundary:** no `window`, `document` or `react` under `src/core`, `src/data` or
  `src/plugins`. `ColumnDef` does not gain `responsive`; the React column type does (C-2), as
  `layout` already does for `columnLayout()`.
- **MUI:** `apsw-gridwright-mui` re-runs the grid's suites against its views; its views must carry the
  same `data-gw-*` attributes and honour `--gw-touch-target`. Its peer floor rises with the release.

## 8. Clarifications

- **C-1. Size containment is opt-in, never on the default root.** Measured in Chrome (stage 5,
  2026-10-02): `container-type: inline-size` on `.gw-root` collapses the grid to **0 px** in all three
  shrink-to-fit parents (`inline-block`, `float`, a flex item with no `min-width`); a block parent is
  unaffected. Moving the container to an inner element (the first fallback) does **not** help: the
  wrapper collapses to its 2 px border. `contain-intrinsic-inline-size: auto 30rem` on the container
  does stop the collapse (it settles at 30 rem, not the 290 px the content wanted). So: the default
  stylesheet sets no `container-type`; toolbar and pagination wrap with `flex-wrap`, which needs no
  query (AC-01 to AC-03). `responsive()` adds `data-gw-responsive` to the root, and only
  `.gw-root[data-gw-responsive]` becomes a size container, with the intrinsic-size fallback. A grid
  that opts in and sits in a shrink-to-fit parent renders 30 rem wide; that is documented in
  `docs/responsive.md`. Nothing changes for a grid that does not list `responsive()`.
- **C-2. `responsive` is a React column option, not an engine one.** The engine has no notion of a
  screen. `GridwrightColumn` (the React-side column type) gains `responsive`, as it has `layout`.
  `ColumnDef` in `src/core/types.ts` is unchanged, so the core entry's types do not move.
- **C-3. Two releases.** Phase 1 (AC-01 to AC-14) is useful alone and carries no new markup. Phase 2
  (AC-20 to AC-27) changes rendered structure and adds a control, and is where the risk is. They are
  specified together so the contract is one piece, and tracked separately in `tasks.md`.
- **C-4. `stackBelow` is opt-in, and refuses `virtualRows()` quietly.** A default of `false` keeps a
  grid that lists `responsive()` for `hideBelow` alone from changing shape. A fixed row height is what
  makes the windowed body work; variable-height cards would need measurement, which is a different
  feature. The refusal does nothing visible and is documented, not thrown, because a layout choice is
  not an error.
- **C-5. A width-hidden column with an active sort or filter.** It stays in the query, and the toolbar
  status shows it ("Sorted by Email, hidden at this width") through the add-on's existing status
  contribution. The alternative, un-hiding it, would defeat `hideBelow` exactly when the reader is
  using the column.
- **C-6. The row menu on a device without hover.** Under `(hover: none)`, the `hover` and
  `hover-contextmenu` triggers of `rowActions()` render a small trigger button at the end of the row,
  labelled from `labels`, instead of relying on pointer entry; the left tap selects as before. This
  touches `src/react/plugins`, so it is a small change to an existing add-on and is listed in
  `api-surface.md` as a changed behaviour (touch devices only). **Confirmed by the maintainer
  (2026-10-02)**: the grid renders a visible three-dot trigger, because touch usability should not
  depend on the consumer remembering to add one.
- **C-7. Pixel thresholds, measured on the container's content box.** Not the border box, so a grid's
  own padding does not shift where it stacks. Hysteresis is not added: the threshold is a hard edge.
- **C-8. Server rendering.** The first render is the full table (`initialWidth` overrides it). This
  trades a one-frame layout shift on a phone for markup that is identical on the server and the
  client. A consumer who knows the device class at request time passes `initialWidth`.
- **C-9. Testing honesty.** jsdom has no layout, so the suites stub `ResizeObserver` and
  `matchMedia` and prove the add-on's logic. They prove nothing about the CSS. The container queries,
  the touch sizes and the overlay clamping are verified in a real browser at 320, 375, 768 and
  1280 px, and the result is recorded in `review.md`. A hidden automation tab does not run
  `ResizeObserver` callbacks reliably, so this needs a visible window.

- **C-10. An add-on declares its narrow variant; the add-on list never changes.** Swapping add-ons at
  a breakpoint is rejected: the list of names is the grid's identity and each add-on calls hooks
  (`docs/addons.md`), so a changing list throws. Instead `AddonContribution` gains an optional
  `whenNarrow: { below: number; contribution: AddonContribution }`. While the container is narrower than
  `below`, its slots replace the same-named slots of the base contribution. The add-on stays listed, so
  its `setup` state, `requires`, `suppresses` and ordering are unchanged across a resize. Without
  `responsive()` there is no width and the base contribution applies. Optional field, so every add-on
  written for 0.13 behaves as before. The built-in toolbar add-ons (search, filters, export, column
  picker, quick filters) are audited in Phase 1 for whether any should collapse to an icon; each
  decision is recorded in `review.md`. Open for stage 3: whether `whenNarrow` is evaluated per slot
  merge or once per render. An add-on may still read `useContainerWidth()` itself.
- **C-11. MUI.** The views are already add-ons under the native names, so `responsive()` and `whenNarrow`
  apply to them with no change. See `plan.md`, "MUI package", for what they must carry.
## Artifacts not written

- `research.md`: the options (container queries against a width observer against `matchMedia`) are
  decided in C-1 and C-7 with their reasons; there are no measurements to record, because the change
  is not about speed.
- `data-model.md`: the add-on keeps one number (the observed width) and two derived booleans, in
  component state. Nothing is added to the engine's state or to a type shape beyond `api-surface.md`.
- `events.md`: it emits no event and adds no pipeline stage; the layout change is deliberately not
  announced (section 6).
