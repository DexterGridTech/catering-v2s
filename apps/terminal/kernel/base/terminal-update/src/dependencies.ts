import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as terminalDataClient} from '@catering-v2s/kernel-base-terminal-data-client';

export const dependencyModuleNames = [contracts, platformPorts, runtime, state, terminalDataClient] as const;
export const devDependencyModuleNames = [] as const;
export const runtimeModuleDependencyNames = [runtime, terminalDataClient] as const;
