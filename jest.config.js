/**
 * Jest Configuration
 * Configured for ES modules support with modern JavaScript
 */

export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/src/**/*.test.js", "**/test/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/**/*.test.js", "!src/index.js"],
};
