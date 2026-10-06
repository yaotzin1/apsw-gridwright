/**
 * The "Controls" panel: the switches that turn add-ons on and off, and the ones that change what the
 * mock server does. Page UI only; `app.js` turns these values into the grid's `addons` list.
 */
import { React, h } from '../shared/package.js';
import { choice, hint, languageChoice, panel, row, toggle } from '../shared/ui.js';
import { requestStats } from './data-source.js';

const FACETS = ['sort', 'filter', 'search', 'paginate'];

/** Requests started and abandoned since the page opened or the counter was reset. */
function RequestCounter() {
    const counts = React.useSyncExternalStore(requestStats.subscribe, requestStats.get);
    return h('span', { className: 'muted' },
        h('span', { className: 'badge-cell', 'data-testid': 'request-count' }, `${counts.started} requests, ${counts.abandoned} abandoned`),
        ' ',
        h('button', { type: 'button', onClick: requestStats.reset }, 'reset count'));
}

/**
 * @param {object} props
 * @param {object} props.settings   every switch's current value
 * @param {(patch: object) => void} props.update
 * @param {() => void} props.failNext
 * @param {string} props.note       the last thing a row action or an edit reported
 */
export function Controls({ settings, update, failNext, note }) {
    const set = (key) => (value) => update({ [key]: value });

    return panel(
        { title: 'Controls', sources: ['employees/controls.js', 'employees/app.js'] },

        row(
            choice('Latency', String(settings.latency), (value) => update({ latency: Number(value) }), [
                ['0', 'none'],
                ['400', '400ms'],
                ['1500', '1.5s'],
            ]),
            choice('Search debounce', String(settings.searchDebounce), (value) => update({ searchDebounce: Number(value) }), [
                ['0', 'none'],
                ['250', '250ms'],
                ['800', '800ms'],
            ]),
            h(RequestCounter, null),
            languageChoice(settings.locale, set('locale')),
            // Core, not an add-on, so it sits here rather than in the row below: selection is
            // engine state and this switch only removes its column.
            toggle('checkbox column', settings.checkboxes, set('checkboxes')),
            settings.checkboxes && toggle('select-all', settings.selectAll, set('selectAll')),
            toggle('select on row click', settings.selectOnRowClick, set('selectOnRowClick')),
            toggle('multi-sort', settings.multiSort, set('multiSort')),
            h('span', { className: 'muted' },
                settings.selected > 0
                    ? `${settings.selected} selected, counted by the grid and phrased by the catalog.`
                    : 'Select rows and watch the count change language with the rest.')),

        hint(
            settings.searchDebounce === 0
                ? 'searchDebounceMs: 0 (the default): every keystroke is a request. Type "invoice" in the search box and the counter climbs by seven, and the abandoned count by six: the engine aborts the request for the term you left, and the browser drops it.'
                : `searchDebounceMs: ${settings.searchDebounce}: type "invoice" in the search box and the counter climbs by one, ${settings.searchDebounce}ms after the last key. Turning a page, or sorting, is not delayed and carries the latest term, and the rows stay on screen while the search waits.`),

        !settings.checkboxes && !settings.selectOnRowClick && hint(
            'coreAddons({ selection: { checkboxes: false } }) removes the column, not the selection. ',
            'selectionMode is still "multiple" and the grid is still aria-multiselectable, but nothing built in ',
            'selects a row any more, because the checkbox was the only control that did. Tick "select on row ',
            'click" to make the row the control, and "cell navigation" for its keyboard route.'),

        settings.selectOnRowClick && hint(
            'selection({ selectOnRowClick: true }): click anywhere on a row to select it, and again to let it go. ',
            'The buttons, links, checkboxes and editable cells in a row keep their own clicks, and dragging across ',
            'a value to copy it selects nothing. ',
            settings.actions && !settings.actionsColumn
                ? "The row menu takes rowActions({ trigger: 'hover-contextmenu' }): it still opens on hover and right-click, and leaves the click to selection. "
                : '',
            settings.cellNav
                ? 'From the keyboard: arrow to any cell and press Space. On the checkbox cell Space ticks the checkbox, once.'
                : 'Rows cannot take focus, so there is no keyboard route yet: tick "cell navigation" and press Space on a cell.'),

        settings.checkboxes && !settings.selectAll && hint(
            'selection({ selectAll: false }): the header keeps the column’s name for screen readers and loses ',
            'the checkbox that selected the page, which on a server-paginated grid reads as "every row".'),

        hint(
            settings.multiSort
                ? 'Click a header to sort by it, then Shift-click another to sort within it: each sorted header shows its place in the order, and the live region says it ("Salary, sort priority 2, sorted ascending"). Shift-click a sorted header to reverse it where it stands, and once more to take it out; the others move up. Shift+Enter does the same from the keyboard. With the server resolving sort, the whole order goes to it in ?sort=.'
                : 'coreAddons({ sorting: { multiSort: false } }): from the next click on, Shift-click replaces the sort like a plain click, so one column is sorted at a time, with no priority badge and no Shift hint in the tooltip of a header.'),

        h('h3', null, 'Add-ons ', h('span', { className: 'muted' }, '(each one is an entry in addons={[...]} on <Gridwright />)')),
        row(
            toggle('row actions', settings.actions, set('actions')),
            !settings.tree && toggle('actions column', settings.actionsColumn, set('actionsColumn')),
            toggle('inline edit', settings.editing, set('editing')),
            toggle('virtual', settings.virtual, set('virtual')),
            toggle('tree', settings.tree, set('tree')),
            !settings.tree && toggle('group by department', settings.grouping, set('grouping')),
            settings.grouping && !settings.tree && toggle('summary row', settings.groupingSummary, set('groupingSummary')),
            toggle('column filters', settings.filtering, set('filtering')),
            toggle('column layout', settings.layout, set('layout')),
            // The guard, as a rule a reader can switch on and watch take effect: the third pin
            // refuses itself, and says so before it is pressed rather than after.
            settings.layout && toggle('at most three pinned columns', settings.limitPins, set('limitPins')),
            toggle('responsive', settings.responsive, set('responsive')),
            settings.responsive && choice('Container width', String(settings.containerWidth), (value) => update({ containerWidth: Number(value) }), [
                ['0', 'full'],
                ['900', '900px'],
                ['600', '600px'],
                ['375', '375px'],
                ['320', '320px'],
            ]),
            settings.responsive && toggle('stack rows below 560px', settings.stackRows, set('stackRows')),
            toggle('export', settings.exporting, set('exporting')),
            toggle('pay band (this page\'s own add-on)', settings.payBand, set('payBand')),
            toggle('row detail', settings.detail, set('detail')),
            settings.detail && toggle('one panel at a time', settings.detailSingle, set('detailSingle')),
            toggle('cell navigation', settings.cellNav, set('cellNav')),
            toggle('url sync', settings.urlSync, set('urlSync')),
            note && h('span', { className: 'muted' }, note)),

        h('h3', null, 'The server ', h('span', { className: 'muted' }, '(the data source declares exactly this)')),
        row(
            h('span', { className: 'muted' }, 'resolves:'),
            ...FACETS.map((facet) =>
                toggle(facet, settings.serverDoes[facet], (on) => update({ serverDoes: { ...settings.serverDoes, [facet]: on } }))),
            toggle('sends a total', settings.withTotal, set('withTotal')),
            toggle('can export everything', settings.fullExport, set('fullExport')),
            h('button', { type: 'button', onClick: failNext }, 'fail the next request')),
        row(
            ...FACETS.map((facet) =>
                h('span', { className: 'badge-cell', key: facet }, `${settings.serverDoes[facet] ? 'server' : 'pipeline'}: ${facet}`))),

        settings.actionsColumn && !settings.tree && hint(
            'An actions column is one more entry in columns: an ordinary column whose cell renders buttons, with ',
            'sortable, filterable, searchable and exportable all false because it holds no value. Each button ',
            'names its row for screen readers, and keeps its own click, so it neither selects the row nor opens ',
            'the row menu. ',
            settings.actions
                ? "Beside it the row menu takes trigger: 'contextmenu': right-click a row for it, since a menu previewed on hover would sit between the pointer and the buttons."
                : 'The per-row icon beside each name is the other half: a column’s icon renderer.'),

        settings.editing && hint(
            'Name, Job title, Email, Department and City are editable. Click one to edit it, or press Tab ',
            'until it is focused and then Enter. Enter or clicking away saves, and Escape puts the old value ',
            'back. Department is a list: choosing an option saves it straight away. The edit goes to the mock ',
            'server, and the row that comes back carries it.',
            settings.cellNav
                ? ' With "cell navigation" on, arrow to the cell and press Enter or F2 instead; when the editor closes, focus comes back to the cell.'
                : ''),

        settings.cellNav && hint(
            'Click any cell, or press Tab until the table takes focus, then use the arrow keys. The whole ',
            'grid is one Tab stop: exactly one cell is tabbable and the arrows move which one, so Tab ',
            'still leaves the table in one press -- the checkboxes too are reached with the arrows, and ',
            'Space on one ticks it. Home and End jump along the row, Ctrl with them jumps ',
            'to the first or last cell, and PageUp/PageDown move by a page of rows. Ctrl+End stops at ',
            'the last row that is loaded -- with "sends a total" unticked the grid does not know where ',
            'the result set ends, so it does not pretend to. Arrow keys inside an editor stay in the ',
            'editor: switch "inline edit" on and try it. Over a tree, right and left open and close a node. ',
            'Copy the way your system does -- Ctrl+C, Cmd+C or Ctrl+Insert -- and the cell under the cursor ',
            'lands on the clipboard; tick a few rows first and they are copied with their header, ready to ',
            'paste into a spreadsheet.'),

        settings.responsive && hint(
            'responsive(): the grid follows the width of its container, not the window. Pick a width above: ',
            'Job title disappears below 900px and Email below 700px (columns.js, responsive: { hideBelow }), ',
            'and the toolbar and pagination wrap. A hidden column is only hidden from view -- it is still ',
            'sorted, filtered, searched and exported, and "column layout" never sees the width. With "row actions" ',
            'on and a device that cannot hover, each row gets a three-dot button that opens the menu. ',
            '"stack rows" draws each row as a card below 560px: the header row goes, a "Sort by" control takes its place, ',
            'and the arrow keys (with "cell navigation") walk the values in reading order.'),

        settings.layout && hint(
            'The columns add up to more than the panel, so the table scrolls sideways: Name stays at the start and ',
            'Status at the end while Job title and Email slide underneath. Drag the divider at the right edge of a ',
            'header to resize a column, or focus it with Tab and use the arrow keys; double-click it, or press ',
            'Enter, to fit the content — try it on Email. "Columns" shows and hides columns, and the pin ',
            'buttons above the table are this page’s own add-on, built on useColumnLayout(). The layout is ',
            'saved in localStorage, so it survives a reload until you choose "forget saved layout". ',
            'Drag a header sideways to reorder the columns, or focus one and press Ctrl with an arrow — ',
            'the export follows the order you arrange.'),

        settings.grouping && hint(
            'grouping({ groupBy: [\'department\'], summaryRow }): a collapsible header per department, ',
            'showing how many rows and the average salary beside its title — Salary declares ',
            "aggregate: 'avg' in columns.js, harmless when grouping isn't listed. Click a header, or Tab to its ",
            'toggle and press Enter or Space, to collapse it; the item count and the average stay on screen, only ',
            'the rows underneath disappear. The table becomes a treegrid and each row carries aria-level. ',
            settings.groupingSummary
                ? 'The summary row below the table totals every department at once, in the footer.'
                : 'Tick "summary row" for a grand total across every department, in the footer.',
            ' Row actions, inline edit, the pay band and row detail work on the rows under a header as they do in ',
            'a flat grid: each receives your row through rowDataOf, and an edit is committed under the id you gave the row. ',
            'A header draws its own row, so it has no menu, no editor and no detail toggle.'),

        settings.urlSync && hint(
            'Search, sort, filter or turn a page, and watch the address bar. Reload the page, or copy the address into ',
            'a new tab: the grid opens on the same view with one request. Back steps through the pages you turned; ',
            'a search or a sort replaces the current entry instead of adding one. Edit the address by hand, say ',
            'sort=nope:asc or size=5000, and what the grid cannot use is dropped. The tree writes its view under ',
            'team_ so the two never collide.'),

        hint(
            'Untick a facet under "the server resolves" and the mock endpoint really stops doing it; the grid does it ',
            'in the browser instead, for the rows that arrived. With "paginate" still ticked that is one page, so a ',
            'filter or a search applied by the grid only sees 25 rows. Untick "sends a total" and the range says ',
            '"of many" rather than inventing a count. "can export everything" gives the source a fetchAll, which ',
            'is what "All matching rows" in the Export menu needs.'));
}
