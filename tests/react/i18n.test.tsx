import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { addonMessages } from '../../src/react/addons/context';
import type { GridAddon } from '../../src/react/addons/types';
import { search } from '../../src/react/core-addons';
import { GridwrightProvider } from '../../src/react/context';
import { GridPagination } from '../../src/react/parts/GridPagination';
import { useGridwright } from '../../src/react/useGridwright';
import { de, en, pl } from '../../src/locales';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const grid = (props: Record<string, unknown> = {}) =>
    render(
        <Gridwright<Person>
            columns={personColumns}
            data={people}
            pageSize={3}
            addons={[search()]}
            selectionMode="multiple"
            aria-label="People"
            {...props}
        />,
    );

describe('locale packs', () => {
    it('renders English with no i18n props at all', () => {
        grid();
        expect(screen.getByRole('searchbox', { name: 'Search rows' })).toBeInTheDocument();
        expect(screen.getByText('Rows per page')).toBeInTheDocument();
        expect(screen.getByText('1-3 of 7')).toBeInTheDocument();
    });

    it('renders a catalog passed as the locale', () => {
        grid({ locale: pl });

        expect(screen.getByRole('searchbox', { name: 'Szukaj w wierszach' })).toBeInTheDocument();
        expect(screen.getByText('Wierszy na stronie')).toBeInTheDocument();
        expect(screen.getByText('1-3 z 7')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Następna strona' })).toBeInTheDocument();
    });

    it('translates the accessible names, not only the visible text', () => {
        grid({ locale: de });
        expect(screen.getAllByRole('checkbox', { name: 'Zeile auswählen' })).toHaveLength(3);
        expect(
            screen.getByRole('checkbox', { name: 'Alle Zeilen auf dieser Seite auswählen' }),
        ).toBeInTheDocument();
    });

    it('marks the root with the locale', () => {
        const { container } = grid({ locale: pl });
        expect(container.querySelector('.gw-root')).toHaveAttribute('lang', 'pl');
    });
});

describe('plural forms', () => {
    it('selects the Polish form that matches the count', async () => {
        // The reason plural forms are a catalog feature: Polish needs one, few and many, and no
        // template string can produce them.
        const user = userEvent.setup();
        grid({ locale: pl });

        const checkboxes = screen.getAllByRole('checkbox', { name: 'Zaznacz wiersz' });

        await user.click(checkboxes[0]!);
        expect(screen.getByText('zaznaczono 1 wiersz')).toBeInTheDocument();

        await user.click(checkboxes[1]!);
        expect(screen.getByText('zaznaczono 2 wiersze')).toBeInTheDocument();

        await user.click(checkboxes[2]!);
        expect(screen.getByText('zaznaczono 3 wiersze')).toBeInTheDocument();
    });

    it('selects the English form', async () => {
        const user = userEvent.setup();
        grid();

        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
        expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
});

describe('number formatting', () => {
    it('formats a total for the locale', () => {
        const many = Array.from({ length: 12_345 }, (_, index) => ({
            ...people[0]!,
            id: index + 1,
        }));

        const { rerender } = render(
            <Gridwright<Person> columns={personColumns} data={many} pageSize={25} locale={en} />,
        );
        expect(screen.getByText('1-25 of 12,345')).toBeInTheDocument();

        rerender(
            <Gridwright<Person> columns={personColumns} data={many} pageSize={25} locale={de} />,
        );
        expect(screen.getByText('1-25 von 12.345')).toBeInTheDocument();
    });
});

describe('other translation routes', () => {
    it('accepts a bare tag, which changes formatting without changing the text', () => {
        const many = Array.from({ length: 12_345 }, (_, index) => ({ ...people[0]!, id: index + 1 }));
        render(<Gridwright<Person> columns={personColumns} data={many} pageSize={25} locale="de-DE" />);

        // German grouping, English words: a bare tag is the right answer for en-GB and the wrong
        // answer for pl, which is why the catalog is a separate thing to pass.
        expect(screen.getByText('1-25 of 12.345')).toBeInTheDocument();
    });

    it('applies message overrides over a catalog', () => {
        // An add-on's key, namespaced by the add-on's name.
        grid({ locale: pl, messages: { 'gridwright:search.placeholder': 'Filtruj' } });

        expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Filtruj');
        expect(screen.getByText('Wierszy na stronie')).toBeInTheDocument();
    });

    it('delegates to an external i18n function', () => {
        // The shape react-i18next, FormatJS and Lingui all expose, so wiring one in is one prop.
        const dictionary: Record<string, string> = {
            'gridwright:pagination.rowsPerPage': 'Righe per pagina',
            'gridwright:search.placeholder': 'Cerca',
            'status.loading': 'Caricamento',
        };
        const translate = vi.fn((key: string) => dictionary[key] ?? key);

        grid({ translate });

        expect(screen.getByText('Righe per pagina')).toBeInTheDocument();
        expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Cerca');
        // A key the function did not know falls back to the catalog, not to the key itself.
        expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    });

    it('lets labels override the catalog for a single shell string', () => {
        grid({ locale: pl, data: [], labels: { empty: 'Pusto' } });

        expect(within(screen.getByRole('grid')).getByText('Pusto')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Następna strona' })).toBeInTheDocument();
    });

    it('translates an add-on of your own from its catalog, and lets the pack or messages outrank it', () => {
        const badge: GridAddon<Person> = {
            name: 'acme:badge',
            setup: () => ({
                messages: { en: { note: 'Beta' }, pl: { note: 'Wersja testowa' } },
                aboveTable: (context) => (
                    <p data-testid="badge">{addonMessages(context.translator, context.contributions as never, 'acme:badge')('note')}</p>
                ),
            }),
        };

        const { unmount } = grid({ locale: pl, addons: [badge] });
        expect(screen.getByTestId('badge')).toHaveTextContent('Wersja testowa');
        unmount();

        grid({ locale: pl, addons: [badge], messages: { 'acme:badge.note': 'Podgląd' } });
        expect(screen.getByTestId('badge')).toHaveTextContent('Podgląd');
    });
});

describe('the live region', () => {
    it('speaks the new language as soon as the locale changes', async () => {
        const { rerender } = render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} />);
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Showing 1 to 3 of 7'));

        rerender(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} locale={pl} />);
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Wyświetlane wiersze od 1 do 3 z 7'));
    });
});

describe('direction', () => {
    it('sets dir on the root for a right-to-left locale', () => {
        const { container } = grid({ locale: 'ar' });
        expect(container.querySelector('.gw-root')).toHaveAttribute('dir', 'rtl');
    });

    it('leaves dir unset for a left-to-right locale, so a nested grid inherits the page', () => {
        const { container } = grid({ locale: pl });
        expect(container.querySelector('.gw-root')).not.toHaveAttribute('dir');
    });
});

describe('composition', () => {
    it('passes the catalog through the provider to a part placed by hand', () => {
        function Composed() {
            const instance = useGridwright<Person>({ columns: personColumns, data: people, pageSize: 3 });
            // A part rendered by hand still finds the pagination add-on's strings in the pack.
            return (
                <GridwrightProvider instance={instance} locale={pl}>
                    <div data-testid="footer">
                        <GridPagination />
                    </div>
                </GridwrightProvider>
            );
        }

        render(<Composed />);
        expect(within(screen.getByTestId('footer')).getByText('Wierszy na stronie')).toBeInTheDocument();
    });
});
