import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';

export const dependencyModuleNames = [platformPorts, runtime, uiState] as const;

export const devDependencyModuleNames = [] as const;
