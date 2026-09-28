import {moduleName as applicationBaseAndroid} from '@catering-v2s/application-base-android';
import {moduleName as uiBaseInput} from '@catering-v2s/ui-base-input';
import {moduleName as uiBasePrimitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as uiBaseRender} from '@catering-v2s/ui-base-render';
import {moduleName as uiIntegrationSampleWallpaperConsole} from '@catering-v2s/ui-integration-sample-wallpaper-console';

export const dependencyModuleNames = [
  applicationBaseAndroid,
  uiBaseInput,
  uiBasePrimitives,
  uiBaseRender,
  uiIntegrationSampleWallpaperConsole,
] as const;

export const devDependencyModuleNames = [] as const;
