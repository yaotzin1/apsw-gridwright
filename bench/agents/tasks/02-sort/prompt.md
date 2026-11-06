`Solution` takes one prop, `people: Person[]`, and shows them in a table.

- Columns: **Name**, **Department**, **Salary**. 25 rows per page.
- Each column header contains a sort control that is a `<button>`.
- Activating the Salary header's button sorts by salary ascending; activating it again sorts
  descending. Sorting covers every row, not just the current page.
- The sorted column's header element exposes the state to screen readers with `aria-sort`
  (`ascending` / `descending`).
