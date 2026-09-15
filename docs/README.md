# Documentation

The [main README](../README.md) is the tour. These are the parts that need more room.

| Page | Read it when |
| :--- | :--- |
| [API reference](api.md) | You need a prop, a column field or an add-on option, its type and its default |
| [Data sources](data-sources.md) | The rows come from somewhere, and you need pagination, totals, aborts or retries to behave |
| [Tree data](tree.md) | Rows have children, or a row belongs under more than one parent |
| [Virtualization and windowing](virtualization.md) | There are too many rows to render, or too many to hold |
| [Storing what the reader changes](persistence.md) | Edits and tree mutations have to reach a database |
| [Extensibility](extensibility.md) | You want to know where your code attaches, and where it deliberately cannot |
| [Add-ons](addons.md) | You are switching a feature of the React grid on or off, or writing one of your own |
| [Writing a plugin](plugins.md) | You are adding a row transformation: filtering, grouping, aggregation, telemetry |
| [Filtering by column](filtering.md) | The reader needs to narrow one column: a number range, a date, a set of values |
| [Exporting](export.md) | The reader needs the rows in a spreadsheet, a document or on paper |
| [Translation](i18n.md) | The grid has to speak a language other than English, or count in one |
| [Spec-driven development](spec-driven-development.md) | You are contributing, or you want to know why the package is shaped this way |

## The shortest possible summary

The grid is an engine plus adapters. The engine holds query state, fetches, and runs a pipeline of
stages over the rows. A data source declares which parts of the query it already resolved, and the
pipeline applies whatever is left. That one declaration is why an in-memory array and a paginating
endpoint use the same code path, and why moving between them is a one-line change.

Everything else follows from that. Sorting and filtering are pipeline stages, so they are plugins,
so your plugin has the same reach as theirs. Rendering is not in the engine at all, so the React
component is one adapter among possible others, and every string it renders comes from a catalog
rather than from JSX.

On the React side there is one component, and it is a shell: a table, its rows, the status rows and
one live region. Every feature is an add-on passed in `addons={[...]}`: search, column filters,
exporting, row actions, inline editing, a tree and windowing, and even sorting, selection and
pagination, which are the core add-ons every grid starts with. Add-ons compose rather than compete,
an add-on of your own uses the same contract with the same reach, and the parts each one renders are
also exported on their own for a layout composed by hand.

## Where the source lives

| Path | Holds |
| :--- | :--- |
| `src/core/` | engine, state, columns, query, pipeline, values, errors |
| `src/data/` | local, remote, REST and windowed data sources |
| `src/plugins/` | the four built-in pipeline stages |
| `src/i18n/` | the message catalog contract and the translator |
| `src/tree/` | the nested set index, the tree controller, the flattening stage |
| `src/locales/` | the bundled translation packs |
| `src/react/` | `Gridwright`, `useGridwright`, context, the shell's parts |
| `src/react/addons/` | the add-on contract: types, ordering, contribution resolution, the attribute allowlist, add-on strings |
| `src/react/core-addons/` | sorting, selection, pagination, the stale-rows notice, and search |
| `src/react/{filters,export,plugins,tree,virtual}/` | the other built-in add-ons and the parts they render |
| `src/styles/` | the unstyled token stylesheet |

## Try it before reading further

```bash
npm run example
```

A playground on <http://localhost:5173> running the built package against a mock API, with live
capability toggles. Uncheck `sort` under "the server resolves" and watch the work move from the
server to the pipeline while the component above it does not change. See
[examples/playground](../examples/playground/README.md).
