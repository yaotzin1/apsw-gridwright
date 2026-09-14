// Types for the tests that import the security gate. The gate itself stays plain, dependency-free
// JavaScript so the pre-commit hook can run it without a build.

export interface SecurityFinding {
    readonly file: string;
    readonly line: number;
    readonly rule: string;
    readonly message: string;
}

export declare const SOURCE_DIRECTORIES: readonly string[];
export declare const SRCDOC_ALLOWED: readonly string[];
export declare function auditSource(relativePath: string, text: string): SecurityFinding[];
export declare function auditManifest(pkg: Record<string, unknown>): SecurityFinding[];
export declare function auditNpmrc(text: string): SecurityFinding[];
export declare function auditDist(relativePath: string, text: string): SecurityFinding[];
export declare function runAudit(options?: { sourceOnly?: boolean }): {
    findings: SecurityFinding[];
    scannedDist: boolean;
};
