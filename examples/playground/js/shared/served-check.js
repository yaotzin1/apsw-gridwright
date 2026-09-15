/*
 * Says so plainly when a playground page is opened from disk instead of served.
 *
 * The pages import ES modules, which browsers refuse to load over file://, and the error they show
 * names a module URL, which sends the reader looking at the module. This is a classic script, loaded
 * with a relative path and without `type="module"`, because it has to run where modules cannot.
 *
 * Built from elements rather than an HTML string: the repository bans HTML sinks everywhere.
 */
if (location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', function () {
        const make = (tag, style, ...children) => {
            const node = document.createElement(tag);
            node.setAttribute('style', style);
            node.append(...children);
            return node;
        };
        const code = (text) => make('code', '', text);
        const muted = 'margin:0 0 1rem;color:#475569';

        document.body.replaceChildren(
            make('div', 'max-width:44rem;margin:15vh auto;padding:0 1rem;font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Roboto,sans-serif',
                make('h1', 'font-size:1.4rem;margin:0 0 .5rem', 'This page has to be served, not opened'),
                make('p', muted, 'It imports ES modules from ', code('dist/'), ', and browsers block module imports over ',
                    code('file://'), '. Nothing is wrong with the package or your network.'),
                make('p', 'margin:0 0 .5rem;color:#475569', 'From the repository root:'),
                make('pre', 'background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;overflow:auto;margin:0 0 1rem',
                    code('npm run example')),
                make('p', 'margin:0;color:#475569', 'Then open http://127.0.0.1:5173/.')),
        );
    });
}
