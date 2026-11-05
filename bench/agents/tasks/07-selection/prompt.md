`Solution` takes two props: `people: Person[]` and `onSelectionChange: (uuids: string[]) => void`.
It shows the people in a table.

- Columns: **Name**, **Department**, **Salary**. 25 rows per page.
- A row's identity is its `uuid`. (The numeric `id` is not unique across our data sources, so do not
  use it.)
- Every row has a checkbox whose accessible name contains "Select row". Several rows can be
  selected at once.
- Whenever the selection changes, call `onSelectionChange` with the `uuid`s of every selected row.
