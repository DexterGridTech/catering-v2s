import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const testReactNativeEntry = fileURLToPath(
  new URL('../../../../../tools/terminal-shared/react-native-vitest-entry.ts', import.meta.url),
);
const rntlSetup = fileURLToPath(new URL('../../../../../tools/terminal-shared/rntl-vitest-setup.ts', import.meta.url));

export default defineConfig({
  define: {__DEV__: 'false'},
  resolve: {
    alias: [
      {find: /^react-native$/, replacement: testReactNativeEntry},
      {find: /^react-native-svg$/, replacement: testReactNativeEntry},
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/vitest.setup.cjs', rntlSetup],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    passWithNoTests: false,
  },
});
