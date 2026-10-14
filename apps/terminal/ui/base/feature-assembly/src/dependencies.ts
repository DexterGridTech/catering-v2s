import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as render} from '@catering-v2s/ui-base-render';

export const dependencyModuleNames = [contracts, runtime, state, uiState, render] as const;
export const devDependencyModuleNames = [] as const;
