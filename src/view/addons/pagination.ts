import type { AddonMessages } from '../../i18n/messages';
import { defineAddon } from '../addon';
import type { ViewAddon } from '../addon';
import { DEFAULT_PAGE_SIZE_OPTIONS, pageFocusAfterChange, pageRangeOf, pageSizeChoices } from '../behaviour/pagination';
import { h } from '../node';

export const PAGINATION_ADDON = 'gridwright:pagination';

/** English strings, plain data with no framework in them, so locale packs and every adapter read the same. */
export const paginationMessages: AddonMessages = {
    en: {
        previous: 'Previous page',
        next: 'Next page',
        rowsPerPage: 'Rows per page',
        range: '{from}-{to} of {total}',
        // Never a computed total. A source that paginates without a count has not sent one.
        rangeUnknown: '{from}-{to} of many',
    },
};

export interface PaginationOptions {
    /** Default `[10, 25, 50, 100]`. */
    readonly pageSizeOptions?: readonly number[];
}

type Button = 'previous' | 'next';

/**
 * Page controls and the row range, below the table, written once for every adapter.
 *
 * The range respects `isTotalExact`: when a paginating source answers without a total the grid knows only
 * that another page exists, and "1-25 of 25" there would be a lie the reader acts on, so the range is
 * worded from the flag.
 *
 * Both buttons disable themselves at the end of their travel, which is correct and which loses a keyboard
 * reader's place: a focused element that becomes disabled sends focus to `<body>`, so reaching the last
 * page would eject the reader from the grid. `settled` moves focus to the sibling, and only after a press
 * by the reader: a page change the consumer drove through the API must not steal focus.
 */
export function pagination<TRow>(options: PaginationOptions = {}): ViewAddon<TRow> {
    const pageSizeOptions = options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;

    return defineAddon<TRow>({
        name: PAGINATION_ADDON,
        setup: (context) => {
            // Which button the reader last pressed. Only that one earns a focus move.
            const pressed = context.state<Button | null>('pressed', null);

            return {
                messages: paginationMessages,
                belowTable: (grid) => {
                    const { api, state } = grid;
                    const t = grid.messages(PAGINATION_ADDON, paginationMessages);
                    const { pageSize } = state.query.pagination;
                    const { from, to, total } = pageRangeOf(state);
                    const press = (button: Button) => () => {
                        pressed.set(button);
                        if (button === 'next') api.nextPage();
                        else api.previousPage();
                    };

                    return h(
                        'div',
                        { attrs: { className: ['gw-pagination', grid.classNames.pagination].filter(Boolean).join(' ') } },
                        h(
                            'label',
                            { attrs: { className: 'gw-page-size' } },
                            h('span', { attrs: { className: 'gw-page-size-label' } }, t('rowsPerPage')),
                            h(
                                'select',
                                { attrs: { className: 'gw-select' }, on: { change: (event) => api.setPageSize(Number(event.value)) } },
                                // The grid's actual page size is always one of the choices, whether or not it was listed.
                                ...pageSizeChoices(pageSizeOptions, pageSize).map((choice) =>
                                    h('option', { attrs: { value: choice, selected: choice === pageSize }, key: String(choice) }, String(choice)),
                                ),
                            ),
                        ),
                        // Not a live region. The grid's one region already says "Showing 4 to 6 of 7" when the page settles.
                        h('span', { attrs: { className: 'gw-page-range' } }, total === null ? t('rangeUnknown', { from, to }) : t('range', { from, to, total })),
                        h(
                            'div',
                            { attrs: { className: 'gw-page-controls' } },
                            h(
                                'button',
                                {
                                    attrs: { type: 'button', className: 'gw-button gw-button--icon', disabled: !state.hasPreviousPage, 'aria-label': t('previous') },
                                    on: { click: press('previous') },
                                    key: 'previous',
                                },
                                '←',
                            ),
                            h(
                                'button',
                                {
                                    attrs: { type: 'button', className: 'gw-button gw-button--icon', disabled: !state.hasNextPage, 'aria-label': t('next') },
                                    on: { click: press('next') },
                                    key: 'next',
                                },
                                '→',
                            ),
                        ),
                    );
                },
                settled: (grid) => {
                    const was = pressed.get();
                    if (was === null) return;
                    // The press is spent by the first page that settles, as the component it replaces spent it.
                    pressed.set(null);
                    const target = pageFocusAfterChange(was, { previous: !grid.state.hasPreviousPage, next: !grid.state.hasNextPage });
                    return target === null ? undefined : { type: 'focus', key: target };
                },
            };
        },
    });
}
