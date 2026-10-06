import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives';

export const dependencyModuleNames = [contracts, runtime, primitives] as const;
export const devDependencyModuleNames = [] as const;
