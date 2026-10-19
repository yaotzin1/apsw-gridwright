import { useEffect, useState } from 'react';
import type { TreeNode } from '../../tree/types';
import type { GridAddon } from '../addons/types';
import { useGridwrightContext } from '../context';
import { columnCountOf } from '../parts/slots';
import { useNodeState } from '../tree/context';
import { SkeletonRow, SkeletonRows } from './Skeleton';
import { Spinner } from './Spinner';
import { useDelayed } from './useDelayed';
import type { LoadingIndicatorOptions } from './types';

export const LOADING_INDICATOR_ADDON = 'gridwright:loading-indicator';

const DEFAULT_DELAY = 200;
const DEFAULT_EXPAND_ROWS = 3;
const MAX_EXPAND_ROWS = 10;

function delayOf(options: LoadingIndicatorOptions): number {
    return Number.isFinite(options.delay) ? Math.max(0, options.delay as number) : DEFAULT_DELAY;
}

/**
 * The status row's content while loading: the indicator, after the delay, and the grid's own
 * "Loading" text, which stays in the document for assistive technology and shows beside the
 * indicator for a reader who asked for reduced motion.
 */
function LoadingStatus({ options }: { readonly options: LoadingIndicatorOptions }) {
    const grid = useGridwrightContext();
    const ready = useDelayed(delayOf(options));
    const indicator = options.render ? (
        <span aria-hidden="true">{options.render({ status: 'loading', columns: grid.columns.length })}</span>
    ) : (
        <Spinner variant={options.spinner ?? 'ring'} size={options.size ?? 'md'} decorative />
    );

    return (
        <span className="gw-loading gw-loading--indicator">
            {ready && indicator}
            <span className="gw-loading-text">{grid.labels.loading}</span>
        </span>
    );
}

/**
 * A spinner over the table while rows are being replaced, taking no room of its own: small in the
 * corner, or, for `refreshVariant: 'spinner'`, a normal-size one centred over the rows.
 */
function RefreshIndicator({ options, centred }: { readonly options: LoadingIndicatorOptions; readonly centred: boolean }) {
    const grid = useGridwrightContext();
    const ready = useDelayed(delayOf(options));
    if (!ready) return null;
    return (
        <div className={centred ? 'gw-refresh gw-refresh--centre' : 'gw-refresh'} aria-hidden="true">
            {options.render ? (
                options.render({ status: 'refreshing', columns: grid.columns.length })
            ) : (
                <Spinner variant={options.spinner ?? 'ring'} size={centred ? (options.size ?? 'md') : 'sm'} decorative />
            )}
        </div>
    );
}

/**
 * Renders nothing; it tells the add-on's `setup` that a refresh has outlasted `delay`. It is mounted
 * only while the grid is refreshing, so the timer starts with the refresh and unmounting stops it.
 */
function RefreshGate({ delay, onSlow }: { readonly delay: number; readonly onSlow: (slow: boolean) => void }) {
    useEffect(() => {
        if (delay <= 0) {
            onSlow(true);
            return () => onSlow(false);
        }
        const timer = setTimeout(() => onSlow(true), delay);
        return () => {
            clearTimeout(timer);
            onSlow(false);
        };
    }, [delay, onSlow]);
    return null;
}

/** The rows under a node whose children are loading. Mounted only then, so its delay starts with the load. */
function ExpandRows({ node, options }: { readonly node: TreeNode<unknown>; readonly options: LoadingIndicatorOptions }) {
    const grid = useGridwrightContext();
    const ready = useDelayed(delayOf(options));
    if (!ready) return null;

    if (options.expandVariant === 'skeleton') {
        const wanted = Number.isFinite(options.expandRows) ? Math.trunc(options.expandRows as number) : DEFAULT_EXPAND_ROWS;
        const count = Math.max(1, Math.min(wanted, MAX_EXPAND_ROWS));
        return <>{Array.from({ length: count }, (_, row) => <SkeletonRow key={row} row={row} shapes={options.shapes} />)}</>;
    }

    return (
        <tr className="gw-row gw-expand-loading" aria-busy="true">
            <td colSpan={columnCountOf(grid)} className="gw-cell">
                <span style={{ paddingInlineStart: `${(node.depth + 1) * 16}px` }}>
                    <LoadingStatus options={{ ...options, delay: 0 }} />
                </span>
            </td>
        </tr>
    );
}

