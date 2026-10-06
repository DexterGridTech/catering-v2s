import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {runtimeModuleDependencyNames} from '../dependencies';
import {needToActivateTerminalCommand} from '../features/commands/commands';
import {moduleName} from '../moduleName';
import {selectActivationStatusView} from '../selectors/selectActivationStatusView';

/** Registers the public UI intent; the composing integration owns its route actor. */
export const createTerminalActivationModule = (): RuntimeModule =>
  Object.freeze({
    moduleName,
    kind: 'toolkit',
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: [{name: needToActivateTerminalCommand.commandName, visibility: needToActivateTerminalCommand.visibility}],
    commandDefinitions: [needToActivateTerminalCommand],
    selectorDefinitions: [selectActivationStatusView],
    actors: [],
    actorDefinitions: [],
    slices: [],
    stateSlices: [],
  });
