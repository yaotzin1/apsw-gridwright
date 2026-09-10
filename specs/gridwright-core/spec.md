# Specification: Gridwright core

> **Status**: Implemented
> **Stage entry**: 1
> **Semver impact**: initial public surface, 0.1.0

---

## 1. The consumer problem

A team building an admin screen picks a grid, wires it to an array, and ships. Three months later
the table has 200,000 rows and the page has to move to a server. In most grid libraries that is a
rewrite of the component, its props, its state and its tests, because the library's client-side and
server-side modes are different products wearing one name.

The second problem follows from the first: grids that do support server data hand the consumer the
whole job. Debouncing, request cancellation, out-of-order responses, totals, retry, error messages
and page clamping are re-implemented in every application, usually incompletely, and always without
the one that bites: the answer to a superseded query arriving last.

## 2. User stories

- **US-01.** As a developer, I render a grid over an array with one prop, and I get sorting,
  filtering, search, pagination and selection without configuring any of them.
- **US-02.** As a developer, I move that grid to a paginating endpoint by replacing one prop, and
  no other line of my component changes.
- **US-03.** As a developer with an endpoint that pages but does not sort, I say so, and the grid
  sorts the page it received rather than silently doing nothing.
- **US-04.** As a developer, I write a plugin that reaches exactly as far as the built-in sorting
  does, because sorting is a plugin.
- **US-05.** As a developer, I theme the grid with CSS variables and translate it with a labels
  object, without forking a component.
- **US-06.** As a person reading a grid, I sort by keyboard, hear the sort direction announced, and
  see a message I can act on when loading fails.
- **US-07.** As a person reading a grid, I am never shown a total the grid invented.

## 3. Acceptance criteria

- [x] AC-01 A local array grid is `ready` synchronously, with no loading state published.
- [x] AC-02 Swapping `data` for `dataSource` changes no other prop.
- [x] AC-03 A stage is skipped exactly when the source declares that capability.
- [x] AC-04 A superseded response is discarded without touching state.
- [x] AC-05 An in-flight request is aborted when the query changes or the grid is destroyed.
- [x] AC-06 A narrowing stage updates the reported total.
- [x] AC-07 A paginating source with no total reports `isTotalExact: false`.
- [x] AC-08 Filtering while on a later page returns to the first page.
- [x] AC-09 A page that no longer exists resolves to the last real page.
- [x] AC-10 A plugin that throws loses its own effect and nothing else.
- [x] AC-11 Sort state is announced through `aria-sort` on the header cell.
- [x] AC-12 Every visible string can be replaced through `labels`.
- [x] AC-13 The core entry imports with no React installed.
- [x] AC-14 The package declares no runtime dependencies.

## 4. Non-goals

- **Row virtualization.** A grid rendering thousands of rows is answered by server pagination. A
  virtualization plugin can be added later without changing the engine.
- **Inline editing.** It brings validation, dirty state and optimistic writes, which is a second
  product.
- **Column resize, reorder and pinning.** Adapter concerns, deferred to a later minor.
- **Grouping and aggregation.** A `TRANSFORM` stage slot exists for it; the implementation is not
  in this release.
- **A styled theme.** The package ships tokens. A theme belongs to the consumer's design system.
- **Adapters beyond React.** The core is framework-agnostic so that Vue or Svelte adapters are
  possible; none ship in 0.1.0.

## 5. Behaviour across the capability seam

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | The pipeline filters, searches, sorts and pages. Totals come from the pre-slice length. Synchronous, so no loading state. |
| everything (server) | The pipeline runs no stage. Totals come from `totalRows`, or the grid reports the total as inexact. |
| pagination only | The pipeline filters, searches and sorts the returned page. The total is the server's, because only the server can count what it did not send. |

## 6. Accessibility and interface copy

- The sort control is a `<button>` inside the `<th>`; `aria-sort` is on the cell.
- Loading, empty and error render inside the table so the header and column widths hold.
- A visually hidden live region announces loading; the page range is `aria-live`.
- The error state is `role="alert"` and offers retry only when the failure is retryable.
- All sixteen visible strings are in `defaultLabels`, and `pageRange` is a function because word
  order around numbers differs by language.

## 7. Clarifications

- **Is selection on by default?** No. `selectionMode` defaults to `none`. A checkbox column nobody
  asked for is a column the reader has to account for, and most grids are read-only.
- **Does a sort change reset the page?** Yes. Page 4 of a differently ordered set holds different
  rows, and the reader did not ask to move.
- **What is the REST page parameter?** One-based `page`, with `pageSize`. Written down rather than
  inferred, because a grid and a server that disagree produce an off-by-one nobody notices until
  page two is missing a row.
- **Who disposes a data source?** Whoever created it. The engine never disposes one it was handed,
  because sources are shared and Strict Mode destroys an engine on purpose.
- **Does the engine retry by default?** `createRemoteDataSource` retries twice with backoff, on
  retryable failures only. A grid fetch is idempotent, and one network blip should not become an
  error message.
