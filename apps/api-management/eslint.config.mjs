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
    // Règles personnalisées pour cette app si nécessaire
    rules: {
      // Exemple : autoriser console.log en développement
      // 'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    },
  },
];
