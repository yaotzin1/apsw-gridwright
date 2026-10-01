# Specification: the header row in the cell cursor

> **Status**: Implemented 2026-10-01 (contract in api-surface.md, review in review.md)
> **Stage entry**: 1 & 2
> **Semver impact**: minor (a new opt-in option and one new hook; no default changes)

---

## 1. The consumer problem

`cellNavigation()` gives the grid one Tab stop and moves between body cells with the arrow keys. The
header row was left out of that model on purpose (`specs/cell-navigation-and-clipboard`, rule 9), so
every sortable header keeps its own Tab stop. A reader who tabs into a ten-column grid meets ten
sort buttons before the first row, and `Tab` does not leave the grid in one press: the opposite of
what the ARIA grid pattern promises and of what the add-on exists for. Reported from the MUI
showcase and open since 0.11.

## 2. User stories

- **US-01.** As a keyboard user, I want `ArrowUp` from the first row to reach the headers, and
  `Enter` or `Space` there to sort, so the sort controls are part of the grid and not a queue in
  front of it.
- **US-02.** As a keyboard user, I want `Shift+Enter` on a header to add it to the sort, as
  Shift-click does.
- **US-03.** As a developer, I want to opt in without changing a grid that already lists
  `cellNavigation()`.

## 3. Acceptance criteria

- [x] **AC-01** `cellNavigation({ headerRow: true })` makes the header cells part of the cursor's
      grid. The grid is still exactly one Tab stop, and it opens on the first row of data.
- [x] **AC-02** `ArrowUp` from the first row moves to the same column's header; `ArrowDown` returns.
      `Ctrl+Home` goes to the first header. `ArrowUp` on a header stays there.
- [x] **AC-03** `Enter`, `Space` or `F2` on a header operates its sort button; `Shift+Enter` adds the
      column to the sort. The cell keeps focus afterwards.
- [x] **AC-04** The built-in sort button, and the MUI one, leave the Tab order in that mode
      (`useHeaderCellTabIndex()`). Controls beside the label, a filter button and a resize handle,
      keep their Tab stops.
- [x] **AC-05** With no rows to show, the header is the grid's one Tab stop.
- [x] **AC-06** Without the option nothing changes: the sort buttons are Tab stops, headers carry
      no `tabindex`.
- [x] **AC-07** Under `grouping()` the cursor passes over a group header (it is one spanning cell,
      and its own toggle is a Tab stop) instead of stalling on a row with no cell.

## 4. Non-goals

- **Moving the filter button and the resize handle into the cursor.** They are separate widgets
  with their own keys; folding them in needs a model of "controls within a cell" that does not
  exist.
- **Making it the default.** A changed default is a major here, and a grid that has been tabbing to
  its sort buttons would stop.
- **Left and Right to collapse a group**, the treegrid keys. Group toggles stay Tab stops.

## 5. Behaviour across the capability seam

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | As above. |
| everything (server) | Identical: the key calls `toggleSort`, which the pipeline or the source answers. |
| pagination only | Identical. |

## 6. Accessibility and interface copy

- The header cell is a `columnheader` carrying `tabindex`; it is the thing focused, so the screen
  reader says the header and its `aria-sort`, and the sort announcement is unchanged.
- No new strings.

## 7. Delivery as a plugin

No engine change. The cursor's row list gains a reserved id for the header; the add-on contributes
`headerAttributes` and `extraHeaderAttributes`, slots every add-on has.

## 8. Clarifications

- **Opt-in.** `headerRow` defaults to false for the reason in the non-goals.
- **Where the grid opens.** On the first row of data, so existing flows and `initialCell` behave as
  before; the header is one key away.
- **MUI.** `apsw-gridwright-mui` imports the new hook, so its peer floor moves with the grid
  release that contains it.

## Artifacts not written

- `plan.md`: the design is section 7; the change is one reserved row id.
- `tasks.md`: a single sitting.
- `data-model.md`: no state is added; the cursor's `ActiveCell` already holds a row id.
- `research.md`: the ARIA grid pattern is the whole reference.
- `events.md`: no event and no pipeline stage.
