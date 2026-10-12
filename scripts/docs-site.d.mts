export const REPO: string;
export const NAV: ReadonlyArray<{ group: string; pages: ReadonlyArray<readonly [slug: string, title: string]> }>;
export function slugOf(text: string): string;
export function resolveLink(href: string, fromFile: string, published: ReadonlySet<string>): { href: string; external: boolean } | null;
export function renderMarkdown(
    source: string,
    options?: { file?: string; published?: ReadonlySet<string>; highlight?: Highlight | null },
): { html: string; headings: Array<{ level: number; id: string; text: string }> };
export type Highlight = (code: string, language: string) => string | null;
export function createHighlight(): Promise<Highlight>;
export function buildDocsSite(root: string, outDir: string, options?: { highlight?: Highlight | null }): Promise<number>;
