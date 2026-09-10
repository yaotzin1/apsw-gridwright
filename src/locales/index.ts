/**
 * Translation packs.
 *
 * Imported from a separate entry point so a consumer pays only for the locales they name:
 *
 * ```ts
 * import { pl } from 'apsw-gridwright/locales';
 * ```
 *
 * The package declares no side effects, so a bundler drops the rest. Adding a locale is a new file
 * beside these plus a line here, and `auditCatalog` in a test proves it has every key.
 */

export { en } from './en';
export { de } from './de';
export { es } from './es';
export { fr } from './fr';
export { pl } from './pl';

export type { LocaleCatalog, Message, MessageCatalog, MessageKey, PluralMessage } from '../i18n/messages';
