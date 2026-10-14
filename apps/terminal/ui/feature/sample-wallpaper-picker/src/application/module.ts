import {createUiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {createWallpaperPickerActor} from '../features/actors/wallpaperPickerActor';
import {createWallpaperPickerEntryActor} from '../features/actors/wallpaperPickerEntryActor';
import {
  confirmWallpaperRequestedCommand,
  wallpaperPickerExitRequestedCommand,
  wallpaperSystemFailureDismissedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperOptionSelectedCommand,
  startWallpaperPickerCommand,
} from '../declarations/commands';
import {moduleKind, moduleName} from '../moduleName';
import {parts, layerDismissals} from '../declarations/parts';

const commands = [
  wallpaperOptionSelectedCommand,
  confirmWallpaperRequestedCommand,
  wallpaperPickerExitRequestedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperSystemFailureDismissedCommand,
  startWallpaperPickerCommand,
] as const;

export const createSampleWallpaperPickerModule = () => {
  const allActors = [createWallpaperPickerActor(), createWallpaperPickerEntryActor()] as const;
  return createUiRuntimeModule(
    {
      moduleName,
      kind: moduleKind,
      dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
      commandDefinitions: commands,
      actorDefinitions: allActors,
    },
    {parts, layerDismissals},
  );
};
