import { config as baseConfig } from './packages/eslint-config/base.js';
import { nestjsConfig } from './packages/eslint-config/nestjs.js';
import { reactInternalConfig } from './packages/eslint-config/react-internal.js';
import { nextJsConfig } from './packages/eslint-config/nextjs-app.js';

// This file exports the complete set of configurations,
// applying the appropriate rules to the correct folders.

export default [
  // 1. Apply the base configuration to all files
  ...baseConfig,

  // 2. Configuration for NestJS microservices (backend)
  {
    // Targets all .ts files in service folders (adjust path if needed)
    files: ['packages/api-management/**/*.ts', 'packages/microservices/**/*.ts'],
    ...nestjsConfig,
  },

  // 3. Configuration for Next.js applications (Dashboard)
  {
    // Targets dashboard files
    files: ['packages/dashboard/**/*.ts', 'packages/dashboard/**/*.tsx'],
    ...nextJsConfig,
  },

  // 4. Configuration for shared React components (internal libs / SDK)
  {
    // Targets React component files that are not necessarily Next.js
    files: ['packages/ui-kit/**/*.tsx', 'packages/sdk/**/*.ts'],
    ...reactInternalConfig,
  },

  // 5. Safety block: ignore rules on the config files themselves
  // This fixes '@typescript-eslint/no-unused-vars' errors on config imports
  {
    files: ['eslint.config.js', 'packages/eslint-config/*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      // For cases where 'tseslint' is imported but not directly used
      'no-unused-vars': 'off',
    },
  },
];
