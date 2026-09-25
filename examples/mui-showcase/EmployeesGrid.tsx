import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
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
import { coreOptions, type Settings } from './settings';
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

    // Built on every render, which is fine: the grid keys on the add-ons' names, not the objects,
    // and the handlers below then always see the current rows.
    const list: GridAddon<Employee>[] = [];
    if (settings.search) list.push(search());
    if (settings.columnFilters) list.push(columnFilters());
    if (settings.exportMenu) list.push(exportMenu({ formats: ['csv', 'excel', 'markdown', 'print', ...cards], filename: 'employees' }));
    if (settings.rowActions) {
        list.push(
            rowActions<Employee>({
                items: [
                    {
                        id: 'raise',
                        label: 'Give a 5% raise',
                        onSelect: (row) => {
                            change(row.data.id, { salary: Math.round(row.data.salary * 1.05) });
                            notify(`${row.data.name} now earns ${money.format(Math.round(row.data.salary * 1.05))}.`);
                        },
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
                        onSelect: (row) => {
                            setEmployees((current) => current.filter((employee) => employee.id !== row.data.id));
                            notify(`${row.data.name} was removed.`);
                        },
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
            columns={columns}
            data={employees}
            pageSize={10}
            selectionMode="multiple"
            locale={locale}
            coreAddons={settings.mui ? muiAddons<Employee>(coreOptions(settings)) : coreAddons<Employee>(coreOptions(settings))}
            addons={list}
        />
    );
}
