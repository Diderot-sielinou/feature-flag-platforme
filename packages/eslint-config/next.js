import { baseConfig } from './base.js';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * Configuration ESLint pour les applications Next.js
 * Hérite de baseConfig + règles React/Next.js
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nextjsConfig = [
  ...baseConfig,

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      'jsx-a11y': pluginJsxA11y,
    },

    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
      },
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      // === React ===
      'react/react-in-jsx-scope': 'off', // Next.js 13+ n'en a pas besoin
      'react/prop-types': 'off', // On utilise TypeScript
      'react/jsx-no-target-blank': 'error',
      'react/jsx-key': 'error',
      'react/no-unescaped-entities': 'warn',
      'react/self-closing-comp': 'error',
      'react/jsx-curly-brace-presence': [
        'error',
        {
          props: 'never',
          children: 'never',
        },
      ],
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-no-duplicate-props': 'error',

      // === React Hooks ===
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // === Accessibility ===
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': [
        'error',
        {
          components: ['Link'],
          specialLink: ['hrefLeft', 'hrefRight'],
          aspects: ['invalidHref', 'preferButton'],
        },
      ],
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',

      // === TypeScript + React ===
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // === Imports ===
      'import/no-anonymous-default-export': 'warn',

      // === Console ===
      // Plus strict en frontend
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['**/*.tsx'],
    rules: {
      // Règles spécifiques aux composants React
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  {
    // Configuration pour les fichiers de configuration Next.js
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },

  {
    // Configuration pour les App Router
    files: ['**/app/**/*.tsx', '**/app/**/*.ts'],
    rules: {
      'import/no-default-export': 'off', // App Router nécessite des exports par défaut
    },
  },
];
