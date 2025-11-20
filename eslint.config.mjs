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

// 2. Résolution des alias / TS project paths
allConfigs.push({
  settings: {
    'import/resolver': {
      typescript: {
        project: [
          'tsconfig.base.json',
          'tsconfig.json',
          'apps/*/tsconfig.json',
          'packages/*/tsconfig.json',
        ],
      },
    },
  },
});

// 3. Configuration NestJS
if (Array.isArray(nestjsConfig)) {
  allConfigs.push(...nestjsConfig);
} else {
  allConfigs.push(nestjsConfig);
}

// 4. Configuration Next.js
if (Array.isArray(nextJsConfig)) {
  allConfigs.push(...nextJsConfig);
} else {
  allConfigs.push(nextJsConfig);
}

// 5. Configuration React interne
if (Array.isArray(reactInternalConfig)) {
  allConfigs.push(...reactInternalConfig);
} else {
  allConfigs.push(reactInternalConfig);
}

// 6. Config de sécurité pour les fichiers de config
allConfigs.push({
  files: ['eslint.config.js', 'packages/eslint-config/*.js'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': 'off',
    '@next/next/no-html-link-for-pages': 'off',
  },
});

// --- Export final ---
export default allConfigs;
