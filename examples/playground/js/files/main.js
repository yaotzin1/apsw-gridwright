/**
 * Entry point of `tree.html`: renders the features page.
 *
 *   tree.html                  the page shell and its styles
 *   js/files/main.js           this file
 *   js/files/app.js            the switches and the panels
 *   js/files/shape-demo.js     the grid over every in-memory shape: tree options, row menu, edits  ← start here
 *   js/files/huge-demo.js      the grid over ten million rows
 *   js/files/columns.js        the columns, and a Markdown report over them
 *   js/files/data.js           the data for each shape, the stored tree API, the windowed source
 *   js/shared/package.js       React and the built package (in an app: npm imports)
 *   js/shared/ui.js            page UI shared by both pages
 */
import { React, createRoot, h } from '../shared/package.js';
import { App } from './app.js';

createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(App)));
