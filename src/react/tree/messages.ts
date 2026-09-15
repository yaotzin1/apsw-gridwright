import type { AddonMessages } from '../../i18n/messages';

export const TREE_ADDON = 'gridwright:tree';

/** English. The translations live in `apsw-gridwright/locales`, under `addons['gridwright:tree']`. */
export const treeMessages: AddonMessages = {
    en: {
        expand: 'Expand',
        collapse: 'Collapse',
        loadFailed: 'The children could not be loaded',
        cycle: 'Already shown further up',
        childCount: {
            one: '{count} item inside',
            other: '{count} items inside',
        },
    },
};
