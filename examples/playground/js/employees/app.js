/**
 * The employees page: the switches become props on one `<Gridwright />`.
 *
 * Read `gridProps` first. It is the whole integration: everything else in this folder either
 * describes the data (`columns.js`, `data-source.js`), defines an option's contents
 * (`export-formats.js`, `row-actions.js`), or is page UI (`controls.js`, `report-editor.js`).
 */
import { React, catalogs, gridwright, h } from '../shared/package.js';
import { panel } from '../shared/ui.js';
import { TEAM, employeeColumns, teamColumns } from './columns.js';
import { Controls } from './controls.js';
import { createEmployeeSource, edits } from './data-source.js';
import { REPORTS, exportOptions } from './export-formats.js';
import { ReportEditor } from './report-editor.js';
import { employeeRowActions, teamRowActions } from './row-actions.js';

const { Gridwright } = gridwright;
const { useMemo, useState } = React;

const INITIAL = {
    latency: 400,
    locale: 'en',
    selected: 0,
    actions: false,
    editing: false,
    virtual: false,
    tree: false,
    filtering: false,
    exporting: false,
    serverDoes: { sort: true, filter: true, search: true, paginate: true },
    withTotal: true,
    fullExport: true,
};

const INITIAL_EXPORT = { report: 'cards', template: REPORTS.cards, outputs: ['markdown', 'pdf'], json: true, server: false };

export function App() {
    const [settings, setSettings] = useState(INITIAL);
    const [formatChoices, setFormatChoices] = useState(INITIAL_EXPORT);
    const [attempt, setAttempt] = useState(0);
    const [note, setNote] = useState('');
    // The tree's controller, handed back by the grid. Inserting and removing rows live on it.
    const [controller, setController] = useState(null);

    const update = (patch) => setSettings((current) => ({ ...current, ...patch }));
    const { latency, serverDoes, withTotal, fullExport } = settings;

    // A new source means a new request, so it is rebuilt only when something it reads changes.
    const dataSource = useMemo(
        () => createEmployeeSource({ latency, serverDoes, withTotal, attempt, fullExport }),
        [latency, serverDoes, withTotal, attempt, fullExport],
    );

    const failNext = async () => {
        await fetch('/api/fail-next');
        setAttempt((value) => value + 1);
    };

    return h('div', { className: 'stack' },
        h(Controls, { settings, update, failNext, note }),
        settings.exporting && h(ReportEditor, {
            choices: formatChoices,
            update: (patch) => setFormatChoices((current) => ({ ...current, ...patch })),
        }),
        panel(
            { title: 'The grid', sources: ['employees/app.js', 'employees/columns.js', 'employees/data-source.js'] },
            h(Gridwright, settings.tree
                ? treeProps({ settings, formatChoices, controller, setController, setNote })
                : gridProps({ settings, formatChoices, dataSource, setNote, update }))));
}

/** The flat grid over the paginating endpoint. */
function gridProps({ settings, formatChoices, dataSource, setNote, update }) {
    return {
        key: 'flat',
        'aria-label': 'Employees',
        columns: employeeColumns,
        dataSource,
        // Under `virtual` this is how many rows each request fetches, not a page anyone turns.
        pageSize: settings.virtual ? 100 : 25,
        searchable: true,
        selectionMode: 'multiple',
        queryDebounceMs: 250,
        // Text, plural rules, number formatting and direction, all from one catalog.
        locale: catalogs[settings.locale],
        onSelectionChange: (ids) => update({ selected: ids.length }),

        ...(settings.virtual ? { virtual: { rowHeight: 40, height: 440 } } : {}),
        ...(settings.filtering ? { columnFilters: true } : {}),
        ...(settings.exporting ? { export: exportOptions(formatChoices) } : {}),
        ...(settings.actions ? { rowActions: employeeRowActions({ dataSource, setNote }) } : {}),
        ...(settings.editing
            ? {
                  onCellEdit: (rowId, columnId, value) => {
                      edits.set(rowId, { ...edits.get(rowId), [columnId]: value });
                      // The source tells the grid its data changed; the row that comes back has the edit.
                      dataSource.invalidate();
                      setNote(`saved ${columnId} on row ${rowId}`);
                  },
              }
            : {}),
    };
}

/** The same component over a small tree in memory. */
function treeProps({ settings, formatChoices, controller, setController, setNote }) {
    return {
        key: 'tree',
        'aria-label': 'Team',
        columns: teamColumns,
        data: TEAM,
        pageSize: 100,
        searchable: true,
        selectionMode: 'multiple',
        locale: catalogs[settings.locale],
        tree: {
            getRowId: (row) => row.id,
            getChildren: (row) => row.children,
            defaultExpandedDepth: 1,
            controllerRef: setController,
            onCommit: async (change) => {
                setNote(`${change.type} ${change.rowId}`);
                await new Promise((resolve) => setTimeout(resolve, settings.latency));
            },
        },

        ...(settings.virtual ? { virtual: { rowHeight: 40, height: 440 } } : {}),
        ...(settings.filtering ? { columnFilters: true } : {}),
        // The tree has no department or start date, so the employee reports do not apply to it.
        ...(settings.exporting ? { export: { ...exportOptions({ ...formatChoices, report: 'none', server: false }), filename: 'team' } } : {}),
        ...(settings.actions ? { rowActions: teamRowActions({ controller, setNote }) } : {}),
        ...(settings.editing ? { onCellEdit: (rowId, columnId, value) => controller?.updateRow(rowId, { [columnId]: value }) } : {}),
    };
}
