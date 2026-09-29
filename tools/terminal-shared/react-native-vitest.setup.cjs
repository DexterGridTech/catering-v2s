const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const {transformSync} = require('@babel/core')

global.IS_REACT_ACT_ENVIRONMENT = true
global.RN$registerCallableModule = () => undefined
global.ErrorUtils = {
  setGlobalHandler: () => undefined,
  getGlobalHandler: () => () => undefined,
}
global.RN$Bridgeless = true
global.__fbBatchedBridgeConfig = {remoteModuleConfig: []}
const displayMetrics = {width: 320, height: 640, scale: 1, fontScale: 1}
global.__turboModuleProxy = () => new Proxy({
  getConstants: () => ({Dimensions: {window: displayMetrics, screen: displayMetrics}}),
}, {
  get(target, property) {
    return target[property] ?? (() => undefined)
  },
})
global.nativeFabricUIManager = new Proxy({}, {get: () => () => undefined})

const packageRequire = Module.createRequire(path.join(process.cwd(), 'package.json'))
const reactNativeRoot = path.dirname(packageRequire.resolve('react-native/package.json'))
const androidPlatform = path.join(reactNativeRoot, 'Libraries/Utilities/Platform.android.js')
const originalRuntimeGlobals = {
  clearImmediate: global.clearImmediate,
  queueMicrotask: global.queueMicrotask,
  setImmediate: global.setImmediate,
}
global.__restoreReactNativeTestGlobals = () => {
  global.clearImmediate = originalRuntimeGlobals.clearImmediate
  global.queueMicrotask = originalRuntimeGlobals.queueMicrotask
  global.setImmediate = originalRuntimeGlobals.setImmediate
}

const originalJsLoader = Module._extensions['.js']
const originalResolveFilename = Module._resolveFilename
const expoPreset = packageRequire.resolve('babel-preset-expo')

Module._resolveFilename = (request, parent, ...rest) => {
  if (
    parent?.filename === path.join(reactNativeRoot, 'Libraries/Utilities/Platform.js') &&
    request === './Platform'
  ) {
    return androidPlatform
  }
  return originalResolveFilename.call(Module, request, parent, ...rest)
}

Module._extensions['.js'] = (module, filename) => {
  if (!filename.includes(`${path.sep}react-native${path.sep}`)) {
    return originalJsLoader(module, filename)
  }

  const source = fs.readFileSync(filename, 'utf8')
  const transformed = transformSync(source, {
    filename,
    presets: [[expoPreset, {
      disableImportExportTransform: false,
      enableBabelRuntime: false,
    }]],
    sourceMaps: false,
  })
  module._compile(transformed?.code ?? source, filename)
}
