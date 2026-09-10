/**
 * Gridwright Agent Skills Validator & Security Auditor
 * Validates YAML frontmatter, schema constraints, markdown structure,
 * and performs automated security audits (Secret Leaks & Prompt Injection).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT_DIR, '.agents', 'skills');

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Security Rules: Secret & Credential Leak Patterns
export const SECRET_PATTERNS = [
  { name: 'OpenAI API Key', regex: /\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b/i },
  { name: 'Google / Gemini API Key', regex: /\bAIzaSy[a-zA-Z0-9_-]{33}\b/ },
  { name: 'GitHub Personal Access Token', regex: /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/ },
  { name: 'JSON Web Token (JWT)', regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\b/ },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'Database Connection String with Credentials', regex: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[a-zA-Z0-9_]+:[^@\s]+@[^\s]+\b/i },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
];

// Security Rules: Adversarial Prompt Injection & Jailbreak Patterns
export const PROMPT_INJECTION_PATTERNS = [
  { name: 'Instruction Override', regex: /\bignore\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|directives|prompts|rules|guidelines)\b/i },
  { name: 'Filter Bypass', regex: /\bbypass\s+(?:all\s+)?(?:safety|security|content|content)\s+(?:filters|guardrails|restrictions|checks|isolation)\b/i },
  { name: 'Prompt Extraction', regex: /\breveal\s+(?:all\s+)?(?:hidden|system|confidential)\s+(?:prompts|instructions|system_prompt|secrets|api_keys)\b/i },
  { name: 'System Rule Disregard', regex: /\bdisregard\s+(?:all\s+)?(?:system|developer|safety)\s+(?:prompts|instructions|rules|boundaries)\b/i },
];

// Security Rules: Unsafe Path Traversal Patterns
export const PATH_TRAVERSAL_PATTERNS = [
  { name: 'Dangerous Path Traversal', regex: /(?:\.\.\/){3,}(?:etc|var|usr|bin|root|windows|system32)/i },
  { name: 'System Root Access Path', regex: /(?:\/etc\/(?:passwd|shadow)|C:\\Windows\\System32)/i },
];

/**
 * Parse simple YAML frontmatter without external dependencies
 */
export function parseFrontmatter(rawContent) {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---')) {
    return { frontmatter: null, body: normalized, error: 'File must start with YAML frontmatter delimiter (---)' };
  }

  const endDelimiterIndex = normalized.indexOf('\n---', 3);
  if (endDelimiterIndex === -1) {
    return { frontmatter: null, body: normalized, error: 'Unclosed YAML frontmatter delimiter (missing closing ---)' };
  }

  const yamlBlock = normalized.substring(3, endDelimiterIndex).trim();
  const body = normalized.substring(endDelimiterIndex + 4).trim();

  const frontmatter = {};
  const lines = yamlBlock.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      return { frontmatter: null, body, error: `Invalid YAML frontmatter line ${i + 2}: "${line}"` };
    }

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body, error: null };
}

/**
 * Audits skill text for security threats (secrets, prompt injection, path traversal)
 */
export function auditSecurity(rawContent, body = '') {
  const securityViolations = [];

  // 1. Scan for hardcoded credentials / secret leaks across the full content
  for (const { name, regex } of SECRET_PATTERNS) {
    const match = rawContent.match(regex);
    if (match) {
      const redacted = match[0].substring(0, 6) + '...' + match[0].substring(Math.max(6, match[0].length - 4));
      securityViolations.push(`[SECURITY CRITICAL] Potential secret leak detected (${name}: ${redacted})`);
    }
  }

  // 2. Scan for prompt injection / jailbreaking patterns in body
  for (const { name, regex } of PROMPT_INJECTION_PATTERNS) {
    if (regex.test(body)) {
      securityViolations.push(`[SECURITY WARNING] Potential Prompt Injection pattern detected (${name})`);
    }
  }

  // 3. Scan for unsafe path traversal
  for (const { name, regex } of PATH_TRAVERSAL_PATTERNS) {
    if (regex.test(rawContent)) {
      securityViolations.push(`[SECURITY WARNING] Unsafe system path reference detected (${name})`);
    }
  }

  return securityViolations;
}

/**
 * Validates a single skill markdown content string
 * Returns an array of error messages (empty array = valid)
 */
