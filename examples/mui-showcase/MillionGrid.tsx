import Skeleton from '@mui/material/Skeleton';
import { useState } from 'react';
import { createWindowedDataSource } from 'apsw-gridwright';
import type { LocaleCatalog } from 'apsw-gridwright';
import { Gridwright, coreAddons, virtualRows } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { muiAddons } from 'apsw-gridwright-mui';
import { READINGS_TOTAL, readingAt } from './data';
import type { Reading } from './data';
import { coreOptions, type Settings } from './settings';

// The fake server cannot sort ten million rows it computes on demand, so the columns say so rather
// than showing sort buttons that would do nothing.
const columns: GridwrightColumn<Reading>[] = [
    { id: 'id', header: '#', align: 'end', sortable: false, filterable: false },
    { id: 'sensor', header: 'Sensor', sortable: false, filterable: false },
    { id: 'value', header: 'Value', align: 'end', sortable: false, filterable: false },
    { id: 'at', header: 'Recorded at', sortable: false, filterable: false },
];

/**
 * Ten million rows. The source holds a window of blocks, not the table, and `virtualRows()` renders
 * only the rows on screen: the browser holds a few thousand rows however far you scroll.
 */
export function MillionGrid({ settings, locale }: { readonly settings: Settings; readonly locale: LocaleCatalog }) {
    const [source] = useState(() =>
        createWindowedDataSource<Reading>({
            blockSize: 200,
            maxBlocks: 12,
            fetchRange: async ({ offset, limit }) => {
                await new Promise((resolve) => setTimeout(resolve, 120));
                const end = Math.min(offset + limit, READINGS_TOTAL);
                return { rows: Array.from({ length: end - offset }, (_, at) => readingAt(offset + at)), totalRows: READINGS_TOTAL };
            },
        }),
    );

    return (
        <Gridwright<Reading>
            aria-label="Sensor readings"
            columns={columns}
            dataSource={source}
            getRowId={(row) => row.id}
            pageSize={200}
            locale={locale}
            coreAddons={settings.mui ? muiAddons<Reading>(coreOptions(settings)) : coreAddons<Reading>(coreOptions(settings))}
            addons={[
                virtualRows<Reading>({
                    rowHeight: 40,
                    height: 520,
                    // While a block is on its way: MUI's skeleton, in the theme.
                    renderSkeleton: () => <Skeleton variant="text" width="60%" />,
                }),
            ]}
        />
    );
}
