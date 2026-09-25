/**
 * The entry point. The grid needs its stylesheet like any other install; the MUI package only sets
 * the variables that stylesheet reads. The theme lives in `App`, because the showcase changes it.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'apsw-gridwright/styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
