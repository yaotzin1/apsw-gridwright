import { describe, expect, it } from 'vitest';
import { DENSITY_LEVELS, resolveInitial, resolveLevels, rowHeightFor } from '../../src/react/density/state';
import type { DensityLevel } from '../../src/react/density/types';

describe('resolveLevels', () => {
    it('offers all three in order when none are given (AC-03)', () => {
        expect(resolveLevels({})).toEqual(['compact', 'comfortable', 'spacious']);
        expect(resolveLevels({ levels: [] })).toEqual(DENSITY_LEVELS);
    });

    it('keeps the order it is given', () => {
        expect(resolveLevels({ levels: ['spacious', 'compact'] })).toEqual(['spacious', 'compact']);
    });

    it('drops repeats and names a plain JavaScript caller invented', () => {
        const levels = ['compact', 'compact', 'roomy', 'comfortable'] as unknown as readonly DensityLevel[];
        expect(resolveLevels({ levels })).toEqual(['compact', 'comfortable']);
    });

    it('falls back to all of them when nothing usable is left', () => {
        expect(resolveLevels({ levels: ['roomy'] as unknown as readonly DensityLevel[] })).toEqual(DENSITY_LEVELS);
    });
});

describe('resolveInitial', () => {
    it('starts on comfortable by default (AC-03)', () => {
        expect(resolveInitial({}, DENSITY_LEVELS)).toBe('comfortable');
    });

    it('starts on the level asked for', () => {
        expect(resolveInitial({ initial: 'compact' }, DENSITY_LEVELS)).toBe('compact');
    });

    it('starts on the first level when the one asked for is not offered', () => {
        expect(resolveInitial({ initial: 'spacious' }, ['compact', 'comfortable'])).toBe('compact');
        expect(resolveInitial({}, ['spacious', 'compact'])).toBe('spacious');
    });
});

describe('rowHeightFor', () => {
    it('gives compact and spacious a height and comfortable none (AC-10)', () => {
        expect(rowHeightFor('compact', {})).toBe(32);
        expect(rowHeightFor('spacious', {})).toBe(52);
        expect(rowHeightFor('comfortable', {})).toBeUndefined();
    });

    it('takes a height from the options, comfortable included', () => {
        expect(rowHeightFor('compact', { rowHeights: { compact: 28 } })).toBe(28);
        expect(rowHeightFor('comfortable', { rowHeights: { comfortable: 44 } })).toBe(44);
    });

    it.each([0, -4, Number.NaN, Number.POSITIVE_INFINITY, '30px' as unknown as number])(
        'ignores %s and uses the level default',
        (bad) => {
            expect(rowHeightFor('compact', { rowHeights: { compact: bad } })).toBe(32);
            expect(rowHeightFor('comfortable', { rowHeights: { comfortable: bad } })).toBeUndefined();
        },
    );
});
