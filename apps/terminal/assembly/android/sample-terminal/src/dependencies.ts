import {moduleName as adapterAndroidAppControl} from '@catering-v2s/adapter-android-app-control';
import {moduleName as adapterAndroidDevice} from '@catering-v2s/adapter-android-device';
import {moduleName as adapterAndroidDualScreen} from '@catering-v2s/adapter-android-dual-screen';
import {moduleName as adapterAndroidLogger} from '@catering-v2s/adapter-android-logger';
import {moduleName as adapterAndroidPersistKv} from '@catering-v2s/adapter-android-persist-kv';
import {moduleName as kernelBasePlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as uiIntegrationSampleConsole} from '@catering-v2s/ui-integration-sample-console';

export const dependencyModuleNames = [
  adapterAndroidAppControl,
  adapterAndroidDevice,
  adapterAndroidDualScreen,
  adapterAndroidLogger,
  adapterAndroidPersistKv,
  kernelBasePlatformPorts,
  uiIntegrationSampleConsole,
] as const;

export const devDependencyModuleNames = [] as const;
