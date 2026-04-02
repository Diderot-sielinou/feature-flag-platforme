/* eslint-disable import/order */
import { config as baseConfig } from './base.js';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';
import pluginNext from '@next/eslint-plugin-next';
import pluginA11y from 'eslint-plugin-jsx-a11y'; // Accessibility plugin

/**
 * ESLint configuration for Next.js applications (your Dashboard).
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  // 1. Inherits all rules from the base configuration
  ...baseConfig,

  // 2. Next.js rules
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      '@next/next': pluginNext,
      'jsx-a11y': pluginA11y, // Adding the A11Y plugin
    },
    rules: {
      // Recommended Next.js rules
      ...pluginNext.configs.recommended.rules,
      // Rules for Core Web Vitals (performance)
      ...pluginNext.configs['core-web-vitals'].rules,

      // --- Merged Personal Accessibility Rules ---
      // Warns if 'alt' is missing (was 'warn' in your personal config)
      'jsx-a11y/alt-text': 'warn',
    },
  },

  // 3. React Hooks configuration
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      'react-hooks': pluginReactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
  },

  // 4. Next.js specific ignored files
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];
