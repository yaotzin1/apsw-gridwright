// Types for the tests that import the workflow parser. The parser stays plain, dependency-free
// JavaScript so the pre-commit hook can run it without a build.

export type WorkflowValue = string | number | boolean | WorkflowValue[] | { [key: string]: WorkflowValue };

export declare const ROOT_DIR: string;
export declare const WORKFLOW_FILE: string;
export declare function parseWorkflowYaml(source: string): Record<string, WorkflowValue>;
export declare function readWorkflow(file?: string): Record<string, WorkflowValue>;
