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
        'error.stale': 'Die Zeilen konnten nicht aktualisiert werden',
        'error.staleDetail': 'Angezeigt wird der zuletzt geladene Stand',
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
        'a11y.sortedAscending': '{column}, aufsteigend sortiert',
        'a11y.sortedDescending': '{column}, absteigend sortiert',
        'a11y.sortCleared': '{column}, nicht sortiert',
        'a11y.rowsShown': 'Zeige {from} bis {to} von {total}',
        'a11y.rowsShownUnknown': 'Zeige {from} bis {to} von vielen',
        'a11y.rowsTotal': {
            one: '{count} Zeile',
            other: '{count} Zeilen',
        },
        'export.action': 'Exportieren',
        'export.csv': 'Als CSV exportieren',
        'export.excel': 'Als Excel exportieren',
        'export.markdown': 'Als Markdown exportieren',
        'export.print': 'Drucken',
        'export.inProgress': '{format}-Export wird vorbereitet',
        'export.complete': '{format}-Export ist fertig',
        'tree.expand': 'Aufklappen',
        'tree.collapse': 'Zuklappen',
        'tree.loadFailed': 'Die untergeordneten Zeilen konnten nicht geladen werden',
        'tree.cycle': 'Weiter oben bereits gezeigt',
        'tree.childCount': {
            one: '{count} Element enthalten',
            other: '{count} Elemente enthalten',
        },
    },
};
