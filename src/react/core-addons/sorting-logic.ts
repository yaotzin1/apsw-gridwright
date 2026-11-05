import { sortAnnouncement as viewSortAnnouncement } from '../../view/behaviour/sorting';
import type { AnnouncementContributor } from '../addons/types';

export { ariaSortOf, nextSortAction, sortPriorityOf, sortTitleOf } from '../../view/behaviour/sorting';

/**
 * The sort's sentence for the grid's live region. The behaviour lives in the view layer, where every
 * adapter shares it; this keeps the React-typed contributor this entry has always exported.
 */
export function sortAnnouncement<TRow>(): AnnouncementContributor<TRow> {
    return viewSortAnnouncement<TRow>();
}
