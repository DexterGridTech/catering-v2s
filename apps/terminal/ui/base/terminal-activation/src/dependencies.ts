import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as topology} from '@catering-v2s/kernel-base-topology';
import {moduleName as adminShell} from '@catering-v2s/ui-base-admin-shell';
import {moduleName as serverConfig} from '@catering-v2s/kernel-base-server-config';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as terminalClient} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as input} from '@catering-v2s/ui-base-input';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as featureAssembly} from '@catering-v2s/ui-base-feature-assembly';

export const dependencyModuleNames = [
  contracts,
  topology,
  adminShell,
  serverConfig,
  state,
  terminalClient,
  runtime,
  uiState,
  input,
  primitives,
  render,
  featureAssembly,
] as const;
export const devDependencyModuleNames = [] as const;
export const runtimeModuleDependencyNames = [runtime, serverConfig, terminalClient, topology, uiState] as const;
