import { baseConfig } from '@repo/eslint-config/base';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
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
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Consolidation de toutes les directives 'ignores'
    ignores: [
      'infrastructure/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/*.js',
      '**/*.d.ts',
      'src/**/*.js',
      'src/**/*.d.ts',
      'prisma/migrations/**',
      'node_modules/@prisma/**',
      'prisma/**',
    ],
  },
];
