---
name: application_security
description: Use before writing or reviewing any code that renders, serializes, fetches, parses, serves or extends anything - components, add-ons, exporters, data sources, the playground and the scripts. Covers the exploit classes a data grid actually has, the banned APIs, and the safe patterns that replace them. Blocking - there are no exceptions.
---

# Application Security

Security is a gate with the same standing as the headless boundary and zero runtime dependencies.
A pattern listed here as banned is not discouraged, it is refused: by ESLint, by
`scripts/security-audit.mjs` in the pre-commit hook and in CI, and in review. A change that seems to
need a banned pattern needs a different design, not an exception. If you believe the rule is wrong,
change this skill and `workflow.ai.yml` in their own reviewed change first; never work around it
inline.

## The threat model

This package is installed into other people's applications. Everything below is attacker-reachable
in some deployment, so treat it as hostile:

| Input | Where it comes from | What it can attack |
| :--- | :--- | :--- |
| Row values | a server, a CSV upload, another user | the DOM, attributes, URLs, CSS, exported files, printed documents, the clipboard |
| Error messages | a server response | the DOM |
| Filter values, search terms | the reader | request URLs, server queries, regexes |
| Column ids, header text | usually the developer, sometimes a server-driven column set | selectors, attributes, templates |
| Translations and `messages` | translators, a CMS, an i18n service | the DOM |
| Add-ons and plugins | third-party packages | everything the package lets them reach |
| Report templates | often user-editable in the consuming app | exported files, printed documents |
| Playground and scripts | anyone on the same network as a developer | the developer's machine and repository |

The package's job is to make the safe path the only path it offers: nothing it exports may hand a
consumer or an add-on an HTML sink, a script sink or an unencoded URL.

## Banned, everywhere in the repository

`src/`, `examples/`, `scripts/` and `tests/`. Enforced by `scripts/security-audit.mjs` and ESLint.

| Banned | Why | Use instead |
| :--- | :--- | :--- |
| `dangerouslySetInnerHTML` | an HTML sink for every consumer and add-on | render text; build elements with React |
| `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML`, `document.write`, `DOMParser` into the live DOM | HTML sinks | `textContent`, `createElement`, `replaceChildren` |
| `eval`, `new Function`, `setTimeout`/`setInterval` with a string | script sinks | functions |
| `javascript:`, `data:` or `vbscript:` URLs built in code | script URLs | an allowlist of `http:`, `https:`, `mailto:`, `tel:` and relative URLs |
| `iframe` without a `sandbox` that omits `allow-scripts` | a same-origin document runs scripts with the host page's rights | `sandbox="allow-same-origin allow-modals"` set before `srcdoc` |
| `target="_blank"` without `rel="noopener noreferrer"` | reverse tabnabbing | always both |
| `postMessage(…, '*')` | leaks to any origin | an explicit target origin |
| `window.open` in `src/` | popups, opener access | an anchor with `rel="noopener"` |
| writing `__proto__`, `prototype` or `constructor` keys from data, or deep-merging untrusted objects | prototype pollution | `Map`, `Object.create(null)`, explicit field copies |
| a regular expression with nested quantifiers run over row data or user input | ReDoS | linear parsing or a bounded pattern |
| `child_process`, `vm`, dynamic `require` / `import()` of a computed path in `src/` | code execution | nothing; the package has no reason to |
| `console.log` of row data, credentials or request bodies | data leaks into logs | log ids and counts |
| `dependencies` in `package.json`; `preinstall`, `install`, `postinstall` scripts | supply chain | see `security_guard` |

## Required patterns

**Text is text.** Render every value, message, header and error through React children or
`textContent`. React's escaping is the defence; the moment markup is assembled as a string for the DOM,
it is gone.

**Every generated document escapes at the boundary.** CSV goes through formula escaping
(`=`, `+`, `-`, `@`, tab, carriage return get an apostrophe). XML and HTML go through one escaper that
also strips control characters XML rejects. Markdown is escaped before the renderer decides what is
markup, and a link keeps its `href` only for `http:`, `https:`, `mailto:`, `tel:` or a relative path.
A new format gets the same treatment and a test proving it, with a hostile value, before it merges.

**The clipboard is a generated document.** What `cellNavigation()` copies is pasted into a
spreadsheet or a rich-text editor by somebody who did not write the rows, and a spreadsheet given
both flavours pastes the HTML one. So both get the formula guard and the HTML flavour goes through
the same escaper; `tests/react/cell-navigation-clipboard.test.tsx` feeds `=HYPERLINK(...)` and an
`<img onerror>` through both. Write to it only inside the browser's `copy` event through
`clipboardData.setData`: no `execCommand`, no hidden textarea stealing focus, and nothing that reads
the clipboard back.

**Printed documents run without scripts.** The print frame is sandboxed without `allow-scripts`, so a
`<script>` that reaches a report through a template, a stylesheet option or a consumer's markup does
not execute. A test asserts the attribute.

**Selectors and attributes are encoded.** `CSS.escape` for any value placed in a selector;
`encodeURIComponent` or `URLSearchParams` for any value placed in a URL; never concatenate a row
value into `style`, `href`, `src` or an event attribute.

**Parsing untrusted JSON copies fields explicitly.** Read the fields you expect into a fresh object or
a `Map`. Never spread or merge a parsed object into configuration or a prototype-bearing object.

**Add-ons get no sink the package does not have.** Slot contributions are React nodes and plain data.
No slot accepts an HTML string, a script, or a URL that is placed into the DOM unchecked. An add-on
can render whatever React lets it render, which is the same power a consumer's cell renderer has; the
package does not widen it.

**Failures do not echo input into markup.** A thrown error's message is rendered as text, and
developer messages go to `onError` or the console, never into an HTML string.

## The playground and the scripts are in scope

A development server is an attack surface on the developer's network.

- Bind to `127.0.0.1` by default. Listening on every interface needs an explicit `HOST`.
- Serve only an allowlist of directories (`dist/`, `examples/`). Never the repository root, never
  `.git`, never `node_modules`, never a dotfile.
- Resolve a requested path and check it with `path.relative`, rejecting anything that starts with
  `..` or is absolute. A `startsWith(root)` check is a bug: a sibling directory whose name begins with
  the root's name passes it.
- Cap request bodies. An unbounded read is a memory exhaustion.
- Playground pages follow every rule above: no `innerHTML`, `rel="noopener noreferrer"` on new tabs.

## Review questions

Answer these in `specs/<feature>/review.md` under "Supply chain and packaging", for every change:

1. Which untrusted inputs does this change touch, and which sink does each reach?
2. Does any new code create a string that becomes markup, a URL, a selector, a style or a script?
   Where is it encoded, and which test feeds it a hostile value?
3. Does any new extension point let third-party code reach something a consumer's own renderer could
   not?
4. Did `scripts/security-audit.mjs` pass, and did it scan the built `dist/` as well?

## Reporting

A vulnerability in a published version is reported privately as `SECURITY.md` describes, fixed in a
patch, and recorded in `CHANGELOG.md` under "Security" once released.
