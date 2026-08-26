import {defineConfig, devices} from '@playwright/test';
import path from 'node:path';

const baseURL = process.env.R5_L2_OPERATIONS_BASE_URL;
if (!baseURL) throw new Error('R5_L2_OPERATIONS_BASE_URL_REQUIRED');
const outputDir = process.env.R5_L2_PLAYWRIGHT_OUTPUT_DIR;
if (!outputDir || !path.isAbsolute(outputDir)) throw new Error('R5_L2_PLAYWRIGHT_OUTPUT_DIR_REQUIRED');
const l2ExpectTimeoutMs = Number(process.env.R5_L2_EXPECT_TIMEOUT_MS ?? 5_000);
if (!Number.isFinite(l2ExpectTimeoutMs) || l2ExpectTimeoutMs < 5_000)
  throw new Error('R5_L2_EXPECT_TIMEOUT_MS_INVALID');

export default defineConfig({
  testDir: './src/tests/l2',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: {timeout: l2ExpectTimeoutMs},
  outputDir,
  reporter: [['line']],
  use: {baseURL, trace: 'retain-on-failure'},
  projects: [{name: 'desktop-1280', use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 720}}}],
});
