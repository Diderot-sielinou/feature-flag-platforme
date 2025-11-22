// packages/eslint-config/base.js

import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';
import importPlugin from 'eslint-plugin-import';

/**
 * Shared base ESLint configuration for the monorepo.
 * Merges default monorepo rules with personal preferences.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  // 1. Recommended base JavaScript rules
  js.configs.recommended,

  // 2. Recommended TypeScript rules
  ...tseslint.configs.recommended,

  // 3. Disables all rules that conflict with Prettier (must be after all others)
  eslintConfigPrettier,

  // 4. Turborepo integration and custom monorepo rules
  {
    plugins: {
      turbo: turboPlugin,
      import: importPlugin,
    },
    // ❌ L'objet 'settings' pour 'import/resolver' est retiré.
    //    Il est déplacé dans le fichier racine eslint.config.mjs.

    rules: {
      // --- Turborepo Rules ---
      'turbo/no-undeclared-env-vars': 'warn',

      // --- Merged Personal TypeScript Rules ---
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',

      // --- Merged Personal Import Rules ---
      'import/no-extraneous-dependencies': 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import/prefer-default-export': 'off',
    },
  },

  // 5. Plugin to treat all errors as warnings (optional, but common in CI)
  {
    plugins: {
      onlyWarn,
    },
  },

  // 6. Node.js environment configuration (taken from your old config)
  {
    languageOptions: {
      globals: {
        // Defines the environment as Node.js (for microservices)
        node: true,
      },
    },
  },

  // 7. Ignored files
  {
    // Ignores build directories
    ignores: ['dist/**'],
  },
];
