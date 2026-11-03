import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ViewEventOrigin } from '../../src/view';
import { toViewEvent } from '../../src/react/view/to-view-event';

/**
 * `origin` is how a neutral add-on learns where an event came from without holding an element. These
 * read it from a real DOM, because the answers are about `closest`, `getSelection` and the controls a
 * cell holds, which only a DOM can give.
 */

let seen: ViewEventOrigin | undefined;
let read: (() => ViewEventOrigin | undefined) | undefined;

const capture = (event: Parameters<typeof toViewEvent>[0]): void => {
    const view = toViewEvent(event);
    // Read after dispatch ends, as a handler that kept the event might.
    read = () => view.origin;
    seen = view.origin;
};

function Table() {
    return (
        <table onKeyDown={capture}>
            <tbody>
                <tr data-row-id="7" onClick={capture}>
                    <td data-column-id="name" tabIndex={0}>
                        <span>Ada</span>
                    </td>
                    <td data-column-id="action">
                        <button type="button">Open</button>
                    </td>
                    <td data-column-id="detail">
                        <table>
                            <tbody>
                                <tr data-row-id="inner">
                                    <td data-column-id="x" tabIndex={0}>
                                        Nested
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

const reset = (): void => {
    seen = undefined;
    read = undefined;
};

describe('toViewEvent origin', () => {
    it('describes a click on a plain cell: the row, the column, no control, the cell is the target', async () => {
        reset();
        render(<Table />);
        await userEvent.click(screen.getByRole('cell', { name: 'Ada' }));
        expect(seen).toEqual({
            cell: { rowId: '7', columnId: 'name', holdsControl: false, targetIsCell: true },
            fromControl: false,
            fromNestedGrid: false,
            textSelected: false,
        });
    });

    it('says the click came from a control, and that the cell holds one', async () => {
        reset();
        render(<Table />);
        await userEvent.click(screen.getByRole('button', { name: 'Open' }));
        expect(seen?.fromControl).toBe(true);
        expect(seen?.cell).toMatchObject({ rowId: '7', columnId: 'action', holdsControl: true, targetIsCell: false });
    });

    it('says a click inside something in the cell is not on the cell itself', async () => {
        reset();
        render(<Table />);
        await userEvent.click(screen.getByText('Ada'));
        expect(seen?.cell).toMatchObject({ rowId: '7', targetIsCell: false });
    });

    it('does not claim a nested grid cell for the outer grid, and says the row click came from a nested grid', async () => {
        reset();
        render(<Table />);
        await userEvent.click(screen.getByText('Nested'));
        expect(seen?.fromNestedGrid).toBe(true);
        // The row handler is on the outer row, whose own table owns neither the inner cell nor the inner row.
        expect(seen?.cell).toBeUndefined();
    });

    it('does not offer the cell of a nested grid to a table-level key handler either', () => {
        reset();
        render(<Table />);
        fireEvent.keyDown(screen.getByText('Nested'), { key: ' ' });
        // The handler is on the outer table; the inner table is nearer to the cell, so the cell belongs to it.
        expect(seen?.cell).toBeUndefined();
    });

    it('reports the cell of the grid the key handler is on', () => {
        reset();
        render(<Table />);
        fireEvent.keyDown(screen.getByRole('cell', { name: 'Ada' }), { key: ' ' });
        expect(seen?.cell).toEqual({ rowId: '7', columnId: 'name', holdsControl: false, targetIsCell: true });
    });

    it('says a text selection inside the row is one, and a collapsed caret is not', () => {
        reset();
        render(<Table />);
        const label = screen.getByText('Ada');
        const range = document.createRange();
        range.selectNodeContents(label);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        fireEvent.click(label);
        expect(seen?.textSelected).toBe(true);

        selection.removeAllRanges();
        fireEvent.click(label);
        expect(seen?.textSelected).toBe(false);
    });

    it('keeps the answer after dispatch, when React has cleared currentTarget', async () => {
        reset();
        render(<Table />);
        await userEvent.click(screen.getByRole('cell', { name: 'Ada' }));
        expect(read?.()?.cell?.rowId).toBe('7');
    });
});
