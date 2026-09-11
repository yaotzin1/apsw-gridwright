# Documentation

The [main README](../README.md) is the tour. These are the parts that need more room.

| Page | Read it when |
| :--- | :--- |
| [Data sources](data-sources.md) | The rows come from somewhere, and you need pagination, totals, aborts or retries to behave |
| [Tree data](tree.md) | Rows have children, or a row belongs under more than one parent |
| [Virtualization and windowing](virtualization.md) | There are too many rows to render, or too many to hold |
| [Storing what the reader changes](persistence.md) | Edits and tree mutations have to reach a database |
| [Extensibility](extensibility.md) | You want to know where your code attaches, and where it deliberately cannot |
| [Writing a plugin](plugins.md) | You are adding a row transformation: filtering, grouping, aggregation, telemetry |
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

On the React side there is one component. A tree, windowing, row actions, inline editing and icons
are options on `<Gridwright />` rather than separate components, so they compose rather than
compete, and each of them is also exported on its own for a layout composed by hand.

## Where the source lives

| Path | Holds |
| :--- | :--- |
| `src/core/` | engine, state, columns, query, pipeline, values, errors |
| `src/data/` | local, remote, REST and windowed data sources |
| `src/plugins/` | the four built-in pipeline stages |
| `src/i18n/` | the message catalog contract and the translator |
| `src/tree/` | the nested set index, the tree controller, the flattening stage |
| `src/locales/` | the bundled translation packs |
| `src/react/` | `Gridwright`, `useGridwright`, context, parts, virtual body, adapter plugins |
| `src/styles/` | the unstyled token stylesheet |

## Try it before reading further

```bash
npm run example
```

A playground on <http://localhost:5173> running the built package against a mock API, with live
capability toggles. Uncheck `sort` under "the server resolves" and watch the work move from the
server to the pipeline while the component above it does not change. See
[examples/playground](../examples/playground/README.md).
