module.exports = {
  ...require('../jest.config.cjs'),
  rootDir: '..',
  testMatch: ['<rootDir>/test/integration/**/*.integration-spec.ts'],
  testTimeout: 60000,
};
