import {moduleName as dualScreen} from '@catering-v2s/adapter-android-dual-screen';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';

export const dependencyModuleNames = [dualScreen, platformPorts] as const;

export const devDependencyModuleNames = [] as const;