function ExpandLoading({ node, options }: { readonly node: TreeNode<unknown>; readonly options: LoadingIndicatorOptions }) {
    const loading = useNodeState(node.nodeId).loadState === 'loading';
    return loading ? <ExpandRows node={node} options={options} /> : null;
}

/** A tree grid's rows are nodes, and the tree add-on does not export the check, so read the shape. */
function expandableNode(data: unknown): TreeNode<unknown> | null {
    if (typeof data !== 'object' || data === null) return null;
    const node = data as Partial<TreeNode<unknown>>;
    return typeof node.nodeId === 'string' && node.hasChildren === true && typeof node.depth === 'number' ? (node as TreeNode<unknown>) : null;
}

/**
 * What the grid shows while it loads: a spinner, or a skeleton of the table's own rows.
 *
 *     <Gridwright addons={[loadingIndicator({ variant: 'skeleton' })]} ... />
 *     <Gridwright addons={[loadingIndicator({ spinner: 'draw-g', indicateRefresh: true })]} ... />
 *     <Gridwright addons={[loadingIndicator({ refreshVariant: 'skeleton', expandVariant: 'spinner' })]} ... />
 *
 * It only draws. The announcement, the `aria-busy` marking and the dimmed rows during a refresh are
 * the grid's own, unchanged, and an indicator is hidden from assistive technology so the one
 * "Loading" sentence is said once.
 */
export function loadingIndicator<TRow>(options: LoadingIndicatorOptions = {}): GridAddon<TRow> {
    const variant = options.variant ?? 'spinner';
    const refreshVariant = options.refreshVariant ?? 'dim';
    const expandVariant = options.expandVariant ?? 'none';
    return {
        name: LOADING_INDICATOR_ADDON,
        setup: function useLoadingIndicatorSetup() {
            // True once a refresh has run longer than `delay`: set by <RefreshGate />, read by `renderRow`.
            const [slow, setSlow] = useState(false);
            return {
                ...(variant === 'spinner' ? { status: { loading: () => <LoadingStatus options={options} /> } } : {}),
                ...(variant === 'skeleton'
                    ? {
                          status: {
                              loadingRows: () => <SkeletonRows rows={options.rows} shapes={options.shapes} delay={delayOf(options)} />,
                          },
                      }
                    : {}),
                ...(refreshVariant === 'skeleton'
                    ? {
                          aboveTable: (grid) =>
                              grid.state.status === 'refreshing' ? <RefreshGate delay={delayOf(options)} onSlow={setSlow} /> : null,
                          // The rows already on screen, drawn as placeholders once the refresh is slow.
                          renderRow: (row, grid) =>
                              slow && grid.state.status === 'refreshing' ? <SkeletonRow row={row.index} shapes={options.shapes} /> : undefined,
                      }
                    : refreshVariant === 'spinner' || (options.indicateRefresh && variant !== 'none')
                      ? {
                            aboveTable: (grid) =>
                                grid.state.status === 'refreshing' ? (
                                    <RefreshIndicator options={options} centred={refreshVariant === 'spinner'} />
                                ) : null,
                        }
                      : {}),
                ...(expandVariant !== 'none'
                    ? {
                          rowAfter: (row) => {
                              const node = expandableNode(row.data);
                              return node ? <ExpandLoading node={node} options={options} /> : undefined;
                          },
                      }
                    : {}),
            };
        },
    };
}
