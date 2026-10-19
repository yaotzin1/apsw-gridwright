# Specification: Spinner cell colours

> **Status**: Draft
> **Stage entry**: 1
> **Semver impact**: minor (provisional; confirmed in api-surface.md)

---

## 1. The consumer problem

The `cell-colors` spinner follows the Gridwright mark: nine cells that take a colour in turn. The name
promises colours, but every cell takes the one `--gw-spinner-color`, so a developer who wants red, green and
blue can only recolour the whole spinner.

## 2. User stories

- **US-01.** As a developer, I give the `cell-colors` spinner up to three colours with custom properties.
- **US-02.** As a developer who sets one colour or none, I get the spinner I had.
- **US-03.** As a person using forced colours, I see the system highlight colour, not the developer's palette.

## 3. Acceptance criteria

- [ ] AC-01 `--gw-spinner-color-2` colours the second column of cells and `--gw-spinner-color-3` the third; the first column keeps `--gw-spinner-color`.
- [ ] AC-02 Each falls back to `--gw-spinner-color`, so setting neither renders as before.
- [ ] AC-03 Under `forced-colors: active` every cell is `Highlight`.
- [ ] AC-04 Reduced motion is unchanged: the spinner still stands on its one frame, in `--gw-spinner-color`.
- [ ] AC-05 No other spinner reads the new properties, and no markup or export changes.

## 4. Non-goals

- A palette prop or a colour per cell. Three tokens colour the three columns and nothing is added to the JS surface.
- Default colours. The default stays the accent, which follows the theme and `muiTheme()`.

## 5. Behaviour across the capability seam

Presentation only; the spinner knows nothing about where rows come from.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing, everything or pagination only | as specified |

## 6. Accessibility and interface copy

No new string. The spinner stays `aria-hidden`. Forced colours override the palette, so a person who asked for system colours gets them.

## 7. Delivery as a plugin

Stylesheet only. No add-on, plugin or export changes.

## Artifacts not written

- `plan.md`: three CSS rules and a keyframe; there is no design to plan.
- `tasks.md`: a single step; nothing worth tracking.
- `data-model.md`: no state or data shape.
- `research.md`: no alternatives weighed; the three-token form is the smallest that gives red, green and blue.
- `events.md`: no event and no pipeline stage.
