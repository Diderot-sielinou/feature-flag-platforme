import { baseConfig } from './base.js';

/**
 * Configuration ESLint pour les applications NestJS
 * Hérite de baseConfig + règles spécifiques backend
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nestjsConfig = [
  ...baseConfig,

  {
    files: ['**/*.ts', '**/*.tsx'],

    rules: {
      // === NestJS Specific ===
      // Les constructeurs vides sont OK pour l'injection de dépendances
      '@typescript-eslint/no-useless-constructor': 'off',
      'no-useless-constructor': 'off',

      // Les fonctions vides sont OK pour les méthodes abstraites
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
      // NestJS utilise beaucoup les décorateurs
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts', '**/__tests__/**/*.ts'],
    rules: {
      // Règles plus souples pour les tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-console': 'off',
    },
  },
];
