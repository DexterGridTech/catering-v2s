export {moduleName} from './moduleName';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
export {createAndroidNativeLoadingCapability} from './foundations/nativeLoadingCapability';
export {
  createAndroidAppControlPort,
  createAndroidTopologyHostPort,
  createAndroidTopologyPeerChannel,
} from './foundations/nativeTopology';
export {createAndroidPlatformBinding} from './foundations/androidPlatform';
export {createAndroidTransportNetworkAdapter} from './foundations/androidTransportNetworkAdapter';
export {createAndroidAutomationUpdateTargetSourceProvider} from './foundations/androidAutomationUpdateTargetSourceProvider';
export {AndroidTerminalApp} from './components/AndroidTerminalApp';
export type {AndroidPlatformBinding} from './foundations/androidPlatform';
export type {AndroidSurfaceForm, AndroidTerminalAppProps} from './components/AndroidTerminalApp';
export type {
  NativeLoadingCapability,
  NativeLoadingHideResult,
  NativeLoadingTarget,
} from '@catering-v2s/kernel-base-platform-ports';
