import {
  createFeatureAssemblyModule,
  type CreateFeatureAssemblyModuleInput,
} from '@catering-v2s/ui-base-feature-assembly';
import {runtimeModuleDependencyNames} from '../dependencies';
import {createWallpaperPickerActor, createWallpaperPickerEntryActor} from '../features/actors/actors';
import {
  confirmWallpaperRequestedCommand,
  wallpaperPickerExitRequestedCommand,
  wallpaperSystemFailureDismissedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperOptionSelectedCommand,
  startWallpaperPickerCommand,
} from '../features/commands/commands';
import {moduleKind, moduleName} from '../moduleName';

const commands = [
  wallpaperOptionSelectedCommand,
  confirmWallpaperRequestedCommand,
  wallpaperPickerExitRequestedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperSystemFailureDismissedCommand,
  startWallpaperPickerCommand,
] as const;

export const createSampleWallpaperPickerModuleInput = (): CreateFeatureAssemblyModuleInput => {
  const allActors = [createWallpaperPickerActor(), createWallpaperPickerEntryActor()] as const;
  return {
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    actorDefinitions: allActors,
  };
};

export const createSampleWallpaperPickerModule = () =>
  createFeatureAssemblyModule(createSampleWallpaperPickerModuleInput());
