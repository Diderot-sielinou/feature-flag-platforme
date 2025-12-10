import { nestjsConfig } from '@repo/eslint-config/nestjs';

/**
 * Configuration ESLint pour l'API Management (NestJS)
 */
export default [
  ...nestjsConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
    },
  },
  {
    ignores: [
      '**/*.d.ts',
    ],
  },
];
