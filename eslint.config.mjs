// Imports
import { config as baseConfig } from './packages/eslint-config/base.js';
import { nestjsConfig } from './packages/eslint-config/nestjs.js';
import { config as reactInternalConfig } from './packages/eslint-config/react-internal.js'; // Renommé pour clarté
import { nextJsConfig } from './packages/eslint-config/nextjs-app.js';

// --- Construction explicite du tableau de configuration ---
const allConfigs = [];

// 1. Commencez par la configuration de base
if (Array.isArray(baseConfig)) {
  allConfigs.push(...baseConfig);
} else {
  allConfigs.push(baseConfig); // Si ce n'est pas un tableau, ajoutez-le directement (inhabituel)
}

// 2. Ajoutez la configuration pour la résolution des alias
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

// 3. Ajoutez la configuration pour NestJS
if (Array.isArray(nestjsConfig)) {
  allConfigs.push(...nestjsConfig);
} else {
  allConfigs.push(nestjsConfig);
}

// 4. Ajoutez la configuration pour Next.js
if (Array.isArray(nextJsConfig)) {
  allConfigs.push(...nextJsConfig);
} else {
  allConfigs.push(nextJsConfig);
}

// 5. Ajoutez la configuration pour les composants React internes/SDK
if (Array.isArray(reactInternalConfig)) {
  allConfigs.push(...reactInternalConfig);
} else {
  allConfigs.push(reactInternalConfig);
}

// 6. Ajoutez la configuration de sécurité pour les fichiers de config
allConfigs.push({
  files: ['eslint.config.js', 'packages/eslint-config/*.js'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': 'off',
  },
});

// --- Export final ---
export default allConfigs;
