import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const reactNativeEntry = fileURLToPath(
  new URL('../terminal-shared/react-native-vitest-entry.ts', import.meta.url),
);
const reactNativeSetup = fileURLToPath(
  new URL('../terminal-shared/react-native-vitest.setup.cjs', import.meta.url),
);

export default defineConfig({
  define: {__DEV__: 'false'},
  resolve: {
    alias: [
      {find: /^react-native$/, replacement: reactNativeEntry},
      {find: /^react-native-svg$/, replacement: reactNativeEntry},
    ],
  },
  test: {
    environment: 'node',
    include: ['journeys/**/*.test.ts'],
    testTimeout: 10_000,
    setupFiles: [reactNativeSetup],
  },
});
