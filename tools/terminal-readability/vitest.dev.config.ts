import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'

const reactNativeEntry = fileURLToPath(new URL('../terminal-shared/react-native-vitest-entry.ts', import.meta.url))
const reactNativeSetup = fileURLToPath(new URL('../terminal-shared/react-native-vitest.setup.cjs', import.meta.url))
const focusedTests = [
  fileURLToPath(new URL('../../apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts', import.meta.url)),
  fileURLToPath(new URL('../../apps/terminal/kernel/base/runtime/test/startupDiagnostics.dev.test.ts', import.meta.url)),
  fileURLToPath(new URL('../../apps/terminal/ui/base/render/test/startupDiagnostics.dev.test.tsx', import.meta.url)),
  fileURLToPath(new URL('../../apps/terminal/ui/base/input/test/InputSurfaceFrame.measurement.dev.test.tsx', import.meta.url)),
]
const compileTimeDefine = {
  name: 'terminal-readability-dev-define',
  enforce: 'post' as const,
  config: () => ({define: {'__DEV__': 'true'}}),
}

export default defineConfig({
  define: {'__DEV__': 'true'},
  plugins: [compileTimeDefine],
  resolve: {alias: [{find: /^react-native$/, replacement: reactNativeEntry}]},
  test: {
    environment: 'node',
    setupFiles: [reactNativeSetup],
    include: focusedTests,
    passWithNoTests: false,
  },
})
