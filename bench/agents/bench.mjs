#!/usr/bin/env node
/**
 * Agent configuration benchmark: can a coding agent build a working grid from a plain request, and
 * how often does it reach for an API that does not exist?
 *
 *   node bench/agents/bench.mjs setup     [--root DIR] [--gridwright VERSION|file:PATH]
 *   node bench/agents/bench.mjs selftest  [--root DIR]
 *   node bench/agents/bench.mjs run       --agent claude|gemini|manual [--model M] [--libs gridwright,tanstack]
 *                                          [--conditions cold,docs] [--tools compiler|blind] [--tasks 01,04|all]
 *                                          [--reps 3] [--run ID] [--timeout-min 15] [--keep]
 *   node bench/agents/bench.mjs report    --run ID [--out FILE]
 *
 * Every trial runs in a sandbox OUTSIDE this repository (default ~/.gridwright-bench), so an agent
 * in the cold condition cannot read docs/, src/ or the hidden tests by walking up the tree. The
 * hidden test is copied in only after the agent has finished, and the trial directory is deleted
 * after grading (its src/ is archived under results/), so a later trial cannot read an earlier one.
 *
 * Methodology and limits: bench/agents/README.md.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

// Windows cannot spawn .cmd shims without a shell, and a shell would parse the agent prompt.
// The JavaScript entry points run under the current Node instead.
const NPM_CLI = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const LIBS = ['gridwright', 'tanstack'];
const CONDITIONS = ['cold', 'docs'];

/** TypeScript errors that mean "this name, prop, option or module does not exist". */
const API_CODES = new Set([2305, 2307, 2339, 2353, 2551, 2561, 2614, 2694, 2724]);

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
    const [command, ...rest] = argv;
    const flags = {};
    for (let i = 0; i < rest.length; i += 1) {
        const arg = rest[i];
        if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
        const key = arg.slice(2);
        const next = rest[i + 1];
        if (next === undefined || next.startsWith('--')) flags[key] = true;
        else {
            flags[key] = next;
            i += 1;
        }
    }
    return { command, flags };
}

const list = (value, all) => (value === undefined || value === 'all' ? all : String(value).split(',').map((s) => s.trim()));
const rootOf = (flags) => path.resolve(String(flags.root ?? process.env.GRIDWRIGHT_BENCH_ROOT ?? path.join(os.homedir(), '.gridwright-bench')));

// ---------------------------------------------------------------- tasks

function allTasks() {
    return fs
        .readdirSync(path.join(HERE, 'tasks'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

function resolveTasks(value) {
    const tasks = allTasks();
    if (value === undefined || value === 'all') return tasks;
    return String(value)
        .split(',')
        .map((wanted) => {
            const match = tasks.find((task) => task === wanted || task.startsWith(`${wanted}-`));
            if (!match) throw new Error(`no task "${wanted}". Tasks: ${tasks.join(', ')}`);
            return match;
        });
}

const LIBRARY_LINE = {
    gridwright: (versions) =>
        `Use \`apsw-gridwright\` (${versions.gridwright}, installed) for the table. Build it with the package's React entry, \`apsw-gridwright/react\`.`,
    tanstack: (versions) =>
        `Use \`@tanstack/react-table\` (${versions.tanstack}, installed) for the table logic, and render the markup yourself. \`@tanstack/react-virtual\` is installed too, if you need it.`,
};

const TOOLS_LINE = {
    compiler: 'You may run `npx tsc --noEmit -p .` (or `npm run typecheck`) to type-check your work. Run nothing else.',
    blind: 'Do not run any commands. Write the code only.',
};

function buildPrompt({ task, lib, tools, versions }) {
    const body = fs.readFileSync(path.join(HERE, 'tasks', task, 'prompt.md'), 'utf8').trim();
    return [
        'You are working in an existing React 19 + TypeScript project. Every dependency is already installed: do not install, upgrade or remove packages, and do not read or write outside this directory, except to read installed packages under node_modules/.',
        '',
        LIBRARY_LINE[lib](versions),
        '',
        'Write the component in `src/Solution.tsx` as a named export, `export function Solution(...)`. Helpers may go in the same file or elsewhere under `src/`. Do not write tests.',
        '',
        'Rows have this shape (declare the type yourself):',
        '',
        '```ts',
        'interface Person { id: number; uuid: string; name: string; email: string; department: string; salary: number }',
        '```',
        '',
        '## Task',
        '',
        body,
        '',
        TOOLS_LINE[tools],
    ].join('\n');
}

// ---------------------------------------------------------------- setup

function installedVersions(root) {
    const read = (name) => {
        const file = path.join(root, 'node_modules', name, 'package.json');
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).version : 'missing';
    };
    return {
        gridwright: read('apsw-gridwright'),
        tanstack: read('@tanstack/react-table'),
        virtual: read('@tanstack/react-virtual'),
        react: read('react'),
        typescript: read('typescript'),
    };
}

function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const source = path.join(from, entry.name);
        const target = path.join(to, entry.name);
        if (entry.isDirectory()) copyDir(source, target);
        else fs.copyFileSync(source, target);
    }
}

