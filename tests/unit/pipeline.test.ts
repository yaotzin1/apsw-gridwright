import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../src/core/columns';
import { runPipeline, STAGE_ORDER } from '../../src/core/pipeline';
import { createQuery } from '../../src/core/query';
import type { DataSourceCapabilities, PipelineStage } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

const columns = resolveColumns<Person>([{ id: 'name' }, { id: 'salary' }]);

const context = (capabilities: Partial<DataSourceCapabilities> = {}) => ({
    query: createQuery(),
    columns,
    capabilities: { sort: false, filter: false, search: false, paginate: false, ...capabilities },
    totalRows: people.length,
});

const stage = (id: string, order: number, run: PipelineStage<Person>['run'], capability?: keyof DataSourceCapabilities): PipelineStage<Person> =>
    capability ? { id, order, capability, run } : { id, order, run };

describe('runPipeline', () => {
    it('runs stages in ascending order regardless of registration order', () => {
        const seen: string[] = [];
        const result = runPipeline<Person>({
            stages: [
                stage('late', STAGE_ORDER.PAGINATE, (rows) => {
                    seen.push('late');
                    return rows;
                }),
                stage('early', STAGE_ORDER.FILTER, (rows) => {
                    seen.push('early');
                    return rows;
                }),
            ],
            rows: people,
            context: context(),
        });

        expect(seen).toEqual(['early', 'late']);
        expect(result.rows).toHaveLength(people.length);
    });

    it('skips a stage whose capability the data source already resolves', () => {
        const run = vi.fn((rows: readonly Person[]) => rows);
        const result = runPipeline<Person>({
            stages: [stage('sort', STAGE_ORDER.SORT, run, 'sort')],
            rows: people,
            context: context({ sort: true }),
        });

        expect(run).not.toHaveBeenCalled();
        expect(result.skipped).toEqual(['sort']);
    });

    it('runs the same stage when the source does not resolve that capability', () => {
        const run = vi.fn((rows: readonly Person[]) => rows);
        runPipeline<Person>({
            stages: [stage('sort', STAGE_ORDER.SORT, run, 'sort')],
            rows: people,
            context: context({ sort: false }),
        });

        expect(run).toHaveBeenCalledOnce();
    });

    it('carries a total forward from the stage that narrowed the set', () => {
        const result = runPipeline<Person>({
            stages: [
                stage('filter', STAGE_ORDER.FILTER, (rows) => ({ rows: rows.slice(0, 3), totalRows: 3 })),
                stage('page', STAGE_ORDER.PAGINATE, (rows) => rows.slice(0, 2)),
            ],
            rows: people,
            context: context(),
        });

        expect(result.rows).toHaveLength(2);
        expect(result.totalRows).toBe(3);
    });

    it('isolates a throwing stage instead of emptying the grid', () => {
        const onStageError = vi.fn();
        const result = runPipeline<Person>({
            stages: [
                stage('broken', STAGE_ORDER.FILTER, () => {
                    throw new Error('plugin blew up');
                }),
                stage('page', STAGE_ORDER.PAGINATE, (rows) => rows.slice(0, 2)),
            ],
            rows: people,
            context: context(),
            onStageError,
        });

        // The broken stage loses its own effect; the rows still reach the reader.
        expect(onStageError).toHaveBeenCalledWith('broken', expect.any(Error));
        expect(result.rows).toHaveLength(2);
    });
});
