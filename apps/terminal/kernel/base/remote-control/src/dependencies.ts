import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as terminalDataClient} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName as topology} from '@catering-v2s/kernel-base-topology';

export const dependencyModuleNames = [
  contracts,
  displayContext,
  platformPorts,
  runtime,
  state,
  terminalDataClient,
  topology,
] as const;

export const devDependencyModuleNames = [] as const;
export const runtimeModuleDependencyNames = [runtime, terminalDataClient, topology, displayContext] as const;
