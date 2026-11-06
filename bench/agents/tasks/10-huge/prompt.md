`Solution` takes one prop, `people: Person[]`, which holds **100,000** rows, and shows them in a
table.

- Columns: **Name**, **Department**, **Salary**.
- No pagination: every row is reachable by scrolling one area that is 600px tall. Every row is
  40px tall.
- It must stay fast: at no time may more than 200 rows be in the DOM. Render only what is near the
  viewport.