function setup(flags) {
    const root = rootOf(flags);
    if (root.startsWith(REPO + path.sep)) {
        throw new Error('The sandbox must live outside the repository, or a cold agent can read docs/ and the hidden tests.');
    }
    let gridwright = String(flags.gridwright ?? 'latest');
    if (gridwright.startsWith('file:')) gridwright = `file:${path.resolve(gridwright.slice(5))}`;
    fs.mkdirSync(root, { recursive: true });
    const manifest = fs.readFileSync(path.join(HERE, 'sandbox', 'package.json'), 'utf8').replace('{{GRIDWRIGHT_VERSION}}', gridwright);
    fs.writeFileSync(path.join(root, 'package.json'), manifest);
    for (const file of ['tsconfig.base.json', 'vitest.config.ts']) fs.copyFileSync(path.join(HERE, 'sandbox', file), path.join(root, file));
    copyDir(path.join(HERE, 'sandbox', 'harness'), path.join(root, 'harness'));
    console.log(`Installing into ${root} ...`);
    const result = spawnSync(process.execPath, [NPM_CLI, 'install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('npm install failed');
    console.log('Installed:', installedVersions(root));
}

function requireSandbox(root) {
    if (!fs.existsSync(path.join(root, 'node_modules', 'vitest'))) {
        throw new Error(`No sandbox at ${root}. Run: node bench/agents/bench.mjs setup${root === rootOf({}) ? '' : ` --root ${root}`}`);
    }
}

// ---------------------------------------------------------------- trials

function prepareTrial({ root, run, task, lib, condition, tools, agent, rep }) {
    const id = `${task}.${lib}.${condition}.${tools}.${agent}.r${rep}`;
    const dir = path.join(root, 'trials', run, id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });

    const sandbox = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const deps = { ...sandbox.dependencies };
    if (lib === 'gridwright') {
        delete deps['@tanstack/react-table'];
        delete deps['@tanstack/react-virtual'];
    } else {
        delete deps['apsw-gridwright'];
    }
    const manifest = {
        name: 'people-app',
        private: true,
        type: 'module',
        scripts: { typecheck: 'tsc --noEmit -p .' },
        dependencies: deps,
        devDependencies: { typescript: sandbox.devDependencies.typescript, '@types/react': sandbox.devDependencies['@types/react'], '@types/react-dom': sandbox.devDependencies['@types/react-dom'] },
    };
    fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    const base = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.base.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), `${JSON.stringify({ ...base, include: ['src'] }, null, 2)}\n`);
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');

    if (condition === 'docs') {
        // The consumer-facing playbook, delivered the way a project would deliver it to its agents.
        fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
        fs.copyFileSync(path.join(REPO, 'docs', 'agent-playbook.md'), path.join(dir, 'docs', 'gridwright-playbook.md'));
        const pointer = '# Project notes for coding agents\n\nBefore writing any table code, read `docs/gridwright-playbook.md`: the rules and canonical snippets for `apsw-gridwright`.\n';
        for (const file of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) fs.writeFileSync(path.join(dir, file), pointer);
    }

    const versions = installedVersions(root);
    const prompt = buildPrompt({ task, lib, tools, versions });
    // Kept beside the trial for the manual agent, and archived with the result.
    fs.writeFileSync(path.join(dir, 'PROMPT.md'), `${prompt}\n`);
    return { id, dir, prompt, versions };
}

function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? values[key] : whole));
}

