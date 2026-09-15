import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';

export const dependencyModuleNames = [contracts, platformPorts, state, runtime, displayContext] as const;

export const devDependencyModuleNames = [] as const;

export const runtimeModuleDependencyNames = [runtime, displayContext] as const;
