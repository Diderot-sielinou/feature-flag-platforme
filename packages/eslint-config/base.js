import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';
// Adds "promise" and "import" plugins from your previous configuration
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
      // Adds "promise" and "import" plugins in the new format
      import: importPlugin,
    },
    rules: {
      // --- Turborepo Rules ---
      'turbo/no-undeclared-env-vars': 'warn',

      // --- Merged Personal TypeScript Rules ---
      // Disables the requirement for explicit types on exports (for flexibility)
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Allows the use of 'any' for flexibility (often needed for monorepo utilities)
      '@typescript-eslint/no-explicit-any': 'off',

      // --- Merged Personal Import Rules ---
      // Disables checking for external dependencies (crucial in a monorepo)
      'import/no-extraneous-dependencies': 'off',

      // Enforces a consistent import order (highly professional)
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],

      // Prefers the flexibility of named exports over forcing default exports
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
