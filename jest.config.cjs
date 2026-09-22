module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { useESM: true, tsconfig: '<rootDir>/tsconfig.test.json' },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/prisma/contract.d.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
};
