import type { DataSourceCapabilities, PipelineContext, PipelineStage } from './types';

/** Conventional slots, so third-party stages can position themselves without reading the source. */
export const STAGE_ORDER = {
    /** Before anything else sees the rows. */
    PRE: 0,
    FILTER: 100,
    SEARCH: 200,
    SORT: 300,
    /** After sorting, before pagination: grouping, aggregation, injected summary rows. */
    TRANSFORM: 500,
    PAGINATE: 900,
    /** After the page is cut. Decoration only; anything here cannot change the total. */
    POST: 1000,
} as const;

export interface PipelineRunResult<TRow> {
    readonly rows: readonly TRow[];
    readonly totalRows: number;
    /** Stage ids that were skipped because the data source already resolved that facet. */
    readonly skipped: readonly string[];
}

export interface PipelineRunOptions<TRow> {
    readonly stages: readonly PipelineStage<TRow>[];
    readonly rows: readonly TRow[];
    readonly context: Omit<PipelineContext<TRow>, 'totalRows'> & { totalRows: number };
    readonly onStageError?: (stageId: string, error: unknown) => void;
}

/**
 * Runs the in-memory stages between the data source and the rendered rows.
 *
 * The skip rule is the local/remote seam. A stage declares the capability it implements, and it is
 * skipped whenever the source reports that capability, so the same registered stage set serves an
 * in-memory array (which resolves nothing) and a SQL-backed endpoint (which resolves everything).
 * Nothing above the pipeline branches on where the rows came from.
 */
export function runPipeline<TRow>(options: PipelineRunOptions<TRow>): PipelineRunResult<TRow> {
    const ordered = [...options.stages].sort((a, b) => a.order - b.order);
    const skipped: string[] = [];

    let rows = options.rows;
    let totalRows = options.context.totalRows;

    for (const stage of ordered) {
        if (stage.capability && isResolvedBySource(options.context.capabilities, stage.capability)) {
            skipped.push(stage.id);
            continue;
        }

        const context: PipelineContext<TRow> = {
            query: options.context.query,
            columns: options.context.columns,
            capabilities: options.context.capabilities,
            totalRows,
        };

        try {
            const output = stage.run(rows, context);
            if (Array.isArray(output)) {
                rows = output as readonly TRow[];
            } else {
                const structured = output as { rows: readonly TRow[]; totalRows?: number };
                rows = structured.rows;
                if (typeof structured.totalRows === 'number') {
                    totalRows = structured.totalRows;
                }
            }
        } catch (error) {
            // A stage is plugin code. One that throws loses its own effect; it does not get to
            // empty the grid and make the data source look broken.
            options.onStageError?.(stage.id, error);
        }
    }

    return { rows, totalRows, skipped };
}

function isResolvedBySource(
    capabilities: DataSourceCapabilities,
    capability: keyof DataSourceCapabilities,
): boolean {
    return capabilities[capability] === true;
}
