import type { LocaleCatalog } from '../i18n/messages';

/**
 * Spanish.
 */
export const es: LocaleCatalog = {
    locale: 'es',
    messages: {
        'search.placeholder': 'Buscar',
        'search.label': 'Buscar en las filas',
        'status.loading': 'Cargando filas',
        'status.empty': 'No hay filas que mostrar',
        'error.title': 'No se pudieron cargar las filas',
        'error.retry': 'Reintentar',
        'error.stale': 'No se pudieron actualizar las filas',
        'error.staleDetail': 'Se muestra lo último que se cargó',
        'selection.row': 'Seleccionar fila',
        'selection.all': 'Seleccionar todas las filas de esta página',
        'selection.count': {
            zero: 'Ninguna fila seleccionada',
            one: '{count} fila seleccionada',
            other: '{count} filas seleccionadas',
        },
        'sort.ascending': 'Ordenar de forma ascendente',
        'sort.descending': 'Ordenar de forma descendente',
        'sort.clear': 'Quitar la ordenación',
        'pagination.previous': 'Página anterior',
        'pagination.next': 'Página siguiente',
        'pagination.rowsPerPage': 'Filas por página',
        'pagination.range': '{from}-{to} de {total}',
        'pagination.rangeUnknown': '{from}-{to} de muchas',
        'a11y.sortedAscending': '{column}, orden ascendente',
        'a11y.sortedDescending': '{column}, orden descendente',
        'a11y.sortCleared': '{column}, sin ordenar',
        'a11y.rowsShown': 'Mostrando de {from} a {to} de {total}',
        'a11y.rowsShownUnknown': 'Mostrando de {from} a {to} de muchas',
        'a11y.rowsTotal': {
            one: '{count} fila',
            other: '{count} filas',
        },
        'tree.expand': 'Expandir',
        'tree.collapse': 'Contraer',
        'tree.loadFailed': 'No se pudieron cargar los elementos secundarios',
        'tree.cycle': 'Ya mostrado más arriba',
        'tree.childCount': {
            one: '{count} elemento dentro',
            other: '{count} elementos dentro',
        },
    },
};
