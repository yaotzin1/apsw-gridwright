import type { LocaleCatalog } from '../i18n/messages';

/**
 * Polish.
 *
 * The selection count is the reason plural forms are a catalog feature rather than a
 * template string: Polish distinguishes one, few (2 to 4), many (5 and up) and a fractional
 * form, and `Intl.PluralRules` picks between them.
 */
export const pl: LocaleCatalog = {
    locale: 'pl',
    messages: {
        'search.placeholder': 'Szukaj',
        'search.label': 'Szukaj w wierszach',
        'status.loading': 'Wczytywanie wierszy',
        'status.empty': 'Brak wierszy do wyświetlenia',
        'error.title': 'Nie udało się wczytać wierszy',
        'error.retry': 'Spróbuj ponownie',
        'selection.row': 'Zaznacz wiersz',
        'selection.all': 'Zaznacz wszystkie wiersze na tej stronie',
        'selection.count': {
            zero: 'Nie zaznaczono wierszy',
            one: 'zaznaczono {count} wiersz',
            few: 'zaznaczono {count} wiersze',
            many: 'zaznaczono {count} wierszy',
            other: 'zaznaczono {count} wiersza',
        },
        'sort.ascending': 'Sortuj rosnąco',
        'sort.descending': 'Sortuj malejąco',
        'sort.clear': 'Wyczyść sortowanie',
        'pagination.previous': 'Poprzednia strona',
        'pagination.next': 'Następna strona',
        'pagination.rowsPerPage': 'Wierszy na stronie',
        'pagination.range': '{from}-{to} z {total}',
        'pagination.rangeUnknown': '{from}-{to} z wielu',
        'a11y.sortedAscending': '{column}, posortowano rosnąco',
        'a11y.sortedDescending': '{column}, posortowano malejąco',
        'a11y.sortCleared': '{column}, bez sortowania',
        'a11y.rowsShown': 'Wyświetlane wiersze od {from} do {to} z {total}',
        'a11y.rowsShownUnknown': 'Wyświetlane wiersze od {from} do {to} z wielu',
        'a11y.rowsTotal': {
            one: '{count} wiersz',
            few: '{count} wiersze',
            many: '{count} wierszy',
            other: '{count} wiersza',
        },
        'tree.expand': 'Rozwiń',
        'tree.collapse': 'Zwiń',
        'tree.loadFailed': 'Nie udało się wczytać elementów podrzędnych',
        'tree.cycle': 'Pokazano już wyżej',
        'tree.childCount': {
            one: '{count} element w środku',
            few: '{count} elementy w środku',
            many: '{count} elementów w środku',
            other: '{count} elementu w środku',
        },
    },
};
