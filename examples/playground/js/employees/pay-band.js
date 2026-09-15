/**
 * An add-on of this page's own: highlights salaries above a threshold and explains it under the table.
 *
 * It is written exactly as an application would write one, against the public exports only. The
 * built-in features (search, filters, export, the tree) are add-ons of this same shape, so anything
 * they do to the grid, this could do too.
 *
 *     <Gridwright columns={columns} dataSource={source} addons={[payBand(130_000)]} />
 */
import { gridwright, h } from '../shared/package.js';

const { rowDataOf, useAddonMessages } = gridwright;

/** The add-on's own strings. A locale pack or the grid's `messages` can override any of them. */
const messages = {
    en: { legend: 'Highlighted: salaries above {threshold}', high: 'Above the pay band' },
    pl: { legend: 'Wyróżnione: pensje powyżej {threshold}', high: 'Powyżej widełek' },
    de: { legend: 'Hervorgehoben: Gehälter über {threshold}', high: 'Über dem Gehaltsband' },
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Rendered by the `belowTable` slot. A component, so it may call hooks; slot functions may not. */
function Legend({ threshold }) {
    const t = useAddonMessages('playground:pay-band', messages);
    return h('p', { className: 'pay-band-legend' }, h('span', { className: 'pay-band-swatch', 'aria-hidden': true }), t('legend', { threshold: money.format(threshold) }));
}

/** @param {number} threshold */
export function payBand(threshold) {
    return {
        // Namespaced, like a plugin. It is also the namespace of the add-on's messages.
        name: 'playground:pay-band',
        setup: () => ({
            messages,
            // Attributes only: class, style, handlers, aria-* and data-*. Nothing that carries markup.
            cellAttributes: (row, column, grid) => {
                // `rowDataOf`, because under the tree add-on a grid row holds a tree node, not the row.
                const salary = rowDataOf(row).salary;
                if (column.id !== 'salary' || typeof salary !== 'number' || salary <= threshold) return {};
                return {
                    className: 'pay-band--high',
                    title: grid.translator.translateAddon('playground:pay-band', 'high', undefined, messages),
                };
            },
            belowTable: () => h(Legend, { threshold }),
        }),
    };
}
