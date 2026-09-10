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
    },
};
