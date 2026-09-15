import { GridwrightProvider } from './context';
import { GridBody } from './parts/GridBody';
import { GridHeader } from './parts/GridHeader';
import { GridRoot } from './parts/GridRoot';
import { GridSlot } from './parts/slots';
import { GridTable } from './parts/GridTable';
import { GridToolbar } from './parts/GridToolbar';
import type { GridwrightInstance, GridwrightProps } from './types';
import { addonNamesOf, useGridwright } from './useGridwright';

/**
 * The grid.
 *
 * A shell: a table, its rows and cells, the status rows and one live region. Every feature is an
 * add-on, including the ones on by default, and each reaches the grid through the same public
 * contract a third-party add-on uses:
 *
 *     <Gridwright
 *         columns={columns}
 *         data={rows}
 *         addons={[search(), columnFilters(), exportMenu(), rowActions({ items })]}
 *     />
 *
 * `coreAddons()` (sorting, selection, pagination, the stale-rows notice) is the default for
 * `coreAddons`; pass your own list to change one of them, or `false` for a bare table.
 */
export function Gridwright<TRow>(props: GridwrightProps<TRow>) {
    if (props.instance) return <GridwrightView {...props} instance={props.instance} />;
    // Keyed on the add-on names: each add-on calls hooks, so a different list is a different grid,
    // and remounting is what React requires of a component whose hooks change.
    return <OwnedGrid key={addonNamesOf(props)} {...props} />;
}

function OwnedGrid<TRow>(props: GridwrightProps<TRow>) {
    const instance = useGridwright<TRow>(props);
    return <GridwrightView {...props} instance={instance} />;
}

function GridwrightView<TRow>({
    instance,
    className,
    classNames,
    locale,
    messages,
    translate,
    labels,
    toolbar,
    footer,
    caption,
    onRowClick,
    'aria-label': ariaLabel,
}: GridwrightProps<TRow> & { instance: GridwrightInstance<TRow> }) {
    return (
        <GridwrightProvider
            instance={instance}
            classNames={classNames}
            {...(onRowClick ? { onRowClick } : {})}
            {...(locale !== undefined ? { locale } : {})}
            {...(messages ? { messages } : {})}
            {...(translate ? { translate } : {})}
            {...(labels ? { labels } : {})}
        >
            <GridRoot className={className}>
                <GridToolbar>{toolbar}</GridToolbar>
                {/* Above the table, so warning about the rows does not move them. */}
                <GridSlot name="aboveTable" />
                <GridTable caption={caption} aria-label={ariaLabel}>
                    <GridHeader />
                    <GridBody />
                </GridTable>
                <GridSlot name="belowTable" />
                {footer}
            </GridRoot>
        </GridwrightProvider>
    );
}

Gridwright.Root = GridRoot;
Gridwright.Toolbar = GridToolbar;
Gridwright.Table = GridTable;
Gridwright.Header = GridHeader;
Gridwright.Body = GridBody;
Gridwright.Slot = GridSlot;
