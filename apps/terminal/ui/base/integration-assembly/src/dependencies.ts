import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as transport} from '@catering-v2s/kernel-base-transport';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as adminShell} from '@catering-v2s/ui-base-admin-shell';
import {moduleName as input} from '@catering-v2s/ui-base-input';
import {moduleName as render} from '@catering-v2s/ui-base-render';

export const dependencyModuleNames = [
  contracts,
  displayContext,
  platformPorts,
  runtime,
  state,
  transport,
  uiState,
  adminShell,
  input,
  render,
] as const;
export const devDependencyModuleNames = [] as const;
