import { config as baseConfig } from './packages/eslint-config/base.js';
import { nestjsConfig } from './packages/eslint-config/nestjs.js';
import { reactInternalConfig } from './packages/eslint-config/react-internal.js';
import { nextJsConfig } from './packages/eslint-config/nextjs-app.js';

// Ce fichier exporte l'ensemble de toutes les configurations,
// en appliquant les configurations spécifiques aux bons dossiers.

export default [
  // 1. Applique la configuration de base à tous les fichiers
  ...baseConfig, 
  
  // 2. Configuration pour les microservices NestJS (backend)
  {
    // Cible tous les fichiers .ts dans les dossiers de services (ajustez le chemin au besoin)
    files: ['packages/api-management/**/*.ts', 'packages/microservices/**/*.ts'],
    ...nestjsConfig
  },
  
  // 3. Configuration pour les applications Next.js (Dashboard)
  {
    // Cible les fichiers du dashboard
    files: ['packages/dashboard/**/*.ts', 'packages/dashboard/**/*.tsx'],
    ...nextJsConfig 
  },
  
  // 4. Configuration pour les composants React partagés (internal libs / SDK)
  {
    // Cible les fichiers de composants React qui ne sont pas nécessairement Next.js
    files: ['packages/ui-kit/**/*.tsx', 'packages/sdk/**/*.ts'],
    ...reactInternalConfig
  },
  
  // 5. Bloc de sécurité : Ignorer les règles sur les fichiers de configuration eux-mêmes
  // Ceci corrige l'erreur '@typescript-eslint/no-unused-vars' sur les imports de config
  {
    files: [
      'eslint.config.js', 
      'packages/eslint-config/*.js'
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      // Pour les cas où 'tseslint' est importé mais non directement utilisé
      'no-unused-vars': 'off', 
    },
  },
];