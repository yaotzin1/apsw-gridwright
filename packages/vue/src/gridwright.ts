import { defineComponent, h, nextTick, onMounted, onScopeDispose, onUpdated, shallowRef, watch } from 'vue';
import type { DefineComponent, PropType, VNodeChild } from 'vue';
import { createLocalDataSource } from '@apsw/gridwright';
import type { ColumnDef, DataSource, GridQuery, LocalDataSource, RowId, SelectionMode } from '@apsw/gridwright';
import type { TranslatorOptions } from '@apsw/gridwright';
import { createGridHost, orderAddons, slot, sorting, tableNode } from '@apsw/gridwright/view';
import type { GridHost, GridHostOptions, OptionalAddon, TableModel, ViewAction, ViewAddon, ViewLabels } from '@apsw/gridwright/view';
import { columnSignature } from './column-signature';
import { buildElementProps, renderViewNode } from './render-node';
import type { RenderViewNodeOptions, VueComponentRenderer } from './render-node';

export interface CellRenderContext<TRow, TValue = unknown> {
    readonly value: TValue;
    readonly row: TRow;
    readonly rowIndex: number;
    readonly column: ColumnDef<TRow, TValue>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GridwrightColumn<TRow, TValue = any> extends ColumnDef<TRow, TValue> {
    readonly render?: (context: CellRenderContext<TRow, TValue>) => VNodeChild;
}

export interface GridwrightProps<TRow = Record<string, unknown>> {
    readonly columns: readonly GridwrightColumn<TRow>[];
    readonly data?: readonly TRow[];
    readonly dataSource?: DataSource<TRow>;
    readonly getRowId?: (row: TRow, index: number) => RowId;
    readonly pageSize?: number;
    readonly initialQuery?: Partial<GridQuery>;
    readonly selectionMode?: SelectionMode;
    readonly addons?: readonly OptionalAddon<ViewAddon<TRow>>[];
    readonly coreAddons?: readonly OptionalAddon<ViewAddon<TRow>>[] | false;
    readonly i18n?: TranslatorOptions;
    readonly labels?: Partial<ViewLabels>;
    readonly caption?: string;
    readonly ariaLabel?: string;
    readonly components?: Readonly<Record<string, VueComponentRenderer>>;
}

function renderCustomTable<TRow>(
    model: TableModel<TRow>,
    host: GridHost<TRow>,
    columnsById: ReadonlyMap<string, GridwrightColumn<TRow>>,
    slots: Readonly<Record<string, ((props?: unknown) => VNodeChild) | undefined>>,
    nodeOptions: RenderViewNodeOptions,
): VNodeChild {
    const state = host.api.getState();
    const resolvedById = new Map(host.api.getColumns().map((col) => [col.id, col]));
    const defaultCellSlot = Object.hasOwn(slots, 'cell') ? slots.cell : undefined;

    const header = h(
        'thead',
        { class: 'gw-thead' },
        h(
            'tr',
            buildElementProps(model.header.attrs, undefined, undefined, nodeOptions),
            model.header.cells.map((cell) =>
                h('th', buildElementProps(cell.attrs, undefined, cell.id, nodeOptions), [renderViewNode(cell.label, nodeOptions)]),
            ),
        ),
    );

    const body =
        model.body.kind === 'status'
            ? h(
                  'tbody',
                  { class: 'gw-tbody' },
                  h(
                      'tr',
                      { class: 'gw-status-row' },
                      h('td', { colspan: model.body.colSpan, class: 'gw-status' }, [renderViewNode(model.body.content, nodeOptions)]),
                  ),
              )
            : h(
                  'tbody',
                  { class: 'gw-tbody', 'aria-busy': model.body.busy },
                  Array.from({ length: model.body.rowCount }, (_, index) => {
                      const rowModel = (model.body as Extract<TableModel<TRow>['body'], { kind: 'rows' }>).row(index);
                      const gridRow = state.rows[index];
                      return h(
                          'tr',
                          buildElementProps(rowModel.attrs, rowModel.handlers, rowModel.id, nodeOptions),
                          rowModel.cells.map((cell) => {
                              const column = columnsById.get(cell.columnId);
                              const resolved = resolvedById.get(cell.columnId);
                              const namedSlotName = `cell-${cell.columnId}`;
                              const columnSlot = Object.hasOwn(slots, namedSlotName) ? slots[namedSlotName] : undefined;
                              let content: VNodeChild;
                              if (column && resolved && gridRow && (column.render || columnSlot || defaultCellSlot)) {
                                  const ctx: CellRenderContext<TRow> = {
                                      value: resolved.getValue(gridRow.data),
                                      row: gridRow.data,
                                      rowIndex: gridRow.index,
                                      column,
                                  };
                                  content = column.render ? column.render(ctx) : columnSlot ? columnSlot(ctx) : defaultCellSlot!(ctx);
                              } else {
                                  content = renderViewNode(cell.content, nodeOptions);
                              }
                              return h('td', buildElementProps(cell.attrs, undefined, cell.columnId, nodeOptions), [content]);
                          }),
                      );
                  }),
              );

    return h('div', buildElementProps(model.root, undefined, undefined, nodeOptions), [
        h('span', { class: 'gw-visually-hidden', role: 'status', 'aria-live': 'polite' }, model.live),
        model.toolbar
            ? h('div', { class: 'gw-toolbar' }, [
                  model.toolbar.status ? renderViewNode(model.toolbar.status, nodeOptions) : null,
                  renderViewNode(model.toolbar.content, nodeOptions),
              ])
            : null,
        h(
            'div',
            { class: 'gw-table-wrapper' },
            h('table', buildElementProps(model.table, model.tableHandlers, undefined, nodeOptions), [
                model.caption ? h('caption', { class: 'gw-caption' }, model.caption) : null,
                header,
                body,
            ]),
        ),
        model.belowTable ? renderViewNode(model.belowTable, nodeOptions) : null,
    ]);
}

export interface GridwrightSlots<TRow = Record<string, unknown>> {
    toolbar?: () => VNodeChild;
    cell?: (context: CellRenderContext<TRow>) => VNodeChild;
    [key: `cell-${string}`]: ((context: CellRenderContext<TRow>) => VNodeChild) | undefined;
}

/**
 * Vue 3 `<Gridwright />` component: renders the framework-neutral `TableModel` and `ViewNode` tree
 * with support for `GridwrightColumn.render` and `#cell`, `#cell-<columnId>`, and `#toolbar` slots.
 */
const GridwrightImpl = defineComponent({
    name: 'Gridwright',
    props: {
        columns: { type: Array as PropType<readonly GridwrightColumn<Record<string, unknown>>[]>, required: true },
        data: { type: Array as PropType<readonly Record<string, unknown>[]>, default: undefined },
        dataSource: { type: Object as PropType<DataSource<Record<string, unknown>>>, default: undefined },
        getRowId: { type: Function as PropType<(row: Record<string, unknown>, index: number) => RowId>, default: undefined },
        pageSize: { type: Number, default: undefined },
        initialQuery: { type: Object as PropType<Partial<GridQuery>>, default: undefined },
        selectionMode: { type: String as PropType<SelectionMode>, default: undefined },
        addons: { type: Array as PropType<readonly OptionalAddon<ViewAddon<Record<string, unknown>>>[]>, default: undefined },
        coreAddons: { type: [Array, Boolean] as PropType<readonly OptionalAddon<ViewAddon<Record<string, unknown>>>[] | false>, default: undefined },
        i18n: { type: Object as PropType<TranslatorOptions>, default: undefined },
        labels: { type: Object as PropType<Partial<ViewLabels>>, default: undefined },
        caption: { type: String, default: undefined },
        ariaLabel: { type: String, default: undefined },
        components: { type: Object as PropType<Readonly<Record<string, VueComponentRenderer>>>, default: undefined },
    },
    setup(props, { slots }) {
        const keyedElements = new Map<string, HTMLElement>();
        const registerFocusKey = (key: string, el: Element | null): void => {
            if (el instanceof HTMLElement) keyedElements.set(key, el);
            else keyedElements.delete(key);
        };
        const focusByKey = (key: string): void => {
            keyedElements.get(key)?.focus();
        };

        const buildHostOptions = (): GridHostOptions<Record<string, unknown>> => ({
            columns: props.columns,
            ...(props.data !== undefined ? { data: props.data } : {}),
            ...(props.dataSource !== undefined ? { dataSource: props.dataSource } : {}),
            ...(props.getRowId !== undefined ? { getRowId: props.getRowId } : {}),
            ...(props.pageSize !== undefined ? { pageSize: props.pageSize } : {}),
            ...(props.initialQuery !== undefined ? { initialQuery: props.initialQuery } : {}),
            ...(props.selectionMode !== undefined ? { selectionMode: props.selectionMode } : {}),
            ...(props.addons !== undefined ? { addons: props.addons } : {}),
            ...(props.coreAddons !== undefined ? { coreAddons: props.coreAddons } : {}),
            ...(props.i18n !== undefined ? { i18n: props.i18n } : {}),
            ...(props.labels !== undefined ? { labels: props.labels } : {}),
            ...(props.caption !== undefined ? { caption: props.caption } : {}),
            ...(props.ariaLabel !== undefined ? { ariaLabel: props.ariaLabel } : {}),
            ...(slots.toolbar ? { toolbar: slot('toolbar') } : {}),
        });

        let host = createGridHost<Record<string, unknown>>(buildHostOptions());
        const model = shallowRef<TableModel<Record<string, unknown>>>(host.getModel());
        let unsubscribe = host.subscribe(() => {
            model.value = host.getModel();
        });

        // The in-memory source this component swapped in after mount. The host owns the one it
        // built itself; a `dataSource` the caller passed belongs to the caller and is never disposed here.
        let swappedLocal: LocalDataSource<Record<string, unknown>> | null = null;
        // What the current host was built from, so a rebuild is not followed by a redundant refetch.
        let sourcedFrom: { data: unknown; dataSource: unknown } = { data: props.data, dataSource: props.dataSource };

        const flushFocusRequest = (): void => {
            const key = host.takeFocusRequest();
            if (key !== null) {
                void nextTick(() => focusByKey(key));
            }
        };

        onMounted(flushFocusRequest);
        onUpdated(flushFocusRequest);

        // Options the host bakes in at creation: changing one needs a new host, and that loses the
        // query. Compared by value, so an inline `:labels="{...}"` does not rebuild on every parent render.
        const rebuildKey = (): string =>
            JSON.stringify([
                orderAddons<ViewAddon<Record<string, unknown>>>(props.coreAddons, () => [sorting<Record<string, unknown>>()], props.addons).map(
                    (addon) => addon.name,
                ),
                props.selectionMode ?? null,
                props.pageSize ?? null,
                props.caption ?? null,
                props.ariaLabel ?? null,
                props.labels ?? null,
                props.i18n ?? null,
            ]);

        watch(rebuildKey, () => {
            unsubscribe();
            host.destroy();
            swappedLocal?.dispose?.();
            swappedLocal = null;
            sourcedFrom = { data: props.data, dataSource: props.dataSource };
            host = createGridHost<Record<string, unknown>>(buildHostOptions());
            model.value = host.getModel();
            unsubscribe = host.subscribe(() => {
                model.value = host.getModel();
            });
        });

        // Columns reach the live engine, and only when what it reads changed.
        watch(
            () => columnSignature(props.columns),
            () => host.api.setColumns(props.columns),
        );

        // New rows or a new source reach the live engine and keep the query, so sort and page survive.
        watch([() => props.data, () => props.dataSource], ([data, dataSource]) => {
            if (data === sourcedFrom.data && dataSource === sourcedFrom.dataSource) return;
            if (data !== undefined && dataSource !== undefined) {
                throw new Error('[gridwright] pass either `data` for an in-memory array or `dataSource` for anything else, not both.');
            }
            sourcedFrom = { data, dataSource };
            const previous = swappedLocal;
            if (dataSource !== undefined) {
                swappedLocal = null;
                host.api.setDataSource(dataSource);
            } else {
                swappedLocal = createLocalDataSource<Record<string, unknown>>([...(data ?? [])]);
                host.api.setDataSource(swappedLocal);
            }
            previous?.dispose?.();
        });

        onScopeDispose(() => {
            unsubscribe();
            host.destroy();
            swappedLocal?.dispose?.();
            keyedElements.clear();
        });

        return () => {
            const currentModel = model.value;
            const nodeOptions: RenderViewNodeOptions = {
                slots: slots as Readonly<Record<string, (() => VNodeChild) | undefined>>,
                ...(props.components ? { components: props.components } : {}),
                registerFocusKey,
                onAction: (action: ViewAction) => {
                    if (action.type === 'focus') focusByKey(action.key);
                },
            };

            const hasCustomColumnRender = props.columns.some((col) => typeof col.render === 'function');
            const hasCellSlot = Object.keys(slots).some((name) => name === 'cell' || name.startsWith('cell-'));

            if (!hasCustomColumnRender && !hasCellSlot) {
                return renderViewNode(tableNode(currentModel), nodeOptions);
            }

            const columnsById = new Map(props.columns.map((col) => [col.id, col]));
            return renderCustomTable(
                currentModel,
                host,
                columnsById,
                slots as Readonly<Record<string, ((props?: unknown) => VNodeChild) | undefined>>,
                nodeOptions,
            );
        };
    },
});

// Vue's `h(Component, props)` cannot infer a generic component's type parameter through its
// `FunctionalComponent<P>` overload, so the runtime component accepts any row type while
// `GridwrightProps<TRow>`, `GridwrightColumn<TRow>`, and `useGridwright<TRow>` remain generic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Gridwright = GridwrightImpl as unknown as DefineComponent<GridwrightProps<any>>;
