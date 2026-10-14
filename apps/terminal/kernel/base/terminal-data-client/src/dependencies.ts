import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as serverConfig} from '@catering-v2s/kernel-base-server-config';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as transport} from '@catering-v2s/kernel-base-transport';
import {moduleName as topology} from '@catering-v2s/kernel-base-topology';

export const dependencyModuleNames = [contracts, platformPorts, runtime, serverConfig, state, transport, topology] as const;
export const runtimeModuleDependencyNames = [runtime, serverConfig, transport, topology] as const;
export const devDependencyModuleNames = [] as const;
