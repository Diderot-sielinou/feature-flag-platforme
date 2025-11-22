// eslint.config.mjs

// Imports
import { config as baseConfig } from './packages/eslint-config/base.js';
import { nestjsConfig } from './packages/eslint-config/nestjs.js';
import { config as reactInternalConfig } from './packages/eslint-config/react-internal.js';
import { nextJsConfig } from './packages/eslint-config/nextjs-app.js';

// --- Construction explicite du tableau de configuration ---
const allConfigs = [];

// 🚫 Ignorer entièrement l'infrastructure (IMPORTANT : doit être AU DÉBUT)
allConfigs.push({
  ignores: ['infrastructure/**/*'],
});

// 1. Configuration de base
if (Array.isArray(baseConfig)) {
  allConfigs.push(...baseConfig);
} else {
  allConfigs.push(baseConfig);
}

// 2. Résolution des alias / TS project paths (FIX: Ajout de tsconfigRootDir)
allConfigs.push({
  settings: {
    'import/resolver': {
      typescript: {
        // ✅ Ajouté pour indiquer que la racine du projet est ici
        tsconfigRootDir: import.meta.dirname, 
        project: [
          './tsconfig.base.json',
          // 'tsconfig.json', // ❌ Cette ligne est maintenant retirée
          'apps/*/tsconfig.json',
          'packages/*/tsconfig.json',
        ],
      },
      // ✅ AJOUTER le node resolver
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
});

// 3. Configuration NestJS (s'applique par défaut à tous les fichiers .ts)
if (Array.isArray(nestjsConfig)) {
  allConfigs.push(...nestjsConfig);
} else {
  allConfigs.push(nestjsConfig);
}

// 4. Configuration Next.js
// 🎯 Restreindre aux applications Next.js (web et dashboard)
const nextJsFiles = ['apps/dashboard/**', 'apps/web/**'];

if (Array.isArray(nextJsConfig)) {
  for (const config of nextJsConfig) {
    // S'assurer que les configurations Next.js ne s'appliquent qu'aux fichiers cibles
    allConfigs.push({ ...config, files: nextJsFiles });
  }
} else {
  allConfigs.push({ ...nextJsConfig, files: nextJsFiles });
}

// 5. Configuration React interne
// 🎯 Restreindre aux packages React (ui, web, dashboard)
const reactInternalFiles = ['packages/ui/**', 'apps/dashboard/**', 'apps/web/**'];

if (Array.isArray(reactInternalConfig)) {
  for (const config of reactInternalConfig) {
    // S'assurer que les configurations React s'appliquent qu'aux fichiers cibles
    allConfigs.push({ ...config, files: reactInternalFiles });
  }
} else {
  allConfigs.push({ ...reactInternalConfig, files: reactInternalFiles });
}

// 6. Config de sécurité pour les fichiers de config
allConfigs.push({
  files: ['eslint.config.js', 'packages/eslint-config/*.js'],
  rules: {
    'import/no-default-export': 'error',
  },
});

// Exemple de ré-application dans la configuration racine
allConfigs.push({
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
    },
});

// Exporter la configuration finale
export default allConfigs;