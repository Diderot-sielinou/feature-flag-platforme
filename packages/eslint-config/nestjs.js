import { baseConfig } from './base.js';

/**

* ESLint configuration for NestJS applications

* Inherits baseConfig + backend-specific rules

* @type {import("eslint").Linter.Config[]}

*/
export const nestjsConfig = [
  ...baseConfig,

  {
    files: ['**/*.ts', '**/*.tsx'],

    rules: {
      // === NestJS Specific ===
      // Empty constructors are OK for dependency injection.
      '@typescript-eslint/no-useless-constructor': 'off',
      'no-useless-constructor': 'off',

      // Empty functions are OK for abstract methods
      '@typescript-eslint/no-empty-function': 'off',
      'no-empty-function': 'off',

      // === TypeScript Strict ===
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
      '@typescript-eslint/require-await': 'warn',

      // === Security ===
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // === Best Practices ===
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'always'],

      // === Console ===
      // Autoriser console.log/warn/error en backend
      'no-console': 'off',

      // === Decorators ===
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-console': 'off',
    },
  },
];
