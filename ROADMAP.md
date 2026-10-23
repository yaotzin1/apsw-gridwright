# Roadmap

What is open, in the order it is likely to be picked up. This is a statement of intent, not a
promise: a bug or a security report goes first. Proposals are welcome as issues labelled
`proposal`; the process a feature follows is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Open measurements and checks

These are work that was named and left undone, each with a clear way to know it is finished. They
are good first contributions (look for the [`good first issue`](https://github.com/yaotzin1/apsw-gridwright/labels/good%20first%20issue) label).

- **Skeleton frame rate over 500 columns.** The loading skeleton was never measured under
  `virtualColumns()` at 500 columns, nor the cost of the `stroke-dashoffset` animation behind the
  spinner. Done when a number is recorded in `specs/loading-indicators/` and any regression is
  filed.
- **Forced colours.** The grid has not been inspected in a real Windows High Contrast session.
  Done when each part (focus ring, sort indicator, selected row, spinner) is checked and the
  result is recorded in [docs/conformance.md](docs/conformance.md).
- **A loading switch in the MUI showcase.** `apsw-gridwright-mui`'s showcase has no way to turn
  the loading indicator on.
- **Screen readers.** NVDA, Narrator, VoiceOver, JAWS and TalkBack passes are listed as not done in
  [docs/conformance.md](docs/conformance.md). A recorded pass on any one of them, with notes, is
  worth more than most code.

## Known gaps in the product

Stated up front so you can rule the grid in or out; see
[What it does not do](README.md#what-it-does-not-do).

- Drag-and-drop reparenting in trees, and selection that cascades down a subtree.
- Variable row heights under `virtualRows()`.
- No pivot tables, built-in charts or range selection. These are not on the near-term list.

## Not planned

- Adapters for frameworks other than React. The core stays headless because that keeps the
  pipeline testable without a renderer, not because a second adapter is coming.
- A runtime dependency of any kind.

## How to influence this

Open an issue using the *Proposal* template. Say the job you are trying to do before the feature
you imagine; a good proposal survives being answered with "can an add-on already do this?".
