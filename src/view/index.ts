/**
 * The framework-neutral view layer: everything between the engine and a renderer that does not
 * depend on which framework draws it. Headless by the same rule as the engine: no DOM, no React,
 * no framework (specs/adapter-architecture).
 */
export { viewEvent } from './event';
export type { ViewEvent } from './event';
export { CONTRIBUTABLE_ATTRIBUTES, isContributable, mergeAttributes } from './attributes';
export { orderAddons, resolveSet, slotValues } from './resolve';
export type { OptionalAddon, OrderableAddon, ResolvableContribution, ResolvedAddonOf, ResolvedSet } from './resolve';
export { announcementFor } from './behaviour/announcement';
export type { AnnouncementChange, AnnouncementContributor, AnnouncementInput, AnnouncementLabels } from './behaviour/announcement';
export { ariaSortOf, nextSortAction, sortAnnouncement, sortPriorityOf, sortTitleOf } from './behaviour/sorting';
export { DEFAULT_PAGE_SIZE_OPTIONS, pageFocusAfterChange, pageRangeOf, pageSizeChoices } from './behaviour/pagination';
export { pageSelectionOf } from './behaviour/selection';
export { createStore } from './store';
export type { Store } from './store';
export { ALLOWED_INPUT_TYPES, ALLOWED_TAGS, HANDLER_NAMES, NODE_ATTRIBUTES, childrenOf, component, fragment, h, isAllowedTag, sanitizeNode, slot, text } from './node';
export type { AllowedTag, AttrValue, Attrs, ElementProps, Handler, HandlerName, Handlers, RenderIssue, RenderIssueCode, StyleValue, ViewAction, ViewChild, ViewNode } from './node';
export { renderToText, stringRenderer } from './text-renderer';
export type { Renderer, TextRendererOptions } from './text-renderer';
export { VIEW_ADDON, defineAddon, isViewAddon } from './addon';
export type { ViewAddon, ViewAddonContribution, ViewAddonSetupContext, ViewAttributes, ViewGrid, ViewRenderGrid, ViewTranslate } from './addon';
export { SORTING_ADDON, sorting, sortingMessages } from './addons/sorting';
export type { SortingOptions } from './addons/sorting';
