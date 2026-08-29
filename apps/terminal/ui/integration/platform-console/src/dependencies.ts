import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as automation} from '@catering-v2s/ui-base-automation';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as input} from '@catering-v2s/ui-base-input';
import {moduleName as adminShell} from '@catering-v2s/ui-base-admin-shell';
import {moduleName as testSupport} from '@catering-v2s/ui-base-test-support';

export const dependencyModuleNames = [
  contracts,
  platformPorts,
  state,
  runtime,
  displayContext,
  uiState,
  render,
  automation,
  primitives,
  input,
  adminShell,
] as const;

export const devDependencyModuleNames = [testSupport] as const;
