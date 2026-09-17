import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as topology} from '@catering-v2s/kernel-base-topology';
import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as input} from '@catering-v2s/ui-base-input';

export const dependencyModuleNames = [contracts, platformPorts, runtime, state, displayContext, topology, render, primitives, input, uiState] as const;

export const devDependencyModuleNames = [] as const;
