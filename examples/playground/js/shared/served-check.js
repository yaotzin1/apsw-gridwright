/*
 * Says so plainly when a playground page is opened from disk instead of served.
 *
 * The pages import ES modules, which browsers refuse to load over file://, and the error they show
 * names a module URL, which sends the reader looking at the module. This is a classic script, loaded
 * with a relative path and without `type="module"`, because it has to run where modules cannot.
 */
if (location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', function () {
        document.body.innerHTML = [
            '<div style="max-width:44rem;margin:15vh auto;padding:0 1rem;',
            'font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Roboto,sans-serif">',
            '<h1 style="font-size:1.4rem;margin:0 0 .5rem">This page has to be served, not opened</h1>',
            '<p style="margin:0 0 1rem;color:#475569">',
            'It imports ES modules from <code>dist/</code>, and browsers block module imports over ',
            '<code>file://</code>. Nothing is wrong with the package or your network.</p>',
            '<p style="margin:0 0 .5rem;color:#475569">From the repository root:</p>',
            '<pre style="background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;',
            'overflow:auto;margin:0 0 1rem"><code>npm run example</code></pre>',
            '<p style="margin:0;color:#475569">Then open ',
            '<a href="http://localhost:5173/">http://localhost:5173/</a>.</p></div>',
        ].join('');
    });
}