async function runAgent({ agentName, config, trial, tools, model, timeoutMs }) {
    if (config.manual) {
        console.log(`\n--- manual trial ${trial.id}\nOpen: ${trial.dir}\nPaste the prompt from PROMPT.md into the agent, let it finish, then press Enter.`);
        const started = Date.now();
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        await rl.question('Done? [Enter] ');
        rl.close();
        return { exitCode: 0, durationMs: Date.now() - started, log: '' };
    }
    const values = { prompt: trial.prompt, model: model ?? '', allowedTools: config.allowedTools?.[tools] ?? '' };
    const args = [...config.args, ...(model ? config.modelArgs ?? [] : [])].map((arg) => fill(arg, values));
    const started = Date.now();
    return new Promise((resolve) => {
        const child = spawn(config.command, args, { cwd: trial.dir, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
        let out = '';
        let err = '';
        child.stdout.on('data', (chunk) => (out += chunk));
        child.stderr.on('data', (chunk) => (err += chunk));
        const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
        child.on('error', (error) => {
            clearTimeout(timer);
            resolve({ exitCode: -1, durationMs: Date.now() - started, log: `${agentName} failed to start: ${error.message}` });
        });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ exitCode: code ?? -1, timedOut: signal === 'SIGTERM', durationMs: Date.now() - started, log: `${out}\n--- stderr\n${err}`, stdout: out });
        });
    });
}

function agentMeta(config, outcome) {
    if (config.output !== 'claude-json' || !outcome.stdout) return {};
    try {
        const body = JSON.parse(outcome.stdout.trim().split('\n').at(-1));
        return {
            turns: body.num_turns,
            costUsd: body.total_cost_usd,
            agentDurationMs: body.duration_ms,
            models: body.modelUsage ? Object.keys(body.modelUsage) : undefined,
            isError: body.is_error,
        };
    } catch {
        return {};
    }
}

// ---------------------------------------------------------------- grading

function typecheck(root, dir) {
    const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    const result = spawnSync(process.execPath, [tsc,'--noEmit', '--pretty', 'false', '-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8' });
    // tsc prints the detail that matters ("Property 'rows' does not exist ...") on indented lines
    // under the first one, so each error is read with its continuation.
    const entries = [];
    for (const line of `${result.stdout}\n${result.stderr}`.split('\n')) {
        const match = /^(.*?)\((\d+),(\d+)\): error TS(\d+): (.*)$/.exec(line.trim());
        if (match) entries.push({ match, message: match[5] });
        else if (/^\s+\S/.test(line) && entries.length > 0) entries[entries.length - 1].message += ` ${line.trim()}`;
    }
    const errors = [];
    for (const { match, message } of entries) {
        const code = Number(match[4]);
        const api = API_CODES.has(code) || (code === 2322 && /does not exist in type|does not exist on type/.test(message)) || (code === 2769 && /does not exist/.test(message));
        errors.push({ file: path.relative(dir, path.resolve(dir, match[1])), line: Number(match[2]), code, api, message });
    }
    return { errors, apiErrors: errors.filter((e) => e.api).length, total: errors.length };
}

function sourceFiles(dir) {
    const files = [];
    const walk = (current) => {
        if (!fs.existsSync(current)) return;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) files.push(full);
        }
    };
    walk(path.join(dir, 'src'));
    return files;
}

