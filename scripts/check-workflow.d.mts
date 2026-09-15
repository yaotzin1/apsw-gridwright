// Types for the tests that import the workflow checker. The checker stays plain, dependency-free
// JavaScript so the pre-commit hook can run it without a build.

interface SpecKit {
    readonly directory?: string;
    readonly template?: string;
    readonly required?: readonly string[];
    readonly optional?: readonly string[];
    readonly omission_heading: string;
}

interface Gate {
    readonly name: string;
    readonly command: string;
}

interface Ci {
    readonly workflow: string;
    readonly protected_branch?: string;
    readonly required_checks?: readonly string[];
}

type Manifest = Record<string, unknown> & {
    engines?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

export declare function majorOf(range: unknown): number | null;
export declare function checkProject(project: unknown, pkg: Manifest): string[];
export declare function ciJobNames(ciText: string): { names: string[]; matrices: Record<string, string[]> };
export declare function checkCi(ci: Ci | undefined, ciText: string, pkg: Manifest): string[];
export declare function runsCommand(text: string, command: string): boolean;
export declare function checkGates(gates: readonly Gate[] | undefined, hookText: string, ciText: string): string[];
export declare function checkSpecDirectory(name: string, files: readonly string[], specText: string | null, specKit: SpecKit): string[];
export declare function checkStructure(
    workflow: Record<string, unknown>,
    options?: { fileExists?: (relative: string) => boolean; skillDirectories?: readonly string[] },
): string[];
export declare function checkRemote(ci: Ci): string[];
export declare function runChecks(options?: { remote?: boolean }): string[];
