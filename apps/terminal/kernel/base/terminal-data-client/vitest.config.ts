import {defineConfig} from 'vitest/config';

export default defineConfig({
  define: {__DEV__: 'false'},
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
  },
});
