const { defineConfig } = require('@playwright/test');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
module.exports = defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30000,
  outputDir: join(tmpdir(), 'old-youtube-test-results'),
  reporter: 'list',
});
