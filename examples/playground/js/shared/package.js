/**
 * The built package and React, for every module on a page.
 *
 * Import from here instead of from `dist/` directly:
 *
 *     import { React, h, gridwright, core, locales } from '../shared/package.js';
 *
 * In an application you would write `import { Gridwright } from 'apsw-gridwright/react'`. These
 * pages have no bundler, so the same exports arrive through this module, which also shows a clear
 * message on the page when React or `dist/` cannot be loaded.
 */
import { loadPackage } from './load-package.js';

export const { React, createRoot, gridwright, core, locales } = await loadPackage(document.getElementById('root'));

/**
 * `React.createElement`. There is no JSX without a build step, so `h('div', props, ...children)` is
 * what `<div {...props}>{children}</div>` compiles to anyway.
 */
export const h = React.createElement;

/** Every bundled translation, keyed by its language tag. */
export const catalogs = { en: locales.en, de: locales.de, es: locales.es, fr: locales.fr, pl: locales.pl };
