# Debate: adapter_review_debate

Outcome: reached after 3 round(s).

## Round 1: claude (CRITIQUE)

```text
These are my findings, each from reading the files. I ran nothing.

1. **`src/react/view/render-node.tsx:46-49`, `src/view/node.ts:135`.** A `focus` action carries a DOM `targetId`, and the renderer calls `getRootNode().getElementById(...)`. Any add-on can therefore focus any element with an id in the document, including other grids and the page. A consumer's own renderer could not do that. The spec (api-surface 1d) says the target is a node `key`, resolved only within the add-on's own output. Only `settled` follows that rule (`adapt.tsx:132`). Handler actions don't.

2. **`src/view/node.ts:234-238`.** `isSafeCssValue` is checked, but style property names never are. `position:fixed; inset:0; zIndex` is accepted, which allows a click-capturing overlay that redresses the UI. A string renderer would also print the unchecked property names.

3. **`src/view/attributes.ts:11-12`, `src/view/node.ts:51-72`.** `id`, `name` and `htmlFor` are allowlisted for every tag, so an add-on can clobber DOM names and collide with the page's ids. `id` is also what finding 1 resolves.

4. **`src/view/host.ts:174,185`.** `focusRequest` stays set until `takeFocusRequest()` is called. If no renderer takes it, a later unrelated render applies a stale focus move and steals focus.

5. **`src/react/view/to-view-event.ts:81-84`.** `origin` is read lazily after dispatch. `target.closest` and the document selection are then read from a tree React may have changed, and `textSelected` reflects the later selection. A handler that reads it asynchronously gets wrong answers.

6. **Spec and code disagree.**
   - `api-surface.md:14,21` lists six handlers, while `HANDLER_NAMES` has eight (`node.ts:128`).
   - The spec's `ViewAction` focus target is a `FocusTarget`, but the code uses `targetId`.
   - The spec says `ViewEvent` has no `targetId`, but the code adds one (`to-view-event.ts:73`), which exposes DOM ids.
```

## Round 1: antigravity (CRITIQUE)

