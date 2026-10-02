# Specification Review: `responsive-layout`

> **Review Date:** 2026-10-02
> **Reviewer:** AI Agent (Jules)
> **Target Spec:** `specs/responsive-layout/` (`spec.md`, `api-surface.md`, `plan.md`, `tasks.md`, `review.md`)
> **Status:** Stage 2 -> Stage 5 Pre-Audit / Architectural Review
> **Purpose:** Confront the `responsive-layout` specification with codebase reality, verify pipeline compliance, evaluate architectural alignment, and analyze critical seam decisions (C-1 and C-6) before implementation.

---

## Executive Summary

The `responsive-layout` specification is exceptionally well-structured, articulate, and aligned with the core philosophy of Gridwright. It correctly identifies the boundary between view concerns (handled in React/CSS) and query concerns (handled in the headless core).

However, confronting the spec with the codebase reveals critical technical seam hazards, minor pipeline gaps, and essential edge cases that must be addressed prior to Stage 6 (Implementation).

---

## 1. Spec Pipeline & Artifact Compliance

### Compliant Aspects
- **Track & Stage Alignment**: Correctly classified as a `feature` track (minor semver impact). Stages 1 and 2 are fully elaborated in `spec.md`.
- **Contract & Plan Setup**: `api-surface.md`, `plan.md`, `tasks.md`, and `review.md` exist and follow template structures.
- **Artifacts Not Written Section**: `spec.md` explicitly names `research.md`, `data-model.md`, and `events.md` under `## Artifacts not written` with clear, valid justifications.

### Recommendations & Gaps
1. **Missing `columnSignature` in `api-surface.md`**: `plan.md` mentions that `columnSignature` must include `hideBelow` so that column definition changes trigger engine/hook reconciliation. However, `api-surface.md` does not document `columnSignature` under `GridAddon` contributions or `Exports changed`.
2. **`useContainerWidth()` Missing from React Entry Types Checklist**: `api-surface.md` lists `useContainerWidth` under added exports, but it is not explicitly referenced in `src/react/index.ts` exports list in `plan.md`.

---

## 2. Architectural Alignment & Headless / Core Boundary

### Principles Verified
- **Headless Core Preservation**: `src/core/` remains strictly headless and presentation-agnostic. `ColumnDef` in `src/core/types.ts` is untouched (Spec C-2), ensuring no DOM, CSS, or React types leak into the core engine or query pipeline.
- **React Adapter & Add-on Seam**: `responsive()` operates strictly as a React add-on (`src/react/responsive/`) and communicates via slot contributions (`toolbar`, `rootAttributes`, `tableAttributes`, `cellAttributes`, `columnLayout`).

### Key Seam Hazard & Nuances
- **Column Visibility Layering vs. `columnLayout()`**: `columnLayout()` currently manages user-driven column visibility via `ColumnLayoutState.hidden`. `responsive()` must layer `hideBelow` on top of user choices without mutating `ColumnLayoutState` or triggering `onChange` callbacks.
  - *Recommendation*: Ensure `responsive()` filters or hides columns by contributing to the resolved column rendering pipeline rather than invoking `ColumnLayoutController.toggleVisibility()`.

---

## 3. Technical Feasibility & Seam Hazards

### 3.1 `ResizeObserver` & Sentinel Ref Strategy
- **Trap**: `CLAUDE.md` and `plan.md` explicitly note that only one add-on may hold the table wrapper ref (`virtualRows()` holds `.gw-table-wrapper`).
- **Feasibility**: `responsive()` correctly renders a zero-height sentinel element in the `aboveTable` slot and finds `.gw-root` via `element.closest('.gw-root')`.
- **StrictMode Verification**: React 18 Strict Mode mounts, unmounts, and remounts components. The `ResizeObserver` must be instantiated and disconnected inside a `useLayoutEffect` / `useEffect` cleanup return to avoid observer leaks or stale width state.

### 3.2 `virtualRows()` Incompatibility (C-4 & AC-26)
- **Feasibility**: Stacking rows (`stackBelow`) breaks fixed-height virtualized row calculations.
- **Specification Rule**: When `virtualRows()` is present, `responsive()` must silently refuse `stackBelow` (keeping table layout intact) and document the behavior without throwing an error.
- **Implementation Mechanism**: The add-on must inspect `addonNamesOf(addons)` for `'gridwright:virtual-rows'` and disable the stacking behavior dynamically.

### 3.3 Pinned Column Overflow Cap (AC-11)
- **Feasibility**: When pinned column width exceeds 50% of the container width, pinning must be suppressed.
- **Technical Nuance**: Unpinning columns dynamically on narrow screens must not overwrite the user's stored pin state (`columnLayout` state). CSS or temporary render-time suppression must be used.

---

## 4. Deep-Dive on Stage 5 Seam Decisions (C-1 and C-6)

