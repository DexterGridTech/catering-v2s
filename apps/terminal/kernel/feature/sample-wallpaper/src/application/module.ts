import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {runtimeModuleDependencyNames} from '../dependencies';
import {createSelectionActor} from '../features/actors/actors';
import {cancelWallpaperSelectionCommand, confirmWallpaperCommand, selectWallpaperCommand} from '../features/commands/commands';
import {wallpaperErrorDefinitions} from '../foundations/errors';
import {moduleKind, moduleName} from '../moduleName';
import {wallpaperStateRegistration} from '../features/slices/slice';

const commands = [selectWallpaperCommand, confirmWallpaperCommand, cancelWallpaperSelectionCommand] as const;

export const createSampleWallpaperModule = (): RuntimeModule => {
  const actors = [createSelectionActor()] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    errorDefinitions: wallpaperErrorDefinitions,
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [{name: wallpaperStateRegistration.name, persistIntent: wallpaperStateRegistration.persistIntent}],
    stateSlices: [wallpaperStateRegistration],
  });
};
