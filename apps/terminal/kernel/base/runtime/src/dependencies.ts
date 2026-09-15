import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as state} from '@catering-v2s/kernel-base-state';

export const dependencyModuleNames = [contracts, platformPorts, state] as const;

export const devDependencyModuleNames = [] as const;

export const runtimeModuleDependencyNames = [] as const;
