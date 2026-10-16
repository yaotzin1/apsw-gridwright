import type { ReactNode } from 'react';

/** The spinners the package draws: a plain ring, and three that follow the Gridwright mark. */
export type SpinnerVariant = 'ring' | 'dot-walk' | 'draw-g' | 'cell-colors';

export type SpinnerSize = 'sm' | 'md' | 'lg';

/** What a skeleton cell stands in for. */
export type SkeletonShape = 'text' | 'number' | 'badge' | 'avatar' | 'none';

/** What a spinner component is given: its size, the class to put on its root, and a colour hint. */
export interface SpinnerRenderProps {
    readonly size: SpinnerSize;
    readonly className: string;
    /** `currentColor`, for a library whose spinner takes a colour prop. */
    readonly color: string;
}

/** A spinner of the consumer's own, or one from a library: any component of these props. */
export type SpinnerComponent = (props: SpinnerRenderProps) => ReactNode;

export type SpinnerProps = {
    /** A built-in name or a component. Default `'ring'`. */
    readonly variant?: SpinnerVariant | SpinnerComponent;
    /** Default `'md'`. */
    readonly size?: SpinnerSize;
    readonly className?: string;
} & (
    | {
          /** The accessible name. Required unless the spinner is decorative. */
          readonly label: string;
          readonly decorative?: false;
      }
    | {
          /** Hide the spinner from assistive technology, because a label beside it says what is happening. */
          readonly decorative: true;
          readonly label?: undefined;
      }
);

export interface LoadingIndicatorOptions {
    /** What to draw while loading. Default `'spinner'`. `'none'` keeps the grid's own text. */
    readonly variant?: 'spinner' | 'skeleton' | 'none';
    /** A built-in name or your own component, for the spinner and the refresh indicator. Default `'ring'`. */
    readonly spinner?: SpinnerVariant | SpinnerComponent;
    readonly size?: SpinnerSize;
    /** Skeleton rows. Default 8, between 1 and 50, and never more than a page. */
    readonly rows?: number;
    /** The skeleton shape of a column, by column id. Default `'text'`. */
    readonly shapes?: Readonly<Record<string, SkeletonShape>>;
    /** Show a small spinner while the grid refreshes over rows it already has. Default false. */
    readonly indicateRefresh?: boolean;
    /** Milliseconds before an indicator appears, so a fast response does not flash one. Default 200. */
    readonly delay?: number;
    /** Draw the indicator yourself. It is hidden from assistive technology; the grid keeps its own text. */
    readonly render?: (info: { readonly status: 'loading' | 'refreshing'; readonly columns: number }) => ReactNode;
}
