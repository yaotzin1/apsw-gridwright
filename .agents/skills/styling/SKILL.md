---
name: styling
description: Use when touching CSS, class names, or any user-visible string. Covers the unstyled contract, CSS custom properties, dark mode, and why every label lives in one object.
---

# Unstyled Design System & i18n

This package ships structure, not a look. A consumer's design system wins every disagreement.

## The stylesheet is a token surface

Everything visible is a CSS custom property declared on `.gw-root`. Theming is:

```css
.my-page { --gw-accent: #7c3aed; --gw-row-height: 44px; }
```

Rules that keep it true:

- No font family, no brand colour, no fixed dimension outside the token block.
- A new visual constant is a new `--gw-*` property with a documented default, never a literal in a
  rule body.
- Dark mode is a token swap under `prefers-color-scheme`, with `[data-gw-theme]` able to override
  it in both directions. Never define a colour only inside a media query.
- Respect `prefers-reduced-motion`. The only transition in the stylesheet is the busy fade, and it
  is disabled there.

## Class names are public

Consumers style against `gw-row` and `gw-cell`. Renaming one breaks their CSS without breaking
their build, so treat it as a major version. The `classNames` prop exists so consumers can add
their own without depending on ours; keep every slot in `GridwrightClassNames` wired up.

## Every visible string lives in `labels`

A string literal in JSX cannot be translated, and this package is used in applications that are.
All of them are in `defaultLabels`, and a consumer overrides any subset through the `labels` prop.

`pageRange` is a function rather than a template because word order around numbers differs by
language, and a sentence assembled from fragments cannot be translated correctly. Any new string
that embeds a number should be a function for the same reason.

## What not to render

No decorative sparkles. No placeholder charts. No invented numbers: when a paginating source sends
no total, the range says "of many", because a number computed from a single page is a number the
reader would act on, and it would be wrong.
