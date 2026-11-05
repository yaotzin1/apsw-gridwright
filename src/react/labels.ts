import type { Translator } from '../i18n/translator';
import { defaultViewLabels, labelsFrom as viewLabelsFrom, mergeLabels as viewMergeLabels } from '../view/labels';
import type { GridwrightLabels } from './types';

/**
 * Turns a translator into the label object the shell renders from. The strings and the logic are the
 * view layer's, shared with every adapter; this keeps the React-typed names this entry has always had.
 */
export function labelsFrom(translator: Translator): GridwrightLabels {
    return viewLabelsFrom(translator);
}

/** English defaults, kept as a named export so a consumer can spread and adjust a single string. */
export const defaultLabels: GridwrightLabels = defaultViewLabels;

export function mergeLabels(translator: Translator, overrides?: Partial<GridwrightLabels>): GridwrightLabels {
    return viewMergeLabels(translator, overrides);
}
