import type { GridwrightColumn } from '../src/react/types';

export interface Person {
    id: number;
    name: string;
    department: string;
    salary: number;
    startedOn: string;
    active: boolean;
}

export const people: readonly Person[] = [
    { id: 1, name: 'Ada Lovelace', department: 'Engineering', salary: 120_000, startedOn: '2019-03-01', active: true },
    { id: 2, name: 'Grace Hopper', department: 'Engineering', salary: 140_000, startedOn: '2017-07-14', active: true },
    { id: 3, name: 'Katherine Johnson', department: 'Research', salary: 110_000, startedOn: '2021-01-20', active: false },
    { id: 4, name: 'Mary Jackson', department: 'Research', salary: 95_000, startedOn: '2022-11-05', active: true },
    { id: 5, name: 'Dorothy Vaughan', department: 'Operations', salary: 105_000, startedOn: '2018-05-30', active: false },
    { id: 6, name: 'Annie Easley', department: 'Operations', salary: 99_000, startedOn: '2020-09-12', active: true },
    { id: 7, name: 'Evelyn Boyd', department: 'Research', salary: 130_000, startedOn: '2016-02-02', active: true },
];

export const personColumns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end' },
    { id: 'startedOn', header: 'Started' },
];

/** A promise that resolves on demand, for driving async data-source tests deterministically. */
export function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
