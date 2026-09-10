import type { LocaleCatalog } from '../i18n/messages';
import { englishCatalog } from '../i18n/messages';

/** English. Also the fallback for every other locale, so it is the one catalog that cannot drift. */
export const en: LocaleCatalog = englishCatalog;
