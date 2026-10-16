import type { GridAddon } from '../addons/types';
import { useGridwrightContext } from '../context';
import { SkeletonRows } from './Skeleton';
import { Spinner } from './Spinner';
import { useDelayed } from './useDelayed';
import type { LoadingIndicatorOptions } from './types';

export const LOADING_INDICATOR_ADDON = 'gridwright:loading-indicator';

const DEFAULT_DELAY = 200;

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

/** A small spinner above the table while rows are being replaced, taking no room of its own. */
function RefreshIndicator({ options }: { readonly options: LoadingIndicatorOptions }) {
    const grid = useGridwrightContext();
    const ready = useDelayed(delayOf(options));
    if (!ready) return null;
    return (
        <div className="gw-refresh" aria-hidden="true">
            {options.render ? (
                options.render({ status: 'refreshing', columns: grid.columns.length })
            ) : (
                <Spinner variant={options.spinner ?? 'ring'} size="sm" decorative />
            )}
        </div>
    );
}

/**
 * What the grid shows while it loads: a spinner, or a skeleton of the table's own rows.
 *
 *     <Gridwright addons={[loadingIndicator({ variant: 'skeleton' })]} ... />
 *     <Gridwright addons={[loadingIndicator({ spinner: 'draw-g', indicateRefresh: true })]} ... />
 *
 * It only draws. The announcement, the `aria-busy` marking and the dimmed rows during a refresh are
 * the grid's own, unchanged, and an indicator is hidden from assistive technology so the one
 * "Loading" sentence is said once.
 */
export function loadingIndicator<TRow>(options: LoadingIndicatorOptions = {}): GridAddon<TRow> {
    const variant = options.variant ?? 'spinner';
    return {
        name: LOADING_INDICATOR_ADDON,
        setup: function useLoadingIndicatorSetup() {
            return {
                ...(variant === 'spinner' ? { status: { loading: () => <LoadingStatus options={options} /> } } : {}),
                ...(variant === 'skeleton'
                    ? {
                          status: {
                              loadingRows: () => <SkeletonRows rows={options.rows} shapes={options.shapes} delay={delayOf(options)} />,
                          },
                      }
                    : {}),
                ...(options.indicateRefresh && variant !== 'none'
                    ? {
                          aboveTable: (grid) => (grid.state.status === 'refreshing' ? <RefreshIndicator options={options} /> : null),
                      }
                    : {}),
            };
        },
    };
}
