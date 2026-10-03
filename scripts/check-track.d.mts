// Types for the tests that import the track checker. The checker stays plain, dependency-free
// JavaScript so the commit-msg hook can run it without a build.

export interface TrackConfig {
    readonly baseline?: string;
    readonly tracks: readonly string[];
    readonly source_paths: readonly string[];
    readonly test_paths: readonly string[];
    readonly changelogs: readonly string[];
    readonly release_paths: readonly string[];
    readonly protected_paths: readonly string[];
    readonly public_surface: readonly string[];
    readonly api_reference: string;
    readonly spec_directory: string;
    readonly spec_required: readonly string[];
}

export interface RangeCommit {
    readonly message: string;
    readonly files: readonly string[];
}

export interface SpecDirectory {
    readonly name: string;
    readonly files: readonly string[];
}

export declare function globToRegExp(glob: string): RegExp;
export declare function matchesAny(file: string, globs: readonly string[] | undefined): boolean;
export declare function parseTrailers(message: string): Map<string, string>;
export declare function isMergeMessage(message: string): boolean;
export declare function checkCommit(message: string, files: readonly string[], config: TrackConfig): string[];
export declare function checkRange(commits: readonly RangeCommit[], specDirectories: readonly SpecDirectory[], config: TrackConfig): string[];
export declare function readConfig(): TrackConfig;
