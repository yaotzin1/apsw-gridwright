# Research: view state and URL synchronization

## Options considered

### Option A — `setQuery` after mount

**How it works.** Create the engine with the default query, then read the URL in an effect and call
`api.setQuery`.

**Rejected because.** Every shared link fetches twice and flashes the default view first. `configure`
already runs before the engine exists.

### Option B — JSON for the whole query (`?grid=%7B%22sort%22...`)

**How it works.** `JSON.stringify(query)` in one parameter.

**Rejected because.** Unreadable and unshareable in a chat message, and every character of it is
percent-encoded. It also invites parsing an attacker's object into configuration.

### Option C — typed column-per-parameter (`?status=open&score_gt=50`)

**How it works.** One parameter per filter, typed by the column's filter options.

**Rejected because.** Reading a type from `column.filter` couples the add-on to `columnFilters()`,
and a filter set by code on a column without those options would lose its type anyway.

### Option D — compact facets with typed pieces

**How it works.** Five parameters (`q`, `sort`, `f`, `page`, `size`); a value piece is a bare string
unless it would read as JSON. See data-model.md.

**Chosen because.** The common URL reads as the draft wanted it to (`f=status:eq:active`), the types a
server receives survive a reload, and parsing is a split and a bounded `JSON.parse` per piece.

## Prior art

- TanStack Table leaves URL state to the application. Useful for flexibility, but every application
  then writes the same validation, and most skip it.
- MUI X Data Grid exports and restores a state object; it does not bind to history. The Back button
  is the part readers notice missing.
- `nuqs` and similar libraries serialize typed parameters per key. Their per-key typing is the model
  for the typed pieces here, without the dependency.

## Measurements

Not a performance change. Parsing is linear in the length of the query string; the writer runs at most
once per `debounceMs` for replace writes and once per page change for push writes.

| Scenario | Rows | Before | After |
| :--- | ---: | ---: | ---: |

## Open questions

None at the end of stage 3.
