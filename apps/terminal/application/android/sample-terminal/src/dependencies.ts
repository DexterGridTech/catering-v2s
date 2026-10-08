import {moduleName as applicationBaseAndroid} from '@catering-v2s/application-base-android';
import {moduleName as uiBaseInput} from '@catering-v2s/ui-base-input';
import {moduleName as uiBasePrimitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as uiBaseRender} from '@catering-v2s/ui-base-render';
import {moduleName as uiIntegrationSampleConsole} from '@catering-v2s/ui-integration-sample-console';
import {moduleName as terminalUpdate} from '@catering-v2s/kernel-base-terminal-update';

export const dependencyModuleNames = [
  applicationBaseAndroid,
  uiBaseInput,
  uiBasePrimitives,
  uiBaseRender,
  uiIntegrationSampleConsole,
  terminalUpdate,
] as const;

export const devDependencyModuleNames = [] as const;
