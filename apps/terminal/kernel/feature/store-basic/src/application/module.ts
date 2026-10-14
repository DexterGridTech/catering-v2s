import {createRuntimeModule, type RuntimeModule, type RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {selectActiveContracts} from '../selectors/selectActiveContracts';
import {selectServicePointAreas} from '../selectors/selectServicePointAreas';
import {selectServicePoints} from '../selectors/selectServicePoints';
import {selectStore} from '../selectors/selectStore';
import {selectStoreBasicBinding} from '../selectors/selectStoreBasicBinding';
import {selectStoreBasicLoadReadiness} from '../selectors/selectStoreBasicLoadReadiness';
import {selectStoreBasicState} from '../selectors/selectStoreBasicState';
import {selectStoreBasicTopicState} from '../selectors/selectStoreBasicTopicState';
import {selectStoreOperatingRules} from '../selectors/selectStoreOperatingRules';
import {createStoreBasicActor} from '../features/actors/storeBasicActor';
import {
  initializeStoreBasicCommand,
  initializeStoreServicePointsCommand,
  refreshStoreBasicTopicCommand,
  storeBasicInformationLoadedCommand,
} from '../declarations/commands';
import {storeBasicStateRegistration} from '../features/slices/storeBasicState';

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
  const actors = createStoreBasicActor();
  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    selectorDefinitions: [
      selectActiveContracts,
      selectServicePointAreas,
      selectServicePoints,
      selectStore,
      selectStoreBasicBinding,
      selectStoreBasicState,
      selectStoreBasicLoadReadiness,
      selectStoreBasicTopicState,
      selectStoreOperatingRules,
    ],
    actorDefinitions: actors,
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
    onApplicationReset: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {
        requestId: createRequestId(),
      });
      if (result.status !== 'completed') {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'store-basic', component: 'reset'})
          .error({
            category: 'terminal.store-basic.initialization',
            event: 'reset-command-failed',
            message: 'Store basic initialization after Runtime reset did not complete',
            data: {dispatchStatus: result.status},
          });
        throw new Error(`Store basic initialization after Runtime reset failed: ${result.status}`);
      }
    },
  });
};
