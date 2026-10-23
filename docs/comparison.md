# Gridwright, TanStack Table, AG Grid and MUI X Data Grid

Which one fits depends on what you are building. This page says where Gridwright is the better
fit, where it is not, and what to check before you choose. It was written in October 2026 about
Gridwright 0.22; the other three change on their own schedule, so treat their rows as a starting
point and confirm them in their own documentation.

## The short version

| If you need | Look first at |
| :--- | :--- |
| Full control of the markup, with your own design system and no grid UI at all | **TanStack Table** |
| Pivot tables, charts or range selection | **AG Grid** or **MUI X Data Grid**; Gridwright has none of these |
| A grid that already looks like Material UI | **MUI X Data Grid**, or Gridwright with `apsw-gridwright-mui` |
| Tree data, grouping with aggregates, Excel export and windowing to millions of rows in one MIT package, with the same code for an array and a paginating API | **Gridwright** |

## What each one is

- **TanStack Table** is a headless library: it computes rows, sorting, filtering, grouping and
  pagination, and renders nothing. You write every `<table>`, header and cell yourself, which is
  the point. It is not tied to React.
- **AG Grid** is a full grid with its own rendering.
- **MUI X Data Grid** is a full grid in the Material UI family.
- **Gridwright** is a React grid on a headless engine. The component renders a real `<table>`
  with `role="grid"` and you extend it with add-ons. Everything is in one MIT package.

## Checking the features that matter to you

Products move features between editions and licences, so this page does not say which edition of
the others has what. Check each row below against their current documentation and pricing before
you decide. The Gridwright column is what its MIT package contains today.

| Feature | Gridwright | Check in the others |
| :--- | :--- | :--- |
| Renders the table for you | Yes | TanStack Table does not |
| Sorting, filtering, pagination | Yes | Which edition includes the filters you need |
| Tree data | Yes | Whether it is included, and in which edition |
| Row grouping with aggregates | Yes | Same question |
| Excel export | Yes | Same question |
| Server-side data | Yes, same code path as local data | Which edition, and whether it is a separate data model |
| Row and column virtualization | Yes | Whether both are included |
| Pivot tables | No | Whether it exists, and in which edition |
| Charts in the grid | No | Same question |
| Selecting a range of cells | No | Same question |
| Runtime dependencies | None | What your bundle gains from each |

## What Gridwright does differently

**One pipeline for local and remote data.** A data source declares which parts of the query it
resolved (sort, filter, search, pagination) and the pipeline does the rest. Moving from an array to
a server is a change of one prop, and a server that only pages still gets sorting and filtering on
the page it returned. In development the grid warns the first time that happens, because a search
that covers one page is a surprise. See [Data sources](data-sources.md).

**It never invents a number.** When a paginating API sends no total, the grid says "of many"
rather than a count computed from one page.

**Zero runtime dependencies.** The component is about 17 kB gzipped, and 25 kB with search, column
filters and export (measured on 0.17.0, method in the [README](../README.md#size)). React is an
optional peer dependency, needed only for the React entry point. The figure does not include
anything you add yourself.

**Accessibility is specified, not assumed.** A real `<table>` with `role="grid"`, sort state on
the header cell, row positions that count across pages and one live region. There is a
per-criterion WCAG 2.2 report that lists what has not been tested, including screen readers on
most platforms. See [Conformance](conformance.md).

**Add-ons have no private access.** Every built-in feature, including tree data and export, is an
add-on that uses the public contract, so yours reaches exactly as far. See
[Add-ons](addons.md).

**It was written for coding agents to use correctly.** [The agent playbook](agent-playbook.md) is
the grid's rules condensed to what an AI agent needs to write correct code in someone's app. It is
documentation, not magic: it makes the common mistakes less likely, and it does not replace
reading the API.

## Where the others are the better choice

- **You need pivot tables, charts or range selection.** Gridwright has none of them today. Check what AG Grid and MUI X Data Grid offer and in which edition.
- **You need total control of the DOM.** A headless library gives you that and a styled grid does
  not. Gridwright's markup is stable and themeable through CSS custom properties, but it is
  Gridwright's markup. If your design system demands its own table, use TanStack Table.
- **You need the largest ecosystem.** TanStack Table and AG Grid have years of answers on Stack
  Overflow, many examples and large communities. Gridwright is young, with one maintainer.
- **You need variable row heights while windowing.** Under `virtualRows()` rows have a fixed
  height.
- **You need drag-and-drop reparenting in a tree** or selection that cascades down a subtree.
  Both are listed as not done in the [README](../README.md#what-it-does-not-do).
- **You need a long record of production use.** Gridwright reached npm in September 2026. It has
  a large test suite and a published conformance report, which is evidence about its behaviour and
  not a substitute for years of other people's production traffic.

## If you use Material UI

`apsw-gridwright-mui` takes the grid's colours, type and dark mode from your MUI theme and supplies
MUI views of the core add-ons, so a Gridwright grid sits in a Material UI app without a second
design language. See [packages/mui](../packages/mui/README.md).

## Deciding in an afternoon

1. Open the [live playground](https://yaotzin1.github.io/apsw-gridwright/examples/playground/index.html)
   and switch the capability toggles to see the same grid over local and remote data.
2. Read [What it does not do](../README.md#what-it-does-not-do). If anything there is a hard
   requirement, you are done.
3. Follow [Getting started](getting-started.md) as far as the paginating API. It takes minutes, not
   days, and it is the fairest test of whether the model fits your code.
