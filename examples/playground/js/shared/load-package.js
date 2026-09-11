/**
 * Loads React and the built package, and says which one failed.
 *
 * Every page here needs this, and each used to carry its own copy. The reason it is worth this
 * much care is a bug report from this repository: a page that reported a missing `dist/` as a CDN
 * outage sent the reader to check their network instead of running a build.
 */

function fail(root, heading, explanation, error) {
    root.innerHTML = `
        <div class="failure">
            <strong>${heading}</strong>
            ${explanation}
            <code class="detail">${String(error)}</code>
        </div>`;
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
            `<p>
                This page needs network access to <code>esm.sh</code> for React itself, because React
                is a peer dependency and is deliberately not bundled. Nothing is wrong with the
                build: run <code>npm run example</code> again once the network is back.
            </p>`,
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
            `<p>
                React came down fine, so this is not the network. Either <code>dist/</code> has not
                been built yet, or this file was opened from disk instead of served. From the
                repository root:
            </p>
            <pre style="background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;overflow:auto"><code>npm run example</code></pre>`,
            error,
        );
    }

    return { React, createRoot, gridwright, core, locales };
}
