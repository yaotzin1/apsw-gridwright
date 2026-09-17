/**
 * The entry point. In your own project this is whatever `createRoot` call you already have.
 *
 * The one line that matters for the grid is the stylesheet import: the package ships structural CSS
 * driven entirely by custom properties, and without it the table renders unstyled.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'apsw-gridwright/styles.css';
import './quickstart.css';
import { App } from './App';

// Strict Mode is on deliberately: it mounts every component twice in development, which is exactly
// the condition a grid holding an engine has to survive. It does.
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
