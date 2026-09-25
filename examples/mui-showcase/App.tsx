import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider, useColorScheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { de, en, es, fr, pl } from 'apsw-gridwright/locales';
import { Controls } from './Controls';
import { EmployeesGrid } from './EmployeesGrid';
import { MillionGrid } from './MillionGrid';
import { ServerGrid } from './ServerGrid';
import { TreeGrid } from './TreeGrid';
import { INITIAL_SETTINGS, gridwrightSource, type Settings } from './settings';

const CATALOGS = { en, de, es, fr, pl };

const ACCENTS = [
    ['#7c3aed', 'Violet'],
    ['#1976d2', 'Blue'],
    ['#2e7d32', 'Green'],
    ['#c2410c', 'Orange'],
] as const;

/**
 * The theme is the application's, as it would be anywhere: CSS variables, both colour schemes, and
 * an accent the header can change. Change it and the grid follows, because `muiTheme()` reads the
 * theme rather than holding a copy of it.
 */
export function App() {
    const [accent, setAccent] = useState<string>(ACCENTS[0][0]);
    const theme = useMemo(
        () =>
            createTheme({
                cssVariables: { colorSchemeSelector: 'class' },
                colorSchemes: {
                    light: { palette: { primary: { main: accent } } },
                    dark: { palette: { primary: { main: accent } } },
                },
                shape: { borderRadius: 10 },
            }),
        [accent],
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Showcase accent={accent} setAccent={setAccent} />
        </ThemeProvider>
    );
}

type TabId = 'employees' | 'server' | 'tree' | 'million';

function Showcase({ accent, setAccent }: { accent: string; setAccent: (accent: string) => void }) {
    const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
    const [tab, setTab] = useState<TabId>('employees');
    const [message, setMessage] = useState<string | null>(null);
    const { mode, systemMode, setMode } = useColorScheme();
    // The scheme on screen: MUI starts in 'system', which follows the operating system.
    const dark = (mode === 'system' ? systemMode : mode) === 'dark';

    const update = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }));
    const locale = CATALOGS[settings.locale];

    return (
        <>
            <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
                    <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
                        apsw-gridwright <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>with MUI</Box>
                    </Typography>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={accent}
                        onChange={(_event, value: string | null) => value && setAccent(value)}
                        aria-label="Accent colour"
                    >
                        {ACCENTS.map(([value, label]) => (
                            <ToggleButton key={value} value={value} aria-label={label} title={label}>
                                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: value }} />
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <FormControlLabel control={<Switch checked={dark} onChange={(_event, on) => setMode(on ? 'dark' : 'light')} />} label="Dark" />
                </Toolbar>
            </AppBar>

            <Box
                sx={{
                    display: 'grid',
                    gap: 3,
                    p: { xs: 2, md: 3 },
                    gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' },
                    alignItems: 'start',
                    maxWidth: 1500,
                    mx: 'auto',
                }}
            >
                <Paper variant="outlined" sx={{ p: 2, position: { md: 'sticky' }, top: 16 }}>
                    <Controls settings={settings} update={update} />
                </Paper>

                <Box sx={{ minWidth: 0 }}>
                    <Tabs value={tab} onChange={(_event, value: TabId) => setTab(value)} variant="scrollable" sx={{ mb: 2 }}>
                        <Tab value="employees" label="Employees" />
                        <Tab value="server" label="Server" />
                        <Tab value="tree" label="Tree" />
                        <Tab value="million" label="10 million rows" />
                    </Tabs>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        {tab === 'employees' && <EmployeesGrid settings={settings} locale={locale} notify={setMessage} />}
                        {tab === 'server' && <ServerGrid settings={settings} locale={locale} />}
                        {tab === 'tree' && <TreeGrid settings={settings} locale={locale} notify={setMessage} />}
                        {tab === 'million' && <MillionGrid settings={settings} locale={locale} />}
                    </Paper>

                    {tab === 'employees' && (
                        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                            <Typography variant="overline" component="h2">
                                The grid above, as code
                            </Typography>
                            <Box component="pre" sx={{ m: 0, overflowX: 'auto', fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>
                                {gridwrightSource(settings)}
                            </Box>
                        </Paper>
                    )}
                </Box>
            </Box>

            <Snackbar
                open={message !== null}
                autoHideDuration={3000}
                onClose={() => setMessage(null)}
                message={message}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            />
        </>
    );
}
