import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';

export const dependencyModuleNames = [platformPorts, runtime, state, render, primitives, uiState] as const;

export const devDependencyModuleNames = [] as const;