```text
I agree with Claude's findings 1–5 and 6a–b, but **6c is wrong** (`targetId?: string` is in [`spec.md:168`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/spec.md#L168) and [`api-surface.md:20`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L20)), and three critical issues are missing. My six findings:

1. **[`src/view/attributes.ts:28-33`](file:///D:/projects/private/apsw-gridwright/src/view/attributes.ts#L28-L33), [`src/react/view/adapt.tsx:205,218,223`](file:///D:/projects/private/apsw-gridwright/src/react/view/adapt.tsx#L205-L228).** `headerAttributes`, `tableAttributes` and `rowAttributes` bypass [`sanitizeNode`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L263) and pass only through [`mergeAttributes`](file:///D:/projects/private/apsw-gridwright/src/view/attributes.ts#L47). [`isContributable`](file:///D:/projects/private/apsw-gridwright/src/view/attributes.ts#L27) accepts any `on[A-Z]*` function and any non-null `style` object without [`isSafeCssValue`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L95), letting a neutral add-on receive raw React `SyntheticEvent`s (with live DOM targets) and inject unsafe CSS `url(...)` values.

2. **[`src/react/view/render-node.tsx:44-50`](file:///D:/projects/private/apsw-gridwright/src/react/view/render-node.tsx#L44-L50), [`src/view/node.ts:51-59,135,234-238`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L51-L238).** Handler `focus` actions use `targetId` and `getRootNode().getElementById(...)`, letting an add-on focus any element in the document instead of a scoped node `key` ([`api-surface.md:80,92`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L80-L92)). Allowlisting `id`/`name`/`htmlFor` enables DOM collisions, and `style` property names are never validated (allowing UI-redressing overlays and CSS injection via property names in [`text-renderer.ts:65`](file:///D:/projects/private/apsw-gridwright/src/view/text-renderer.ts#L65)).

3. **[`src/view/host.ts:102,165-176`](file:///D:/projects/private/apsw-gridwright/src/view/host.ts#L102-L176), [`src/view/addons/pagination.ts:108`](file:///D:/projects/private/apsw-gridwright/src/view/addons/pagination.ts#L108).** `refresh()` notifies `listeners` *before* running `settled()`, and `pressed.set(null)` inside `settled()` synchronously triggers a second `refresh()` before `focusRequest = request.key` runs. Subscribers reading `takeFocusRequest()` during notification see `null`, a stale `focusRequest` lingers if unread, and page presses rebuild the model twice.

4. **[`src/view/addons/selection.ts:116-123`](file:///D:/projects/private/apsw-gridwright/src/view/addons/selection.ts#L116-L123), [`src/react/view/adapt.tsx:214`](file:///D:/projects/private/apsw-gridwright/src/react/view/adapt.tsx#L214), [`src/view/model/table-model.ts:270-293`](file:///D:/projects/private/apsw-gridwright/src/view/model/table-model.ts#L270-L293).** Per-row work is redone for every row: `rowHandlers` allocates a fresh closure per row (violating [`api-surface.md:178`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L178)), `rowModelOf` recomputes `extras` and `slotValues` per row, and `adapt.tsx` mounts a `<NeutralSlot>` (with hooks and `sanitizeNode`) per extra-column cell.

5. **[`src/react/view/to-view-event.ts:81-84`](file:///D:/projects/private/apsw-gridwright/src/react/view/to-view-event.ts#L81-L84).** Lazy `origin` reads live DOM hierarchy and `getSelection()` after dispatch, returning mutated state if read asynchronously.

6. **[`specs/adapter-architecture/api-surface.md:14,21,41,192`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L14-L192), [`src/view/resolve.ts:141`](file:///D:/projects/private/apsw-gridwright/src/view/resolve.ts#L141), [`src/conformance/index.ts:29`](file:///D:/projects/private/apsw-gridwright/src/conformance/index.ts#L29).** Spec and code disagree on `resolveContributions` vs `resolveSet`, `conformanceSuite` signature (`runner` parameter and `skip` record vs array), `HANDLER_NAMES` count (8 vs 6), and `ViewAction` (`targetId` vs `target: FocusTarget`).
```

## Round 2: claude (CRITIQUE)

```text
I accept most of antigravity's list. I withdraw one item of mine and I want one item added and one reworded.

**Withdrawn:** my 6c was wrong. `ViewEvent.targetId` is in the spec (`spec.md:168`, `api-surface.md:20`). The code at `to-view-event.ts:73` matches it. The real mismatch is that `ViewAction` uses `target: FocusTarget` (`api-surface.md:21`) while the code uses a DOM `targetId`. That is finding 2 below.

**Agreed, kept in the final list:**
1. `adapt.tsx:205-223`: header, table and row attributes skip `sanitizeNode`. They go through `mergeAttributes` only, so raw `on*` functions and unchecked `style` reach React. This is the strongest finding and I missed it.
2. `render-node.tsx:44-50`: a `focus` action resolves a DOM id across the whole document. It should resolve a node `key` within the add-on's own output.
3. `node.ts:234-238`: style property names are unchecked, which allows a fixed-position overlay and CSS injection when `text-renderer.ts:65` prints them. `id`, `name` and `htmlFor` are allowlisted for every tag.
4. `host.ts:102,165-176`: `refresh()` notifies listeners before `settled()` runs, and `settled()` can trigger a second refresh. A subscriber reading `takeFocusRequest()` sees null, and an untaken request goes stale and moves focus later.
5. `to-view-event.ts:81-84`: lazy `origin` reads the DOM after dispatch.

**Reworded:** the per-row closure claim (their 4) is only worth keeping if `api-surface.md:178` really forbids it. I have not checked that, and `rowModelOf` recomputing `extras` per row needs a line reference before it counts as a violation.

**Spec versus code:** keep the `HANDLER_NAMES` mismatch (eight in code, six in the spec) and the `ViewAction` mismatch. The `resolveSet` and `conformanceSuite` mismatches are plausible, but I have not verified them myself.
```

## Round 2: antigravity (AGREEMENT)

