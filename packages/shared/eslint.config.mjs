import { baseConfig } from '@repo/eslint-config/base';

/**
 * Configuration ESLint pour le package shared
 * Types et constantes partagés
 */
export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Package de types : être très strict
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
    },
  },
];