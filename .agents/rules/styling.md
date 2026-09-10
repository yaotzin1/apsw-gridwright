# Styling & Interface Copy Rules

Binding.

## 1. The package ships structure, not a look

No font family, no brand colour, no fixed dimension outside the token block on `.gw-root`. A new
visual constant is a new `--gw-*` custom property with a documented default.

## 2. Dark mode is a token swap

Defined under `prefers-color-scheme: dark` and again under `[data-gw-theme='dark']`, so an explicit
choice wins in both directions. Never define a colour only inside a media query.

## 3. Reduced motion is respected

Any transition or animation is disabled under `prefers-reduced-motion: reduce`.

## 4. Every visible string lives in `labels`

`defaultLabels` in `src/react/labels.ts` is the complete set. A string literal rendered from JSX is
a defect. A string that embeds a number is a function, because word order around numbers differs by
language.

## 5. Class names are a public contract

`gw-*` names appear in consumer stylesheets. Renaming one is a breaking change.

## 6. No slop

No decorative sparkles, no placeholder charts, no empty ornamental containers, and no number the
grid computed rather than received.
