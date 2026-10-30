/** End-to-end tests: real HTTP requests against the API, using the TEST_DATABASE_URL database. */
module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  // The generated Prisma client imports "./x.js"; map those to the .ts sources.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  globalSetup: "<rootDir>/test/global-setup.ts",
  testTimeout: 60000,
  maxWorkers: 1,
};
