/**
 * Every switch on the page, in one object, and the `<Gridwright />` those switches amount to.
 *
 * The code panel prints `gridwrightSource(settings)`, so what the page says it renders and what it
 * renders are built from the same values.
 */

export type LocaleName = 'en' | 'de' | 'es' | 'fr' | 'pl';

export interface Settings {
    // Core add-ons, on every tab.
    mui: boolean;
    multiSort: boolean;
    checkboxes: boolean;
    selectAll: boolean;
    selectOnRowClick: boolean;
    locale: LocaleName;
    // The Employees tab's add-ons.
    search: boolean;
    columnFilters: boolean;
    exportMenu: boolean;
    rowActions: boolean;
    inlineEditing: boolean;
    columnLayout: boolean;
    cellNavigation: boolean;
    rowDetail: boolean;
    virtualRows: boolean;
    urlSync: boolean;
}

export const INITIAL_SETTINGS: Settings = {
    mui: true,
    multiSort: true,
    checkboxes: true,
    selectAll: true,
    selectOnRowClick: false,
    locale: 'en',
    search: true,
    columnFilters: true,
    exportMenu: true,
    rowActions: true,
    inlineEditing: true,
    columnLayout: true,
    cellNavigation: false,
    rowDetail: true,
    virtualRows: false,
    urlSync: false,
};

/** The core add-on options the switches set, as `coreAddons(options)` and `muiAddons(options)` take them. */
export function coreOptions(settings: Settings) {
    return {
        sorting: { multiSort: settings.multiSort },
        selection: { checkboxes: settings.checkboxes, selectAll: settings.selectAll, selectOnRowClick: settings.selectOnRowClick },
    };
}

/** The source of the Employees grid as the switches currently have it. */
export function gridwrightSource(settings: Settings): string {
    const options: string[] = [];
    if (!settings.multiSort) options.push('sorting: { multiSort: false }');
    const selection: string[] = [];
    if (!settings.checkboxes) selection.push('checkboxes: false');
    if (!settings.selectAll) selection.push('selectAll: false');
    if (settings.selectOnRowClick) selection.push('selectOnRowClick: true');
    if (selection.length > 0) options.push(`selection: { ${selection.join(', ')} }`);
    const core = `${settings.mui ? 'muiAddons' : 'coreAddons'}(${options.length ? `{ ${options.join(', ')} }` : ''})`;

    const addons = [
        settings.search && 'search()',
        settings.columnFilters && 'columnFilters()',
        settings.exportMenu && "exportMenu({ formats: ['csv', 'excel', 'markdown', 'print', ...cards] })",
        settings.rowActions && 'rowActions({ items })',
        settings.inlineEditing && 'inlineEditing({ commit })',
        settings.columnLayout && 'columnLayout()',
        settings.cellNavigation && 'cellNavigation()',
        settings.rowDetail && 'rowDetail({ render: ProjectsPanel })',
        settings.virtualRows && 'virtualRows({ rowHeight: 40, height: 520 })',
        settings.urlSync && "urlSync({ prefix: 'emp_' })",
    ].filter(Boolean);

    return [
        '<Gridwright',
        '    columns={columns}',
        '    data={employees}',
        '    selectionMode="multiple"',
        ...(settings.locale === 'en' ? [] : [`    locale={${settings.locale}}`]),
        `    coreAddons={${core}}`,
        '    addons={[',
        ...addons.map((addon) => `        ${addon},`),
        '    ]}',
        '/>',
    ].join('\n');
}
