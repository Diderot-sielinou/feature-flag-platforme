// import { nestjsConfig } from "@repo/eslint-config/nestjs.js";

// export default [...nestjsConfig];
import { nestjsConfig } from "@repo/eslint-config/nestjs.js";

/**
 * Configuration ESLint pour l’app NestJS `api-management`
 * 
 * ✅ Étend la configuration partagée du package @repo/eslint-config
 * ✅ Compatible avec CommonJS
 * ✅ Intègre les bonnes règles TypeScript & Jest
 */

export default [
  ...nestjsConfig,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ✅ Quelques règles personnalisées possibles ici
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
