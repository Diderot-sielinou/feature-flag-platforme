import { baseConfig } from './packages/eslint-config/base.js';

/**
 * Configuration ESLint racine du monorepo
 * Cette config est utilisée pour les fichiers à la racine uniquement
 * Chaque app/package a sa propre configuration
 */
export default [
  ...baseConfig,

  {
    // Ignorer l'infrastructure et les fichiers de build
    ignores: [
      'infrastructure/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/out/**',
      '**/.turbo/**',
      'packages/eslint-config/**',
    ],
  },

  {
    // Configuration pour les fichiers de configuration
    files: ['*.js', '*.mjs', '*.cjs'],
    // 🛑 BLOQUER LE PARSEUR ET LE TYPAGE TYPESCRIPT HÉRITÉ
    languageOptions: {
      // Retire explicitement le parseur TS pour revenir au parseur JS par défaut
      parser: undefined,
      parserOptions: {
        // Désactive la recherche de tsconfig qui cause l'erreur "Parsing error: That TSConfig does not include this file"
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
