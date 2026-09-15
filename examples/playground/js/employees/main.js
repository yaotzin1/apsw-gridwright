/**
 * Entry point of `index.html`: renders the employees page.
 *
 *   index.html                     the page shell and its styles
 *   js/employees/main.js           this file
 *   js/employees/app.js            the switches become props on <Gridwright />   ← start here
 *   js/employees/columns.js        the columns, and the team tree data
 *   js/employees/data-source.js    the paginating REST source, and what it tells the grid
 *   js/employees/export-formats.js the Export menu: built-in formats, reports, formats of your own
 *   js/employees/row-actions.js    the row menu
 *   js/employees/controls.js       page UI: the Controls panel
 *   js/employees/report-editor.js  page UI: the Export formats panel
 *   js/shared/package.js           React and the built package (in an app: npm imports)
 *   js/shared/ui.js                page UI shared by both pages
 */
import { React, createRoot, h } from '../shared/package.js';
import { App } from './app.js';

createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(App)));
