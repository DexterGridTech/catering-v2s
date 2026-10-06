import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['journeys/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
