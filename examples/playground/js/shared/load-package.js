/**
 * Loads React and the built package, and says which one failed.
 *
 * Every page here needs this, and each used to carry its own copy. The reason it is worth this
 * much care is a bug report from this repository: a page that reported a missing `dist/` as a CDN
 * outage sent the reader to check their network instead of running a build.
 *
 * The failure message is built from elements, never from an HTML string: the error text comes from
 * the browser and a module URL, and the repository bans HTML sinks everywhere, the playground
 * included.
 */

const element = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
};

function fail(root, heading, explanation, error) {
    root.replaceChildren(
        element('div', { className: 'failure' },
            element('strong', {}, heading),
            ...explanation,
            element('code', { className: 'detail' }, String(error))),
    );
    throw error;
}

export async function loadPackage(root) {
    // Two steps rather than one `Promise.all` over everything, so the message can name the half
    // that failed.
    let React;
    let createRoot;
    try {
        [React, { createRoot }] = await Promise.all([import('react'), import('react-dom/client')]);
    } catch (error) {
        fail(
            root,
            'React could not be loaded from the CDN.',
            [
                element('p', {},
                    'This page needs network access to ', element('code', {}, 'esm.sh'), ' for React itself, ',
                    'because React is a peer dependency and is deliberately not bundled. Nothing is wrong with ',
                    'the build: run ', element('code', {}, 'npm run example'), ' again once the network is back.'),
            ],
            error,
        );
    }

    // React resolves first, so `dist/react/index.js` can find its bare `react` import.
    let gridwright;
    let core;
    let locales;
    try {
        [gridwright, core, locales] = await Promise.all([
            import('../../../../dist/react/index.js'),
            import('../../../../dist/index.js'),
            import('../../../../dist/locales/index.js'),
        ]);
    } catch (error) {
        fail(
            root,
            'The built package could not be loaded.',
            [
                element('p', {},
                    'React came down fine, so this is not the network. Either ', element('code', {}, 'dist/'),
                    ' has not been built yet, or this file was opened from disk instead of served. From the ',
                    'repository root:'),
                element('pre', { className: 'command' }, element('code', {}, 'npm run example')),
            ],
            error,
        );
    }

    return { React, createRoot, gridwright, core, locales };
}
