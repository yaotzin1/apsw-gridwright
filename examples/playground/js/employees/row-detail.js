/**
 * The `rowDetail()` add-on on this page: a panel under a row holding a second grid.
 *
 * A nested `<Gridwright />` is the case the add-on exists for. Three things are worth knowing before
 * you write one:
 *
 *   - The panel is rendered only while it is open, so a nested grid stops fetching when it closes.
 *   - `useGridwrightContext()` inside the panel resolves to the *inner* grid. The outer one is the
 *     `grid` argument `render` is handed.
 *   - Each grid has its own live region, so six open panels mean six of them on the page.
 *
 * The inner grid lists `coreAddons: false`, which is a bare table: no sort buttons, no page
 * controls, nothing but the rows. A five-row field list has no use for any of them.
 */
import { gridwright, h } from '../shared/package.js';

const { Gridwright, rowDetail } = gridwright;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });

const fieldColumns = [
    { id: 'field', header: 'Field', width: 160 },
    { id: 'value', header: 'Value' },
];

/** The fields that did not earn a column of their own, as rows of the nested grid. */
const fieldsOf = (person) => [
    { id: 'email', field: 'Email', value: person.email ?? '--' },
    { id: 'title', field: 'Title', value: person.title ?? '--' },
    { id: 'department', field: 'Department', value: person.department ?? '--' },
    { id: 'salary', field: 'Salary', value: typeof person.salary === 'number' ? money.format(person.salary) : '--' },
    { id: 'startedOn', field: 'Started', value: person.startedOn ? date.format(new Date(person.startedOn)) : '--' },
    { id: 'active', field: 'Active', value: person.active ? 'yes' : 'no' },
];

/** @param {{ single: boolean }} options */
export function employeeRowDetail({ single }) {
    return rowDetail({
        single,
        // Teams in the tree have no fields of their own worth a panel, so they get no toggle at all
        // rather than a control that opens an empty one.
        hasDetail: (row) => row.data.kind !== 'team',
        render: ({ data, close }) =>
            h('div', { className: 'detail-panel' },
                h('div', { className: 'detail-heading' },
                    h('strong', null, data.name),
                    h('button', { type: 'button', onClick: close }, 'close')),
                h(Gridwright, {
                    columns: fieldColumns,
                    data: fieldsOf(data),
                    coreAddons: false,
                    'aria-label': `Fields of ${data.name}`,
                })),
    });
}
