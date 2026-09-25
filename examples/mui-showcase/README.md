# The MUI showcase

```bash
npm install
npm run example:mui     # http://localhost:5175
```

An ordinary MUI app with the grid in it, and every feature of the grid behind a switch. The grid's
only MUI-specific line is `coreAddons={muiAddons()}`; everything else is the same component a
non-MUI app writes.

## What is on the page

| Where | What it shows |
| :--- | :--- |
| The header | An accent colour and dark mode. The theme is built with `cssVariables`, so the grid follows either without re-rendering: `muiTheme()` writes `var(--mui-…)` references. |
| Core add-ons | MUI views on or off (`muiAddons()` or `coreAddons()`), multi-column sort, the checkbox column, select-all, select on row click, and the language. They apply on every tab. |
| Add-ons | One switch per entry in `addons={[...]}` on the Employees tab: search, column filters, export, row actions, an actions column of icon buttons (a `cell` renderer, pinned right), inline editing, column layout, cell navigation, row detail, virtual rows, the view in the URL. Row detail and virtual rows exclude each other, and the switch says why. |
| The code panel | The `<Gridwright />` the switches currently amount to, generated from the same settings the grid is. |
| The snackbar | What a row action or an edit just did, in MUI's `Snackbar`. |

## The tabs

| Tab | Data | Try |
| :--- | :--- | :--- |
| **Employees** | 240 people in memory | Shift-click a second header; filter Department; edit a salary; open a row's menu for a raise; expand a row for its projects (a nested grid); export Employee cards as a PDF; drag a column; switch on cell navigation and use the arrows. |
| **Server** | The same people behind a fake server (`server.ts`) that sorts, filters, searches and pages after a delay | Untick "Server sends a total" and the range reads "of many". Press "Fail the next request": the rows stay, under a notice that they are no longer current. |
| **Tree** | A folder tree | Expand and collapse, search for a file (its folders stay), add a file to a folder from the row menu, rename in place. |
| **10 million rows** | Computed per index, never held | Drag the scrollbar to the end. The source keeps a window of blocks and `virtualRows()` renders only what is on screen; MUI skeletons fill rows still arriving. |

## Files

| File | What it is |
| :--- | :--- |
| `App.tsx` | The theme, the header, the tabs and the snackbar |
| `Controls.tsx` | The switches |
| `settings.ts` | The switches' state, the code panel's source, and which trigger the row menu gets |
| `EmployeesGrid.tsx` | The flat grid with every add-on, an avatar `icon` on every row, and an actions column |
| `icons.tsx` | Three Material icons as paths, so the example needs nothing beyond `@mui/material` |
| `ServerGrid.tsx`, `server.ts` | The grid over a server, and the server |
| `TreeGrid.tsx` | The tree |
| `MillionGrid.tsx` | The windowed ten million rows |
| `data.ts` | Seeded sample data |

The aliases in `vite.config.ts` point the package names at this repository's sources. In your own
project they come from `node_modules` and need no configuration.
