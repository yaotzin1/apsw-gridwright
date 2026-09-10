---
name: accessibility
description: Use when changing markup, keyboard behaviour, focus, or anything announced to assistive technology. Covers the ARIA grid pattern and the specific traps in a paginated table.
---

# Accessible Grid

A grid that cannot be operated without a mouse is broken, not unpolished.

## Markup first, ARIA second

`role="grid"` goes on a real `<table>` with real `<thead>`, `<th scope="col">` and `<td>`. The row
and column relationships a screen reader announces then come from the markup, instead of from ARIA
attributes somebody has to keep in sync by hand. A stack of divs with `role="row"` is more code and
worse output.

## Sorting

- The control is a `<button>` inside the `<th>`, so it is reachable by Tab and activated by Enter
  and Space with no key handling of our own.
- `aria-sort` goes on the `<th>`, not on the button. That is where assistive technology looks.
- Its values are `ascending`, `descending` and `none`. The arrow is `aria-hidden`: it is
  decoration, and it is not the accessible state.
- The button's title names the next action, not the current state. A reader wants to know what
  clicking will do.

## Announcing changes

Paging replaces the rows with no navigation, so nothing is announced by default. The visually
hidden live region in `GridRoot` carries the loading state, and the page range is `aria-live`.
Keep both, and keep the live region short: it is read out on every change.

## The states inside the table

Loading, empty and error render as a row inside the table, not as a replacement for it, so the
header and the column widths stay put. A table that collapses to a centred spinner and springs back
on every page change is the most common way a working grid feels broken.

An error uses `role="alert"` so it is announced without the reader hunting for it.

## Checkboxes

Every selection checkbox has a label. The header checkbox is `indeterminate` when part of the page
is selected, which is set through a ref because it is a property, not an attribute.

## Verify by behaviour

Assert with `getByRole` and accessible names, never on class names or DOM structure. A test that
finds the sort control by role is also a test that the control is reachable.
