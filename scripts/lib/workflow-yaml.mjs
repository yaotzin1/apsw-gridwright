/**
 * Reads `workflow.ai.yml` without a YAML dependency.
 *
 * The scripts that consume the workflow run in the pre-commit hook before `node_modules` exists, so
 * they cannot import a parser. Each of them used to match lines by indentation and by the name of
 * the section that happened to follow, which meant reordering the file or deleting a section
 * silently emptied a generated table. This parses the subset the file is written in, and refuses
 * anything outside it rather than guessing:
 *
 * - mappings and lists, nested by indentation, a list indented under its key
 * - scalars: double-quoted (JSON escapes), single-quoted, bare, integers, true and false
 * - inline lists of scalars: `[a, b, "c"]`
 * - full-line comments, and trailing comments after a bare scalar
 *
 * Block scalars (`|`, `>`), anchors, flow mappings and multi-document streams are errors.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const WORKFLOW_FILE = path.join(ROOT_DIR, 'workflow.ai.yml');

class WorkflowYamlError extends Error {
    constructor(message, lineNumber) {
        super(lineNumber === undefined ? message : `workflow YAML line ${lineNumber}: ${message}`);
        this.name = 'WorkflowYamlError';
    }
}

const KEY = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/;

/** Splits `a, "b, c", 'd'` on the commas outside quotes. */
function splitInlineList(inner) {
    const entries = [];
    let current = '';
    let quote = null;
    for (let i = 0; i < inner.length; i += 1) {
        const char = inner[i];
        if (quote) {
            current += char;
            if (char === '\\' && quote === '"') {
                current += inner[i + 1] ?? '';
                i += 1;
            } else if (char === quote) {
                quote = null;
            }
        } else if (char === '"' || char === "'") {
            quote = char;
            current += char;
        } else if (char === ',') {
            entries.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    entries.push(current);
    return entries;
}

function parseScalar(raw, lineNumber) {
    const text = raw.trim();

    if (text.startsWith('"')) {
        if (!text.endsWith('"') || text.length < 2) throw new WorkflowYamlError('unterminated double-quoted string', lineNumber);
        try {
            return JSON.parse(text);
        } catch {
            throw new WorkflowYamlError('invalid escape in double-quoted string', lineNumber);
        }
    }
    if (text.startsWith("'")) {
        if (!text.endsWith("'") || text.length < 2) throw new WorkflowYamlError('unterminated single-quoted string', lineNumber);
        return text.slice(1, -1).replace(/''/g, "'");
    }

    const bare = text.replace(/\s+#.*$/, '');
    if (bare.startsWith('[')) {
        if (!bare.endsWith(']')) throw new WorkflowYamlError('unterminated inline list', lineNumber);
        const inner = bare.slice(1, -1).trim();
        return inner === '' ? [] : splitInlineList(inner).map((entry) => parseScalar(entry, lineNumber));
    }
    if (/^[|>][-+]?$/.test(bare)) throw new WorkflowYamlError('block scalars are not supported; use a quoted string', lineNumber);
    if (/^[&*!{]/.test(bare)) throw new WorkflowYamlError(`unsupported YAML syntax: ${bare}`, lineNumber);
    if (/^-?\d+$/.test(bare)) return Number(bare);
    if (bare === 'true') return true;
    if (bare === 'false') return false;
    return bare;
}

/** Parses the workflow subset. Throws `WorkflowYamlError` naming the line on anything else. */
export function parseWorkflowYaml(source) {
    const lines = source
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((text, index) => ({ indent: text.length - text.trimStart().length, text: text.trim(), number: index + 1 }))
        .filter((line) => line.text !== '' && !line.text.startsWith('#'));

    for (const line of lines) {
        if (line.text === '---' || line.text === '...') throw new WorkflowYamlError('multi-document streams are not supported', line.number);
    }

    let position = 0;

    function parseBlock(indent) {
        const first = lines[position];
        return first.text.startsWith('- ') || first.text === '-' ? parseList(indent) : parseMapping(indent);
    }

    function parseMapping(indent) {
        const result = {};
        while (position < lines.length && lines[position].indent === indent) {
            const line = lines[position];
            if (line.text.startsWith('- ')) break;

            const match = KEY.exec(line.text);
            if (!match) throw new WorkflowYamlError(`expected "key: value", found: ${line.text}`, line.number);
            const [, key, rest] = match;
            if (Object.hasOwn(result, key)) throw new WorkflowYamlError(`duplicate key "${key}"`, line.number);
            position += 1;

            if (rest !== undefined && rest.trim() !== '') {
                result[key] = parseScalar(rest, line.number);
                continue;
            }

            const next = lines[position];
            if (!next || next.indent <= indent) {
                throw new WorkflowYamlError(`"${key}" has no value; indent its contents under it`, line.number);
            }
            result[key] = parseBlock(next.indent);
        }

        if (position < lines.length && lines[position].indent > indent) {
            throw new WorkflowYamlError('unexpected indentation', lines[position].number);
        }
        return result;
    }

    function parseList(indent) {
        const result = [];
        while (position < lines.length && lines[position].indent === indent && lines[position].text.startsWith('- ')) {
            const line = lines[position];
            const item = line.text.slice(2).trim();

            if (KEY.test(item)) {
                // A mapping item: its first key sits on the dash line, the rest are indented to match it.
                lines[position] = { indent: indent + 2, text: item, number: line.number };
                result.push(parseMapping(indent + 2));
            } else {
                result.push(parseScalar(item, line.number));
                position += 1;
            }
        }
        return result;
    }

    if (lines.length === 0) return {};
    if (lines[0].indent !== 0) throw new WorkflowYamlError('the document must start at column 0', lines[0].number);
    const document = parseMapping(0);
    if (position < lines.length) throw new WorkflowYamlError(`unexpected content: ${lines[position].text}`, lines[position].number);
    return document;
}

/** Reads and parses `workflow.ai.yml` from the repository root. */
export function readWorkflow(file = WORKFLOW_FILE) {
    return parseWorkflowYaml(fs.readFileSync(file, 'utf8'));
}
