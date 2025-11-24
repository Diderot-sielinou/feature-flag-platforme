import { baseConfig } from '@repo/eslint-config/base';

/**
 * Configuration ESLint pour le package database
 * Prisma schema et migrations
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
    files: ['src/**/*.ts'],
    rules: {
      // Prisma génère du code, donc plus souple
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Ignorer les fichiers générés par Prisma
    ignores: ['prisma/migrations/**', 'node_modules/@prisma/**'],
  },
];