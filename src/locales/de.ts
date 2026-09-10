import type { LocaleCatalog } from '../i18n/messages';

/**
 * German.
 */
export const de: LocaleCatalog = {
    locale: 'de',
    messages: {
        'search.placeholder': 'Suchen',
        'search.label': 'Zeilen durchsuchen',
        'status.loading': 'Zeilen werden geladen',
        'status.empty': 'Keine Zeilen vorhanden',
        'error.title': 'Die Zeilen konnten nicht geladen werden',
        'error.retry': 'Erneut versuchen',
        'selection.row': 'Zeile auswählen',
        'selection.all': 'Alle Zeilen auf dieser Seite auswählen',
        'selection.count': {
            zero: 'Nichts ausgewählt',
            one: '{count} Zeile ausgewählt',
            other: '{count} Zeilen ausgewählt',
        },
        'sort.ascending': 'Aufsteigend sortieren',
        'sort.descending': 'Absteigend sortieren',
        'sort.clear': 'Sortierung aufheben',
        'pagination.previous': 'Vorherige Seite',
        'pagination.next': 'Nächste Seite',
        'pagination.rowsPerPage': 'Zeilen pro Seite',
        'pagination.range': '{from}-{to} von {total}',
        'pagination.rangeUnknown': '{from}-{to} von vielen',
    },
};
