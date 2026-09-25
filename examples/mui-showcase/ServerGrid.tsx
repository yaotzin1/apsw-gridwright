import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';
import { Gridwright, columnFilters, coreAddons, exportMenu, search } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import type { LocaleCatalog } from 'apsw-gridwright';
import { muiAddons } from 'apsw-gridwright-mui';
import { DEPARTMENTS, employees, money } from './data';
import type { Employee } from './data';
import { createFakeServer, type ServerSettings } from './server';
import { coreOptions, type Settings } from './settings';

const columns: GridwrightColumn<Employee>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department', filter: { type: 'select', choices: DEPARTMENTS.map((value) => ({ value, label: value })) } },
    { id: 'city', header: 'City' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(Number(value)), filter: { type: 'number' } },
];

/**
 * The same grid over a server: every sort, filter, search and page is a request, answered after a
 * delay. What to watch: the loading state, "of many" when the server sends no total, and the
 * stale-rows notice when a refresh fails over rows that are still on screen.
 */
export function ServerGrid({ settings, locale }: { readonly settings: Settings; readonly locale: LocaleCatalog }) {
    const [server, setServer] = useState<ServerSettings>({ latency: 600, sendsTotal: true, failNext: false });
    // The source is created once and reads the switches through this ref on every request, so
    // changing a switch changes the server's behaviour without rebuilding the grid.
    const current = useRef(server);
    current.current = server;
    const [source] = useState(() => createFakeServer(() => employees, () => current.current));

    const update = (patch: Partial<ServerSettings>) => {
        setServer((previous) => ({ ...previous, ...patch }));
        // Take effect on the next request, which the refresh below makes now.
        current.current = { ...current.current, ...patch };
        source.invalidate();
    };

    return (
        <Stack spacing={2}>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                    select
                    size="small"
                    label="Latency"
                    value={server.latency}
                    onChange={(event) => update({ latency: Number(event.target.value) })}
                    sx={{ minWidth: 120 }}
                >
                    {[0, 600, 2000].map((ms) => (
                        <MenuItem key={ms} value={ms}>
                            {ms === 0 ? 'none' : `${ms} ms`}
                        </MenuItem>
                    ))}
                </TextField>
                <FormControlLabel
                    control={<Switch size="small" checked={server.sendsTotal} onChange={(_event, on) => update({ sendsTotal: on })} />}
                    label="Server sends a total"
                />
                <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    onClick={() => {
                        current.current = { ...current.current, failNext: true };
                        source.invalidate();
                    }}
                >
                    Fail the next request
                </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                Untick the total and the range reads "of many": the grid never computes a total from one page. Fail a request and
                the rows stay, under a notice that says they are no longer current.
            </Typography>
            <Gridwright<Employee>
                aria-label="Employees on the server"
                columns={columns}
                dataSource={source}
                pageSize={10}
                queryDebounceMs={250}
                selectionMode="multiple"
                locale={locale}
                coreAddons={settings.mui ? muiAddons<Employee>(coreOptions(settings)) : coreAddons<Employee>(coreOptions(settings))}
                addons={[search(), columnFilters(), exportMenu({ formats: ['csv', 'excel'], filename: 'employees-server' })]}
            />
        </Stack>
    );
}
