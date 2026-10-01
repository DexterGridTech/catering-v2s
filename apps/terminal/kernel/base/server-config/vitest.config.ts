import {defineConfig} from 'vitest/config';

export default defineConfig({
  define: {__DEV__: process.env.TERMINAL_TEST_DEV_MODE === 'true' ? 'true' : 'false'},
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
  },
});
