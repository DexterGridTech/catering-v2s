import type {NodeId, RuntimeInstanceId} from '@catering-v2s/kernel-base-contracts';
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import type {PersistenceOperationResult, StateRoot, StateRuntime} from '@catering-v2s/kernel-base-state';
import type {
  RuntimeModule,
  RuntimeModuleContext,
  RuntimeModuleDispatch,
  RuntimeModuleDescriptor,
  RuntimeModulePreSetupContext,
  RuntimeModuleResetInput,
} from '../types/module';
import type {PeerDispatchGateway} from '../types/peer';
import type {RuntimeUnknownAction} from '../types/runtime';
import type {RuntimeJournal} from '../types/journal';
import {createStateSubscription} from './createStateSubscription';

type DispatchCommand = RuntimeModuleDispatch;

type RuntimeLifecycleInput = Readonly<{
  modules: readonly RuntimeModule[];
  descriptors: readonly RuntimeModuleDescriptor[];
  journal: RuntimeJournal;
  runtimeId: RuntimeInstanceId;
  localNodeId: NodeId;
  platformPorts: PlatformPorts;
  requestMaxResidenceMs: number;
  getStateRuntime: () => StateRuntime | undefined;
  dispatchCommand: DispatchCommand;
  installPeerDispatchGateway: (gateway: PeerDispatchGateway) => void;
  dispatchAction: (action: RuntimeUnknownAction) => RuntimeUnknownAction;
  registerResource: (cleanup: () => void) => () => void;
  registerAsyncResource: (cleanup: () => Promise<void>) => () => void;
  evaluateSelector: (name: string, argsTuple: readonly unknown[]) => unknown;
}>;

const requireStateRuntime = (input: RuntimeLifecycleInput): StateRuntime => {
  const stateRuntime = input.getStateRuntime();
  if (stateRuntime === undefined) {
    throw new Error('State runtime is not available during this lifecycle phase');
  }
  return stateRuntime;
};

const createModuleContext = (input: RuntimeLifecycleInput, module: RuntimeModule): RuntimeModuleContext => {
  const stateRuntime = requireStateRuntime(input);
  return Object.freeze({
    moduleName: module.moduleName,
    runtimeId: input.runtimeId,
    localNodeId: input.localNodeId,
    platformPorts: input.platformPorts,
    descriptors: input.descriptors,
    journal: input.journal,
    requestMaxResidenceMs: input.requestMaxResidenceMs,
    getState: (): StateRoot => stateRuntime.getState(),
    flushPersistence: (): Promise<PersistenceOperationResult> => stateRuntime.flushPersistence(),
    subscribeState: (listener: () => void): (() => void) =>
      createStateSubscription(stateRuntime.getStore(), listener, input.registerResource),
    registerResource: input.registerResource,
    registerAsyncResource: input.registerAsyncResource,
    createFullSyncPayload: (sliceName: string) => stateRuntime.createFullSyncPayload(sliceName),
    applyAuthoritativeSync: (sliceName: string, payload: import('@catering-v2s/kernel-base-state').SyncStateDiff) =>
      stateRuntime.applyAuthoritativeSync(sliceName, payload),
    dispatchCommand: input.dispatchCommand,
    evaluateSelector: input.evaluateSelector,
    installPeerDispatchGateway: input.installPeerDispatchGateway,
  });
};

export const createRuntimeLifecycle = (input: RuntimeLifecycleInput) => {
  const runPreSetup = async (): Promise<void> => {
    for (const module of input.modules) {
      const context: RuntimeModulePreSetupContext = Object.freeze({
        moduleName: module.moduleName,
        localNodeId: input.localNodeId,
        platformPorts: input.platformPorts,
        descriptors: input.descriptors,
        journal: input.journal,
      });
      await module.preSetup?.(context);
    }
  };

  const runInstall = async (): Promise<void> => {
    for (const module of input.modules) {
      await module.install?.(createModuleContext(input, module));
    }
  };

  const runResetHooks = async (resetInput: RuntimeModuleResetInput): Promise<void> => {
    for (const module of input.modules) {
      await module.onApplicationReset?.(createModuleContext(input, module), resetInput);
    }
  };

  return Object.freeze({
    runPreSetup,
    runInstall,
    runResetHooks,
  });
};
