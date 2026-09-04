import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as memberRegistry} from '@catering-v2s/kernel-feature-sample-member-registry';
import {moduleName as staffSession} from '@catering-v2s/kernel-feature-sample-staff-session';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';

export const dependencyModuleNames = [
  displayContext,
  runtime,
  state,
  uiState,
  memberRegistry,
  staffSession,
  render,
  primitives,
] as const;
export const devDependencyModuleNames = [] as const;
