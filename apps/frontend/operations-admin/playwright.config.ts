import {defineConfig, devices} from '@playwright/test';

const baseURL = process.env.R5_L2_OPERATIONS_BASE_URL;
if (!baseURL) throw new Error('R5_L2_OPERATIONS_BASE_URL_REQUIRED');

export default defineConfig({
  testDir: './src/tests/l2',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  reporter: [['line']],
  use: {baseURL, trace: 'retain-on-failure'},
  projects: [{name: 'desktop-1280', use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 720}}}],
});
