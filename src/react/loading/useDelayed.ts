import { useEffect, useState } from 'react';

/**
 * True once `delay` milliseconds have passed since the component mounted, immediately when `delay`
 * is zero. A response that settles first unmounts the component, so a fast load never shows an
 * indicator. The first render is always the not-yet state, which server and client agree on.
 */
export function useDelayed(delay: number): boolean {
    const [ready, setReady] = useState(delay <= 0);
    useEffect(() => {
        if (delay <= 0) {
            setReady(true);
            return undefined;
        }
        setReady(false);
        const timer = setTimeout(() => setReady(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);
    return ready;
}
