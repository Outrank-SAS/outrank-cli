import js from '@eslint/js';
import globals from 'globals';

const STDIO_ALLOWED_FILES = ['src/adapters/cli/**', 'src/core/io.js', 'src/index.js', 'bin/**'];

const STDIO_RESTRICTIONS = [
  {
    object: 'process',
    property: 'stdout',
    message: 'stdout is the MCP JSON-RPC channel. Emit output only through the CLI adapter.',
  },
  {
    object: 'process',
    property: 'stdin',
    message: 'stdin is the MCP JSON-RPC channel. Read input only through the CLI adapter.',
  },
  {
    object: 'process',
    property: 'exit',
    message: 'Set process.exitCode in the CLI adapter instead of calling process.exit.',
  },
];

const BASE_RULES = {
  'prefer-arrow-callback': 'error',
  'func-style': ['error', 'expression'],
  'prefer-const': 'error',
  'no-var': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': 'error',
  'no-restricted-properties': ['error', ...STDIO_RESTRICTIONS],
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: 'node:readline',
          message: 'Interactive prompts are not allowed; the CLI is argv-driven and the MCP server owns stdio.',
        },
      ],
    },
  ],
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'bin/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: BASE_RULES,
  },
  {
    files: STDIO_ALLOWED_FILES,
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
    },
  },
];
