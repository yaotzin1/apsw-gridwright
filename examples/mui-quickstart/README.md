# The grid in an MUI app

```bash
npm install
npm run example:mui     # http://localhost:5175
```

An ordinary MUI app (`ThemeProvider`, `CssBaseline`, a purple primary, both colour schemes on CSS
variables) with one grid in it. The grid's only MUI-specific line is `coreAddons={muiAddons()}`.

| Switch | What to look at |
| :--- | :--- |
| MUI views | Off, the grid falls back to `coreAddons()`: native controls, and the grid's own colours, which follow the operating system rather than the app. On, the sort labels, checkboxes and pager are MUI's, and the colours are the theme's. |
| Dark mode | The app's MUI colour scheme. The grid follows it without re-rendering, because `muiTheme()` writes `var(--mui-…)` references for a CSS-variables theme. |
| Select on row click | `muiAddons({ selection: { selectOnRowClick: true } })`: the same option the native selection takes. |

Shift-click a second header to sort within the first: the badges and the announcement are the
native add-on's, drawn by `TableSortLabel`.

The aliases in `vite.config.ts` point the package names at this repository's sources. In your own
project they come from `node_modules` and need no configuration.
