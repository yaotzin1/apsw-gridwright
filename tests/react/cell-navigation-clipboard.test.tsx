import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { cellNavigation } from '../../src/react/navigation';
import { isCopyShortcut } from '../../src/react/navigation/clipboard';
import type { CellNavigationOptions } from '../../src/react/navigation/types';
import type { GridwrightColumn } from '../../src/react/types';
import { pl } from '../../src/locales';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * Copying from the grid, the way every platform does it.
 *
 * The copy runs in the browser's `copy` event, so these tests drive the two halves a real keypress
 * produces: the keydown, which has to leave something selected for Firefox and Safari to fire
 * `copy` at all, and the `copy` event itself, whose `clipboardData` is what lands on the clipboard.
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary' },
];

const renderGrid = (options: CellNavigationOptions = {}, props: Record<string, unknown> = {}) =>
    render(
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={4}
            aria-label="People"
            addons={[cellNavigation<Person>(options)]}
            {...props}
        />,
    );

const cells = (): HTMLElement[] => screen.getAllByRole('cell');
const tabbable = (): HTMLElement => cells().find((cell) => cell.getAttribute('tabindex') === '0')!;
const announcement = (): string => screen.getByRole('status').textContent ?? '';

/** A `copy` event's clipboard, recording what was put on it. */
function clipboard() {
    const data = new Map<string, string>();
    return { data, clipboardData: { setData: vi.fn((type: string, value: string) => data.set(type, value)) } };
}

/** The shortcut's keydown, then the `copy` the browser fires for it. */
function pressCopy(target: HTMLElement, key: Partial<KeyboardEventInit> = { key: 'c', code: 'KeyC', ctrlKey: true }) {
    fireEvent.keyDown(target, key);
    const board = clipboard();
    const notPrevented = fireEvent.copy(target, { clipboardData: board.clipboardData });
    return { ...board, prevented: !notPrevented };
}

const shortcut = (key: string, extra: Partial<Parameters<typeof isCopyShortcut>[0]> = {}) =>
    isCopyShortcut({ key, code: 'KeyC', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });

