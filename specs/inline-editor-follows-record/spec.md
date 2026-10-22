# Specification: an inline editor follows its record

> **Status**: Implemented
> **Stage entry**: 1
> **Semver impact**: patch in effect, minor by surface (one optional prop on an exported provider)

---

## 1. The consumer problem

The inline editor's state is `{ rowId, columnId }`, held by the provider, while the input and the text
typed into it live in the cell. When a result takes the record off the page (a filter, a search, a sort,
a page change, or the server no longer returning it) the cell unmounts and the text is lost, but the
state stays. When the record comes back the state opens an editor by itself: it shows the stored value
rather than what was typed, and it takes focus from wherever the reader has gone.

A developer cannot work around it, because the state is private to the add-on. A reader sees an input
open on a row they last touched pages ago.

Found by the combinatorial tests of 2026-10-22 (`tests/react/combinations-edit.test.tsx`), which recorded
the behaviour as known defects before this change.

## 2. User stories

- **US-01.** As a person editing a cell, if the record leaves the page I am not surprised by an editor
  opening when it returns.
- **US-02.** As a person editing a cell, nothing about the grid refreshing, reordering or renaming other
  rows closes my editor or changes my text.
- **US-03.** As a developer, I do not have to know that this state exists.

## 3. Acceptance criteria

- [x] AC-01. An editor open on a record that is not among the rows of a **settled** result is closed, and writes nothing.
- [x] AC-02. The record returning to the page does not open an editor, and can be edited again normally.
- [x] AC-03. While rows are loading (`refreshing`, `loading`) the editor is left alone.
- [x] AC-04. An editor stays open, with its text and focus, when other records leave, arrive or are renamed.
- [x] AC-05. Under `treeData()` the check asks by the record's id, so an editor in a tree is not closed
  because the placement's id differs from the record's.
- [x] AC-06. The check holds under React Strict Mode, which unmounts and remounts every cell once.
- [x] AC-07. `InlineEditProvider` without `isPresent` behaves as it did.

## 4. Non-goals

- **Not preserving the draft across the record's absence.** The text lived in a cell that was removed.
  Keeping it would mean moving it into provider state, which changes what a commit and a cancel mean.
- **Not closing an editor that a virtualized body scrolls out of view.** The record is still in the
  result; only its element is gone, and scrolling back is not a return.
- **Not a change to when a blur commits.**

## 5. Behaviour across the capability seam

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | Sort, filter, search and page change settle synchronously; the check runs on the next render. |
| everything (server) | The editor stays through the `refreshing` wait and closes only when the answer omits the record. |
| pagination only | As for a server. |

## 6. Accessibility and interface copy

Nothing rendered or announced is added. When an editor closes because its record left, focus was inside an
element that no longer exists; the grid does not move it.

## 7. Delivery as a plugin

`inlineEditing()` already owns the provider. It passes `isPresent`, built from `state.rows` and `state.status`,
through the existing `provide` slot. The provider is the only place that holds the editing state.

## 8. Clarifications

- **A function, not a list of rows.** A list would have to be mapped to ids on every render and could not
  express that a tree's editor id is the record's. A function is asked only while an editor is open.
- **"Settled" is `status === 'ready'`.** With `keepPreviousData: false` the rows are empty while loading, and
  that must not read as every record having left.

## Artifacts not written

- `plan.md`: two files change; the seams are in section 7.
- `research.md`: no measurement; the function runs only while an editor is open, over one page of rows.
- `data-model.md`: no state shape changes.
- `events.md`: no event and no pipeline stage.
- `tasks.md`: a single step.
