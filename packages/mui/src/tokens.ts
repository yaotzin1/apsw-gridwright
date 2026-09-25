import { alpha, type Theme } from '@mui/material/styles';

/** The grid's custom properties, by name. `styles.css` reads every one of them. */
export type GridTokens = Readonly<Partial<Record<`--gw-${string}`, string>>>;

/** The part of a theme built with `cssVariables: true`: the same palette, as `var(--mui-…)` references. */
interface ThemeVars {
    readonly palette: {
        readonly background: { readonly paper: string; readonly default: string };
        readonly action: { readonly hover: string; readonly selectedOpacity: string | number };
        readonly text: { readonly primary: string; readonly secondary: string; readonly disabled: string };
        readonly primary: { readonly main: string; readonly mainChannel: string; readonly contrastText: string };
        readonly error: { readonly main: string };
        readonly divider: string;
    };
}

const length = (value: string | number | undefined): string | undefined =>
    value === undefined ? undefined : typeof value === 'number' ? `${value}px` : value;

/**
 * The grid's tokens from an MUI theme.
 *
 * With `theme.vars` (a theme created with `cssVariables: true`) every colour is a `var(--mui-…)`
 * reference, so switching the colour scheme restyles the grid without a render. Without it the
 * resolved values are written, and follow the theme when it changes and the grid renders again.
 *
 * `--gw-focus-ring` is left to the stylesheet, which builds it from `--gw-surface` and `--gw-accent`
 * on the same element; `--gw-row-height` and the pinned-column shadows keep their defaults.
 */
export function muiTokens(theme: Theme): GridTokens {
    const vars = (theme as Theme & { readonly vars?: ThemeVars }).vars;
    const palette = vars?.palette ?? theme.palette;
    const selected = vars
        ? `rgba(${vars.palette.primary.mainChannel} / ${vars.palette.action.selectedOpacity})`
        : alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity);

    const tokens: Record<string, string | undefined> = {
        '--gw-surface': palette.background.paper,
        '--gw-surface-muted': palette.background.default,
        '--gw-surface-hover': palette.action.hover,
        '--gw-surface-selected': selected,
        '--gw-text': palette.text.primary,
        '--gw-text-muted': palette.text.secondary,
        '--gw-border': palette.divider,
        '--gw-border-strong': palette.text.disabled,
        '--gw-accent': palette.primary.main,
        '--gw-accent-contrast': palette.primary.contrastText,
        '--gw-danger': palette.error.main,
        '--gw-font-size': length(theme.typography.body2.fontSize),
        '--gw-line-height': theme.typography.body2.lineHeight === undefined ? undefined : String(theme.typography.body2.lineHeight),
        '--gw-radius': length(theme.shape.borderRadius),
        '--gw-gap': theme.spacing(1),
        '--gw-cell-padding-x': theme.spacing(2),
        '--gw-cell-padding-y': theme.spacing(1),
    };
    return Object.fromEntries(Object.entries(tokens).filter((entry): entry is [string, string] => entry[1] !== undefined)) as GridTokens;
}