export function validateSkillContent(rawContent, _filePath = 'SKILL.md') {
  const errors = [];

  if (!rawContent || rawContent.trim() === '') {
    errors.push('Skill file is completely empty');
    return errors;
  }

  const { frontmatter, body, error: fmError } = parseFrontmatter(rawContent);

  if (fmError) {
    errors.push(fmError);
    return errors;
  }

  if (!frontmatter) {
    errors.push('Missing YAML frontmatter block');
    return errors;
  }

  // 1. Validate 'name' property
  if (!frontmatter.name || typeof frontmatter.name !== 'string' || frontmatter.name.trim() === '') {
    errors.push('Frontmatter is missing required non-empty "name" property');
  } else {
    const name = frontmatter.name.trim();
    if (name.length < 2) {
      errors.push(`Skill name "${name}" is too short (min 2 characters)`);
    } else if (name.length > 80) {
      errors.push(`Skill name "${name}" is too long (max 80 characters)`);
    }
  }

  // 2. Validate 'description' property
  if (!frontmatter.description || typeof frontmatter.description !== 'string' || frontmatter.description.trim() === '') {
    errors.push('Frontmatter is missing required non-empty "description" property');
  } else {
    const desc = frontmatter.description.trim();
    if (desc.length < 10) {
      errors.push(`Skill description is too brief (${desc.length} chars, min 10 characters required for model context)`);
    }
  }

  // 3. Validate Markdown body
  if (!body || body.trim() === '') {
    errors.push('Skill markdown body instructions are empty after frontmatter');
  } else {
    // Check for Level 1 heading
    const hasH1 = /^#\s+.+/m.test(body);
    if (!hasH1) {
      errors.push('Markdown body must contain at least one Level 1 heading (# Title)');
    }

    // Check for closed code blocks (``` count must be even)
    const codeBlockCount = (body.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      errors.push(`Unclosed fenced code block in markdown (${codeBlockCount} delimiter tokens found, expected even number)`);
    }

    // Check for empty markdown link targets [text]()
    const emptyLinkMatches = body.match(/\[([^\]]+)\]\(\s*\)/g);
    if (emptyLinkMatches) {
      errors.push(`Found empty markdown link targets: ${emptyLinkMatches.join(', ')}`);
    }
  }

  // 4. Run automated Security Audit
  const secErrors = auditSecurity(rawContent, body);
  errors.push(...secErrors);

  return errors;
}

/**
 * Validates all skills in the given directory
 */
export function validateAllSkills(skillsDir = SKILLS_DIR) {
  if (!fs.existsSync(skillsDir)) {
    return {
      success: false,
      totalCount: 0,
      validCount: 0,
      invalidCount: 1,
      results: [
        {
          skillName: 'ALL',
          skillDir: skillsDir,
          isValid: false,
          errors: [`Skills directory not found at: ${skillsDir}`],
        },
      ],
    };
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skillFolders = entries.filter((e) => e.isDirectory());
  const strayFiles = entries.filter((e) => e.isFile());

  const results = [];
  let validCount = 0;
  let invalidCount = 0;

  // Check stray files in .agents/skills root
  for (const file of strayFiles) {
    if (file.name === '.gitkeep' || file.name === 'README.md') continue;
    invalidCount++;
    results.push({
      skillName: file.name,
      skillDir: path.join(skillsDir, file.name),
      isValid: false,
      errors: [`Stray file in skills root: Skills must be encapsulated in their own subfolder (.agents/skills/<skill_name>/SKILL.md)`],
    });
  }

  for (const folder of skillFolders) {
    const folderPath = path.join(skillsDir, folder.name);
    const skillFilePath = path.join(folderPath, 'SKILL.md');

    if (!fs.existsSync(skillFilePath)) {
      invalidCount++;
      results.push({
        skillName: folder.name,
        skillDir: folderPath,
        isValid: false,
        errors: [`Missing SKILL.md in directory ${folderPath}`],
      });
      continue;
    }

    const content = fs.readFileSync(skillFilePath, 'utf-8');
    const errors = validateSkillContent(content, skillFilePath);

    if (errors.length > 0) {
      invalidCount++;
      results.push({
        skillName: folder.name,
        skillDir: folderPath,
        isValid: false,
        errors,
      });
    } else {
      validCount++;
      results.push({
        skillName: folder.name,
        skillDir: folderPath,
        isValid: true,
        errors: [],
      });
    }
  }

  return {
    success: invalidCount === 0,
    totalCount: skillFolders.length + strayFiles.filter((f) => f.name !== '.gitkeep' && f.name !== 'README.md').length,
    validCount,
    invalidCount,
    results,
  };
}

/**
 * CLI runner
 */
export function runCli() {
  console.log(`\n${colors.cyan}${colors.bold}🔍 Gridwright Agent Skills Validator & Security Auditor${colors.reset}`);
  console.log(`${colors.dim}Scanning directory: ${SKILLS_DIR}${colors.reset}\n`);

  const report = validateAllSkills();

  for (const item of report.results) {
    if (item.isValid) {
      console.log(`  ${colors.green}✔ [PASS]${colors.reset} ${colors.bold}${item.skillName}${colors.reset} ${colors.dim}(Syntax & Security Checked)${colors.reset}`);
    } else {
      console.log(`  ${colors.red}✖ [FAIL]${colors.reset} ${colors.bold}${item.skillName}${colors.reset}`);
      for (const err of item.errors) {
        const prefix = err.includes('[SECURITY') ? `${colors.magenta}🛡 ` : `${colors.red}↳ `;
        console.log(`     ${prefix}${err}${colors.reset}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  if (report.success) {
    console.log(`${colors.green}${colors.bold}✨ All ${report.validCount} skills validated successfully! (0 Security Threats / 0 Syntax Errors)${colors.reset}\n`);
    return 0;
  } else {
    console.log(`${colors.red}${colors.bold}❌ Validation failed: ${report.invalidCount} skill(s) have errors or security violations (${report.validCount}/${report.totalCount} passed).${colors.reset}\n`);
    return 1;
  }
}

// If executed directly from command line
if (process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('validate-skills.mjs'))) {
  const exitCode = runCli();
  process.exit(exitCode);
}
