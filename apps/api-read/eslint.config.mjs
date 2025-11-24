import { nestjsConfig } from '@repo/eslint-config/nestjs';

/**
 * Configuration ESLint pour l'API Read (NestJS)
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
    // Règles personnalisées pour cette app si nécessaire
    rules: {
      // L'API Read peut avoir des règles légèrement différentes
      // Exemple : plus strict sur les promises
      // '@typescript-eslint/no-floating-promises': 'error',

    },
  },
];
