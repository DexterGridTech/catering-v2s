import {defineConfig} from 'vitest/config';

export default defineConfig({
  define: {__DEV__: 'false'},
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: false,
  },
});
