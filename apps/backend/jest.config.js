/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // The Nest framework lives in the workspace root node_modules but rxjs lives
  // under apps/backend; make Jest look in both.
  moduleDirectories: ['node_modules', '<rootDir>/../../node_modules'],
  moduleNameMapper: {
    '^rxjs$': '<rootDir>/node_modules/rxjs/dist/cjs/index.js',
    '^rxjs/operators$': '<rootDir>/node_modules/rxjs/dist/cjs/operators/index.js',
  },
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/dto/**',
  ],
};
