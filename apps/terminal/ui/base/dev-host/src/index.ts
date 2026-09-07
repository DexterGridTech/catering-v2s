export {moduleName} from './moduleName'
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies'
export {createTestExpoApp} from './components/testExpoApp'
export {createWebDevicePort, createWebPlatformPorts} from './implementations/webPlatform'
export {createWebStateStoragePort} from './implementations/webStorage'
export type {
  SurfaceSize,
  TerminalSurfaces,
  TestExpoAppOptions,
  TestExpoAssembly,
  TestExpoRuntimeStatus,
} from './components/testExpoApp'
export type {SurfaceMode, WebPlatformOptions} from './implementations/webPlatform'
export type {WebStoragePortName} from './implementations/webStorage'
