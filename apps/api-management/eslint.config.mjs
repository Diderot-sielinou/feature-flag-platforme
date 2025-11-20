import { nestjsConfig } from '@repo/eslint-config/nestjs.js';

/**

* ESLint configuration for the NestJS `api-management` app

* ✅ Extends the shared configuration of the @repo/eslint-config package

* ✅ Compatible with CommonJS

* ✅ Integrates proper TypeScript & Jest rules

*/

export default [
  ...nestjsConfig,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
