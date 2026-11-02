# Self-review: Framework-neutral adapter architecture

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

## 2. The local/remote seam

## 3. Public surface and semver

## 4. Accessibility and i18n

## 5. Supply chain and packaging

## 6. Honest output

## 7. Verification

```
<paste the actual output of npm run verify>
```

## Known gaps

<!-- What was deliberately left undone, and the condition that would justify doing it. -->

## Review debate, 2026-11-02 (interim, covers T-03 to T-08 only)

The Indaba engine is not installed on this machine, so this is not an Indaba run. It has the same
shape: an independent reviewer that saw only the branch diff critiqued it, the author answered with
code, and the reviewer attacked the answers (two rounds). Nothing here is a ruling by the maintainer.

Round 1 found eight issues; all were reproduced with a probe before fixing:
prototype-key lookups in slot and component registries (crash), no slot cycle guard (stack overflow),
`sanitizeNode` throwing on non-list children, unchecked style values, `type` checked only on `input`,
headless lint gaps (`.tsx`, `navigator`, relative adapter imports), a store that stopped notifying after
one listener threw, and a component guard that blocked legitimate recursion.

Round 2 found that the fixes held except three: the depth cap did not bound work (a component
rendering itself twice, or slots holding two of the next, expand exponentially inside 64 levels), the
CSS check was a denylist that `=rl(` and `src(` passed, and a style getter was read twice, so the
checked value was not the drawn one. Fixed with a 20 000-node budget, an allowlist of CSS functions that
also refuses backslashes, comments, `;`, braces and at-rules, and by checking a copy of the style.
Each has a regression test that fails without its fix.

## Known gaps

- Lint does not see dynamic `import('react')`, `require` or `globalThis.document` in the headless
  directories. A narrow selector would be cheap but a broad one could break core code; the headless
  lint test and review carry it until a renderer package makes it matter.
- The relative-import ban matches any path ending in a `react` directory, and does not catch an import
  that reaches the adapter through a barrel elsewhere.
- The CSS value check is deliberately conservative: a value using a function outside the allowlist is
  refused, and an adapter author who needs one must add it to `SAFE_CSS_FUNCTIONS` with a reason.
- Not started: T-09 onward, which waits on the C-4 decision (spec status line).
