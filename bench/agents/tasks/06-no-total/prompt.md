`Solution` takes no props. It loads people from a REST endpoint and shows them in a table.

The endpoint is `GET /api/people` (same origin). It understands exactly two query parameters:
`page` (**one-based**) and `pageSize`; any other parameter makes it answer HTTP 400. It responds
with a **bare JSON array** of `Person` — it cannot tell you how many rows exist in total.

- Columns: **Name**, **Department**, **Salary**. 25 rows per page, paged by the server.
- A button whose accessible name contains "Next page" loads the next page.
- A page with fewer than 25 rows is the last one: the Next page button must then be disabled.
- Never display a total row count or a page count, because none is known. Text such as
  "of 75", "Page 1 of 3" or "75 rows" would be wrong; "1–25 of many" is fine.
