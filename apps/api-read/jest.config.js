const { pathsToModuleNameMapper } = require('ts-jest');

const { compilerOptions } = require('../../tsconfig.base.json');

module.exports = {
  preset: 'ts-jest',
  rootDir: '../..',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testMatch: ['**/*.spec.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/apps/api-management/tsconfig.json',
    },
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/',
  }),
};
