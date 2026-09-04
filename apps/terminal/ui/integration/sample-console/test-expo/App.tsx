import {createTestExpoApp} from '@catering-v2s/ui-base-test-support'
import {createSampleAssembly, terminalSurfaces} from '../src'

const App = createTestExpoApp({
  appName: 'sample-console',
  title: '真实业务画布',
  persistenceKey: 'sample-console-web',
  terminalSurfaces,
  createAssembly: createSampleAssembly,
  getRuntimeStatus: assembly => assembly.runtime.status,
})

export default App
