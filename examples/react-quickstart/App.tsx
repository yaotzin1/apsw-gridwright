/**
 * The step switcher. Nothing here is about the grid: it picks one step's component and shows the
 * file it lives in, so you can read the source beside what it renders.
 *
 * Read the steps in order. Each one is a complete, copyable component.
 *
 * The step is kept in `?step=`, so a reload stays on it. Step 3's grid writes its own parameters
 * beside that one and leaves `step` alone.
 */
import { useState } from 'react';
import { FirstGrid } from './steps/01-first-grid';
import { FormattedColumns } from './steps/02-columns';
import { WithAddons } from './steps/03-add-ons';
import { SelectionAndActions } from './steps/04-selection';
import { ExpandableRows } from './steps/05-expandable-rows';
import { RemoteData } from './steps/06-remote-data';

const STEPS = [
    {
        file: 'steps/01-first-grid.tsx',
        title: '1. A grid',
        blurb: 'Two props and a list of columns. Sorting, paging, the empty state and a live region come with it.',
        render: () => <FirstGrid />,
    },
    {
        file: 'steps/02-columns.tsx',
        title: '2. Columns',
        blurb: '`formatValue` for text, `cell` for React, `icon` per row, `accessor` for a value that is not a property.',
        render: () => <FormattedColumns />,
    },
    {
        file: 'steps/03-add-ons.tsx',
        title: '3. Add-ons',
        blurb: 'Search, column filters, export and the view in the URL are entries in `addons`. The core four are configurable, not fixed.',
        render: () => <WithAddons />,
    },
    {
        file: 'steps/04-selection.tsx',
        title: '4. Selection and actions',
        blurb: 'Selection is engine state; the checkboxes are one add-on’s view of it. Row actions float over the row.',
        render: () => <SelectionAndActions />,
    },
    {
        file: 'steps/05-expandable-rows.tsx',
        title: '5. Expandable rows',
        blurb: 'A panel under a row, holding a second grid. Rendered only while open, and never counted as a grid row.',
        render: () => <ExpandableRows />,
    },
    {
        file: 'steps/06-remote-data.tsx',
        title: '6. Remote data',
        blurb: 'The same grid over a server. One prop changes; the columns and add-ons do not.',
        render: () => <RemoteData />,
    },
] as const;

function stepFromUrl(): number {
    const index = Number(new URLSearchParams(window.location.search).get('step')) - 1;
    return Number.isInteger(index) && index >= 0 && index < STEPS.length ? index : 0;
}

export function App() {
    const [index, setIndex] = useState(stepFromUrl);
    const step = STEPS[index]!;

    // A new step is a new grid, so the previous grid's parameters are dropped with it.
    const choose = (next: number) => {
        setIndex(next);
        window.history.replaceState(window.history.state, '', `?step=${next + 1}`);
    };

    return (
        <main className="page">
            <header className="stack">
                <h1>apsw-gridwright — step by step</h1>
                <p className="muted">
                    Six steps from an array to a server. Open <code>examples/react-quickstart/{step.file}</code> beside this
                    page; the comment at the top of each file explains why it is written that way.
                </p>
            </header>

            <nav className="row" aria-label="Steps">
                {STEPS.map((candidate, candidateIndex) => (
                    <button
                        key={candidate.file}
                        type="button"
                        onClick={() => choose(candidateIndex)}
                        aria-current={candidateIndex === index ? 'step' : undefined}
                        className={candidateIndex === index ? 'step-button is-current' : 'step-button'}
                    >
                        {candidate.title}
                    </button>
                ))}
            </nav>

            <section className="panel stack" aria-labelledby="step-title">
                <div className="stack">
                    <h2 id="step-title">{step.title}</h2>
                    <p className="muted">{step.blurb}</p>
                    <code className="muted">examples/react-quickstart/{step.file}</code>
                </div>

                {/* Keyed, so switching steps mounts a fresh grid rather than reconciling two
                    different ones into each other. */}
                <div key={step.file}>{step.render()}</div>
            </section>
        </main>
    );
}
