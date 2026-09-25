# Specification: a row menu that leaves the click to selection

> **Status**: Implemented 2026-09-25 (contract in api-surface.md, review in review.md)
> **Stage entry**: 1 & 2
> **Semver impact**: minor (a new member of the `BubbleMenuTrigger` union; no default changes)

---

## 1. The consumer problem

`selection({ selectOnRowClick: true })` makes a click on a row select it. `rowActions()` defaults to
`trigger: 'both'`, where the same click pins the row menu. A grid that lists both does two things on
one click: the row turns selected and a menu opens over it, taking focus. Found in the MUI showcase,
where it made row-click selection look broken.

The existing triggers cannot separate them. `'hover'` keeps the preview but loses the context-menu
key, which is the menu's keyboard route once it is pinned. `'contextmenu'` keeps the key but loses
the preview. No value means "everything except the left click".

## 2. User stories

- **US-01.** As a developer with row-click selection and a row menu, I want the click to select and
  the menu to stay reachable by hover, right-click and the context-menu key.
- **US-02.** As a person using the grid, I want one click to do one thing.

## 3. Acceptance criteria

- [x] **AC-01** `rowActions({ trigger: 'hover-contextmenu' })` previews the menu on hover and focus,
      and pins it on right-click and the context-menu key.
- [x] **AC-02** Under that trigger, a left click on a row does not open or pin the menu, and with
      `selectOnRowClick` it selects the row.
- [x] **AC-03** `useBubbleMenu('hover-contextmenu')` and `<BubbleMenu trigger="hover-contextmenu">`
      behave the same way, since all three share `rowHandlers`.
- [x] **AC-04** The default stays `'both'`. A grid that lists neither option changes in nothing.

## 4. Non-goals

- **Making `rowActions()` read `selection()`'s options.** One add-on changing its behaviour because
  of another's option is a coupling no third-party add-on could reproduce. The consumer picks the
  trigger.
- **A general list of triggers** (`trigger: ['hover', 'contextmenu']`). Four of the seven
  combinations are already named; the one that was missing is added by name.

## 5. Behaviour across the capability seam

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | As above. The trigger is about pointer events on rendered rows. |
| everything (server) | Identical. |
| pagination only | Identical. |

## 6. Accessibility and interface copy

- Keyboard: the menu's route is unchanged. Focus on a row previews it, and the context-menu key
  (or Shift+F10) pins it and focuses its first item.
- No new strings.

## 7. Delivery as a plugin

No engine change. `useBubbleMenu` gains the value, and `rowActions()` and `BubbleMenu` pass their
`trigger` through to it, so the add-on and the standalone part get it together.

## 8. Clarifications

- **Name.** `'hover-contextmenu'` names exactly the two routes it keeps, matching the existing
  single-route names. Chosen by the maintainer 2026-09-25 over an example-only workaround.
- **Should the examples switch it automatically?** Yes, in the examples only: while "select on row
  click" is on, they pass `trigger: 'hover-contextmenu'`, and their code panels show it.

## Artifacts not written

- `plan.md`: one union member and two conditions in `useBubbleMenu`; the design is section 7.
- `tasks.md`: a single step.
- `data-model.md`: no state is added; the menu's state is unchanged.
- `research.md`: nothing external was consulted.
- `events.md`: the feature emits no event and adds no pipeline stage.
