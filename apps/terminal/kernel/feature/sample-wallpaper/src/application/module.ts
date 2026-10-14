import {createRuntimeModule, type RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {runtimeModuleDependencyNames} from '../dependencies';
import {createWallpaperSelectionActor} from '../features/actors/wallpaperSelectionActor';
import {
  cancelWallpaperSelectionCommand,
  confirmWallpaperCommand,
  selectWallpaperCommand,
} from '../declarations/commands';
import {moduleKind, moduleName} from '../moduleName';
import {selectHostConfirmedWallpaperId} from '../selectors/selectHostConfirmedWallpaperId';
import {selectPendingWallpaperId} from '../selectors/selectPendingWallpaperId';
import {selectWallpaperId} from '../selectors/selectWallpaperId';
import {wallpaperStateRegistration} from '../features/slices/wallpaperSelection';

const commands = [selectWallpaperCommand, confirmWallpaperCommand, cancelWallpaperSelectionCommand] as const;

export const createSampleWallpaperModule = (
  input: Readonly<{canMutate?: (state: StateRoot) => boolean}> = {},
): RuntimeModule => {
  const actors = [createWallpaperSelectionActor(input.canMutate)] as const;
  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    selectorDefinitions: [selectHostConfirmedWallpaperId, selectPendingWallpaperId, selectWallpaperId],
    actorDefinitions: actors,
    stateSlices: [wallpaperStateRegistration],
  });
};
