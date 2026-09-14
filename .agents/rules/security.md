# Security Rules

Binding, blocking, and without exceptions. The detail and the reasons are in
`.agents/skills/application_security/SKILL.md` (code) and `.agents/skills/security_guard/SKILL.md`
(supply chain). `scripts/security-audit.mjs` and ESLint enforce what a machine can check; review
enforces the rest.

## 1. Banned APIs, everywhere

`src/`, `examples/`, `scripts/`, `tests/`:

- HTML sinks: `dangerouslySetInnerHTML`, assigning `innerHTML` or `outerHTML`, `insertAdjacentHTML`,
  `document.write`.
- Script sinks: `eval`, `new Function`, `setTimeout` or `setInterval` with a string.
- `postMessage` to `'*'`; `target="_blank"` without `rel="noopener noreferrer"`.
- Writing `__proto__` or a prototype from code that handles data.
- Disabling a security lint rule inline.

Under `src/` additionally: `window.open`, `child_process`/`vm`/`worker_threads`, computed dynamic
imports, and `console.log`/`info`/`debug`/`trace`.

## 2. Documents the package builds are inert

An `iframe` document exists only in the print frame, is sandboxed before it has content, and the
sandbox never includes `allow-scripts`. A test asserts it.

## 3. Everything written from data is escaped at its boundary

CSV cells are formula-escaped. XML and HTML go through one escaper. Markdown is escaped before
rendering, and links keep an `href` only for `http:`, `https:`, `mailto:`, `tel:` or a relative path.
Values in selectors use `CSS.escape`; values in URLs use `URLSearchParams` or `encodeURIComponent`.
Row values never reach `style`, `href`, `src` or an event attribute unencoded.

## 4. Extension points do not widen the attack surface

Add-ons, plugins and slots receive React nodes and plain data. No extension point accepts an HTML
string, a script, or a URL placed into the DOM without the checks above.

## 5. Zero runtime dependencies

`dependencies` is empty. React is an optional peer dependency. An addition requires a recorded
decision in the feature's spec.

## 6. Nothing runs on install

No `preinstall`, `install`, `postinstall` or `prepare` script.

## 7. The tarball is an allowlist

`files` lists exactly `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`. Source maps carry no absolute
paths. Verify with `npm pack --dry-run`.

## 8. Install configuration is not weakened

`.npmrc` never sets `strict-ssl=false`, an `http:` registry, or `audit=false`, and never holds a
literal token.

## 9. The development server is local and narrow

Binds to `127.0.0.1` unless `HOST` is set, serves only `dist/` and `examples/`, refuses dotfiles and
`node_modules`, checks paths with `path.relative`, and caps request bodies.

## 10. Skill files are scanned

`scripts/validate-skills.mjs` audits every `SKILL.md` for leaked credentials, prompt-injection
patterns and unsafe path references, and blocks the commit.

## 11. No secrets in the repository

No tokens, no internal URLs, no customer data in fixtures. Test fixtures use invented people.

## 12. Vulnerabilities are reported privately

As `SECURITY.md` describes.
