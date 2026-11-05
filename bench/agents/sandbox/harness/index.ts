import { screen, within } from '@testing-library/react';
import { onTestFinished, vi } from 'vitest';

/** The row shape every task prompt describes. Deterministic, so tests can name exact rows. */
export interface Person {
    id: number;
    uuid: string;
    name: string;
    email: string;
    department: string;
    salary: number;
}

const DEPARTMENTS = ['Sales', 'Engineering', 'Support', 'Finance', 'Legal'];

export function makePeople(count: number): Person[] {
    return Array.from({ length: count }, (_, index) => {
        const n = index + 1;
        return {
            id: n,
            uuid: `u-${n.toString(16).padStart(4, '0')}`,
            name: `Person ${n}`,
            email: `person${n}@example.com`,
            department: DEPARTMENTS[index % DEPARTMENTS.length] as string,
            salary: 30_000 + ((n * 7_919) % 90_000),
        };
    });
}

/** Rows that hold cells, so header rows are excluded whatever markup a library chooses. */
export function dataRows(): HTMLElement[] {
    return screen.queryAllByRole('row').filter((row) => cellsOf(row).length > 0);
}

export function cellsOf(row: HTMLElement): HTMLElement[] {
    return [...within(row).queryAllByRole('cell'), ...within(row).queryAllByRole('gridcell')];
}

/** True when some cell of the row reads exactly `text`. */
export function rowHasCell(row: HTMLElement, text: string): boolean {
    return cellsOf(row).some((cell) => cell.textContent?.trim() === text);
}

export function namesOnScreen(): string[] {
    return dataRows()
        .map((row) => cellsOf(row).map((cell) => cell.textContent?.trim() ?? '').find((t) => /^Person \d+$/.test(t)))
        .filter((name): name is string => name !== undefined);
}

export function isDisabled(element: HTMLElement): boolean {
    return (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true';
}

export type ServerMode =
    /** page (one-based), pageSize, sort=col:dir[,col:dir], search. Replies { data, total }. */
    | 'rest'
    /** Only page and pageSize. Any other parameter is a 400. Replies { data, total }. */
    | 'page-only'
    /** page and pageSize; any other parameter is a 400. Replies a bare array: no total exists. */
    | 'no-total';

export interface FakeServer {
    /** Every request URL, in order. */
    readonly requests: URL[];
    readonly lastRequest: () => URL | undefined;
}

/** Replaces fetch with an in-memory /api/people. Unstubbed after each test by the setup file. */
export function installServer(mode: ServerMode, rows: readonly Person[]): FakeServer {
    const requests: URL[] = [];
    const fetchStub = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, 'http://localhost:3000');
        requests.push(url);
        if (url.pathname !== '/api/people') return json({ error: 'not found' }, 404);

        const allowed = mode === 'rest' ? ['page', 'pageSize', 'sort', 'search'] : ['page', 'pageSize'];
        const unknown = [...url.searchParams.keys()].filter((key) => !allowed.includes(key));
        if (unknown.length > 0) return json({ error: `unsupported parameter: ${unknown.join(', ')}` }, 400);

        const page = Number(url.searchParams.get('page') ?? '1');
        const pageSize = Number(url.searchParams.get('pageSize') ?? '25');
        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
            return json({ error: 'page is one-based and pageSize is positive' }, 400);
        }

        let result = [...rows];
        const search = url.searchParams.get('search');
        if (search) result = result.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
        const sort = url.searchParams.get('sort');
        if (sort) {
            const keys = sort.split(',').map((part) => part.split(':') as [keyof Person, string]);
            result.sort((a, b) => {
                for (const [key, dir] of keys) {
                    const order = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
                    if (order !== 0) return dir === 'desc' ? -order : order;
                }
                return 0;
            });
        }
        const slice = result.slice((page - 1) * pageSize, page * pageSize);
        return mode === 'no-total' ? json(slice) : json({ data: slice, total: result.length });
    });
    vi.stubGlobal('fetch', fetchStub);
    return { requests, lastRequest: () => requests.at(-1) };
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Gives every element a layout box, for tasks that virtualize. jsdom lays nothing out. */
export function fakeLayout(viewport = 600, rowHeight = 40): void {
    const proto = HTMLElement.prototype;
    const isRow = (element: HTMLElement) => element.tagName === 'TR' || element.getAttribute('role') === 'row';
    const sizes: Record<string, (element: HTMLElement) => number> = {
        clientHeight: (el) => (isRow(el) ? rowHeight : viewport),
        offsetHeight: (el) => (isRow(el) ? rowHeight : viewport),
        clientWidth: () => 1000,
        offsetWidth: () => 1000,
    };
    const saved = new Map<string, PropertyDescriptor | undefined>();
    for (const [prop, read] of Object.entries(sizes)) {
        saved.set(prop, Object.getOwnPropertyDescriptor(proto, prop));
        Object.defineProperty(proto, prop, {
            configurable: true,
            get(this: HTMLElement) {
                return read(this);
            },
        });
    }
    const rect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function boundingRect(this: HTMLElement) {
        const height = isRow(this) ? rowHeight : viewport;
        return { x: 0, y: 0, top: 0, left: 0, bottom: height, right: 1000, width: 1000, height, toJSON: () => ({}) } as DOMRect;
    };
    onTestFinished(() => {
        proto.getBoundingClientRect = rect;
        for (const [prop, descriptor] of saved) {
            if (descriptor) Object.defineProperty(proto, prop, descriptor);
            else delete (proto as unknown as Record<string, unknown>)[prop];
        }
    });
}
