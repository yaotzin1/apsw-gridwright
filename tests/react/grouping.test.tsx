import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { grouping } from '../../src/react/grouping/addon';
import { treeData } from '../../src/react/tree/addon';
import { virtualRows } from '../../src/react/virtual/addon';
import type { GridwrightColumn } from '../../src/react/types';

interface Employee {
    readonly id: string;
    readonly name: string;
    readonly department: string;
    readonly salary: number;
}

const employees: Employee[] = [
    { id: 'ada', name: 'Ada Lovelace', department: 'Engineering', salary: 140_000 },
    { id: 'grace', name: 'Grace Hopper', department: 'Engineering', salary: 150_000 },
    { id: 'katherine', name: 'Katherine Johnson', department: 'Research', salary: 120_000 },
];

const columns: readonly GridwrightColumn<Employee>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', aggregate: 'sum' },
];

/** A custom `cell` and `icon`, the shape the playground's employees example uses. */
const columnsWithRenderers: readonly GridwrightColumn<Employee>[] = [
    {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => `${row.name} <${row.department}>`,
        icon: ({ row }) => (row.salary > 145_000 ? 'star' : null),
    },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary' },
];

const groupRows = () => screen.getAllByRole('row').filter((row) => row.className.includes('gw-row--group'));
const dataRows = () => screen.getAllByRole('row').filter((row) => !row.className.includes('gw-row--group') && row.getAttribute('data-row-id')?.startsWith('row:'));

const renderGrid = (options: Parameters<typeof grouping>[0] = { groupBy: ['department'] }) =>
    render(
        <Gridwright<Employee>
            columns={columns}
            data={employees}
            pageSize={100}
            aria-label="Employees"
            addons={[grouping(options)]}
        />,
    );

describe('grouping()', () => {
    it('renders a group header per distinct value, expanded by default', () => {
        renderGrid();
        const groups = groupRows();
        expect(groups).toHaveLength(2);
        expect(within(groups[0]!).getByText('Engineering')).toBeInTheDocument();
        expect(within(groups[1]!).getByText('Research')).toBeInTheDocument();
        expect(dataRows()).toHaveLength(3);
    });

    it('passes a custom cell and icon renderer your row, not the group wrapper around it', () => {
        render(
            <Gridwright<Employee>
                columns={columnsWithRenderers}
                data={employees}
                pageSize={100}
                aria-label="Employees"
                addons={[grouping({ groupBy: ['department'] })]}
            />,
        );
        // The cell renderer reads row.name and row.department; if it received the GroupedRow
        // wrapper instead, both would read as undefined and the cell would show "undefined <undefined>".
        expect(screen.getByText('Ada Lovelace <Engineering>')).toBeInTheDocument();
        expect(screen.getByText('Grace Hopper <Engineering>')).toBeInTheDocument();
        // The icon renderer reads row.salary; Grace's (150,000) clears the threshold, Ada's does not.
        expect(within(screen.getByText('Grace Hopper <Engineering>').closest('td')!).getByText('star')).toBeInTheDocument();
        expect(within(screen.getByText('Ada Lovelace <Engineering>').closest('td')!).queryByText('star')).not.toBeInTheDocument();
    });

    it('collapses a group from its toggle, hiding its member rows', async () => {
        const user = userEvent.setup();
        renderGrid();

        await user.click(screen.getByRole('button', { name: 'Collapse Engineering group' }));
        expect(dataRows()).toHaveLength(1);
        expect(screen.getByText('Katherine Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Expand Engineering group' }));
        expect(dataRows()).toHaveLength(3);
    });

    it('starts collapsed when defaultExpanded is false', () => {
        renderGrid({ groupBy: ['department'], defaultExpanded: false });
        expect(dataRows()).toHaveLength(0);
        expect(groupRows()).toHaveLength(2);
    });

    it('carries aria-expanded and aria-level on the group row', () => {
        renderGrid();
        const [engineering] = groupRows();
        expect(engineering).toHaveAttribute('aria-expanded', 'true');
        expect(engineering).toHaveAttribute('aria-level', '1');
    });

    it('shows the item count and the column aggregate on the group header', () => {
        renderGrid();
        const [engineering] = groupRows();
        expect(within(engineering!).getByText('2 items')).toBeInTheDocument();
        expect(within(engineering!).getByText('290,000')).toBeInTheDocument();
    });

    it('sets the table role to treegrid', () => {
        renderGrid();
        expect(screen.getByRole('treegrid')).toBeInTheDocument();
    });

    it('sets aria-level on member rows, one past their group', () => {
        renderGrid();
        const row = dataRows().find((candidate) => within(candidate).queryByText('Ada Lovelace'));
        expect(row).toHaveAttribute('aria-level', '2');
    });

    it('renders a grand-total summary row when summaryRow is on', () => {
        renderGrid({ groupBy: ['department'], summaryRow: true });
        const footer = document.querySelector('.gw-tfoot');
        expect(footer).toBeTruthy();
        expect(within(footer as HTMLElement).getByText('Total')).toBeInTheDocument();
        expect(within(footer as HTMLElement).getByText((140_000 + 150_000 + 120_000).toLocaleString())).toBeInTheDocument();
    });

    it('renders no summary row when summaryRow is off', () => {
        renderGrid();
        expect(document.querySelector('.gw-tfoot')).toBeNull();
    });

    it('turns summaryRow on after the grid already mounted, without remounting the add-on', async () => {
        // A plugin is reconciled by name: recreating groupingPlugin() on every render is not enough
        // on its own, since the engine ignores a new object under a name already installed. This
        // exercises the whole path a live toggle takes, not just the plugin in isolation.
        const user = userEvent.setup();
        function Demo() {
            const [summaryRow, setSummaryRow] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setSummaryRow(true)}>
                        turn summary on
                    </button>
                    <Gridwright<Employee>
                        columns={columns}
                        data={employees}
                        pageSize={100}
                        aria-label="Employees"
                        addons={[grouping({ groupBy: ['department'], summaryRow })]}
                    />
                </>
            );
        }
        render(<Demo />);

        expect(document.querySelector('.gw-tfoot')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'turn summary on' }));

        const footer = document.querySelector('.gw-tfoot');
        expect(footer).toBeTruthy();
        expect(within(footer as HTMLElement).getByText((140_000 + 150_000 + 120_000).toLocaleString())).toBeInTheDocument();
    });

    it('renders group headers under virtualRows(), the same as any other row', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Employee>
                columns={columns}
                data={employees}
                aria-label="Employees"
                addons={[grouping({ groupBy: ['department'] }), virtualRows({ rowHeight: 40, height: 400 })]}
            />,
        );

        expect(groupRows()).toHaveLength(2);
        expect(dataRows()).toHaveLength(3);

        await user.click(screen.getByRole('button', { name: 'Collapse Engineering group' }));
        expect(dataRows()).toHaveLength(1);
    });

    it('refuses to be listed with treeData(), by name', () => {
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            render(
                <Gridwright<Employee>
                    columns={columns}
                    data={employees}
                    aria-label="Employees"
                    addons={[grouping({ groupBy: ['department'] }), treeData<Employee>({ getRowId: (row) => row.id, getChildren: () => undefined })]}
                />,
            ),
        ).toThrow(/gridwright:grouping.*gridwright:tree|gridwright:tree/s);
        reported.mockRestore();
    });
});
