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
            toggle('export', settings.exporting, set('exporting')),
            toggle('pay band (this page\'s own add-on)', settings.payBand, set('payBand')),
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

        hint(
            'Untick a facet under "the server resolves" and the mock endpoint really stops doing it; the grid does it ',
            'in the browser instead, for the rows that arrived. With "paginate" still ticked that is one page, so a ',
            'filter or a search applied by the grid only sees 25 rows. Untick "sends a total" and the range says ',
            '"of many" rather than inventing a count. "can export everything" gives the source a fetchAll, which ',
            'is what "All matching rows" in the Export menu needs.'));
}
