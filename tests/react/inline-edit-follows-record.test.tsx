import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { InlineEditProvider } from '../../src/react/plugins';
import { inlineEditing } from '../../src/react/plugins/addons';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridApi } from '../../src/core/types';
import type { GridwrightColumn } from '../../src/react/types';
import { treeData } from '../../src/react/tree/addon';
import { fakeServer } from '../fake-server';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * An editor belongs to the cell that rendered it. When the record leaves the settled rows the editing
 * state goes with it, so the record coming back is an ordinary row and not an editor opening by itself.
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', edit: { editable: true } },
    { id: 'department', header: 'Department' },
];

let api: GridApi<Person>;
const probe: GridAddon<Person> = {
    name: 'test:api',
    setup: () => ({
        toolbar: (context) => {
            api = context.api;
            return null;
        },
    }),
};

async function mount(options: { strict?: boolean; keepPreviousData?: boolean; pageSize?: number } = {}) {
    const server = fakeServer(people);
    const grid = (
        <Gridwright<Person>
            columns={columns}
            dataSource={server.dataSource}
            getRowId={(row) => row.id}
            pageSize={options.pageSize ?? 10}
            {...(options.keepPreviousData === undefined ? {} : { keepPreviousData: options.keepPreviousData })}
            aria-label="People"
            addons={[inlineEditing<Person>({ commit: vi.fn() }), probe]}
        />
    );
    render(options.strict ? <StrictMode>{grid}</StrictMode> : grid);
    await screen.findByText('Ada Lovelace');
    return server;
}

const open = async (id: number): Promise<void> => {
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>(`tr[data-row-id="${id}"] .gw-edit-trigger`)!);
};
const editor = (): HTMLInputElement | null => document.querySelector<HTMLInputElement>('input.gw-editor');
const ready = () => waitFor(() => expect(api.getState().status).toBe('ready'));

describe('the editor follows its record', () => {
    it('stays open under React Strict Mode, which mounts and unmounts every cell once', async () => {
        await mount({ strict: true });
        await open(2);

        expect(editor()).not.toBeNull();
        await act(async () => void (await api.refresh()));
        expect(editor()).not.toBeNull();
    });

    it('stays open when a different record leaves the page', async () => {
        const server = await mount();
        await open(2);
        fireEvent.change(editor()!, { target: { value: 'Mine' } });

        server.rows = server.rows.filter((row) => row.id !== 5);
        await act(async () => void (await api.refresh()));

        expect(editor()).toHaveValue('Mine');
    });

    it('stays open when the records around it are replaced but its own stays', async () => {
        const server = await mount();
        await open(2);
        fireEvent.change(editor()!, { target: { value: 'Mine' } });

        server.rows = [people[1]!, { ...people[0]!, id: 70, name: 'New A' }, { ...people[0]!, id: 71, name: 'New B' }];
        await act(async () => void (await api.refresh()));

        expect(editor()).toHaveValue('Mine');
    });

    it('does not close while the answer is still on its way', async () => {
        const server = await mount();
        await open(2);

        server.hold();
        await act(async () => void api.setSearch('mary'));
        expect(api.getState().status).toBe('refreshing');

        // The old rows are still on screen, so the record is still there to be edited.
        expect(editor()).not.toBeNull();
        await act(async () => server.release());
        await ready();
        expect(editor()).toBeNull();
    });

    it('closes when the answer leaves the record out, and stays closed when it returns', async () => {
        await mount({ pageSize: 3 });
        await open(1);

        await act(async () => api.setPage(1));
        await ready();
        expect(editor()).toBeNull();

        await act(async () => api.setPage(0));
        await ready();

        expect(document.querySelector('tr[data-row-id="1"]')).not.toBeNull();
        expect(editor()).toBeNull();
        expect(document.querySelector('tr[data-row-id="1"] .gw-edit-trigger')).not.toBeNull();
    });

    it('lets the same record be edited again after it came back', async () => {
        await mount({ pageSize: 3 });
        await open(1);
        await act(async () => api.setPage(1));
        await ready();
        await act(async () => api.setPage(0));
        await ready();

        await open(1);

        expect(editor()).toHaveValue('Ada Lovelace');
        expect(editor()).toHaveFocus();
    });

    it('leaves a provider used without rows exactly as it was', () => {
        render(
            <InlineEditProvider commit={vi.fn()}>
                <span>no grid here</span>
            </InlineEditProvider>,
        );

        expect(screen.getByText('no grid here')).toBeInTheDocument();
    });

    it('keeps an editor open in a tree, where one record can stand in several places', async () => {
        interface Node {
            id: string;
            name: string;
            children?: Node[];
        }
        const nodes: Node[] = [
            { id: 'a', name: 'Alpha', children: [{ id: 'a1', name: 'Alpha One' }] },
            { id: 'b', name: 'Beta' },
        ];
        const user = userEvent.setup();
        render(
            <Gridwright<Node>
                columns={[{ id: 'name', header: 'Name', edit: { editable: true } }]}
                data={nodes}
                pageSize={10}
                aria-label="Nodes"
                addons={[
                    treeData<Node>({ getRowId: (row) => row.id, getChildren: (row) => row.children, defaultExpandedDepth: 1 }),
                    inlineEditing<Node>({ commit: vi.fn() }),
                ]}
            />,
        );
        await screen.findByText('Alpha One');

        await user.click(screen.getByText('Alpha One'));
        expect(editor()).not.toBeNull();
        fireEvent.change(editor()!, { target: { value: 'Typed in a tree' } });
        await act(async () => undefined);
        await act(async () => undefined);

        expect(editor()).toHaveValue('Typed in a tree');
    });
});
