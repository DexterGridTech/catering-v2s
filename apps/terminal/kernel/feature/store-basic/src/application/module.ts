import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createStoreBasicActors} from '../features/actors/actors';
import {
  initializeStoreBasicCommand,
  initializeStoreServicePointsCommand,
  refreshStoreBasicTopicCommand,
  storeBasicInformationLoadedCommand,
} from '../features/commands/commands';
import {storeBasicStateRegistration} from '../features/slices/slice';

const commands = [
  initializeStoreBasicCommand,
  storeBasicInformationLoadedCommand,
  initializeStoreServicePointsCommand,
  refreshStoreBasicTopicCommand,
] as const;

const safeErrorCode = (error: unknown): string => {
  if (error instanceof Error) return error.name;
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return typeof error;
};

export const createStoreBasicModule = (): RuntimeModule => {
  const actors = createStoreBasicActors();
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [{name: storeBasicStateRegistration.name, persistIntent: storeBasicStateRegistration.persistIntent}],
    stateSlices: [storeBasicStateRegistration],
    install: (context: RuntimeModuleContext) => {
      void context
        .dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {requestId: createRequestId()})
        .then(result => {
          if (result.status !== 'completed') {
            context.platformPorts.logger
              .scope({moduleName, layer: 'kernel', subsystem: 'store-basic', component: 'startup'})
              .error({
                category: 'terminal.store-basic.initialization',
                event: 'startup-command-failed',
                message: 'Store basic initialization command did not complete',
                data: {dispatchStatus: result.status},
              });
          }
        })
        .catch((error: unknown) => {
          context.platformPorts.logger
            .scope({moduleName, layer: 'kernel', subsystem: 'store-basic', component: 'startup'})
            .error({
              category: 'terminal.store-basic.initialization',
              event: 'startup-command-threw',
              message: 'Store basic initialization command failed before returning',
              data: {errorCode: safeErrorCode(error)},
            });
        });
    },
  });
};