function staticChecks(dir, lib) {
    const text = sourceFiles(dir)
        .map((file) => fs.readFileSync(file, 'utf8'))
        .join('\n');
    const importsGridwright = /from\s+['"]apsw-gridwright(\/[\w-]+)?['"]/.test(text);
    const importsTanstack = /from\s+['"]@tanstack\/react-table['"]/.test(text);
    return {
        hasSolution: fs.existsSync(path.join(dir, 'src', 'Solution.tsx')),
        usesLibrary: lib === 'gridwright' ? importsGridwright && !importsTanstack : importsTanstack && !importsGridwright,
        lines: text.split('\n').length,
    };
}

function runTests(root, dir, task) {
    const bench = path.join(dir, '__bench__');
    fs.mkdirSync(bench, { recursive: true });
    fs.copyFileSync(path.join(HERE, 'tasks', task, 'test.tsx'), path.join(bench, `${task}.test.tsx`));
    const report = path.join(os.tmpdir(), `gw-bench-${process.pid}-${Date.now()}.json`);
    const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
    const result = spawnSync(process.execPath, [vitest,'run', '--config', 'vitest.config.ts', '--reporter=json', `--outputFile=${report}`, path.relative(root, bench)], {
        cwd: root,
        encoding: 'utf8',
        timeout: 5 * 60_000,
    });
    fs.rmSync(bench, { recursive: true, force: true });
    if (!fs.existsSync(report)) {
        return { passed: 0, failed: 0, total: 0, crashed: true, output: `${result.stdout}\n${result.stderr}`.slice(-4_000) };
    }
    const body = JSON.parse(fs.readFileSync(report, 'utf8'));
    fs.rmSync(report, { force: true });
    const assertions = body.testResults.flatMap((file) => file.assertionResults);
    const failures = assertions.filter((a) => a.status !== 'passed').map((a) => ({ test: a.title, message: (a.failureMessages ?? []).join('\n').slice(0, 1_500) }));
    const suiteError = body.testResults.find((file) => file.status === 'failed' && file.assertionResults.length === 0)?.message;
    return {
        passed: body.numPassedTests,
        failed: body.numFailedTests + (suiteError ? 1 : 0),
        total: body.numTotalTests,
        crashed: Boolean(suiteError),
        failures: suiteError ? [{ test: '(suite)', message: suiteError.slice(0, 1_500) }, ...failures] : failures,
    };
}

function grade({ root, trial, task, lib }) {
    const checks = staticChecks(trial.dir, lib);
    const types = typecheck(root, trial.dir);
    const tests = checks.hasSolution ? runTests(root, trial.dir, task) : { passed: 0, failed: 0, total: 0, crashed: true, failures: [] };
    const pass = checks.hasSolution && checks.usesLibrary && types.total === 0 && !tests.crashed && tests.total > 0 && tests.failed === 0 && tests.passed === tests.total;
    return { checks, types, tests, pass };
}

function archive({ root, run, trial, outcome }) {
    const dest = path.join(root, 'results', run, trial.id);
    fs.rmSync(dest, { recursive: true, force: true });
    copyDir(path.join(trial.dir, 'src'), path.join(dest, 'src'));
    fs.copyFileSync(path.join(trial.dir, 'PROMPT.md'), path.join(dest, 'PROMPT.md'));
    if (outcome?.log) fs.writeFileSync(path.join(dest, 'agent.log'), outcome.log);
    return dest;
}

// ---------------------------------------------------------------- commands

async function run(flags) {
    const root = rootOf(flags);
    requireSandbox(root);
    const agents = JSON.parse(fs.readFileSync(path.join(HERE, 'agents.json'), 'utf8'));
    const agentName = String(flags.agent ?? '');
    const config = agents[agentName];
    if (!config || agentName.startsWith('$')) throw new Error(`--agent must be one of: ${Object.keys(agents).filter((k) => !k.startsWith('$')).join(', ')}`);
    const model = flags.model ? String(flags.model) : undefined;
    const libs = list(flags.libs, LIBS);
    const conditions = list(flags.conditions, CONDITIONS);
    const tools = String(flags.tools ?? 'compiler');
    if (!['compiler', 'blind'].includes(tools)) throw new Error('--tools is compiler or blind');
    const tasks = resolveTasks(flags.tasks);
    const reps = Number(flags.reps ?? 3);
    const runId = String(flags.run ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
    const timeoutMs = Number(flags['timeout-min'] ?? 15) * 60_000;

    // The playbook is Gridwright's; TanStack has no equivalent here, so it runs cold only.
    const cells = libs.flatMap((lib) => conditions.filter((c) => lib === 'gridwright' || c === 'cold').map((condition) => ({ lib, condition })));
    const plan = [];
    for (let rep = 1; rep <= reps; rep += 1) for (const task of tasks) for (const cell of cells) plan.push({ ...cell, task, rep });
    console.log(`Run ${runId}: ${plan.length} trials (${agentName}${model ? ` ${model}` : ''}, tools=${tools}) in ${root}`);

    const resultsFile = path.join(root, 'results', runId, 'results.jsonl');
    fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
    for (const [index, item] of plan.entries()) {
        const trial = prepareTrial({ root, run: runId, task: item.task, lib: item.lib, condition: item.condition, tools, agent: agentName, rep: item.rep });
        process.stdout.write(`[${index + 1}/${plan.length}] ${trial.id} ... `);
        const outcome = await runAgent({ agentName, config, trial, tools, model, timeoutMs });
        const graded = grade({ root, trial, task: item.task, lib: item.lib });
        const record = {
            run: runId,
            trial: trial.id,
            task: item.task,
            lib: item.lib,
            condition: item.condition,
            tools,
            agent: agentName,
            model: model ?? 'default',
            rep: item.rep,
            versions: trial.versions,
            agentExit: outcome.exitCode,
            timedOut: Boolean(outcome.timedOut),
            durationMs: outcome.durationMs,
            ...agentMeta(config, outcome),
            ...graded,
        };
        // The agent never got to work (no login, CLI missing, API down): not a result about the library.
        record.infraError = !graded.checks.hasSolution && !record.timedOut && (record.agentExit === -1 || record.isError === true);
        fs.appendFileSync(resultsFile, `${JSON.stringify(record)}\n`);
        archive({ root, run: runId, trial, outcome });
        if (!flags.keep) fs.rmSync(trial.dir, { recursive: true, force: true });
        if (record.infraError) console.log(`AGENT ERROR (excluded from the report): see ${path.join(root, 'results', runId, trial.id, 'agent.log')}`);
        else console.log(`${graded.pass ? 'PASS' : 'fail'}  tests ${graded.tests.passed}/${graded.tests.total}, tsc ${graded.types.total} (api ${graded.types.apiErrors})`);
    }
    console.log(`\nResults: ${resultsFile}\nReport:  node bench/agents/bench.mjs report --run ${runId}${flags.root ? ` --root ${root}` : ''}`);
}

/** Grades the reference solutions. Every task must pass for every library, or the task is unfair. */
function selftest(flags) {
    const root = rootOf(flags);
    requireSandbox(root);
    const tasks = resolveTasks(flags.tasks);
    const libs = list(flags.libs, LIBS);
    let failed = 0;
    for (const lib of libs) {
        for (const task of tasks) {
            const reference = path.join(HERE, 'references', lib, `${task}.tsx`);
            if (!fs.existsSync(reference)) {
                console.log(`MISSING  ${lib} ${task}`);
                failed += 1;
                continue;
            }
            const trial = prepareTrial({ root, run: 'selftest', task, lib, condition: 'cold', tools: 'compiler', agent: 'reference', rep: 1 });
            fs.copyFileSync(reference, path.join(trial.dir, 'src', 'Solution.tsx'));
            const graded = grade({ root, trial, task, lib });
            if (!flags.keep) fs.rmSync(trial.dir, { recursive: true, force: true });
            console.log(`${graded.pass ? 'ok   ' : 'FAIL '}  ${lib.padEnd(10)} ${task}  tests ${graded.tests.passed}/${graded.tests.total}, tsc ${graded.types.total}`);
            if (!graded.pass) {
                failed += 1;
                for (const error of graded.types.errors) console.log(`         TS${error.code} ${error.file}:${error.line} ${error.message}`);
                for (const failure of graded.tests.failures ?? []) console.log(`         ${failure.test}: ${failure.message.split('\n').slice(0, 6).join('\n         ')}`);
                if (graded.tests.output) console.log(graded.tests.output);
            }
        }
    }
    // Negative controls: a mistake agents really make must fail its task, or the task measures nothing.
    let missed = 0;
    for (const lib of libs) {
        const folder = path.join(HERE, 'references', 'negative', lib);
        if (!fs.existsSync(folder)) continue;
        for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.tsx')).sort()) {
            const [task, label] = file.replace(/\.tsx$/, '').split('--');
            if (!tasks.includes(task)) continue;
            const trial = prepareTrial({ root, run: 'selftest', task, lib, condition: 'cold', tools: 'compiler', agent: `negative-${label}`, rep: 1 });
            fs.copyFileSync(path.join(folder, file), path.join(trial.dir, 'src', 'Solution.tsx'));
            const graded = grade({ root, trial, task, lib });
            if (!flags.keep) fs.rmSync(trial.dir, { recursive: true, force: true });
            console.log(`${graded.pass ? 'MISSED' : 'caught'} ${lib.padEnd(10)} ${task} (${label})  tests ${graded.tests.passed}/${graded.tests.total}, tsc ${graded.types.total} (api ${graded.types.apiErrors})`);
            if (graded.pass) missed += 1;
        }
    }
    if (failed > 0 || missed > 0) {
        console.log(`\n${failed} reference(s) failed, ${missed} negative control(s) passed when they should not.`);
        process.exitCode = 1;
    } else console.log('\nEvery task is solvable in every library, and every negative control is caught.');
}

function report(flags) {
    const root = rootOf(flags);
    const runId = flags.run;
    if (!runId) throw new Error('--run ID is required');
    const file = path.join(root, 'results', String(runId), 'results.jsonl');
    const all = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    const excluded = all.filter((r) => r.infraError);
    const records = all.filter((r) => !r.infraError);
    const pct = (n, d) => (d === 0 ? '–' : `${Math.round((100 * n) / d)}%`);
    const mean = (values) => (values.length === 0 ? '–' : (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
    const key = (r) => `${r.lib} / ${r.condition}`;
    const groups = new Map();
    for (const record of records) {
        const k = `${record.agent} (${record.model}) | ${key(record)} | ${record.tools}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(record);
    }

    const first = records[0];
    const lines = [
        `# Agent benchmark: run ${runId}`,
        '',
        `Versions: apsw-gridwright ${first?.versions.gridwright}, @tanstack/react-table ${first?.versions.tanstack}, react ${first?.versions.react}, typescript ${first?.versions.typescript}.`,
        `Trials: ${records.length}${excluded.length ? `, plus ${excluded.length} excluded because the agent never ran (${excluded.map((r) => r.trial).join(', ')})` : ''}.`,
        '',
        'Pass = the file exists, imports the required library, type-checks with zero errors and passes every hidden test. API errors are TypeScript errors that name an export, prop, option or module that does not exist (TS2305, TS2307, TS2339, TS2353, TS2551, TS2561, TS2614, TS2694, TS2724, and TS2322/TS2769 when they say a property does not exist), counted after the agent finished.',
        '',
        '## Summary',
        '',
        '| Agent | Library / condition | Tools | Trials | Pass | Tests passed | Trials with API errors | API errors / trial | Mean turns | Mean cost |',
        '| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ];
    for (const [k, group] of groups) {
        const [agent, cell, tools] = k.split(' | ');
        const testsPassed = group.reduce((a, r) => a + r.tests.passed, 0);
        const testsTotal = group.reduce((a, r) => a + Math.max(r.tests.total, 0), 0);
        const turns = group.map((r) => r.turns).filter((t) => typeof t === 'number');
        const cost = group.map((r) => r.costUsd).filter((t) => typeof t === 'number');
        lines.push(
            `| ${agent} | ${cell} | ${tools} | ${group.length} | ${pct(group.filter((r) => r.pass).length, group.length)} | ${pct(testsPassed, testsTotal)} | ${pct(group.filter((r) => r.types.apiErrors > 0).length, group.length)} | ${mean(group.map((r) => r.types.apiErrors))} | ${mean(turns)} | ${cost.length ? `$${mean(cost)}` : '–'} |`,
        );
    }

    const cells = [...new Set(records.map(key))].sort();
    lines.push('', '## Pass rate per task', '', `| Task | ${cells.join(' | ')} |`, `| :--- | ${cells.map(() => '---:').join(' | ')} |`);
    for (const task of [...new Set(records.map((r) => r.task))].sort()) {
        const row = cells.map((cell) => {
            const group = records.filter((r) => r.task === task && key(r) === cell);
            return group.length ? `${group.filter((r) => r.pass).length}/${group.length}` : '–';
        });
        lines.push(`| ${task} | ${row.join(' | ')} |`);
    }

    const invented = records.flatMap((r) => r.types.errors.filter((e) => e.api).map((e) => ({ ...e, lib: r.lib, condition: r.condition, task: r.task })));
    lines.push('', '## API errors (names, props or modules that do not exist)', '');
    if (invented.length === 0) lines.push('None.');
    else {
        const counts = new Map();
        for (const e of invented) {
            const label = `${e.lib} / ${e.condition} — TS${e.code}: ${e.message.replace(/\s+/g, ' ').slice(0, 160)}`;
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        for (const [label, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 40)) lines.push(`- ${count}× ${label}`);
    }
    const text = `${lines.join('\n')}\n`;
    const out = flags.out ? path.resolve(String(flags.out)) : path.join(root, 'results', String(runId), 'summary.md');
    fs.writeFileSync(out, text);
    console.log(text);
    console.log(`Written to ${out}`);
}

async function main() {
    const { command, flags } = parseArgs(process.argv.slice(2));
    if (command === 'setup') return setup(flags);
    if (command === 'selftest') return selftest(flags);
    if (command === 'run') return run(flags);
    if (command === 'report') return report(flags);
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    process.exitCode = command ? 1 : 0;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
