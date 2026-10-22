# Specification: warn when a query covers only the page received

> **Status**: Implemented
> **Stage entry**: 1
> **Semver impact**: minor (one new optional option; no default changes what the grid does)

---

## 1. The consumer problem

A data source that paginates and declares none of `sort`, `filter` and `search` is the common real
case: an endpoint that takes a page number and nothing else. For it the pipeline sorts, filters and
searches **the rows that arrived**, which is documented and is the reason `capabilities` is a
declaration rather than a boolean.

It is also the configuration in which the grid tells the reader something false by omission. A person
who types a surname into the search box is looking in the whole result. The grid looks at the page on
screen, finds nobody, and says so. If the person is on page 17, no sentence anywhere tells the
developer, or the reader, that page 17 was never searched.

The developer chose this mode by writing four booleans, and a developer who copies the recipe has not
necessarily understood what it costs. The cost appears at the moment the grid does the page-only work,
so that is the moment to say it.

## 2. User stories

- **US-01.** As a developer integrating an endpoint that only pages, I am told, the first time the grid
  sorts, filters or searches the page for me, that it covered the page and not the result, and what to
  declare once the server does the work.
- **US-02.** As a developer for whom page-only is the product, I can say so once and hear nothing more.
- **US-03.** As a developer whose grid only ever pages, or whose source resolves the facet, I hear
  nothing.
- **US-04.** As the operator of a production site, I get no console output from the grid for this.

## 3. Acceptance criteria

- [x] AC-01. When a query sorts, filters or searches a source whose `capabilities.paginate` is true and
  whose capability for that facet is false, the engine writes one `console.warn` for that facet.
- [x] AC-02. The message names the facet ("sorting", "filtering", "search"), the number of rows of the page
  received, the source's `kind`, the capability to declare, and the option that silences it.
- [x] AC-03. A facet warns once per engine. A query that uses all three warns three times, one line each.
- [x] AC-04. Nothing is written for a facet the query does not use, for a source that declares the facet,
  or for a source that does not paginate (an array).
- [x] AC-05. `warnOnPageScopedQuery: false` on `createGridEngine`, and the same prop on `<Gridwright />` and
  `useGridwright`, writes nothing.
- [x] AC-06. Nothing is written when `NODE_ENV` is `production`.
- [x] AC-07. `setDataSource` starts a new set of warned facets.
- [x] AC-08. What the grid shows is identical with the warning on and off.
- [x] AC-09. The quickstart and `react-remote` examples that demonstrate a page-only source pass the option,
  and the docs that describe the recipe describe the warning.

## 4. Non-goals

- **Not a thrown error.** Page-only is legitimate; refusing it would break working grids.
- **Not a marking in the interface.** A visible "this search covers the page" note is a different
  feature with copy, `labels` and accessibility work of its own. It is not ruled out; it is not this.
- **Not a new event or a field in `GridState`.** A consumer who wants to react in code already has the
  capabilities they declared. A signal nobody asked for is surface to keep.
- **Not a change of default behaviour.** The pipeline still sorts, filters and searches the page.
- **Not a different default for `createRemoteDataSource`.** It declares all four facets unless told
  otherwise, so the warning reaches only a developer who explicitly wrote `sort: false` and its siblings.

## 5. Behaviour across the capability seam

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | No warning: the array is the whole result, so a facet covers all of it. |
| everything (server) | No warning: the server did the work. |
| pagination only | One warning per facet the query uses, the first time it uses it. |
| pagination and some facets | A warning only for a used facet the source left out. |
| a windowed source | No warning: it declares every facet. |

## 6. Accessibility and interface copy

No control and no rendered text is added, so no label goes in `labels`. The message is a developer
diagnostic on the console, like the existing capability-declaration warnings, and is not translated.

## 7. Delivery as a plugin

Not a plugin and not an add-on. It is an observation about the relationship between the query and the
source's declaration, and the engine is the only layer that holds both. An engine plugin would see the
query and the capabilities, but would have to be installed to be useful, and the point is that a
developer who has not thought about this is told. `useGridwright` forwards the option, so an add-on does
not need to.

## 8. Clarifications

- **Once per facet, not once per engine.** A grid that has warned about search should still say something
  the first time the reader sorts, because that is a separate fact about the same source.
- **At the first use, not at construction.** Warning at construction would reach every paged read-only grid
  for a cost it never incurs.
- **Production is detected with `globalThis.process.env.NODE_ENV`,** read defensively, because the core has
  no DOM and no dependency to ask. A bundler that replaces `process.env.NODE_ENV` elsewhere does not affect
  this read; a runtime with no `process` (a browser without a define) warns, which is the safe side.
- **`warnOnPageScopedQuery`, not `quiet` or `silent`.** The name says what is silenced and that silencing is
  a statement about intent.

## Artifacts not written

- `plan.md`: the change is one function in `src/core/engine.ts` and a pass-through; the seams are in this spec.
- `research.md`: no measurement is involved; the check is three comparisons per applied result.
- `data-model.md`: no state or type shape changes beyond one optional field on two options objects.
- `events.md`: the feature emits no event and adds no pipeline stage.
- `tasks.md`: a single step, tracked by the acceptance criteria above.
