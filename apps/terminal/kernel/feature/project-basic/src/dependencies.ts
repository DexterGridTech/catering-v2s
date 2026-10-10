import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as terminalUpdate} from '@catering-v2s/kernel-base-terminal-update';
import {moduleName as terminalDataClient} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName as topology} from '@catering-v2s/kernel-base-topology';
import {moduleName as serverConfig} from '@catering-v2s/kernel-base-server-config';
import {moduleName as storeBasic} from '@catering-v2s/kernel-feature-store-basic';

export const dependencyModuleNames = [contracts, runtime, state, terminalDataClient, terminalUpdate, topology, serverConfig, storeBasic] as const;
export const devDependencyModuleNames = [] as const;
export const runtimeModuleDependencyNames = [runtime, terminalDataClient, storeBasic, terminalUpdate, topology, serverConfig] as const;
