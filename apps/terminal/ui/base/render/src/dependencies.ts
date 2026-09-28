import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';

export const dependencyModuleNames = [
  contracts,
  platformPorts,
  runtime,
  state,
  displayContext,
  uiState,
  primitives,
] as const;

export const devDependencyModuleNames = [] as const;
