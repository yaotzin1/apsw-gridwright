import { useId } from 'react';
import { useAddonMessages } from '../addons/context';
import { useDensity } from './context';
import { DENSITY_ADDON, densityMessages } from './messages';
import type { DensityLevel } from './types';

/**
 * The choice of level, as a native select with a label.
 *
 * Native on purpose: it is reached by Tab, changed with the arrow keys, Home and End, announced with its
 * label and value by every screen reader, and it needs no code of ours to do any of that. Changing it
 * says nothing in the grid's live region, because no row changed; the select reports its own value.
 */
export function DensityControl() {
    const { level, levels, setLevel } = useDensity();
    const t = useAddonMessages(DENSITY_ADDON, densityMessages);
    const id = useId();

    return (
        <div className="gw-density">
            <label htmlFor={id}>{t('label')}</label>
            <select id={id} className="gw-select" value={level} onChange={(event) => setLevel(event.target.value as DensityLevel)}>
                {levels.map((entry) => (
                    <option key={entry} value={entry}>
                        {t(entry)}
                    </option>
                ))}
            </select>
        </div>
    );
}
