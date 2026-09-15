/**
 * The page furniture both playground pages share: panels, switches, and the links to the source.
 *
 * None of this is part of the grid. It is the playground's own chrome, kept here so the files that
 * show how to use the grid contain nothing else.
 */
import { h } from './package.js';

const JS_ROOT = '/examples/playground/js/';

/**
 * A link to the file that implements the panel it sits in, opened as plain text in a new tab.
 *
 *     source('employees/export-formats.js')
 */
export const source = (path, label = path) =>
    h('a', { className: 'source', href: JS_ROOT + path, target: '_blank', rel: 'noopener', key: path }, label);

/** A titled section of the page, with the files behind it listed beside the title. */
export const panel = ({ title, sources = [] }, ...children) =>
    h('section', { className: 'panel' },
        h('div', { className: 'panel-head' },
            h('h2', null, title),
            sources.length > 0 && h('span', { className: 'sources' }, 'source: ', ...sources.map((path) => source(path)))),
        ...children);

/** A labelled checkbox bound to a boolean. */
export const toggle = (label, checked, onChange, disabled = false) =>
    h('label', { className: 'inline', key: label, style: disabled ? { opacity: 0.45 } : undefined },
        h('input', { type: 'checkbox', checked, disabled, onChange: (event) => onChange(event.target.checked) }),
        label);

/** A labelled select bound to a string. `options` is `[value, label]` pairs. */
export const choice = (label, value, onChange, options) =>
    h('label', { className: 'inline', key: label }, label,
        h('select', { value, onChange: (event) => onChange(event.target.value) },
            ...options.map(([optionValue, optionLabel]) => h('option', { key: optionValue, value: optionValue }, optionLabel))));

export const hint = (...children) => h('p', { className: 'hint' }, ...children);

export const row = (...children) => h('div', { className: 'row' }, ...children);

/** The language picker both pages have. */
export const languageChoice = (locale, setLocale) =>
    choice('Language', locale, setLocale, [
        ['en', 'English'],
        ['de', 'Deutsch'],
        ['es', 'Español'],
        ['fr', 'Français'],
        ['pl', 'Polski'],
    ]);
