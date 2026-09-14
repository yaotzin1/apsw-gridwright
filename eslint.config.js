import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Exploit-prone APIs, banned everywhere. The same list is enforced without ESLint by
 * `scripts/security-audit.mjs` in the pre-commit hook, so a machine without node_modules is still
 * gated; this copy puts the error in the editor. See `.agents/skills/application_security/SKILL.md`.
 * There is no inline exception: an `eslint-disable` for one of these is rejected by the audit too.
 */
const SECURITY_RULES = {
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'HTML sink. Use textContent or createElement.' },
        { property: 'outerHTML', message: 'HTML sink. Use textContent or createElement.' },
        { property: 'insertAdjacentHTML', message: 'HTML sink. Use insertAdjacentElement.' },
        { object: 'document', property: 'write', message: 'HTML sink.' },
        { object: 'document', property: 'writeln', message: 'HTML sink.' },
    ],
    'no-restricted-syntax': [
        'error',
        {
            selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
            message: 'dangerouslySetInnerHTML is an HTML sink. Render text, or build elements with React.',
        },
        {
            selector: "Property[key.name='dangerouslySetInnerHTML']",
            message: 'dangerouslySetInnerHTML is an HTML sink. Render text, or build elements with React.',
        },
        {
            selector: "CallExpression[callee.property.name='postMessage'][arguments.1.value='*']",
            message: "postMessage with '*' sends to any origin. Name the target origin.",
        },
    ],
};

export default tseslint.config(
    { ignores: ['dist', 'coverage', 'node_modules', 'examples/**/dist'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx,js,mjs,cjs,jsx}'],
        rules: SECURITY_RULES,
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: { ...globals.browser, ...globals.node },
        },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,
            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'error',
            'no-console': ['error', { allow: ['warn', 'error'] }],
        },
    },
    {
        // The core engine is headless by contract. A DOM reference here is an architectural
        // regression, not a style preference, so it fails the lint gate.
        files: [
            'src/core/**/*.ts',
            'src/data/**/*.ts',
            'src/plugins/**/*.ts',
            'src/i18n/**/*.ts',
            'src/locales/**/*.ts',
            'src/tree/**/*.ts',
        ],
        languageOptions: { globals: { ...globals.node } },
        rules: {
            'no-restricted-globals': [
                'error',
                { name: 'document', message: 'The core is headless: DOM access belongs in an adapter under src/react/.' },
                { name: 'window', message: 'The core is headless: DOM access belongs in an adapter under src/react/.' },
            ],
            'no-restricted-imports': [
                'error',
                { paths: [{ name: 'react', message: 'The core must not depend on React. Keep framework code in src/react/.' }] },
            ],
        },
    },
    {
        // The playground's own scripts. They were inline in the HTML until they grew past a
        // thousand lines, which also meant nothing checked them: every slip surfaced in a browser
        // instead of in the terminal.
        files: ['examples/playground/js/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            ecmaVersion: 2023,
            globals: { ...globals.browser },
        },
        rules: {
            'no-console': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: {
            'no-console': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['tests/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },
);