```text
I accept the converged findings (1–5 and spec mismatches on `HANDLER_NAMES` and `ViewAction`), with the exact line references Claude requested for the per-row work and spec mismatches so they can remain in the final report:

- **Per-row work (finding 4 / reworded item):**
  - [`specs/adapter-architecture/api-surface.md:178-179`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L178-L179) explicitly states: *"`rowHandlers` is called per rendered row, so it returns a cached object for a row whose `selected` did not change (hot-path rule, performance.md section 8)."* In [`src/view/addons/selection.ts:116-123`](file:///D:/projects/private/apsw-gridwright/src/view/addons/selection.ts#L116-L123), `rowHandlers` instead allocates a fresh `{ click: (event) => { ... } }` object and closure on every call, closing over `row.id`.
  - In [`src/view/model/table-model.ts:271-293`](file:///D:/projects/private/apsw-gridwright/src/view/model/table-model.ts#L271-L293), [`rowModelOf`](file:///D:/projects/private/apsw-gridwright/src/view/model/table-model.ts#L262) recomputes `slotValues(active, 'rowAttributes')` (line 271), `slotValues(active, 'rowHandlers')` (line 273), `active.flatMap(({ contribution }) => contribution.columns ?? [])` (line 274), and `extras.filter(...)` (lines 290, 292) for every row instead of hoisting them once per model in [`buildTableModel`](file:///D:/projects/private/apsw-gridwright/src/view/model/table-model.ts#L156).
  - In [`src/react/view/adapt.tsx:214`](file:///D:/projects/private/apsw-gridwright/src/react/view/adapt.tsx#L214), each extra-column cell renders `<NeutralSlot>`, running hooks and [`sanitizeNode`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L263) per row.

- **Spec vs. code signatures (finding 6):**
  - [`specs/adapter-architecture/api-surface.md:42`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L42) specifies `resolveContributions<TRow, TNode>(...): ResolvedContributions<TRow, TNode>`, while [`src/view/resolve.ts:124,141`](file:///D:/projects/private/apsw-gridwright/src/view/resolve.ts#L124-L141) exports `resolveSet` and `ResolvedSet`.
  - [`specs/adapter-architecture/api-surface.md:192`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L192) specifies `conformanceSuite(driver, options?: { skip?: readonly string[] })`, while [`src/conformance/index.ts:29`](file:///D:/projects/private/apsw-gridwright/src/conformance/index.ts#L29) has `conformanceSuite(driver, runner: Runner, options?: ConformanceOptions)` where `skip` is `Readonly<Record<string, string>>`.
```

## Round 3: claude (AGREEMENT)

```text
I accept the converged list as the review's result.

Findings I'd keep:
1. `adapt.tsx:205-223`: header, table and row attributes skip `sanitizeNode`. Raw `on*` functions and unchecked `style` reach React.
2. `render-node.tsx:44-50`: a `focus` action resolves a DOM `targetId` across the whole document. The spec says it should resolve a node `key` within the add-on's own output.
3. `node.ts:234-238`: style property names are unchecked, and `id`, `name` and `htmlFor` are allowlisted for every tag.
4. `host.ts:102,165-176`: `refresh()` notifies listeners before `settled()` runs. A stale focus request can linger.
5. `to-view-event.ts:81-84`: lazy `origin` reads the DOM after dispatch.
6. Per-row work: `api-surface.md:178-179` requires a cached `rowHandlers` object, but `selection.ts:116-123` allocates a new one per call. `table-model.ts:271-293` recomputes slot values per row.
7. Spec and code disagree on `HANDLER_NAMES` (eight in code, six in the spec), on `ViewAction` (`targetId` in code, `target: FocusTarget` in the spec), on `resolveContributions` versus `resolveSet`, and on the `conformanceSuite` signature.

Rewording:
- Finding 4 should say that a notified subscriber may read a null `takeFocusRequest()` before `settled()` sets it. Antigravity's "double refresh" claim needs a line reference before it counts as a defect.
- I would drop "`<NeutralSlot>` per extra-column cell" as a violation unless it is shown to be measurably per-row work.
- The `resolveSet` and `conformanceSuite` mismatches are verified only by antigravity's line references. I did not check them myself.
```

