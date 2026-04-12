module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  // Treat TypeScript as ESM so .js extension imports resolve to .ts sources in tests
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Allow importing local files with .js extension while running in TS/Jest
    '^(.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: 'tsconfig.test.json', useESM: true, diagnostics: { ignoreCodes: [151002] } }
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(octokit|@octokit)/)',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['cobertura', 'text', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
