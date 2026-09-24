import {createTestExpoApp} from '@catering-v2s/ui-base-dev-host'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {createProcessMemoryStateStoragePort} from '@catering-v2s/kernel-base-platform-ports'
import {refreshTopologyDisplayCommand} from '@catering-v2s/kernel-base-topology'
import {createSampleWallpaperConsoleAssembly, terminalSurfaces} from '../src'
import '../theme/global.css'

const App = createTestExpoApp({
  appName: 'sample-wallpaper-console',
  title: '壁纸终端画布',
  persistenceKey: 'sample-wallpaper-console-web',
  webPlatformOptions: {protectedStorage: createProcessMemoryStateStoragePort()},
  terminalSurfaces,
  createAssembly: createSampleWallpaperConsoleAssembly,
  getRuntimeStatus: assembly => assembly.runtime.status,
  onSurfaceModeChanged: async ({assembly}) => {
    await assembly.runtime.dispatchCommand(refreshTopologyDisplayCommand, {}, {requestId: createRequestId()})
  },
})

export default App
