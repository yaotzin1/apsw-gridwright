/**
 * Fails when `workflow.ai.yml` claims something about the repository that is not true.
 *
 * The workflow file is what agents obey, and a claim nothing checks drifts: it once described the
 * test toolchain two majors after the upgrade, listed CI jobs that no longer ran, and required
 * artifacts no script looked for. Each check below turns one claim into a failure:
 *
 * - `project`: the Node floor, peer ranges and toolchain majors match package.json
 * - `stages` and `tracks`: every lead skill is registered, every stage a track names exists, every
 *   guidance file exists
 * - `skills.registry`: exactly the directories under .agents/skills, each with its SKILL.md
 * - `quality_gates.pre_commit`: every gate is run by the hook and by CI
 * - `ci.required_checks`: exactly the job names the CI file produces, with the Node matrix starting
 *   at the engines floor
 * - `spec_kit`: every feature directory has the required files and accounts for the optional ones
 * - `architectural_rules`: each names its enforcement, and every file it names exists
 *
 *   node scripts/check-workflow.mjs            the checks above (hook, CI)
 *   node scripts/check-workflow.mjs --remote   also compare branch protection on GitHub (needs gh)
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_DIR, readWorkflow } from './lib/workflow-yaml.mjs';

const read = (relative) => fs.readFileSync(path.join(ROOT_DIR, relative), 'utf8').replace(/\r\n/g, '\n');
const exists = (relative) => fs.existsSync(path.join(ROOT_DIR, relative));

/** The first major version a range admits: `^5.0.0` and `>=22.12` give 5 and 22. */
export function majorOf(range) {
    const match = /(\d+)/.exec(String(range ?? ''));
    return match ? Number(match[1]) : null;
}

/** Compares `project` with the manifest. */
export function checkProject(project, pkg) {
    const errors = [];
    if (!project) return ['workflow.ai.yml has no project section'];

    if (project.runtime?.node !== pkg.engines?.node) {
        errors.push(`project.runtime.node is "${project.runtime?.node}" but package.json engines.node is "${pkg.engines?.node}"`);
    }
    for (const [name, range] of Object.entries(project.peer_dependencies ?? {})) {
        if (pkg.peerDependencies?.[name] !== range) {
            errors.push(`project.peer_dependencies.${name} is "${range}" but package.json declares "${pkg.peerDependencies?.[name]}"`);
        }
    }
    for (const name of Object.keys(pkg.peerDependencies ?? {})) {
        if (!Object.hasOwn(project.peer_dependencies ?? {}, name)) {
            errors.push(`package.json declares peer dependency "${name}", which project.peer_dependencies does not list`);
        }
    }
    for (const [name, major] of Object.entries(project.toolchain ?? {})) {
        const declared = pkg.devDependencies?.[name];
        if (declared === undefined) {
            errors.push(`project.toolchain lists ${name}, which package.json devDependencies does not`);
        } else if (majorOf(declared) !== major) {
            errors.push(`project.toolchain.${name} is ${major} but package.json devDependencies has "${declared}"`);
        }
    }
    return errors;
}

/**
 * The display names of the jobs in a GitHub Actions file, with `${{ matrix.<key> }}` expanded over
 * an inline matrix list. Read with patterns rather than a parser: the CI file uses block scalars,
 * which the workflow parser refuses on purpose.
 */
