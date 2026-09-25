import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as staffSession} from '@catering-v2s/kernel-feature-sample-staff-session';
import {moduleName as input} from '@catering-v2s/ui-base-input';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as featureAssembly} from '@catering-v2s/ui-base-feature-assembly';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';

export const dependencyModuleNames = [
  runtime,
  state,
  uiState,
  staffSession,
  input,
  render,
  primitives,
  featureAssembly,
] as const;
export const devDependencyModuleNames = [platformPorts] as const;
export const runtimeModuleDependencyNames = [runtime, uiState, staffSession] as const;
