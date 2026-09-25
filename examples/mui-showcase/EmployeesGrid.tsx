import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import {
    Gridwright,
    cellNavigation,
    columnFilters,
    columnLayout,
    coreAddons,
    exportMenu,
    inlineEditing,
    markdownReportFormats,
    rowActions,
    rowDetail,
    search,
    urlSync,
    virtualRows,
} from 'apsw-gridwright/react';
import type { GridAddon, GridwrightColumn } from 'apsw-gridwright/react';
import { muiAddons } from 'apsw-gridwright-mui';
import { CITIES, DEPARTMENTS, day, employees as initialEmployees, money } from './data';
import type { Employee, Project } from './data';
import { DeleteIcon, MailIcon, RaiseIcon } from './icons';
import { coreOptions, rowActionsTrigger, type Settings } from './settings';
import type { LocaleCatalog } from 'apsw-gridwright';

const choices = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

const columns: GridwrightColumn<Employee>[] = [
    {
        id: 'name',
        header: 'Name',
        width: 190,
        // Frozen at the start while the rest scrolls sideways, under columnLayout().
        layout: { pinned: 'left', hideable: false },
        edit: { editable: true },
        // An icon on every row: `icon` renders before the cell's content, hidden from screen
        // readers, and stays inside the editor's button so clicking it still starts an edit.
        icon: ({ row }) => (
            <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'primary.main' }}>
                {row.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
            </Avatar>
        ),
    },
    {
        id: 'email',
        header: 'Email',
        width: 250,
        // React in a cell: the value stays searchable and exportable, because the engine reads it
        // from the row rather than from what this renders.
        cell: ({ value }) => (
            <Link href={`mailto:${String(value)}`} underline="hover">
                {String(value)}
            </Link>
        ),
    },
    {
        id: 'department',
        header: 'Department',
        width: 140,
        filter: { type: 'select', choices: choices(DEPARTMENTS) },
        edit: { inputType: 'select', choices: choices(DEPARTMENTS) },
    },
    { id: 'title', header: 'Job title', width: 170 },
    { id: 'city', header: 'City', width: 120, filter: { type: 'select', choices: choices(CITIES) } },
    {
        id: 'salary',
        header: 'Salary',
        align: 'end',
        width: 120,
        formatValue: (value) => money.format(Number(value)),
        // The file wants the number, so a spreadsheet can add the column up.
        exportValue: (value) => String(value),
        filter: { type: 'number' },
        edit: { inputType: 'number' },
    },
    {
        id: 'startedOn',
        header: 'Started',
        width: 130,
        formatValue: (value) => day.format(new Date(String(value))),
        filter: { type: 'date' },
    },
    {
        id: 'active',
        header: 'Status',
        width: 110,
        formatValue: (value) => (value ? 'Active' : 'Inactive'),
        filter: {
            type: 'select',
            choices: [
                { value: true, label: 'Active' },
                { value: false, label: 'Inactive' },
            ],
        },
        // An MUI component inside a grid cell, in the theme like everything else.
        cell: ({ value }) => <Chip size="small" label={value ? 'Active' : 'Inactive'} color={value ? 'success' : 'default'} variant="outlined" />,
    },
];

// A report template: `{columnId}` writes that column's export text. Offered as a Markdown file and
// as a PDF through the print dialog.
const cards = markdownReportFormats<Employee>({
    id: 'showcase:cards',
    label: 'Employee cards',
    header: (rows) => `# Employee cards\n\n${rows.length} people.`,
    template: ['## {name}', '', '- {title}, {department}', '- {city}', '- Salary: {salary}'].join('\n'),
});

const projectColumns: GridwrightColumn<Project>[] = [
    { id: 'name', header: 'Project' },
    { id: 'role', header: 'Role' },
    { id: 'hours', header: 'Hours', align: 'end' },
];

interface EmployeesGridProps {
    readonly settings: Settings;
    readonly locale: LocaleCatalog;
    readonly notify: (message: string) => void;
}

