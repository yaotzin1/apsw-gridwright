import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const WcagContext = createContext(false);

export function WcagProvider({ children }: { readonly children: ReactNode }) {
    return <WcagContext.Provider value={true}>{children}</WcagContext.Provider>;
}

/**
 * Whether the grid lists `wcag()`. False everywhere else.
 *
 * What an add-on of your own, or one of ours, reads to render something only the WCAG 2.2 AA mode
 * asks for (the column picker's move and width controls are one), so the mode stays one switch. It
 * never throws: a control that is optional by design has nothing to complain about.
 */
export function useWcagEnabled(): boolean {
    return useContext(WcagContext);
}
