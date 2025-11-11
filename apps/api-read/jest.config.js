const { pathsToModuleNameMapper } = require('ts-jest');

const { compilerOptions } = require('../../tsconfig.base.json'); // ✅ Corrigé : bon chemin vers le fichier racine

module.exports = {
  preset: 'ts-jest',
  rootDir: '../..', // ✅ Important pour que Jest résolve les chemins correctement
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testMatch: ['**/*.spec.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/apps/api-management/tsconfig.json', // ✅ Bon chemin absolu
    },
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/', // ✅ Résolution propre depuis la racine du repo
  }),
};
