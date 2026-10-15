# Specification: Tree toggle icon

> **Status**: Draft
> **Stage entry**: 1
> **Semver impact**: minor (provisional; confirmed in api-surface.md)

---

## 1. The consumer problem

The tree's expand control is one filled triangle, and it never points down: the stylesheet rotates it
on `aria-expanded` of the button, which the toggle deliberately does not carry (the row does, as the
treegrid pattern says). An open row looks the same as a closed one. A developer who wants a plus in a
square, or any other mark, has no option and would have to override the stylesheet against markup
that does not expose the state.

## 2. User stories

- **US-01.** As a person reading a tree, the control points down when the row is open.
- **US-02.** As a developer, I choose the control from a few drawn presets with one option.
- **US-03.** As a developer, I draw my own control from the open and loading state.
- **US-04.** As a developer who sets nothing, I get the triangle, now pointing down when open.

## 3. Acceptance criteria

- [ ] AC-01 The toggle carries `data-expanded="true"` when open and `"false"` when closed; the stylesheet reads it.
- [ ] AC-02 `toggleIcon` accepts `'chevron'`, `'angle'`, `'square'`, `'circle'`, `'plusminus'` and a function.
- [ ] AC-03 A function receives `{ expanded, loading }` and its result is hidden from assistive technology.
- [ ] AC-04 The toggle button, its label, `aria-expanded` on the row and its keyboard behaviour are identical for every value.
- [ ] AC-05 A right-to-left document points the closed marks toward the inline end.
- [ ] AC-06 Reduced motion removes the transition and the loading pulse.

## 4. Non-goals

- Icon sets or images shipped in the package. Presets are drawn in CSS from `currentColor`; anything richer is the function form.
- A per-row or per-depth icon. The column's `icon` already draws a row's own mark.
- Changing the label, which stays in the add-on's messages.

## 5. Behaviour across the capability seam

Presentation only; the control is drawn from the node's state, which comes from the controller for any source.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | as specified |
| everything (server) | as specified |
| pagination only | as specified |

## 6. Accessibility and interface copy

No new string. The mark is `aria-hidden`; the button keeps its `Expand` / `Collapse` label and the row keeps `aria-expanded`. Marks use `currentColor`, so the existing contrast tokens and the `wcag()` target size apply.

## 7. Delivery as a plugin

React add-on only: an option on `treeData()`, passed through the add-on's provider to `TreeCell`.

## 8. Clarifications

- Default stays the triangle, so a grid that sets nothing renders the same markup apart from one added attribute.
- The open triangle now rotating is the documented intent, not a new behaviour.

## Artifacts not written

- `plan.md`: one option and a stylesheet rule; there is no design to plan.
- `tasks.md`: a single step; nothing worth tracking.
- `data-model.md`: no state or data shape; the node's expanded state already exists.
- `research.md`: no alternatives weighed beyond the presets listed in the spec.
- `events.md`: no event and no pipeline stage.