export function ciJobNames(ciText) {
    const lines = ciText.split('\n');
    const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
    if (jobsAt === -1) return { names: [], matrices: {} };

    const names = [];
    const matrices = {};
    let job = null;

    for (const line of lines.slice(jobsAt + 1)) {
        if (/^\S/.test(line)) break;
        const jobKey = /^ {2}([\w-]+):\s*$/.exec(line);
        if (jobKey) {
            job = { key: jobKey[1], name: jobKey[1], matrix: {} };
            names.push(job);
            continue;
        }
        if (!job) continue;
        const name = /^ {4}name:\s*(.+?)\s*$/.exec(line);
        if (name) job.name = name[1].replace(/^["']|["']$/g, '');
        const axis = /^\s+([\w-]+):\s*\[(.+)\]\s*$/.exec(line);
        if (axis) job.matrix[axis[1]] = axis[2].split(',').map((value) => value.trim().replace(/^["']|["']$/g, ''));
    }

    const expanded = names.flatMap((entry) => {
        const reference = /\$\{\{\s*matrix\.([\w-]+)\s*\}\}/.exec(entry.name);
        if (!reference) return [entry.name];
        const values = entry.matrix[reference[1]] ?? [];
        matrices[entry.key] = values;
        return values.map((value) => entry.name.replace(reference[0], value));
    });

    return { names: expanded, matrices };
}

/** Compares the required checks with the CI file and the Node matrix with the engines floor. */
export function checkCi(ci, ciText, pkg) {
    const errors = [];
    if (!ci) return ['workflow.ai.yml has no ci section'];

    const { names, matrices } = ciJobNames(ciText);
    if (names.length === 0) return [`found no jobs in ${ci.workflow}`];

    const required = new Set(ci.required_checks ?? []);
    for (const check of required) {
        if (!names.includes(check)) errors.push(`ci.required_checks names "${check}", which no job in ${ci.workflow} produces`);
    }
    for (const name of names) {
        if (!required.has(name)) errors.push(`${ci.workflow} runs "${name}", which ci.required_checks does not require`);
    }

    const floor = majorOf(pkg.engines?.node);
    for (const [job, values] of Object.entries(matrices)) {
        const majors = values.map(Number).filter(Number.isFinite);
        if (majors.length > 0 && floor !== null && Math.min(...majors) !== floor) {
            errors.push(`the ${job} matrix starts at Node ${Math.min(...majors)} but engines.node starts at ${floor}; a declared floor nothing tests is a guess`);
        }
    }
    return errors;
}

/** True when the text runs the command, allowing npm's `--silent` after the script name. */
export function runsCommand(text, command) {
    const tokens = command.trim().split(/\s+/).map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(^|[\\s;&|])${tokens.join('\\s+(?:--silent\\s+)?')}(?=$|[\\s;&|>])`, 'm');
    return pattern.test(text);
}

/** Every pre-commit gate must be run by the hook and by CI, or it is a gate in name only. */
export function checkGates(gates, hookText, ciText) {
    const errors = [];
    for (const gate of gates ?? []) {
        if (!runsCommand(hookText, gate.command)) errors.push(`gate "${gate.name}" (${gate.command}) is not run by .githooks/pre-commit`);
        if (!runsCommand(ciText, gate.command)) errors.push(`gate "${gate.name}" (${gate.command}) is not run by CI`);
    }
    return errors;
}

/**
 * One feature directory against `spec_kit`. `files` is the directory listing; `specText` is spec.md
 * or null. An optional artifact is accounted for by a bullet under the omission heading that names
 * the file in backticks and gives a reason after a colon.
 */
export function checkSpecDirectory(name, files, specText, specKit) {
    const errors = [];
    for (const file of specKit.required ?? []) {
        if (!files.includes(file)) errors.push(`specs/${name} is missing ${file}`);
    }

    const omitted = new Map();
    if (specText) {
        // The template's example bullet sits inside a comment; a copy that keeps it has omitted nothing.
        const lines = specText.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
        const start = lines.findIndex((line) => line.trim() === specKit.omission_heading);
        if (start !== -1) {
            for (const line of lines.slice(start + 1)) {
                if (/^#{1,2}\s/.test(line)) break;
                const bullet = /^\s*-\s+`([^`]+)`\s*:\s*(.*)$/.exec(line);
                if (bullet) omitted.set(bullet[1], bullet[2].trim());
            }
        }
    }

    for (const file of specKit.optional ?? []) {
        const present = files.includes(file);
        if (present && omitted.has(file)) {
            errors.push(`specs/${name} has ${file} and also lists it under "${specKit.omission_heading}"`);
        } else if (!present && !omitted.has(file)) {
            errors.push(`specs/${name} has no ${file}; write it, or list it in spec.md under "${specKit.omission_heading}" with the reason`);
        } else if (!present && omitted.get(file) === '') {
            errors.push(`specs/${name} omits ${file} without a reason`);
        }
    }
    for (const file of omitted.keys()) {
        if (!(specKit.optional ?? []).includes(file)) {
            errors.push(`specs/${name} omits ${file}, which is not optional`);
        }
    }
    return errors;
}

/** Stages, tracks, registry and rules against each other and the file system. */
export function checkStructure(workflow, { fileExists = exists, skillDirectories = [] } = {}) {
    const errors = [];
    const stages = workflow.stages ?? [];
    const registry = workflow.skills?.registry ?? [];
    const skillNames = new Set(registry.map((skill) => skill.name));
    const stageIds = new Set();

    for (const stage of stages) {
        if (stageIds.has(stage.id)) errors.push(`stage id "${stage.id}" is used twice`);
        stageIds.add(stage.id);
        for (const skill of stage.lead_skills ?? []) {
            if (!skillNames.has(skill)) errors.push(`stage "${stage.id}" is led by "${skill}", which is not in skills.registry`);
        }
        if (!stage.guidance) errors.push(`stage "${stage.id}" names no guidance file`);
        else if (!fileExists(stage.guidance)) errors.push(`stage "${stage.id}" points at ${stage.guidance}, which does not exist`);
    }

    const phases = stages.map((stage) => stage.phase);
    for (const track of workflow.tracks ?? []) {
        const order = (track.stages ?? []).map((id) => {
            if (!stageIds.has(id)) errors.push(`track "${track.id}" names stage "${id}", which does not exist`);
            return phases[stages.findIndex((stage) => stage.id === id)];
        });
        if (order.some((phase, index) => index > 0 && phase <= order[index - 1])) {
            errors.push(`track "${track.id}" lists its stages out of order`);
        }
        if (track.guidance && !fileExists(track.guidance)) errors.push(`track "${track.id}" points at ${track.guidance}, which does not exist`);
    }

    for (const skill of registry) {
        if (!fileExists(skill.path)) errors.push(`skill "${skill.name}" points at ${skill.path}, which does not exist`);
    }
    for (const directory of skillDirectories) {
        if (!skillNames.has(directory)) errors.push(`.agents/skills/${directory} is not in skills.registry`);
    }

    for (const [index, entry] of (workflow.architectural_rules ?? []).entries()) {
        if (typeof entry !== 'object' || !entry.rule || !entry.enforced_by) {
            errors.push(`architectural_rules[${index}] needs both "rule" and "enforced_by"`);
            continue;
        }
        for (const [, file] of entry.enforced_by.matchAll(/`([\w./-]+\.[a-z]+)`/g)) {
            if (file.includes('/') && !fileExists(file)) errors.push(`architectural_rules[${index}] is enforced by ${file}, which does not exist`);
        }
    }
    return errors;
}

/** Branch protection on GitHub against `ci.required_checks`. Needs an authenticated `gh`. */
export function checkRemote(ci) {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    const slugMatch = /github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/.exec(remote);
    if (!slugMatch) return [`origin (${remote}) is not a GitHub repository`];

    const output = execFileSync(
        'gh',
        ['api', `repos/${slugMatch[1]}/branches/${ci.protected_branch}/protection/required_status_checks`, '--jq', '.contexts[]'],
        { cwd: ROOT_DIR, encoding: 'utf8' },
    );
    const actual = new Set(output.split('\n').map((line) => line.trim()).filter(Boolean));
    const expected = new Set(ci.required_checks ?? []);
    const errors = [];
    for (const check of expected) if (!actual.has(check)) errors.push(`branch protection on ${ci.protected_branch} does not require "${check}"`);
    for (const check of actual) if (!expected.has(check)) errors.push(`branch protection on ${ci.protected_branch} requires "${check}", which ci.required_checks does not list; a check no job produces blocks every merge`);
    return errors;
}

export function runChecks({ remote = false } = {}) {
    const workflow = readWorkflow();
    const pkg = JSON.parse(read('package.json'));
    const ciText = read(workflow.ci?.workflow ?? '.github/workflows/ci.yml');
    const hookText = read(workflow.quality_gates?.local_hook?.path ?? '.githooks/pre-commit');
    const skillsDir = path.join(ROOT_DIR, workflow.skills?.directory ?? '.agents/skills');
    const skillDirectories = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    const errors = [
        ...checkProject(workflow.project, pkg),
        ...checkStructure(workflow, { skillDirectories }),
        ...checkGates(workflow.quality_gates?.pre_commit, hookText, ciText),
        ...checkCi(workflow.ci, ciText, pkg),
    ];

    const specKit = workflow.spec_kit;
    const specsDir = path.join(ROOT_DIR, specKit.directory);
    for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
        const directory = path.join(specsDir, entry.name);
        const files = fs.readdirSync(directory);
        const specText = files.includes('spec.md') ? fs.readFileSync(path.join(directory, 'spec.md'), 'utf8') : null;
        errors.push(...checkSpecDirectory(entry.name, files, specText, specKit));
    }

    if (remote) errors.push(...checkRemote(workflow.ci));
    return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const remote = process.argv.includes('--remote');
    let errors;
    try {
        errors = runChecks({ remote });
    } catch (error) {
        console.error(`check-workflow: ${error.message}`);
        process.exit(1);
    }

    if (errors.length > 0) {
        console.error('workflow.ai.yml claims something the repository does not do:');
        for (const error of errors) console.error(`  - ${error}`);
        process.exit(1);
    }
    console.log(`workflow.ai.yml matches the repository${remote ? ', including branch protection' : ''}`);
}
