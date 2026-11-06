`Solution` takes no props. It loads people from a REST endpoint and shows them in a table.

The endpoint is `GET /api/people` (same origin) and does all the work itself:

| Query parameter | Meaning |
| :--- | :--- |
| `page` | **one-based** page number |
| `pageSize` | rows per page |
| `sort` | `column:asc` or `column:desc`; column ids are `name`, `department`, `salary` |
| `search` | substring to match in the name; omit when empty |

It responds with JSON `{ "data": Person[], "total": number }`, where `total` counts every matching
row. Any other parameter is ignored.

- Columns: **Name**, **Department**, **Salary**. 25 rows per page.
- Sorting and paging happen on the server, never on the client.
- Each column header contains a sort control that is a `<button>`; activating Salary's sorts by
  salary ascending.
- A button whose accessible name contains "Next page" loads the next page.
- Show the total number of rows the server reported somewhere on screen (for example "1–25 of 120").