## Round 3: antigravity (AGREEMENT)

```text
I accept the converged 7-point list as the final review result, including Claude's rewording of Finding 4 and dropping the `<NeutralSlot>` sub-point.

Final agreed findings:
1. **[`src/react/view/adapt.tsx:205-223`](file:///D:/projects/private/apsw-gridwright/src/react/view/adapt.tsx#L205-L223), [`src/view/attributes.ts:28-33`](file:///D:/projects/private/apsw-gridwright/src/view/attributes.ts#L28-L33):** `headerAttributes`, `tableAttributes`, and `rowAttributes` bypass [`sanitizeNode`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L263) and pass only through [`mergeAttributes`](file:///D:/projects/private/apsw-gridwright/src/view/attributes.ts#L47), letting raw `on[A-Z]*` functions and unsanitized `style` values reach React.
2. **[`src/react/view/render-node.tsx:44-50`](file:///D:/projects/private/apsw-gridwright/src/react/view/render-node.tsx#L44-L50), [`src/view/node.ts:135`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L135):** Handler `focus` actions resolve a DOM `targetId` across the document via `getRootNode().getElementById(...)` instead of a node `key` scoped to the add-on's output ([`api-surface.md:80,92`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L80-L92)).
3. **[`src/view/node.ts:51-72,234-238`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L51-L238), [`src/view/attributes.ts:11-12`](file:///D:/projects/private/apsw-gridwright/src/view/attributes.ts#L11-L12):** Style property names are unchecked (enabling fixed-position UI-redressing overlays and CSS injection in [`text-renderer.ts:65`](file:///D:/projects/private/apsw-gridwright/src/view/text-renderer.ts#L65)), and `id`, `name`, and `htmlFor` are allowlisted globally.
4. **[`src/view/host.ts:102,165-185`](file:///D:/projects/private/apsw-gridwright/src/view/host.ts#L102-L185):** [`refresh`](file:///D:/projects/private/apsw-gridwright/src/view/host.ts#L155) notifies listeners before `settled()` runs, so a notified subscriber reading [`takeFocusRequest`](file:///D:/projects/private/apsw-gridwright/src/view/host.ts#L183) sees `null`, an untaken request lingers to steal focus later, and [`pressed.set(null)`](file:///D:/projects/private/apsw-gridwright/src/view/addons/pagination.ts#L108) inside `settled()` triggers a synchronous second `refresh()` via [`createViewSignal`](file:///D:/projects/private/apsw-gridwright/src/view/host.ts#L102).
5. **[`src/react/view/to-view-event.ts:81-84`](file:///D:/projects/private/apsw-gridwright/src/react/view/to-view-event.ts#L81-L84):** Lazy `origin` reads the DOM and document selection after dispatch.
6. **[`src/view/addons/selection.ts:116-123`](file:///D:/projects/private/apsw-gridwright/src/view/addons/selection.ts#L116-L123), [`src/view/model/table-model.ts:271-293`](file:///D:/projects/private/apsw-gridwright/src/view/model/table-model.ts#L271-L293):** `rowHandlers` allocates a new closure per row (violating [`api-surface.md:178-179`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L178-L179)), and [`rowModelOf`](file:///D:/projects/private/apsw-gridwright/src/view/model/table-model.ts#L262) recomputes slot values and column slices per row.
7. **[`specs/adapter-architecture/api-surface.md:14,21,42,192`](file:///D:/projects/private/apsw-gridwright/specs/adapter-architecture/api-surface.md#L14-L192), [`src/view/node.ts:128`](file:///D:/projects/private/apsw-gridwright/src/view/node.ts#L128), [`src/view/resolve.ts:141`](file:///D:/projects/private/apsw-gridwright/src/view/resolve.ts#L141), [`src/conformance/index.ts:29`](file:///D:/projects/private/apsw-gridwright/src/conformance/index.ts#L29):** Spec and code disagree on `HANDLER_NAMES` (8 vs 6), `ViewAction` (`targetId` vs `target: FocusTarget`), `resolveSet` vs `resolveContributions`, and `conformanceSuite` parameters.
```
