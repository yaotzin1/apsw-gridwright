`Solution` takes one prop, `people: Person[]`, and shows them in a table.

- Columns: **Name**, **Department**, **Salary**. 25 rows per page.
- Every row has an expand button named "Show details for {name}", e.g. "Show details for Person 3".
- Activating it opens a panel directly under that row: an element with `role="region"` and the
  accessible name "Details for {name}", showing the person's email address.
- While open, the same button is named "Hide details for {name}", and activating it closes the
  panel.
