import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'

const testReactNativeEntry = fileURLToPath(new URL('../../../../../tools/terminal-shared/react-native-vitest-entry.ts', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [{find: /^react-native$/, replacement: testReactNativeEntry}],
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/vitest.setup.cjs'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    passWithNoTests: false,
  },
})
