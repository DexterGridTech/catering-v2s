import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'

const reactNativeEntry = fileURLToPath(new URL('../../../../../tools/terminal-shared/react-native-vitest-entry.ts', import.meta.url))
const reactNativeSetup = fileURLToPath(new URL('../../../../../tools/terminal-shared/react-native-vitest.setup.cjs', import.meta.url))

export default defineConfig({
  define: {__DEV__: 'false'},
  resolve: {alias: [{find: /^react-native$/, replacement: reactNativeEntry}]},
  test: {
    environment: 'node',
    setupFiles: [reactNativeSetup],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    passWithNoTests: false,
  },
})
