import type { SyntheticEvent } from 'react';
import { viewEvent } from '../../view/event';
import type { ViewEvent, ViewEventOrigin } from '../../view/event';
import { cellControlOf } from '../navigation/cell-control';

/**
 * What a click inside a row operates instead of selecting the row. A button in a cell is the reader
 * asking for that button, not for the row.
 */
const CONTROL_SELECTOR =
    'button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="switch"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])';

/**
 * Answers the questions of a `ViewEventOrigin` from the element the handler is on and the element the
 * event started at. This is the one place in the adapter that walks the tree on behalf of a neutral
 * add-on; the add-on sees booleans and ids.
 *
 * "This grid's own table" is the nearest table around the handler's element, so a grid nested in a
 * detail row is another grid's, and its rows and cells are not ours.
 */
export function originOf(currentTarget: Element | null, target: Element | null): ViewEventOrigin {
    const ownTable = currentTarget?.closest('table') ?? null;

    const cellElement = target?.closest('td') ?? null;
    const rowElement = cellElement?.closest('tr') ?? null;
    const rowId = rowElement?.getAttribute('data-row-id') ?? null;
    const cell =
        cellElement !== null && ownTable !== null && cellElement.closest('table') === ownTable && rowId !== null
            ? {
                  rowId,
                  columnId: cellElement.getAttribute('data-column-id') ?? '',
                  holdsControl: cellControlOf(cellElement) !== null,
                  targetIsCell: target === cellElement,
              }
            : undefined;

    const control = target?.closest(CONTROL_SELECTOR) ?? null;
    const fromControl = control !== null && currentTarget !== null && currentTarget.contains(control);

    // Only a row handler can be fooled by a nested grid: a table-level handler reads `cell`, which already excludes it.
    const fromNestedGrid = currentTarget?.tagName === 'TR' && target !== null && target.closest('tr') !== currentTarget;

    const selection = currentTarget?.ownerDocument.getSelection() ?? null;
    const textSelected =
        selection !== null && !selection.isCollapsed && selection.anchorNode !== null && currentTarget !== null && currentTarget.contains(selection.anchorNode);

    return { ...(cell ? { cell } : {}), fromControl, fromNestedGrid, textSelected };
}

/**
 * A `ViewEvent` from what React hands a handler. Reads the fields a description may use, and no more;
 * `origin` is computed the first time something asks for it, because most handlers never do.
 */
export function toViewEvent(native: SyntheticEvent): ViewEvent {
    const event = native as SyntheticEvent & {
        key?: string;
        shiftKey?: boolean;
        ctrlKey?: boolean;
        metaKey?: boolean;
        altKey?: boolean;
        button?: number;
    };
    const target = native.target as { value?: unknown; checked?: unknown; id?: unknown } | null;
    const built = viewEvent({
        ...(event.key !== undefined ? { key: event.key } : {}),
        shiftKey: event.shiftKey === true,
        ctrlKey: event.ctrlKey === true,
        metaKey: event.metaKey === true,
        altKey: event.altKey === true,
        ...(typeof event.button === 'number' ? { button: event.button } : {}),
        ...(typeof target?.value === 'string' ? { value: target.value } : {}),
        ...(typeof target?.checked === 'boolean' ? { checked: target.checked } : {}),
        ...(typeof target?.id === 'string' && target.id !== '' ? { targetId: target.id } : {}),
        preventDefault: () => native.preventDefault(),
    });
    // Captured now: React clears `currentTarget` once dispatch ends, and the answer is read later.
    const handlerElement = native.currentTarget instanceof Element ? native.currentTarget : null;
    const startElement = native.target instanceof Element ? native.target : null;
    let origin: ViewEventOrigin | undefined;
    Object.defineProperty(built, 'origin', {
        enumerable: true,
        get: () => (origin ??= originOf(handlerElement, startElement)),
    });
    return built;
}
