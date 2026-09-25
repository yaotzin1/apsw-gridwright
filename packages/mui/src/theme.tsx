import { useColorScheme, useTheme } from '@mui/material/styles';
import { useMemo, type CSSProperties } from 'react';
import type { GridAddon } from 'apsw-gridwright/react';
import { muiTokens } from './tokens';

export const MUI_THEME_ADDON = 'gridwright:mui-theme';

/**
 * The grid in the colours, type, radius and spacing of the MUI theme it is rendered in.
 *
 * It sets the grid's `--gw-*` tokens on the root element, through `rootAttributes`, so the toolbar,
 * the table and the pager all take them, and the stylesheet stays the only stylesheet. It renders
 * nothing and changes no behaviour: any grid can list it, with the native controls or the MUI ones.
 */
export function muiTheme<TRow>(): GridAddon<TRow> {
    return {
        name: MUI_THEME_ADDON,
        setup: function useMuiTheme() {
            const theme = useTheme();
            const { colorScheme } = useColorScheme();
            // The scheme on screen: the live one under a CSS-variables theme, otherwise the palette's.
            const mode = colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : theme.palette.mode;
            // Per theme, not per render: the grid renders on every state change.
            const style = useMemo(() => ({ ...muiTokens(theme), fontFamily: theme.typography.fontFamily }) as CSSProperties, [theme]);

            return {
                // `data-gw-theme` so selectors of the consumer's own, and the stylesheet's dark block,
                // see the MUI mode rather than the operating system's.
                rootAttributes: () => ({ style, 'data-gw-theme': mode }),
            };
        },
    };
}
