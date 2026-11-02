import type { ReactElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterAll, describe, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { virtualColumns, virtualRows } from '../../src/react/virtual';
import type { GridwrightColumn } from '../../src/react/types';

/**
 * The baseline AC-11 of specs/adapter-architecture compares against: mount and one state change on
 * the two fixtures performance.md names. Prints the median of several runs in milliseconds.
 * A change is judged against the same command on the same machine, never against a number
 * recorded on another one.
 */
type Row = readonly number[];
const RUNS = 11;
// The first runs are slow while the engine optimises the render path; a median taken across that
// transition moves by a factor of two between identical builds, so they are not counted.
const WARM_UP = 5;
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const report: string[] = [];

const columnsOf = (count: number): GridwrightColumn<Row>[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `c${index}`,
        header: `Column ${index}`,
        accessor: (row: Row) => row[index],
        width: 120,
    }));
const rowsOf = (rows: number, columns: number): Row[] =>
    Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => r * 1_000 + c));

async function measure(label: string, build: () => ReactElement, change: () => Promise<void>): Promise<void> {
    const mount: number[] = [];
    const update: number[] = [];
    for (let run = 0; run < WARM_UP + RUNS; run += 1) {
        const started = performance.now();
        render(build());
        const mounted = performance.now();
        await change();
        const changed = performance.now();
        cleanup();
        if (run >= WARM_UP) {
            mount.push(mounted - started);
            update.push(changed - mounted);
        }
    }
    report.push(`${label.padEnd(44)} mount ${median(mount).toFixed(1).padStart(8)} ms   change ${median(update).toFixed(1).padStart(8)} ms`);
}

const sortFirstHeader = async (): Promise<void> => {
    const button = document.querySelector<HTMLButtonElement>('thead th button');
    await act(async () => button?.click());
};

describe('render baseline', () => {
    afterAll(() => {
        process.stdout.write(`\nrender baseline, median of ${RUNS} runs\n${report.join('\n')}\n\n`);
    });

    it('10 000 rows x 12 columns, 50 per page, then a sort', async () => {
        const columns = columnsOf(12);
        const data = rowsOf(10_000, 12);
        await measure('10 000 rows x 12 cols (paged 50)', () => <Gridwright<Row> columns={columns} data={data} pageSize={50} />, sortFirstHeader);
    });

    it('10 000 rows x 12 columns with virtualRows, then a sort', async () => {
        const columns = columnsOf(12);
        const data = rowsOf(10_000, 12);
        await measure(
            '10 000 rows x 12 cols (virtualRows)',
            () => <Gridwright<Row> columns={columns} data={data} pageSize={10_000} addons={[virtualRows<Row>()]} />,
            sortFirstHeader,
        );
    });

    it('100 rows x 500 columns with virtualColumns, then a sort', async () => {
        const columns = columnsOf(500);
        const data = rowsOf(100, 500);
        await measure(
            '100 rows x 500 cols (virtualColumns)',
            () => <Gridwright<Row> columns={columns} data={data} pageSize={100} addons={[virtualColumns<Row>()]} />,
            sortFirstHeader,
        );
    });
});
