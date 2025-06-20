import eslint from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        NodeJS: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        RequestInit: 'readonly',
        HeadersInit: 'readonly',
        Headers: 'readonly',
        require: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off', // Turn off for flexibility
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-fallthrough': 'off', // Allow fallthrough in switch statements
      '@typescript-eslint/no-require-imports': 'off', // Allow require imports for Node.js
    },
  },
  {
    files: ['**/*.{js,ts}'],
    ...prettier,
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'cdk.out/**',
      '*.config.js',
      '*.config.ts',
      'infrastructure/**',
      'test_*.js', // Ignore test files with different patterns
    ],
  },
];
