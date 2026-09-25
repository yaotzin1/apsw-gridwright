import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import type { LocaleName, Settings } from './settings';

type Key = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

interface ControlsProps {
    readonly settings: Settings;
    readonly update: (patch: Partial<Settings>) => void;
}

const LOCALES: readonly [LocaleName, string][] = [
    ['en', 'English'],
    ['de', 'Deutsch'],
    ['es', 'Español'],
    ['fr', 'Français'],
    ['pl', 'Polski'],
];

/** The page's switches. Every one of them adds, removes or configures one add-on. */
export function Controls({ settings, update }: ControlsProps) {
    const toggle = (key: Key, label: ReactNode, options: { disabled?: string } = {}) => {
        const control = (
            <FormControlLabel
                key={key}
                disabled={options.disabled !== undefined}
                control={<Switch size="small" checked={settings[key]} onChange={(_event, on) => update({ [key]: on })} />}
                label={label}
            />
        );
        // A disabled switch says why, rather than leaving the reader to guess.
        return options.disabled ? (
            <Tooltip key={key} title={options.disabled} placement="right">
                <span>{control}</span>
            </Tooltip>
        ) : (
            control
        );
    };

    return (
        <Stack spacing={2.5}>
            <Section title="Core add-ons" note="Every tab. muiAddons() or coreAddons(), with the same options.">
                {toggle('mui', 'MUI views (muiAddons)')}
                {toggle('multiSort', 'Multi-column sort (Shift-click)')}
                {toggle('checkboxes', 'Checkbox column')}
                {toggle('selectAll', 'Select-all checkbox', settings.checkboxes ? {} : { disabled: 'Needs the checkbox column.' })}
                {toggle('selectOnRowClick', 'Select on row click')}
                <SelectionNote settings={settings} />
                <TextField
                    select
                    size="small"
                    label="Language"
                    value={settings.locale}
                    onChange={(event) => update({ locale: event.target.value as LocaleName })}
                    sx={{ mt: 1.5, maxWidth: 200 }}
                >
                    {LOCALES.map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                            {label}
                        </MenuItem>
                    ))}
                </TextField>
            </Section>

            <Section title="Add-ons" note="The Employees tab. Each switch is one entry in addons={[...]}.">
                {toggle('search', 'Search')}
                {toggle('columnFilters', 'Column filters')}
                {toggle('exportMenu', 'Export: CSV, Excel, Markdown, PDF')}
                {toggle('rowActions', 'Row actions menu')}
                {toggle('actionsColumn', 'Actions column: icon buttons per row')}
                {settings.actionsColumn && settings.rowActions && (
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ ml: 5.5, mb: 0.5, maxWidth: 220 }}>
                        Beside the buttons, the row menu opens on right-click only, so it never covers them.
                    </Typography>
                )}
                {toggle('inlineEditing', 'Inline editing')}
                {toggle('columnLayout', 'Column layout: resize, reorder, pin, hide')}
                {toggle('cellNavigation', 'Cell navigation and copy')}
                {toggle('rowDetail', 'Row detail with a nested grid', settings.virtualRows ? { disabled: 'A detail panel has no fixed height, so it cannot be windowed. Switch off virtual rows.' } : {})}
                {toggle('virtualRows', 'Virtual rows', settings.rowDetail ? { disabled: 'Switch off row detail first: windowing needs rows of one height.' } : {})}
                {toggle('urlSync', 'View in the URL')}
            </Section>
        </Stack>
    );
}

/** What the three selection switches amount to, since the combination is what matters. */
function SelectionNote({ settings }: { readonly settings: Settings }) {
    const parts = settings.selectOnRowClick
        ? [
              'Click a row to select it, and again to let it go. Its buttons and editable cells keep their own clicks.',
              settings.rowActions && !settings.actionsColumn && 'The row menu moves to hover and right-click, so the click stays one action.',
              !settings.checkboxes && 'Keyboard: switch on cell navigation, then Space selects the focused row.',
          ]
        : [!settings.checkboxes && 'No checkboxes and no row click: nothing selects a row. Switch on "Select on row click".'];
    const note = parts.filter(Boolean).join(' ');
    return note ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ ml: 5.5, mb: 0.5, maxWidth: 220 }}>
            {note}
        </Typography>
    ) : null;
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
    return (
        <div>
            <Typography variant="overline" component="h2" sx={{ lineHeight: 1.6 }}>
                {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                {note}
            </Typography>
            <FormGroup>{children}</FormGroup>
        </div>
    );
}
