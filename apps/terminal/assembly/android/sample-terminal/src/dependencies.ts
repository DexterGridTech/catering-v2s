import {moduleName as assemblyBaseAndroid} from '@catering-v2s/assembly-base-android';
import {moduleName as uiBaseRender} from '@catering-v2s/ui-base-render';
import {moduleName as uiIntegrationSampleConsole} from '@catering-v2s/ui-integration-sample-console';

export const dependencyModuleNames = [
  assemblyBaseAndroid,
  uiBaseRender,
  uiIntegrationSampleConsole,
] as const;

export const devDependencyModuleNames = [] as const;
