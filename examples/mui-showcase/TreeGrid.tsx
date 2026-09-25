import { useState } from 'react';
import { Gridwright, coreAddons, inlineEditing, rowActions, rowDataOf, search, treeData } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import type { LocaleCatalog, TreeController } from 'apsw-gridwright';
import { muiAddons } from 'apsw-gridwright-mui';
import { files } from './data';
import type { FileNode } from './data';
import { coreOptions, rowActionsTrigger, type Settings } from './settings';

const columns: GridwrightColumn<FileNode>[] = [
    {
        id: 'name',
        header: 'Name',
        edit: { editable: true },
        icon: ({ row }) => <span aria-hidden="true">{row.kind === 'folder' ? '\u{1F4C1}' : '\u{1F4C4}'}</span>,
    },
    { id: 'owner', header: 'Owner', edit: { editable: (row) => row.kind === 'file' } },
    { id: 'size', header: 'Size', align: 'end', formatValue: (value) => `${Number(value)} KB` },
];

/**
 * A folder tree: nested rows, expansion, search that keeps a match's ancestors, a row menu that
 * adds and removes nodes, and names edited in place. The tree applies each change at once and
 * would revert it if `onCommit` threw.
 */
export function TreeGrid({ settings, locale, notify }: { readonly settings: Settings; readonly locale: LocaleCatalog; readonly notify: (message: string) => void }) {
    const [tree, setTree] = useState<TreeController<FileNode> | null>(null);

    return (
        <Gridwright<FileNode>
            aria-label="Files"
            columns={columns}
            data={files}
            selectionMode="multiple"
            locale={locale}
            coreAddons={settings.mui ? muiAddons<FileNode>(coreOptions(settings)) : coreAddons<FileNode>(coreOptions(settings))}
            addons={[
                treeData<FileNode>({
                    getRowId: (row) => row.id,
                    getChildren: (row) => row.children,
                    defaultExpandedDepth: 1,
                    controllerRef: setTree,
                    onCommit: (change) => notify(`Tree change: ${change.type}.`),
                }),
                search<FileNode>(),
                rowActions<FileNode>({
                    trigger: rowActionsTrigger(settings),
                    items: [
                        {
                            id: 'add',
                            label: 'Add a file here',
                            // `rowDataOf`, because a tree row is a placement of your row.
                            hidden: (row) => rowDataOf<FileNode>(row).kind !== 'folder',
                            onSelect: (row) =>
                                void tree?.insertRow(
                                    { id: crypto.randomUUID(), name: 'untitled.md', kind: 'file', owner: 'You', size: 1 },
                                    { referenceNodeId: String(row.id), position: 'child' },
                                ),
                        },
                        {
                            id: 'remove',
                            label: 'Delete',
                            destructive: true,
                            onSelect: (row) => void tree?.removeNode(String(row.id)),
                        },
                    ],
                }),
                inlineEditing<FileNode>({
                    commit: (rowId, columnId, value) => tree?.updateRow(rowId, { [columnId]: value } as Partial<FileNode>),
                }),
            ]}
        />
    );
}
