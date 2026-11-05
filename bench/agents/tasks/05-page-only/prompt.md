`Solution` takes no props. It loads people from a legacy REST endpoint and shows them in a table.

The endpoint is `GET /api/people` (same origin). It understands exactly two query parameters:
`page` (**one-based**) and `pageSize`. **Any other query parameter makes it answer HTTP 400.** It
responds with JSON `{ "data": Person[], "total": number }`. It cannot sort, filter or search.

- Columns: **Name**, **Department**, **Salary**. 25 rows per page, paged by the server.
- A button whose accessible name contains "Next page" loads the next page.
- Each column header contains a sort control that is a `<button>`. The product owner accepts that
  sorting only reorders the rows of the page currently loaded: activating Salary's button sorts the
  visible page by salary ascending.
