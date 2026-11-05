/** What a scenario throws when an adapter does not behave. A plain Error subclass, so any runner reports it. */
export class ConformanceFailure extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConformanceFailure';
    }
}

export function expectEqual<T>(actual: T, expected: T, what: string): void {
    if (!Object.is(actual, expected) && JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new ConformanceFailure(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

export function expectTruthy<T>(value: T | null | undefined, what: string): T {
    if (value === null || value === undefined || value === false) throw new ConformanceFailure(`${what}: not found`);
    return value;
}
