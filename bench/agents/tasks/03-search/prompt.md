`Solution` takes one prop, `people: Person[]`, and shows them in a table.

- Columns: **Name**, **Department**, **Salary**. 25 rows per page.
- Above the table, a search box: an `<input>` whose accessible name contains "Search".
- Typing in it keeps only people whose name contains the text, case-insensitively, searching every
  row and not just the current page.
