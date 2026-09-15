import type { LocaleCatalog } from '../i18n/messages';

/**
 * French.
 */
export const fr: LocaleCatalog = {
    locale: 'fr',
    messages: {
        'status.loading': 'Chargement des lignes',
        'status.empty': 'Aucune ligne à afficher',
        'error.title': 'Impossible de charger les lignes',
        'error.retry': 'Réessayer',
        'a11y.rowsShown': 'Affichage de {from} à {to} sur {total}',
        'a11y.rowsShownUnknown': 'Affichage de {from} à {to} sur plusieurs',
        'a11y.rowsTotal': {
            one: '{count} ligne',
            other: '{count} lignes',
        },
    },
    // The built-in add-ons' strings, by add-on name. A pack of your own can translate a third-party
    // add-on the same way, under that add-on's name.
    addons: {
        'gridwright:search': {
            placeholder: 'Rechercher',
            label: 'Rechercher dans les lignes',
        },
        'gridwright:stale-notice': {
            title: 'Les lignes n’ont pas pu être mises à jour',
            detail: 'Affichage du dernier chargement',
        },
        'gridwright:selection': {
            row: 'Sélectionner la ligne',
            all: 'Sélectionner toutes les lignes de cette page',
            count: {
                zero: 'Aucune ligne sélectionnée',
                one: '{count} ligne sélectionnée',
                other: '{count} lignes sélectionnées',
            },
        },
        'gridwright:sorting': {
            ascending: 'Trier par ordre croissant',
            descending: 'Trier par ordre décroissant',
            clear: 'Supprimer le tri',
            sortedAscending: '{column}, tri croissant',
            sortedDescending: '{column}, tri décroissant',
            sortCleared: '{column}, non trié',
        },
        'gridwright:filters': {
            open: 'Filtrer {column}',
            openActive: 'Filtrer {column}, filtre actif',
            condition: 'Condition',
            value: 'Valeur',
            from: 'De',
            to: 'À',
            values: 'Valeurs',
            apply: 'Appliquer',
            clear: 'Effacer le filtre',
            clearAll: {
                one: 'Effacer {count} filtre',
                other: 'Effacer {count} filtres',
            },
            'op.contains': 'Contient',
            'op.notContains': 'Ne contient pas',
            'op.eq': 'Égal à',
            'op.ne': 'Différent de',
            'op.startsWith': 'Commence par',
            'op.endsWith': 'Se termine par',
            'op.gt': 'Supérieur à',
            'op.gte': 'Supérieur ou égal à',
            'op.lt': 'Inférieur à',
            'op.lte': 'Inférieur ou égal à',
            'op.between': 'Entre',
            'op.in': 'Est l’un de',
            'op.notIn': 'N’est aucun de',
            'op.isEmpty': 'Est vide',
            'op.isNotEmpty': 'N’est pas vide',
            'op.on': 'Le',
            'op.after': 'Après',
            'op.before': 'Avant',
            applied: '{column}, filtre appliqué',
            removed: '{column}, filtre supprimé',
        },
        'gridwright:pagination': {
            previous: 'Page précédente',
            next: 'Page suivante',
            rowsPerPage: 'Lignes par page',
            range: '{from}-{to} sur {total}',
            rangeUnknown: '{from}-{to} sur plusieurs',
        },
        'gridwright:export': {
            action: 'Exporter',
            csv: 'Exporter en CSV',
            excel: 'Exporter en Excel',
            markdown: 'Exporter en Markdown',
            print: 'Imprimer',
            inProgress: 'Préparation de l’export {format}',
            complete: 'Export {format} prêt',
            rows: 'Lignes',
            scopeAll: 'Toutes les lignes correspondantes',
            scopePage: 'Cette page',
            scopeSelected: {
                zero: 'Lignes sélectionnées (aucune)',
                one: '{count} ligne sélectionnée',
                other: '{count} lignes sélectionnées',
            },
            allUnavailable: 'Seules cette page ou les lignes sélectionnées peuvent être exportées ici',
            failed: 'L’export {format} n’a pas pu être produit',
            reportMarkdown: '{label} (Markdown)',
            reportPdf: '{label} (PDF)',
        },
        'gridwright:row-actions': {
            menu: 'Actions sur la ligne',
        },
        'gridwright:tree': {
            expand: 'Déplier',
            collapse: 'Replier',
            loadFailed: 'Impossible de charger les lignes enfants',
            cycle: 'Déjà affiché plus haut',
            childCount: {
                one: 'contient {count} élément',
                other: 'contient {count} éléments',
            },
        },
    },
};
