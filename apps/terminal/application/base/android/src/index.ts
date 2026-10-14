export {moduleName} from './moduleName';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
export {createAndroidNativeLoadingCapability} from './implementations/nativeLoadingCapability';
export {createAndroidPlatformBinding} from './implementations/androidPlatformBinding';
export {createAndroidAutomationUpdateTargetSourceProvider} from './implementations/androidAutomationUpdateTargetSourceProvider';
export {AndroidTerminalApp} from './components/AndroidTerminalApp';
export type {AndroidPlatformBinding} from './implementations/androidPlatformBinding';
export type {AndroidSurfaceForm, AndroidTerminalAppProps} from './components/AndroidTerminalApp';
export type {
  NativeLoadingCapability,
  NativeLoadingHideResult,
  NativeLoadingTarget,
} from '@catering-v2s/kernel-base-platform-ports';
