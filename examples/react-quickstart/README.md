# react-quickstart

Six steps from an array to a server, as a real React app: TypeScript, JSX, Vite, Strict Mode.

```bash
npm install          # once, in the repository root
npm run example:react
```

<http://localhost:5174>. Pick a step at the top of the page and read the file beside it — the
comment at the top of each one explains why it is written that way.

The prose version, written for your own project rather than this one, is
[docs/getting-started.md](../../docs/getting-started.md).

## The steps

| # | File | What it introduces |
| :--- | :--- | :--- |
| 1 | [`steps/01-first-grid.tsx`](steps/01-first-grid.tsx) | Two props and a list of columns. What sorting, paging, the empty state and the live region cost you: nothing. |
| 2 | [`steps/02-columns.tsx`](steps/02-columns.tsx) | `formatValue` for text, `cell` for React, `icon` per row, `accessor` for a value that is not a property. |
| 3 | [`steps/03-add-ons.tsx`](steps/03-add-ons.tsx) | Search, column filters, export and `urlSync()` as entries in `addons`: sort or filter, then reload. Configuring the core four. |
| 4 | [`steps/04-selection.tsx`](steps/04-selection.tsx) | Selection as engine state, the checkbox column as one add-on's view of it, and row actions. |
| 5 | [`steps/05-expandable-rows.tsx`](steps/05-expandable-rows.tsx) | `rowDetail()`: a panel under a row holding a second grid. |
| 6 | [`steps/06-remote-data.tsx`](steps/06-remote-data.tsx) | The same grid over a server, and what a data source declares about itself. |

[`data.ts`](data.ts) is the row type and the fixture. [`App.tsx`](App.tsx) is the step switcher and
has nothing to do with the grid.

## What is different here from your project

Two things, both in [`vite.config.ts`](vite.config.ts):

- **The aliases.** This example lives inside the package it demonstrates, so
  `apsw-gridwright/react` and its siblings resolve to `src/`. That is what makes the example
  type-check and lint with the rest of the repository, which is what stops it drifting away from the
  real API. **In your project you run `npm install apsw-gridwright` and configure nothing.**
- **No `package.json` of its own.** It runs on the repository's existing dev dependencies — Vite and
  React are already there — so there is nothing extra to install.

Everything else is what you would write: the imports are the package specifiers, the stylesheet is
imported in [`main.tsx`](main.tsx), and Strict Mode is on because a grid holding an engine has to
survive a double mount.

## The other examples

| Example | Use it to |
| :--- | :--- |
| this one | follow the steps in order, in a real React environment |
| [`../playground/`](../playground/README.md) | switch every add-on on and off against a mock API, over a tree and ten million rows |
| [`../react-remote/App.tsx`](../react-remote/App.tsx) | copy a worked example of every add-on at once, including one written by hand |
