/**
 * The showcase's data: 240 employees with projects, a folder tree, and the arithmetic behind a
 * table of ten million rows that never exists in memory.
 *
 * Seeded, so every reload shows the same people and a screenshot can be compared with the last one.
 */

export type Department = 'Engineering' | 'Research' | 'Operations' | 'Design' | 'Sales';

export interface Project {
    id: string;
    name: string;
    role: string;
    hours: number;
}

export interface Employee {
    id: number;
    name: string;
    email: string;
    department: Department;
    title: string;
    city: string;
    salary: number;
    startedOn: string;
    active: boolean;
    projects: Project[];
}

export interface FileNode {
    id: string;
    name: string;
    kind: 'folder' | 'file';
    owner: string;
    size: number;
    children?: FileNode[];
}

export const DEPARTMENTS: readonly Department[] = ['Engineering', 'Research', 'Operations', 'Design', 'Sales'];
export const CITIES = ['Kraków', 'Warsaw', 'Berlin', 'Lisbon', 'Lyon', 'Madrid', 'Toronto'] as const;

const FIRST = ['Ada', 'Grace', 'Katherine', 'Mary', 'Dorothy', 'Annie', 'Hedy', 'Radia', 'Frances', 'Barbara', 'Joan', 'Margaret', 'Evelyn', 'Jean', 'Karen', 'Sophie', 'Lynn', 'Edith'];
const LAST = ['Lovelace', 'Hopper', 'Johnson', 'Jackson', 'Vaughan', 'Easley', 'Lamarr', 'Perlman', 'Allen', 'Liskov', 'Clarke', 'Hamilton', 'Boyd', 'Bartik', 'Spärck Jones', 'Wilson', 'Conway', 'Clarke-Hill'];
const TITLES: Record<Department, readonly string[]> = {
    Engineering: ['Engineer', 'Senior Engineer', 'Staff Engineer', 'Principal Engineer'],
    Research: ['Researcher', 'Research Lead', 'Mathematician'],
    Operations: ['Programmer', 'Operations Manager', 'Analyst'],
    Design: ['Designer', 'Design Lead'],
    Sales: ['Account Executive', 'Sales Engineer'],
};
const PROJECTS = ['Atlas', 'Beacon', 'Comet', 'Delta', 'Ember', 'Fjord', 'Gale', 'Harbor'];
const ROLES = ['Lead', 'Contributor', 'Reviewer', 'Advisor'];

/** A small deterministic generator, so the data is the same on every load. */
function random(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
        return state / 2_147_483_648;
    };
}

const next = random(20260925);
const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;

export const employees: Employee[] = Array.from({ length: 240 }, (_, index) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const department = pick(DEPARTMENTS);
    const year = 2012 + Math.floor(next() * 13);
    const month = 1 + Math.floor(next() * 12);
    return {
        id: index + 1,
        name: `${first} ${last}`,
        // Accents dropped rather than letters: "Spärck" becomes "sparck", not "sprck".
        email: `${first}.${last}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z.]/g, '') + `${index + 1}@example.com`,
        department,
        title: pick(TITLES[department]),
        city: pick(CITIES),
        salary: Math.round((70 + next() * 110) * 1000),
        startedOn: `${year}-${String(month).padStart(2, '0')}-${String(1 + Math.floor(next() * 28)).padStart(2, '0')}`,
        active: next() > 0.15,
        projects: Array.from({ length: 1 + Math.floor(next() * 4) }, (_unused, at) => ({
            id: `${index + 1}-${at}`,
            name: pick(PROJECTS),
            role: pick(ROLES),
            hours: 20 + Math.floor(next() * 400),
        })),
    };
});

let fileCount = 0;
const file = (name: string, owner: string): FileNode => ({ id: `f${++fileCount}`, name, kind: 'file', owner, size: 4 + Math.floor(next() * 900) });
const folder = (name: string, owner: string, children: FileNode[]): FileNode => ({
    id: `d${++fileCount}`,
    name,
    kind: 'folder',
    owner,
    size: children.reduce((sum, child) => sum + child.size, 0),
    children,
});

export const files: FileNode[] = [
    folder('Engineering', 'Grace', [
        folder('grid', 'Ada', [file('engine.ts', 'Ada'), file('pipeline.ts', 'Ada'), file('README.md', 'Grace')]),
        folder('mui', 'Grace', [file('theme.tsx', 'Grace'), file('sorting.tsx', 'Grace')]),
        file('roadmap.md', 'Grace'),
    ]),
    folder('Design', 'Evelyn', [folder('tokens', 'Evelyn', [file('colors.json', 'Evelyn'), file('spacing.json', 'Evelyn')]), file('brand.pdf', 'Joan')]),
    folder('Research', 'Katherine', [file('trajectories.xlsx', 'Katherine'), file('notes.md', 'Mary')]),
];

export const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const day = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });

/** A row of the ten-million-row table, computed from its index rather than stored. */
export interface Reading {
    id: number;
    sensor: string;
    value: number;
    at: string;
}

export const READINGS_TOTAL = 10_000_000;

export function readingAt(index: number): Reading {
    // Deterministic per index, so scrolling back shows the same values.
    const value = Math.round(((Math.sin(index * 12.9898) * 43758.5453) % 1) * 1000) / 10;
    return {
        id: index + 1,
        sensor: `S-${String((index % 997) + 1).padStart(3, '0')}`,
        value: Math.abs(value),
        at: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString().replace('T', ' ').slice(0, 19),
    };
}
