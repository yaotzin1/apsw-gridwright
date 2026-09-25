import type { ComponentType } from 'react';
import type * as GridwrightModule from '../../../src/react/Gridwright';
import { vi } from 'vitest';
import type { GridAddon } from 'apsw-gridwright/react';
import { muiAddons } from 'apsw-gridwright-mui';

/**
 * The grid's own accessibility and core add-on suites, run a second time with the MUI views.
 *
 * Not a copy: the suites below are imported and register here as they are. Every `<Gridwright />`
 * they render without a `coreAddons` of its own gets `muiAddons()` instead of the native set, so
 * each promise those suites make about sorting, selection, pagination and the live region is held
 * against the MUI views too. A test that passes its own `coreAddons` is configuring the native set
 * on purpose, and keeps it.
 */

const state = vi.hoisted(() => ({ coreAddons: null as null | (() => GridAddon<unknown>[]) }));

vi.mock('../../../src/react/Gridwright', async (importOriginal) => {
    const actual = await importOriginal<typeof GridwrightModule>();
    // Any props at all: the wrapper only fills in `coreAddons` and passes the rest through.
    const Original = actual.Gridwright as unknown as ComponentType<Record<string, unknown>>;
    function Gridwright(props: Record<string, unknown>) {
        const coreAddons = props.coreAddons === undefined && state.coreAddons ? state.coreAddons() : props.coreAddons;
        return <Original {...props} coreAddons={coreAddons} />;
    }
    return { ...actual, Gridwright };
});

state.coreAddons = () => muiAddons();

await import('../../../tests/react/accessible-state.test');
await import('../../../tests/react/gridwright.test');
await import('../../../tests/react/multi-column-sorting.test');
await import('../../../tests/react/selection-controls.test');