/** 240 people in memory, with every add-on that suits a flat list, each behind a switch. */
export function EmployeesGrid({ settings, locale, notify }: EmployeesGridProps) {
    const [employees, setEmployees] = useState(initialEmployees);

    const change = (id: Employee['id'], patch: Partial<Employee>) =>
        setEmployees((current) => current.map((employee) => (employee.id === id ? { ...employee, ...patch } : employee)));
    const nameOf = (id: Employee['id']) => employees.find((employee) => employee.id === id)?.name ?? 'the row';

    // One set of actions, offered two ways: as buttons in a column, and in the row menu.
    const raise = (employee: Employee) => {
        const salary = Math.round(employee.salary * 1.05);
        change(employee.id, { salary });
        notify(`${employee.name} now earns ${money.format(salary)}.`);
    };
    const remove = (employee: Employee) => {
        setEmployees((current) => current.filter((each) => each.id !== employee.id));
        notify(`${employee.name} was removed.`);
    };

    // An actions column is an ordinary column whose `cell` renders controls. It has no value of its
    // own, so it opts out of everything that reads one: sorting, filtering, search and export.
    // Buttons in a cell keep their own clicks, so they neither select the row nor open its menu.
    const actionsColumn: GridwrightColumn<Employee> = {
        id: 'actions',
        header: 'Actions',
        accessor: () => null,
        width: 132,
        align: 'center',
        sortable: false,
        filterable: false,
        searchable: false,
        exportable: false,
        layout: { pinned: 'right', resizable: false },
        cell: ({ row }) => (
            <>
                <Tooltip title="Email">
                    <IconButton size="small" href={`mailto:${row.email}`} aria-label={`Email ${row.name}`}>
                        <MailIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Give a 5% raise">
                    <IconButton size="small" onClick={() => raise(row)} aria-label={`Give ${row.name} a 5% raise`}>
                        <RaiseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                    <IconButton size="small" color="error" onClick={() => remove(row)} aria-label={`Remove ${row.name}`}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </>
        ),
    };

    // Built on every render, which is fine: the grid keys on the add-ons' names, not the objects,
    // and the handlers below then always see the current rows.
    const list: GridAddon<Employee>[] = [];
    if (settings.search) list.push(search());
    if (settings.columnFilters) list.push(columnFilters());
    if (settings.exportMenu) list.push(exportMenu({ formats: ['csv', 'excel', 'markdown', 'print', ...cards], filename: 'employees' }));
    if (settings.rowActions) {
        list.push(
            rowActions<Employee>({
                // Right-click only beside the actions column, and never the left click while that
                // click selects: see `rowActionsTrigger`.
                trigger: rowActionsTrigger(settings, settings.actionsColumn),
                items: [
                    {
                        id: 'raise',
                        label: 'Give a 5% raise',
                        onSelect: (row) => raise(row.data),
                    },
                    {
                        id: 'status',
                        label: 'Toggle active',
                        onSelect: (row) => {
                            change(row.data.id, { active: !row.data.active });
                            notify(`${row.data.name} is now ${row.data.active ? 'inactive' : 'active'}.`);
                        },
                    },
                    {
                        id: 'remove',
                        label: 'Remove',
                        destructive: true,
                        separatorBefore: true,
                        onSelect: (row) => remove(row.data),
                    },
                ],
            }),
        );
    }
    if (settings.inlineEditing) {
        list.push(
            inlineEditing<Employee>({
                commit: (rowId, columnId, value) => {
                    change(Number(rowId), { [columnId]: value } as Partial<Employee>);
                    notify(`Saved ${columnId} for ${nameOf(Number(rowId))}.`);
                },
            }),
        );
    }
    if (settings.columnLayout) list.push(columnLayout());
    if (settings.cellNavigation) list.push(cellNavigation());
    if (settings.rowDetail) {
        list.push(
            rowDetail<Employee>({
                render: ({ data }) => (
                    // A grid inside a grid, in MUI's clothes too, with no add-ons of its own.
                    <Gridwright<Project>
                        aria-label={`Projects of ${data.name}`}
                        columns={projectColumns}
                        data={data.projects}
                        pageSize={5}
                        locale={locale}
                        coreAddons={settings.mui ? muiAddons<Project>() : coreAddons<Project>()}
                    />
                ),
            }),
        );
    }
    if (settings.virtualRows) list.push(virtualRows({ rowHeight: 40, height: 520 }));
    if (settings.urlSync) list.push(urlSync({ prefix: 'emp_' }));

    return (
        <Gridwright<Employee>
            aria-label="Employees"
            columns={settings.actionsColumn ? [...columns, actionsColumn] : columns}
            data={employees}
            pageSize={10}
            selectionMode="multiple"
            locale={locale}
            coreAddons={settings.mui ? muiAddons<Employee>(coreOptions(settings)) : coreAddons<Employee>(coreOptions(settings))}
            addons={list}
        />
    );
}
