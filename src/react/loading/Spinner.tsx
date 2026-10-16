import { classes } from '../context';
import { BUILT_IN_SPINNERS } from './spinners';
import type { SpinnerProps } from './types';

/**
 * A spinner, in the grid or out of it. Needs no provider and no add-on.
 *
 *     <Spinner label="Saving" />
 *     <Spinner variant="draw-g" size="lg" label="Loading" />
 *     <Spinner variant={() => <ClipLoader size={24} color="currentColor" />} decorative />
 *
 * `variant` is a built-in name or a component of your own, a library's included. Either way the
 * wrapper is this one's: a spinner with a `label` is an image with that name, and a decorative one
 * is hidden from assistive technology, so a replacement cannot leave a stream of unnamed nodes behind.
 */
export function Spinner(props: SpinnerProps) {
    const { variant = 'ring', size = 'md', className } = props;
    const Art = typeof variant === 'function' ? variant : BUILT_IN_SPINNERS[variant];
    const decorative = props.decorative === true;

    return (
        <span
            className={classes('gw-spinner', `gw-spinner--${size}`, className)}
            {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': props.label })}
        >
            <Art size={size} className="gw-spinner-art" color="currentColor" />
        </span>
    );
}
