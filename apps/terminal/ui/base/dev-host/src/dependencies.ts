import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as displayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';

export const dependencyModuleNames = [contracts, displayContext, platformPorts] as const;
export const devDependencyModuleNames = [] as const;
