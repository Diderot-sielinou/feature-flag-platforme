import { nestjsConfig } from '@repo/eslint-config/nestjs.js';

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
      'import/order': 'off',
      // '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