### 4.1 Decision C-1: `.gw-root` `container-type: inline-size`
- **Spec Proposal**: Making `.gw-root` an `inline-size` container allows CSS `@container` queries to adjust the toolbar and pagination relative to the grid width rather than `window.innerWidth`.
- **Shrink-to-Fit Risk Analysis**:
  1. `inline-block` parent: Without explicit `width`, `inline-size` containment prevents the grid from deriving width from table cells, collapsing the parent/grid width to `0px`.
  2. Floating parent (`float: left`): Same collapse risk.
  3. `flex: 1` or Flex item with `width: auto` and no `min-width`: Flex child collapses to `min-content` (0px).
- **Evaluation & Verdict**:
  - *Risk Level*: High for unconstrained / shrink-to-fit containers.
  - *Mitigation*: If Stage 5 testing confirms collapse in shrink-to-fit scenarios, `.gw-root` should retain `width: 100%` / `display: block` with a default `min-width: 0`, OR the `container-type: inline-size` should be placed on an inner `.gw-container` wrapper rather than the top `.gw-root` element.

### 4.2 Decision C-6: Touch Row Menu Trigger in `rowActions()` under `(hover: none)`
- **Spec Proposal**: Under `(hover: none)` (e.g., mobile Safari / Chrome on Android), `rowActions()` configured with `hover` or `hover-contextmenu` triggers cannot open via hover. C-6 proposes rendering a visible trigger button (`.gw-row-trigger`) at the end of the row.
- **Codebase Reality**: `src/react/plugins/BubbleMenu.tsx` currently relies on `onPointerOver`, `onFocus`, `onClick`, and `onContextMenu`. Mobile touch devices map `pointerover` unpredictably or not at all.
- **Evaluation & Verdict**:
  - *Maintainer Confirmation Needed*: The spec explicitly notes "Needs the maintainer's confirmation at the next stage".
  - *Architectural Recommendation*: Providing a visible trigger button (`.gw-row-trigger`) on touch devices restores accessibility (WCAG 2.1) without disrupting pointer users. However, care must be taken so that tapping `.gw-row-trigger` stops event propagation and does not trigger row selection (`selectOnRowClick`).

---

## 5. Accessibility (a11y) & i18n

### Accessibility (a11y)
1. **Grid Semantics Preservation in Stacked Layout (AC-21)**: Setting `display: block` or `display: grid` on `<table>`, `<tr>`, `<td>` causes browser accessibility trees (WebKit/Blink) to strip default table roles.
   - *Verification*: Explicit `role="grid"`, `role="row"`, `role="gridcell"`, `role="columnheader"` must be added via `rootAttributes`, `rowAttributes`, `cellAttributes`, and `headerAttributes`.
2. **Label Announcement (AC-22)**: Visual labels in stacked cards (`data-gw-label`) must not result in duplicate screen reader announcements. Using `aria-label` on the cell or visually hidden `<span>` labels must be tested against VoiceOver and NVDA.
3. **Touch Target Size (AC-04)**: Enforcing 44px hit areas under `(pointer: coarse)` satisfies WCAG 2.5.8 (Target Size - 24px) and Apple / Android HIG recommendations (44px/48px).

### Internationalization (i18n)
- **Message Catalog**: The new `gridwright:responsive` add-on catalog introduces 7 string keys (`sortBy`, `sortDirection`, `sortAscending`, `sortDescending`, `sortNone`, `hiddenAtThisWidth`, `rowActions`).
- **Translation Coverage**: Must include default translations for `en`, `de`, `es`, `fr`, and `pl`.

---

## 6. Edge Cases & Unhandled Scenarios

1. **Hydration Mismatch / SSR (AC-13 & C-8)**:
   - On initial server render, `useContainerWidth()` returns `initialWidth` (or `null`).
   - If `initialWidth` is unset, the grid renders unstacked with all columns. Upon hydration, `ResizeObserver` fires in a layout effect and updates width.
   - *Requirement*: Ensure no React hydration warning occurs between server markup and client first frame.
2. **Toolbar Wrap Overflows in Multi-Addon Scenarios**:
   - When multiple add-ons (Search, Column Filters, Export Menu, Column Picker, Quick Filters) are active simultaneously at 320px width, flex wrapping must prevent controls from clipping or hiding behind overflow boundaries.
3. **Multi-Sort Controls in Stacked Layout (AC-23)**:
   - The stacked sort control must support multi-column sorting state representation without requiring header clicks.

---

## Conclusion & Next Steps

The `responsive-layout` spec is thoroughly designed and ready for stage transitions once:
1. Stage 5 shrink-to-fit tests confirm whether C-1 container query placement needs an inner wrapper.
2. Maintainer confirms the C-6 touch trigger placement in `rowActions()`.
3. `api-surface.md` is updated to document the `columnSignature` contribution.
