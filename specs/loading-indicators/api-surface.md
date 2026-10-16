# API surface contract: loading-indicators

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

> **Draft.** Written at stage 1 to make the spec reviewable. Stage 3 confirms the slot named below.

## Semver classification

**minor**

Reasoning: a new add-on, a new component, new types and new CSS custom properties are added. Nothing is
removed or renamed, no default changes, and a grid that does not list `loadingIndicator()` renders the markup
it did before. The one contract change is an optional `loadingRows` field on `StatusContribution`, additive
and absent unless an add-on sets it. Stage 3 found that the existing `status.loading` slot already replaces
the status row's content, so no new slot is needed for the spinner; only the skeleton needs `loadingRows`,
because it renders several table rows where `status.loading` renders the inside of one cell.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `loadingIndicator` | `apsw-gridwright/react` | `<TRow>(options?: LoadingIndicatorOptions) => GridAddon<TRow>` |
| `Spinner` | `apsw-gridwright/react` | `(props: SpinnerProps) => ReactElement` |
| `LOADING_INDICATOR_ADDON` | `apsw-gridwright/react` | `'gridwright:loading-indicator'` |
| `SpinnerVariant` | `apsw-gridwright/react` | `'ring' \| 'dot-walk' \| 'draw-g' \| 'cell-colors'` |
| `SpinnerRenderProps` | `apsw-gridwright/react` | `{ size: SpinnerSize; className: string; /** `currentColor`, for libraries that take a colour prop. */ color: string }` |
| `SpinnerComponent` | `apsw-gridwright/react` | `(props: SpinnerRenderProps) => ReactNode` |
| `RingSpinner`, `DotWalkSpinner`, `DrawGSpinner`, `CellColorsSpinner` | `apsw-gridwright/react` | `SpinnerComponent` |
| `SpinnerSize` | `apsw-gridwright/react` | `'sm' \| 'md' \| 'lg'` |
| `SkeletonShape` | `apsw-gridwright/react` | `'text' \| 'number' \| 'badge' \| 'avatar' \| 'none'` |
| `LoadingIndicatorOptions` | `apsw-gridwright/react` | see below |
| `SpinnerProps` | `apsw-gridwright/react` | see below |

```ts
interface LoadingIndicatorOptions {
    /** What to draw while loading. Default `'spinner'`. `'none'` keeps today's text only. */
    readonly variant?: 'spinner' | 'skeleton' | 'none';
    /** A built-in name or the consumer's own component. For `variant: 'spinner'` and the refresh
     *  indicator. Default `'ring'`. */
    readonly spinner?: SpinnerVariant | SpinnerComponent;
    readonly size?: SpinnerSize;
    /** Skeleton rows. Default 8, clamped to 1..50, and to the viewport under `virtualRows()`. */
    readonly rows?: number;
    /** Skeleton shape per column id. Default `text`. */
    readonly shapes?: Readonly<Record<string, SkeletonShape>>;
    /** Show a small spinner while `refreshing`. Default false. */
    readonly indicateRefresh?: boolean;
    /** Milliseconds before an indicator appears. Default 200. 0 shows it at once. */
    readonly delay?: number;
    /** Replace the indicator. The accessible-name rules still apply to what it returns. */
    readonly render?: (info: { status: 'loading' | 'refreshing'; columns: number }) => ReactNode;
}

type SpinnerProps = {
    readonly variant?: SpinnerVariant | SpinnerComponent; // default 'ring'
    readonly size?: SpinnerSize; // default 'md'
    readonly className?: string;
} & (
    | { /** The accessible name. */ readonly label: string; readonly decorative?: false }
    | { /** aria-hidden, no name. */ readonly decorative: true; readonly label?: undefined }
);
```

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `StatusContribution` | `loading`, `empty`, `error` | adds optional `loadingRows?: SlotRender<TRow>` | additive. When an active add-on sets it, `GridStatusBody` renders the returned `<tr>` elements in the body instead of the single status row. The last add-on to provide it wins, as for `loading` |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| the status row | the text "Loading…" | unchanged unless `loadingIndicator()` is listed |

No existing default changes. The defaults of the new options are in the interface above.

## CSS surface added

| Token | Default | Meaning |
| :--- | :--- | :--- |
| `--gw-spinner-size` | 1.5rem (`sm` 1rem, `lg` 2.25rem) | edge length |
| `--gw-spinner-color` | `var(--gw-accent)` | the moving part |
| `--gw-spinner-track-color` | translucent `currentColor` | the fixed part |
| `--gw-spinner-thickness` | 2px | stroke or bar weight |
| `--gw-spinner-duration` | 900ms | one cycle |
| `--gw-skeleton-base`, `--gw-skeleton-shine` | derived from the surface tokens | the two skeleton colours |
| `--gw-skeleton-duration` | 1400ms | one shimmer sweep |

New classes, all prefixed `gw-`: `gw-spinner`, `gw-spinner-<variant>`, `gw-skeleton-row`, `gw-skeleton-cell`.
No existing class is renamed.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
- [ ] The tree-shaking smoke test shows the shell does not bundle the add-on
