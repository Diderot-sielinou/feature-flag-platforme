import { config as baseConfig } from "./base.js";
import tseslint from "typescript-eslint";
import securityPlugin from "eslint-plugin-security";
import nodePlugin from "eslint-plugin-node";

/**
 * Configuration ESLint pour les microservices NestJS (backend).
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nestjsConfig = [
  // 1. Hérite de toutes les règles de la configuration de base
  ...baseConfig,
  
  // 2. Configuration spécifique à l'analyse de fichiers TypeScript
  {
    files: ["**/*.ts", "**/*.tsx"], // Appliquer uniquement aux fichiers TS/TSX
    languageOptions: {
      parserOptions: {
        // Nécessaire pour les règles qui dépendent de l'information de type (ex: no-unused-vars)
        project: "tsconfig.json", 
      },
    },
    // Ajout des plugins pour la sécurité et Node.js
    plugins: {
      security: securityPlugin,
      node: nodePlugin,
    },
    rules: {
      // --- Règles spécifiques à NestJS (Injection de Dépendances / Classes) ---
      "no-useless-constructor": "off",
      "@typescript-eslint/no-useless-constructor": "off", 
      "no-empty-function": "off",
      "@typescript-eslint/no-empty-function": "off",
      
      // Bonne pratique NestJS : permet l'utilisation de _ pour les variables non utilisées (DI)
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],

      // --- Règles spécifiques à Node.js / Monorepo ---
      // Désactivée car gérée par les outils de build du monorepo
      "node/no-missing-import": "off", 
      
      // --- Règles de Sécurité ---
      // Interdit l'utilisation de 'eval' avec expression pour prévenir le RCE
      "security/detect-eval-with-expression": "error",
      // Interdit les expressions régulières non sécurisées (prévention ReDoS)
      "security/detect-unsafe-regex": "error",
    },
  },
];