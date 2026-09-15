import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as memberRegistry} from '@catering-v2s/kernel-feature-sample-member-registry';
import {moduleName as staffSession} from '@catering-v2s/kernel-feature-sample-staff-session';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as input} from '@catering-v2s/ui-base-input';
import {moduleName as featureAssembly} from '@catering-v2s/ui-base-feature-assembly';
import {moduleName as testSupport} from '@catering-v2s/ui-base-test-support';

export const dependencyModuleNames = [
  displayContext,
  runtime,
  state,
  uiState,
  memberRegistry,
  staffSession,
  render,
  primitives,
  input,
  featureAssembly,
] as const;
export const devDependencyModuleNames = [testSupport] as const;
export const runtimeModuleDependencyNames = [displayContext, runtime, uiState, memberRegistry, staffSession] as const;
