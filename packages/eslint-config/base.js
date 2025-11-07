import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";
// Ajout des plugins "promise" et "import" de votre ancienne configuration
import importPlugin from "eslint-plugin-import";

/**
 * Configuration ESLint de base partagée pour le monorepo.
 * Fusionne les règles du Monorepo par défaut et les préférences personnelles.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  // 1. Règles de base JavaScript recommandées
  js.configs.recommended,
  
  // 2. Règles TypeScript recommandées
  ...tseslint.configs.recommended,
  
  // 3. Désactive toutes les règles qui entrent en conflit avec Prettier (doit être après tous les autres)
  eslintConfigPrettier,
  
  // 4. Intégration Turborepo et règles de monorepo personnalisées
  {
    plugins: {
      turbo: turboPlugin,
      // Ajout des plugins "promise" et "import" dans le nouveau format
      import: importPlugin, 
    },
    rules: {
      // --- Règles de Turborepo ---
      "turbo/no-undeclared-env-vars": "warn",

      // --- Règles TypeScript Personnelles Fusionnées ---
      // Désactive l'exigence de types explicites sur les exports (pour plus de flexibilité)
      "@typescript-eslint/explicit-module-boundary-types": "off", 
      // Autorise l'utilisation de 'any' pour la flexibilité (souvent nécessaire pour les utilitaires monorepo)
      "@typescript-eslint/no-explicit-any": "off", 
      
      // --- Règles d'Importation Personnelles Fusionnées ---
      // Désactive la vérification des dépendances externes (crucial dans un monorepo)
      "import/no-extraneous-dependencies": "off", 
      
      // Force un ordre d'importation cohérent (très professionnelle)
      "import/order": ["error", {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always"
      }],
      
      // Préfère la flexibilité des exports nommés plutôt que de forcer les exports par défaut
      "import/prefer-default-export": "off", 
    },
  },
  
  // 5. Plugin pour traiter toutes les erreurs comme des avertissements (optionnel, mais courant en CI)
  {
    plugins: {
      onlyWarn,
    },
  },

  // 6. Configuration de l'environnement Node.js (tirée de votre ancienne config)
  {
    languageOptions: {
      globals: {
        // Définit l'environnement comme Node.js (pour les microservices)
        node: true,
      },
    },
  },
  
  // 7. Fichiers à ignorer
  {
    // Ignore les répertoires de compilation
    ignores: ["dist/**"],
  },
];