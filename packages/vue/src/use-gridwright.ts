import { onScopeDispose, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import type { GridApi } from '@apsw/gridwright';
import { createGridHost } from '@apsw/gridwright/view';
import type { GridHost, GridHostOptions, TableModel, ViewNode } from '@apsw/gridwright/view';

export interface UseGridwrightOptions<TRow> extends Omit<GridHostOptions<TRow>, 'toolbar'> {
    readonly toolbar?: ViewNode;
}

export interface UseGridwrightReturn<TRow> {
    readonly host: GridHost<TRow>;
    readonly api: GridApi<TRow>;
    readonly model: ShallowRef<TableModel<TRow>>;
    readonly takeFocusRequest: () => string | null;
}

/**
 * Creates and manages a `GridHost` inside a Vue component or effect scope, keeping `model`
 * synchronized in a `ShallowRef` and destroying the host on scope disposal.
 */
export function useGridwright<TRow>(options: UseGridwrightOptions<TRow>): UseGridwrightReturn<TRow> {
    const host = createGridHost<TRow>(options);
    const model = shallowRef<TableModel<TRow>>(host.getModel());
    const unsubscribe = host.subscribe(() => {
        model.value = host.getModel();
    });

    onScopeDispose(() => {
        unsubscribe();
        host.destroy();
    });

    return {
        host,
        api: host.api,
        model,
        takeFocusRequest: () => host.takeFocusRequest(),
    };
}
