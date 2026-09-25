/**
 * The entry point: an ordinary MUI app. The grid needs its stylesheet like any other install; the
 * MUI package only sets the variables that stylesheet reads.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'apsw-gridwright/styles.css';
import { App } from './App';

// CSS variables and both colour schemes, so the dark-mode switch restyles the grid without
// re-rendering it: `muiTheme()` writes `var(--mui-...)` references for a theme like this one.
const theme = createTheme({
    cssVariables: { colorSchemeSelector: 'class' },
    colorSchemes: { light: true, dark: true },
    palette: { primary: { main: '#7c3aed' } },
    shape: { borderRadius: 10 },
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    </StrictMode>,
);
