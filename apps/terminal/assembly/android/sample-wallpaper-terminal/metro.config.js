import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createMetroConfig} from '@catering-v2s/assembly-base-android/config'

const appDir = path.dirname(fileURLToPath(import.meta.url))

export default createMetroConfig({
  appDir,
  globalCssPath: '@catering-v2s/ui-integration-sample-wallpaper-console/theme/global.css',
})
