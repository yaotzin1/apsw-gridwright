import type { LocaleCatalog } from '../i18n/messages';

/**
 * French.
 */
export const fr: LocaleCatalog = {
    locale: 'fr',
    messages: {
        'search.placeholder': 'Rechercher',
        'search.label': 'Rechercher dans les lignes',
        'status.loading': 'Chargement des lignes',
        'status.empty': 'Aucune ligne à afficher',
        'error.title': 'Impossible de charger les lignes',
        'error.retry': 'Réessayer',
        'selection.row': 'Sélectionner la ligne',
        'selection.all': 'Sélectionner toutes les lignes de cette page',
        'selection.count': {
            zero: 'Aucune ligne sélectionnée',
            one: '{count} ligne sélectionnée',
            other: '{count} lignes sélectionnées',
        },
        'sort.ascending': 'Trier par ordre croissant',
        'sort.descending': 'Trier par ordre décroissant',
        'sort.clear': 'Supprimer le tri',
        'pagination.previous': 'Page précédente',
        'pagination.next': 'Page suivante',
        'pagination.rowsPerPage': 'Lignes par page',
        'pagination.range': '{from}-{to} sur {total}',
        'pagination.rangeUnknown': '{from}-{to} sur plusieurs',
    },
};
