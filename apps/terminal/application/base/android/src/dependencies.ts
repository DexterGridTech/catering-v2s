import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as adapterAndroidDevice} from '@catering-v2s/adapter-android-device';
import {moduleName as adapterAndroidDualScreen} from '@catering-v2s/adapter-android-dual-screen';
import {moduleName as adapterAndroidPersistKv} from '@catering-v2s/adapter-android-persist-kv';
import {moduleName as adapterAndroidRemote} from '@catering-v2s/adapter-android-remote';
import {moduleName as adapterAndroidTopology} from '@catering-v2s/adapter-android-topology';
import {moduleName as adapterAndroidTransport} from '@catering-v2s/adapter-android-transport';
import {moduleName as adapterAndroidUpdate} from '@catering-v2s/adapter-android-update';
import {moduleName as terminalUpdate} from '@catering-v2s/kernel-base-terminal-update';
import {moduleName as transport} from '@catering-v2s/kernel-base-transport';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';

export const dependencyModuleNames = [
  platformPorts,
  adapterAndroidDevice,
  adapterAndroidDualScreen,
  adapterAndroidPersistKv,
  adapterAndroidRemote,
  adapterAndroidTopology,
  adapterAndroidTransport,
  adapterAndroidUpdate,
  terminalUpdate,
  transport,
] as const;
export const devDependencyModuleNames = [primitives] as const;
