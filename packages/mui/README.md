# apsw-gridwright-mui

MUI views for [apsw-gridwright](https://www.npmjs.com/package/apsw-gridwright). One line makes the
grid part of your MUI app:

- **It takes your theme.** Colours, typography, radius and spacing come from the MUI theme in
  context, including dark mode. A theme built with `cssVariables: true` switches colour scheme
  without re-rendering the grid.
- **Its controls are MUI components.** The sort control is `TableSortLabel`, the selection
  checkboxes are `Checkbox`, and the pager is `TablePagination`, styled by your theme's
  `components` entries like every other MUI component in the app.
- **It is still the same grid.** A real sort button with `aria-sort` on the header cell, the sort and
  row-range sentences in the live region, an indeterminate select-all that screen readers hear as
  "mixed", "of many" when the server sends no total, and focus that stays in the pager when a button
  disables itself. The grid's own accessibility suites run against these views unchanged.

```bash
npm install apsw-gridwright apsw-gridwright-mui @mui/material @emotion/react @emotion/styled
```

```tsx
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Gridwright } from 'apsw-gridwright/react';
import { muiAddons } from 'apsw-gridwright-mui';
import 'apsw-gridwright/styles.css';

<ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
    <Gridwright columns={columns} data={rows} selectionMode="multiple" coreAddons={muiAddons()} />
</ThemeProvider>;
```

`muiAddons(options)` takes the same options as `coreAddons(options)`:
`muiAddons({ sorting: { multiSort: false }, selection: { selectOnRowClick: true } })`.

## What is in it

| Export | What it is |
| :--- | :--- |
| `muiAddons(options?)` | The core add-on set as MUI views, plus the theme. Pass it as `coreAddons`. |
| `muiTheme()` | The grid's `--gw-*` tokens from the MUI theme, on the grid's root. Works with the native controls too. |
| `muiSorting(options?)` | Sorting with `TableSortLabel`. Named `gridwright:sorting`, like `sorting()`. |
| `muiSelection(options?)` | Selection with `Checkbox`. Named `gridwright:selection`, like `selection()`. |
| `muiPagination(options?)` | Paging with `TablePagination`. Named `gridwright:pagination`, like `pagination()`. |
| `muiTokens(theme)` | The token values `muiTheme()` applies, for your own CSS. |

The views keep the native add-ons' names, so the grid's locale packs, your message overrides and
`virtualRows()` treat them as the add-ons they replace. A grid cannot list both views of one
feature. To use one MUI view in the native set, replace it by name:

```tsx
coreAddons={coreAddons().map((a) => (a.name === 'gridwright:sorting' ? muiSorting() : a))}
```

## What does not follow your theme's component overrides

The table, its rows and its cells are the grid's own `<table>` markup, themed through the tokens.
A `components.MuiTableCell` override in your theme does not reach them. The filters, export menu,
column picker, inline editor, row detail and tree toggles keep their own controls, in your theme's
colours.

The rows-per-page control is a real `<select>` in MUI's styling (`native: true`), so its options
open where the platform opens them and keep the grid's direction and language.

## Requirements

`@mui/material` 7 or 9, React 18 or 19, and `apsw-gridwright` 0.12 or newer. `styles.css` from
`apsw-gridwright` is still required: this package only sets its variables.

MIT.
