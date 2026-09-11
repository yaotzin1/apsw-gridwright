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
        'a11y.sortedAscending': '{column}, tri croissant',
        'a11y.sortedDescending': '{column}, tri décroissant',
        'a11y.sortCleared': '{column}, non trié',
        'a11y.rowsShown': 'Affichage de {from} à {to} sur {total}',
        'a11y.rowsShownUnknown': 'Affichage de {from} à {to} sur plusieurs',
        'a11y.rowsTotal': {
            one: '{count} ligne',
            other: '{count} lignes',
        },
        'tree.expand': 'Déplier',
        'tree.collapse': 'Replier',
        'tree.loadFailed': 'Impossible de charger les lignes enfants',
        'tree.cycle': 'Déjà affiché plus haut',
        'tree.childCount': {
            one: 'contient {count} élément',
            other: 'contient {count} éléments',
        },
    },
};
