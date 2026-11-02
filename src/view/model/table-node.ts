import { h } from '../node';
import type { ViewNode } from '../node';
import type { TableModel } from './table-model';

/**
 * The whole grid as one node description, for a renderer that draws nodes rather than building its
 * own elements from the model. The structure is the React shell's: a root with a visually hidden live
 * region, the scrolling wrapper, the table with an optional caption, the header row and the body.
 */
export function tableNode<TRow>(model: TableModel<TRow>): ViewNode {
    const header = h(
        'thead',
        { attrs: { className: 'gw-thead' } },
        h(
            'tr',
            { attrs: model.header.attrs },
            ...model.header.cells.map((cell) => h('th', { attrs: cell.attrs, key: cell.column.id }, cell.label)),
        ),
    );

    const body =
        model.body.kind === 'status'
            ? h(
                  'tbody',
                  { attrs: { className: 'gw-tbody' } },
                  h(
                      'tr',
                      { attrs: { className: 'gw-status-row' } },
                      h('td', { attrs: { colSpan: model.body.colSpan, className: 'gw-status' } }, model.body.content),
                  ),
              )
            : h(
                  'tbody',
                  { attrs: { className: 'gw-tbody', 'aria-busy': model.body.busy } },
                  ...Array.from({ length: model.body.rowCount }, (_, index) => {
                      const row = (model.body as Extract<TableModel<TRow>['body'], { kind: 'rows' }>).row(index);
                      return h('tr', { attrs: row.attrs, key: row.id }, ...row.cells.map((cell) => h('td', { attrs: cell.attrs, key: cell.columnId }, cell.content)));
                  }),
              );

    return h(
        'div',
        { attrs: model.root },
        // A visually hidden live region: one sentence, never the rows themselves.
        h('span', { attrs: { className: 'gw-visually-hidden', role: 'status', 'aria-live': 'polite' } }, model.live),
        h(
            'div',
            { attrs: { className: 'gw-table-wrapper' } },
            h('table', { attrs: model.table }, model.caption ? h('caption', { attrs: { className: 'gw-caption' } }, model.caption) : null, header, body),
        ),
    );
}