describe('isCopyShortcut(): whichever key the platform calls copy', () => {
    it('accepts Ctrl+C (Windows, Linux, ChromeOS) and Cmd+C (macOS, iPadOS) without asking which this is', () => {
        expect(shortcut('c', { ctrlKey: true })).toBe(true);
        expect(shortcut('c', { metaKey: true })).toBe(true);
        // Caps Lock on.
        expect(shortcut('C', { ctrlKey: true })).toBe(true);
    });

    it('accepts Ctrl+Insert, the older copy shortcut Windows and Linux desktops still honour', () => {
        expect(isCopyShortcut({ key: 'Insert', code: 'Insert', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(true);
    });

    it('reads the letter the layout typed, and the physical key only on a non-Latin layout', () => {
        // Russian: the key labelled C types "с" (Cyrillic), and the OS still treats Ctrl+it as copy.
        expect(shortcut('с', { ctrlKey: true, code: 'KeyC' })).toBe(true);
        // Dvorak: the key where QWERTY has C types "j". That is Ctrl+J, not copy.
        expect(shortcut('j', { ctrlKey: true, code: 'KeyC' })).toBe(false);
        // AZERTY and Dvorak readers press the C their keyboard shows, wherever it physically is.
        expect(shortcut('c', { ctrlKey: true, code: 'KeyI' })).toBe(true);
    });

    it('refuses AltGr, which Windows reports as Ctrl+Alt and which types letters', () => {
        // Polish programmer layout: AltGr+C is "ć".
        expect(shortcut('ć', { ctrlKey: true, altKey: true })).toBe(false);
        expect(shortcut('c', { ctrlKey: true, altKey: true })).toBe(false);
    });

    it('refuses Ctrl+Shift+C, which belongs to the developer tools, and a bare C', () => {
        expect(shortcut('C', { ctrlKey: true, shiftKey: true })).toBe(false);
        expect(shortcut('c')).toBe(false);
    });
});

describe('cellNavigation(): copying', () => {
    it('copies the cell under the cursor, and says so', async () => {
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));

        const { data, prevented } = pressCopy(tabbable());

        expect(prevented).toBe(true);
        expect(data.get('text/plain')).toBe('Ada Lovelace');
        expect(data.get('text/html')).toBe('<meta charset="utf-8"><table><tbody><tr><td>Ada Lovelace</td></tr></tbody></table>');
        await waitFor(() => expect(announcement()).toContain('Copied the cell to the clipboard'));
    });

    it('works the same with Cmd+C and Ctrl+Insert', async () => {
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));

        expect(pressCopy(tabbable(), { key: 'c', code: 'KeyC', metaKey: true }).data.get('text/plain')).toBe('Ada Lovelace');
        expect(pressCopy(tabbable(), { key: 'Insert', code: 'Insert', ctrlKey: true }).data.get('text/plain')).toBe(
            'Ada Lovelace',
        );
    });

    it('selects the cell on keydown so Firefox and Safari fire copy, and clears it after', async () => {
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));
        const cell = tabbable();
        cell.focus();

        fireEvent.keyDown(cell, { key: 'c', code: 'KeyC', ctrlKey: true });
        expect(document.getSelection()?.toString()).toBe('Ada Lovelace');
        // Focus stays on the cell: selecting text is not a focus change.
        expect(document.activeElement).toBe(cell);

        fireEvent.copy(cell, { clipboardData: clipboard().clipboardData });
        expect(document.getSelection()?.isCollapsed).toBe(true);
    });

    it('does not let the browser keep a selection whose copy never came', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));
        tabbable().focus();

        fireEvent.keyDown(tabbable(), { key: 'c', code: 'KeyC', ctrlKey: true });
        await user.keyboard('{ArrowRight}');
        expect(document.getSelection()?.isCollapsed).toBe(true);
    });

    it('copies the selected rows with a header row, in the order they are shown', async () => {
        const user = userEvent.setup();
        renderGrid({}, { selectionMode: 'multiple' });
        await waitFor(() => expect(tabbable()).toBeDefined());

        const rows = screen.getAllByRole('row').slice(1);
        await user.click(within(rows[2]!).getByRole('checkbox'));
        await user.click(within(rows[0]!).getByRole('checkbox'));

        const { data } = pressCopy(tabbable());

        expect(data.get('text/plain')).toBe(
            ['Name\tDepartment\tSalary', 'Ada Lovelace\tEngineering\t120000', 'Katherine Johnson\tResearch\t110000'].join('\n'),
        );
        expect(data.get('text/html')).toContain('<thead><tr><th>Name</th><th>Department</th><th>Salary</th></tr></thead>');
        await waitFor(() => expect(announcement()).toContain('Copied 2 rows to the clipboard'));
    });

    it('announces in the grid language', async () => {
        renderGrid({}, { locale: pl });
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));
        pressCopy(tabbable());
        await waitFor(() => expect(announcement()).toContain('Skopiowano komórkę do schowka'));
    });

    it('escapes markup and defuses formulas in both flavours', async () => {
        const hostile: Person = { ...people[0]!, name: '=HYPERLINK("x")', department: '<img src=x onerror=alert(1)>' };
        renderGrid({}, { data: [hostile] });
        await waitFor(() => expect(tabbable()).toBeDefined());

        const name = pressCopy(tabbable());
        expect(name.data.get('text/plain')).toBe(`"'=HYPERLINK(""x"")"`);
        expect(name.data.get('text/html')).toContain('<td>&#39;=HYPERLINK(&quot;x&quot;)</td>');

        fireEvent.keyDown(tabbable(), { key: 'ArrowRight' });
        const department = pressCopy(cells()[1]!);
        expect(department.data.get('text/html')).not.toContain('<img');
        expect(department.data.get('text/html')).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('defuses a formula behind leading spaces in both flavours alike', async () => {
        // A spreadsheet given both flavours pastes the HTML one, so the two must follow one rule.
        renderGrid({}, { data: [{ ...people[0]!, name: '   =1+1' }] });
        await waitFor(() => expect(tabbable()).toBeDefined());

        const copied = pressCopy(tabbable());
        expect(copied.data.get('text/plain')).toBe("'   =1+1");
        expect(copied.data.get('text/html')).toContain('<td>&#39;   =1+1</td>');
    });

    it('leaves text the reader selected with the pointer to the browser', async () => {
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));

        const range = document.createRange();
        range.selectNodeContents(cells()[1]!);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);

        const { clipboardData, prevented } = pressCopy(cells()[1]!);
        expect(clipboardData.setData).not.toHaveBeenCalled();
        expect(prevented).toBe(false);
        document.getSelection()!.removeAllRanges();
    });

    it('leaves a copy inside a form control alone', async () => {
        render(
            <Gridwright<Person>
                columns={[{ id: 'name', header: 'Name', cell: ({ value }) => <input aria-label="Edit name" defaultValue={String(value)} /> }]}
                data={people.slice(0, 1)}
                aria-label="People"
                addons={[cellNavigation<Person>()]}
            />,
        );
        const input = await screen.findByRole('textbox', { name: 'Edit name' });

        const { clipboardData, prevented } = pressCopy(input);
        expect(clipboardData.setData).not.toHaveBeenCalled();
        expect(prevented).toBe(false);
    });

    it('does nothing with copy: false, and neither does a grid without the add-on', async () => {
        renderGrid({ copy: false });
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));

        fireEvent.keyDown(tabbable(), { key: 'c', code: 'KeyC', ctrlKey: true });
        expect(document.getSelection()?.isCollapsed ?? true).toBe(true);
        const { clipboardData } = pressCopy(tabbable());
        expect(clipboardData.setData).not.toHaveBeenCalled();
    });

    it('copies nothing from the selection checkbox cell', async () => {
        const user = userEvent.setup();
        renderGrid({}, { selectionMode: 'multiple' });
        await waitFor(() => expect(tabbable()).toBeDefined());
        tabbable().focus();
        await user.keyboard('{ArrowLeft}');

        const { clipboardData } = pressCopy(document.activeElement as HTMLElement);
        expect(clipboardData.setData).not.toHaveBeenCalled();
    });
});
