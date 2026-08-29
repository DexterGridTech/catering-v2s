import {moduleName as render} from '@catering-v2s/ui-base-render';
import {moduleName as automation} from '@catering-v2s/ui-base-automation';
import {moduleName as kernelTestSupport} from '@catering-v2s/kernel-base-test-support';

export const dependencyModuleNames = [] as const;

export const devDependencyModuleNames = [render, automation, kernelTestSupport] as const;
