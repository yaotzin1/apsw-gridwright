/**
 * The "Controls" panel: the switches that turn add-ons on and off, and the ones that change what the
 * mock server does. Page UI only; `app.js` turns these values into the grid's `addons` list.
 */
import { h } from '../shared/package.js';
import { choice, hint, languageChoice, panel, row, toggle } from '../shared/ui.js';

const FACETS = ['sort', 'filter', 'search', 'paginate'];

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
            languageChoice(settings.locale, set('locale')),
            h('span', { className: 'muted' },
                settings.selected > 0
                    ? `${settings.selected} selected, counted by the grid and phrased by the catalog.`
                    : 'Select rows and watch the count change language with the rest.')),

        h('h3', null, 'Add-ons ', h('span', { className: 'muted' }, '(each one is an entry in addons={[...]} on <Gridwright />)')),
        row(
            toggle('row actions', settings.actions, set('actions')),
            toggle('inline edit', settings.editing, set('editing')),
            toggle('virtual', settings.virtual, set('virtual')),
            toggle('tree', settings.tree, set('tree')),
            toggle('column filters', settings.filtering, set('filtering')),
            toggle('column layout', settings.layout, set('layout')),
            // The guard, as a rule a reader can switch on and watch take effect: the third pin
            // refuses itself, and says so before it is pressed rather than after.
            settings.layout && toggle('at most three pinned columns', settings.limitPins, set('limitPins')),
            toggle('export', settings.exporting, set('exporting')),
            toggle('pay band (this page\'s own add-on)', settings.payBand, set('payBand')),
            toggle('row detail', settings.detail, set('detail')),
            settings.detail && toggle('one panel at a time', settings.detailSingle, set('detailSingle')),
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

        settings.layout && hint(
            'The columns add up to more than the panel, so the table scrolls sideways: Name stays at the start and ',
            'Status at the end while Job title and Email slide underneath. Drag the divider at the right edge of a ',
            'header to resize a column, or focus it with Tab and use the arrow keys; double-click it, or press ',
            'Enter, to fit the content — try it on Email. "Columns" shows and hides columns, and the pin ',
            'buttons above the table are this page’s own add-on, built on useColumnLayout(). The layout is ',
            'saved in localStorage, so it survives a reload until you choose "forget saved layout". ',
            'Drag a header sideways to reorder the columns, or focus one and press Ctrl with an arrow — ',
            'the export follows the order you arrange.'),

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
