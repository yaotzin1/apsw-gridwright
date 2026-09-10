import { classes, GridwrightProvider, useGridwrightContext } from './context';
import { GridBody } from './parts/GridBody';
import { GridHeader } from './parts/GridHeader';
import { GridPagination } from './parts/GridPagination';
import { GridTable } from './parts/GridTable';
import { GridToolbar } from './parts/GridToolbar';
import type { GridwrightInstance, GridwrightProps } from './types';
import { useGridwright } from './useGridwright';

/**
 * The assembled grid.
 *
 * Pass `data` for an array or `dataSource` for anything else; nothing else about the component
 * changes between the two. When the composed layout does not fit, drop to `useGridwright` plus
 * `<GridwrightProvider>` and place the same parts yourself -- this component is only their default
 * arrangement, with no privileged access to the engine.
 */
export function Gridwright<TRow>(props: GridwrightProps<TRow>) {
    // Two components rather than a conditional hook call: whichever one renders, its hook order is
    // the same on every render, which is the rule that matters.
    return props.instance ? (
        <GridwrightView {...props} instance={props.instance} />
    ) : (
        <GridwrightOwned {...props} />
    );
}

function GridwrightOwned<TRow>(props: GridwrightProps<TRow>) {
    const instance = useGridwright<TRow>(props);
    return <GridwrightView {...props} instance={instance} />;
}

function GridwrightView<TRow>({
    instance,
    className,
    classNames,
    labels,
    searchable = false,
    toolbar,
    footer,
    caption,
    hidePagination = false,
    pageSizeOptions,
    onRowClick,
    renderEmpty,
    renderLoading,
    renderError,
    'aria-label': ariaLabel,
}: GridwrightProps<TRow> & { instance: GridwrightInstance<TRow> }) {
    const showToolbar = searchable || toolbar !== undefined;

    return (
        <GridwrightProvider instance={instance} classNames={classNames} labels={labels}>
            <GridRoot className={className}>
                {showToolbar && <GridToolbar searchable={searchable}>{toolbar}</GridToolbar>}

                <GridTable caption={caption} aria-label={ariaLabel}>
                    <GridHeader />
                    <GridBody<TRow>
                        {...(onRowClick ? { onRowClick } : {})}
                        {...(renderEmpty ? { renderEmpty } : {})}
                        {...(renderLoading ? { renderLoading } : {})}
                        {...(renderError ? { renderError } : {})}
                    />
                </GridTable>

                {!hidePagination && (
                    <GridPagination {...(pageSizeOptions ? { pageSizeOptions } : {})} />
                )}
                {footer}
            </GridRoot>
        </GridwrightProvider>
    );
}

function GridRoot({ className, children }: { className?: string; children: React.ReactNode }) {
    const { classNames, state, labels } = useGridwrightContext();

    return (
        <div
            className={classes('gw-root', classNames.root, className)}
            data-status={state.status}
        >
            {/* A visually hidden live region: without it a screen reader gets no announcement at
                all when the rows change under a paginating grid. */}
            <span className="gw-visually-hidden" role="status" aria-live="polite">
                {state.status === 'loading' || state.status === 'refreshing' ? labels.loading : ''}
            </span>
            {children}
        </div>
    );
}

Gridwright.Root = GridRoot;
Gridwright.Toolbar = GridToolbar;
Gridwright.Table = GridTable;
Gridwright.Header = GridHeader;
Gridwright.Body = GridBody;
Gridwright.Pagination = GridPagination;
