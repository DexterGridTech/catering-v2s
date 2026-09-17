import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName as adapterAndroidDevice} from '@catering-v2s/adapter-android-device'
import {moduleName as adapterAndroidDualScreen} from '@catering-v2s/adapter-android-dual-screen'
import {moduleName as adapterAndroidPersistKv} from '@catering-v2s/adapter-android-persist-kv'
import {moduleName as transport} from '@catering-v2s/kernel-base-transport'

export const dependencyModuleNames = [
  platformPorts,
  adapterAndroidDevice,
  adapterAndroidDualScreen,
  adapterAndroidPersistKv,
  transport,
] as const
export const devDependencyModuleNames = [] as const
