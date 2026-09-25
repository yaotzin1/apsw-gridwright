import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { useState } from 'react';
import { Gridwright, coreAddons, search } from 'apsw-gridwright/react';
import type { GridwrightColumn } from 'apsw-gridwright/react';
import { muiAddons } from 'apsw-gridwright-mui';
import { day, money, people } from '../react-quickstart/data';
import type { Person } from '../react-quickstart/data';

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200 },
    { id: 'department', header: 'Department' },
    { id: 'title', header: 'Job title' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(Number(value)) },
    { id: 'startedOn', header: 'Started', formatValue: (value) => day.format(new Date(String(value))) },
];

/**
 * The same grid twice over, as one switch: the native core add-ons, or `muiAddons()`.
 *
 * Everything else about the grid is one line either way. The switches around it are MUI's own, so
 * the grid can be compared with the components it has to sit beside.
 */
export function App() {
    const [mui, setMui] = useState(true);
    const [rowClick, setRowClick] = useState(false);
    const { mode, systemMode, setMode } = useColorScheme();
    // The scheme on screen: MUI starts in 'system', which follows the operating system.
    const dark = (mode === 'system' ? systemMode : mode) === 'dark';

    const options = { selection: { selectOnRowClick: rowClick } };

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, sm: 4 } }}>
            <Typography variant="h5" component="h1" gutterBottom>
                apsw-gridwright with MUI
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                One prop: <code>coreAddons={'{'}muiAddons(){'}'}</code>. Shift-click a second header to sort within the first.
            </Typography>

            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
                <FormControlLabel control={<Switch checked={mui} onChange={(_event, on) => setMui(on)} />} label="MUI views" />
                <FormControlLabel control={<Switch checked={dark} onChange={(_event, on) => setMode(on ? 'dark' : 'light')} />} label="Dark mode" />
                <FormControlLabel
                    control={<Switch checked={rowClick} onChange={(_event, on) => setRowClick(on)} />}
                    label="Select on row click"
                />
            </Stack>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Gridwright<Person>
                    aria-label="People"
                    columns={columns}
                    data={people}
                    pageSize={10}
                    selectionMode="multiple"
                    coreAddons={mui ? muiAddons<Person>(options) : coreAddons<Person>(options)}
                    addons={[search()]}
                />
            </Paper>
        </Box>
    );
}
