import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const reactNativeEntry = fileURLToPath(
  new URL('../../../../../tools/terminal-shared/react-native-vitest-entry.ts', import.meta.url),
);
const reactNativeSetup = fileURLToPath(
  new URL('../../../../../tools/terminal-shared/react-native-vitest.setup.cjs', import.meta.url),
);
const rntlSetup = fileURLToPath(new URL('../../../../../tools/terminal-shared/rntl-vitest-setup.ts', import.meta.url));

export default defineConfig({
  define: {__DEV__: process.env.TERMINAL_TEST_DEV_MODE === 'true' ? 'true' : 'false'},
  resolve: {
    alias: [
      {find: /^react-native$/, replacement: reactNativeEntry},
      {find: /^react-native-svg$/, replacement: reactNativeEntry},
    ],
  },
  test: {
    environment: 'node',
    setupFiles: [reactNativeSetup, rntlSetup],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    passWithNoTests: false,
  },
});
