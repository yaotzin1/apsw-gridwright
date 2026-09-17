/**
 * The rows every step renders, and the type they are.
 *
 * Nothing about this file is special to the grid: it is the shape your own API already returns.
 * Note `id`, which the grid uses as each row's identity without being told, because `getRowId`
 * defaults to the `id` property.
 */

export interface Person {
    id: number;
    name: string;
    email: string;
    department: 'Engineering' | 'Research' | 'Operations' | 'Design';
    title: string;
    salary: number;
    startedOn: string;
    active: boolean;
    /** Used by step 5, where a row expands into a second grid. */
    projects: Project[];
}

export interface Project {
    id: string;
    name: string;
    role: string;
    hours: number;
}

export const people: Person[] = [
    {
        id: 1,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        department: 'Engineering',
        title: 'Principal Engineer',
        salary: 164_000,
        startedOn: '2019-03-01',
        active: true,
        projects: [
            { id: 'p1', name: 'Analytical Engine', role: 'Lead', hours: 620 },
            { id: 'p2', name: 'Compiler', role: 'Reviewer', hours: 80 },
        ],
    },
    {
        id: 2,
        name: 'Grace Hopper',
        email: 'grace@example.com',
        department: 'Engineering',
        title: 'Staff Engineer',
        salary: 152_000,
        startedOn: '2017-07-14',
        active: true,
        projects: [{ id: 'p3', name: 'COBOL', role: 'Lead', hours: 910 }],
    },
    {
        id: 3,
        name: 'Katherine Johnson',
        email: 'katherine@example.com',
        department: 'Research',
        title: 'Research Lead',
        salary: 148_000,
        startedOn: '2021-01-20',
        active: false,
        projects: [
            { id: 'p4', name: 'Orbital Mechanics', role: 'Lead', hours: 1200 },
            { id: 'p5', name: 'Re-entry Maths', role: 'Author', hours: 340 },
        ],
    },
    {
        id: 4,
        name: 'Mary Jackson',
        email: 'mary@example.com',
        department: 'Research',
        title: 'Engineer',
        salary: 121_000,
        startedOn: '2022-11-05',
        active: true,
        projects: [{ id: 'p6', name: 'Wind Tunnel', role: 'Engineer', hours: 480 }],
    },
    {
        id: 5,
        name: 'Dorothy Vaughan',
        email: 'dorothy@example.com',
        department: 'Operations',
        title: 'Operations Manager',
        salary: 133_000,
        startedOn: '2018-05-30',
        active: false,
        projects: [],
    },
    {
        id: 6,
        name: 'Annie Easley',
        email: 'annie@example.com',
        department: 'Operations',
        title: 'Programmer',
        salary: 118_000,
        startedOn: '2020-09-12',
        active: true,
        projects: [{ id: 'p7', name: 'Centaur', role: 'Programmer', hours: 700 }],
    },
    {
        id: 7,
        name: 'Evelyn Boyd',
        email: 'evelyn@example.com',
        department: 'Design',
        title: 'Design Lead',
        salary: 139_000,
        startedOn: '2016-02-02',
        active: true,
        projects: [{ id: 'p8', name: 'Design System', role: 'Lead', hours: 550 }],
    },
    {
        id: 8,
        name: 'Melba Roy',
        email: 'melba@example.com',
        department: 'Research',
        title: 'Mathematician',
        salary: 127_000,
        startedOn: '2023-04-18',
        active: true,
        projects: [{ id: 'p9', name: 'Echo Satellites', role: 'Analyst', hours: 260 }],
    },
    {
        id: 9,
        name: 'Kathleen Booth',
        email: 'kathleen@example.com',
        department: 'Engineering',
        title: 'Senior Engineer',
        salary: 144_000,
        startedOn: '2021-08-09',
        active: false,
        projects: [{ id: 'p10', name: 'Assembly', role: 'Author', hours: 410 }],
    },
    {
        id: 10,
        name: 'Sister Mary Kenneth Keller',
        email: 'mary.keller@example.com',
        department: 'Design',
        title: 'Researcher',
        salary: 131_000,
        startedOn: '2015-10-23',
        active: true,
        projects: [{ id: 'p11', name: 'BASIC', role: 'Contributor', hours: 300 }],
    },
];

/** Shared formatters. Columns use them through `formatValue`. */
export const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});

export const day = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
});
