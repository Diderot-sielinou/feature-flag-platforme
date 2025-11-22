/* eslint-disable import/order */
import { config as baseConfig } from './base.js';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import securityPlugin from 'eslint-plugin-security';
import nodePlugin from 'eslint-plugin-node';

/**
 * Configuration ESLint pour les microservices NestJS (backend).
 * Optimisée pour monorepo Turborepo + NestJS + Prisma.
 */
export const nestjsConfig = [
  ...baseConfig,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        // ✅ Correction : Utiliser des chemins relatifs à la racine monorepo (./) pour la robustesse.
        project: [
          './tsconfig.base.json', // Ajout de la base
          './apps/*/tsconfig.json',
          './packages/*/tsconfig.json',
          './apps/*/tsconfig.spec.json', // Critique pour les fichiers de test
        ],
        // eslint-disable-next-line no-undef
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      security: securityPlugin,
      node: nodePlugin,
    },
    rules: {
      // --- TypeScript / NestJS ---
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',

      // --- Node.js / Monorepo ---
      'node/no-missing-import': 'off',
      'node/no-unsupported-features/es-syntax': 'off',

      // --- Sécurité ---
      'security/detect-eval-with-expression': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-child-process': 'error',

      'no-unused-expressions': 'off', // 1. Désactiver la règle JS
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
          enforceForJSX: true,
        },
      ],
      'no-return-await': 'off', // 1. Désactiver la règle JS
      '@typescript-eslint/return-await': 'error', // 2. Activer la règle TS (plus sûr pour async)
    },
  },
];
