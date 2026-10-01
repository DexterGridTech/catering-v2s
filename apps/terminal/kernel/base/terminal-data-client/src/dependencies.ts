import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as transport} from '@catering-v2s/kernel-base-transport';

export const dependencyModuleNames = [contracts, platformPorts, runtime, state, transport] as const;
export const runtimeModuleDependencyNames = [runtime, transport] as const;
export const devDependencyModuleNames = [] as const;
