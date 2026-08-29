import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as state} from '@catering-v2s/kernel-base-state';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';

export const dependencyModuleNames = [contracts, state, runtime] as const;

export const devDependencyModuleNames = [] as const;
