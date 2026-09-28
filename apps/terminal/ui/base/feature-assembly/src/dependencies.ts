import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as state} from '@catering-v2s/kernel-base-state';

export const dependencyModuleNames = [contracts, runtime, state] as const;
export const devDependencyModuleNames = [] as const;
