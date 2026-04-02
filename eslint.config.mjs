import { baseConfig } from './packages/eslint-config/base.js';

/**

* ESLint root configuration of the monorepo

* This configuration is used for files in the root directory only

* Each app/package has its own configuration

*/
export default [
  ...baseConfig,

  {
    ignores: [
      'infrastructure/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/out/**',
      '**/.turbo/**',
      'packages/eslint-config/**',
      'packages/database/**',
    ],
  },

  {
    files: ['*.js', '*.mjs', '*.cjs'],
    languageOptions: {
      parser: undefined,
      parserOptions: {
        project: null,
        tsconfigRootDir: undefined,
        sourceType: 'module',
      },
    },

    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-anonymous-default-export': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];
