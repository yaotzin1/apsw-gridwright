import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { NodeId } from '../../tree/types';
import type { TreeController, TreeNodeState } from '../../tree/controller';

/**
 * How the expand control is drawn.
 *
 * - `'chevron'`: a filled triangle, right when closed and down when open.
 * - `'angle'`: an open chevron, `>` when closed and `v` when open.
 * - `'square'`: a box holding a plus when closed and a hyphen when open.
 * - `'circle'`: the same in a circle.
 * - `'plusminus'`: a bare plus when closed and a bare hyphen when open.
 * - a function draws anything else, and receives the state it should reflect.
 *
 * The button, its label and its keyboard behaviour are the grid's either way.
 */
export type TreeToggleIcon =
    | 'chevron'
    | 'angle'
    | 'square'
    | 'circle'
    | 'plusminus'
    | ((state: { readonly expanded: boolean; readonly loading: boolean }) => ReactNode);

export interface TreeContextValue<TRow> {
    readonly controller: TreeController<TRow>;
    /** Which column carries the indentation and the toggle. */
    readonly treeColumnId: string | null;
    /** How the toggle is drawn. */
    readonly toggleIcon: TreeToggleIcon;
    /** Bumped whenever the controller changes, so consumers of node state re-render. */
    readonly revision: number;
}

const TreeContext = createContext<TreeContextValue<unknown> | null>(null);

export interface TreeProviderProps<TRow> {
    readonly controller: TreeController<TRow>;
    readonly treeColumnId?: string | null;
    readonly toggleIcon?: TreeToggleIcon;
    readonly children: ReactNode;
}

/**
 * Publishes the tree controller to the parts.
 *
 * The controller lives outside React and mutates in place, so a revision counter is what turns its
 * notifications into renders. Copying the expansion set into React state instead would give two
 * sources of truth and a frame where they disagree.
 */
export function TreeProvider<TRow>({ controller, treeColumnId, toggleIcon = 'chevron', children }: TreeProviderProps<TRow>) {
    const [revision, setRevision] = useState(0);

    useEffect(() => controller.subscribe(() => setRevision((value) => value + 1)), [controller]);

    const value = useMemo<TreeContextValue<TRow>>(
        () => ({ controller, treeColumnId: treeColumnId ?? null, toggleIcon, revision }),
        [controller, treeColumnId, toggleIcon, revision],
    );

    return (
        <TreeContext.Provider value={value as unknown as TreeContextValue<unknown>}>
            {children}
        </TreeContext.Provider>
    );
}

export function useTreeContext<TRow = unknown>(): TreeContextValue<TRow> {
    const value = useContext(TreeContext);
    if (!value) {
        throw new Error('[gridwright] this component must be rendered inside a tree grid.');
    }
    return value as unknown as TreeContextValue<TRow>;
}

/** The tree context if there is one. Lets a shared part work in both flat and tree grids. */
export function useOptionalTreeContext<TRow = unknown>(): TreeContextValue<TRow> | null {
    return useContext(TreeContext) as unknown as TreeContextValue<TRow> | null;
}

export function useNodeState(nodeId: NodeId): TreeNodeState {
    const { controller, revision } = useTreeContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => controller.getNodeState(nodeId), [controller, nodeId, revision]);
}
