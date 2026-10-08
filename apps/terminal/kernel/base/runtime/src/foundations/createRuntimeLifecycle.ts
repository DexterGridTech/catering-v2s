import type {NodeId, RuntimeInstanceId} from '@catering-v2s/kernel-base-contracts';
import type {LoggerPort, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
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
  logger: LoggerPort;
  requestMaxResidenceMs: number;
  getStateRuntime: () => StateRuntime | undefined;
  dispatchCommand: DispatchCommand;
  installPeerDispatchGateway: (gateway: PeerDispatchGateway) => void;
  dispatchAction: (action: RuntimeUnknownAction) => RuntimeUnknownAction;
  registerResource: (cleanup: () => void) => () => void;
  registerAsyncResource: (cleanup: () => Promise<void>) => () => void;
  evaluateSelector: (name: string, argsTuple: readonly unknown[]) => unknown;
}>;

const safeFailureToken = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/u.test(value) ? value : undefined;

const failureFacts = (error: unknown): Readonly<{causeName?: string; causeCode?: string}> => {
  if (error === null || typeof error !== 'object') return Object.freeze({});
  const value = error as Readonly<{name?: unknown; code?: unknown}>;
  const causeName = safeFailureToken(value.name);
  const causeCode = safeFailureToken(value.code);
  return Object.freeze({...(causeName ? {causeName} : {}), ...(causeCode ? {causeCode} : {})});
};

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
  const runModuleHook = async (
    moduleName: string,
    phase: 'pre-setup' | 'install' | 'reset',
    hook: () => void | Promise<void>,
  ): Promise<void> => {
    try {
      await hook();
    } catch (error) {
      input.logger.error({
        category: 'runtime.lifecycle',
        event: 'runtime.module.hook.failed',
        message: 'Runtime module lifecycle hook failed',
        data: {moduleName, phase, ...failureFacts(error)},
        error: {
          name: 'RuntimeModuleHookFailed',
          code: `ERR_TER_RUNTIME_MODULE_${phase.toUpperCase().replaceAll('-', '_')}_FAILED`,
          message: 'Runtime module lifecycle hook failed',
        },
      });
      throw error;
    }
  };

  const runPreSetup = async (): Promise<void> => {
    for (const module of input.modules) {
      const context: RuntimeModulePreSetupContext = Object.freeze({
        moduleName: module.moduleName,
        localNodeId: input.localNodeId,
        platformPorts: input.platformPorts,
        descriptors: input.descriptors,
        journal: input.journal,
      });
      if (module.preSetup) {
        await runModuleHook(module.moduleName, 'pre-setup', () => module.preSetup!(context));
      }
    }
  };

  const runInstall = async (): Promise<void> => {
    for (const module of input.modules) {
      if (module.install) {
        const context = createModuleContext(input, module);
        await runModuleHook(module.moduleName, 'install', () => module.install!(context));
      }
    }
  };

  const runResetHooks = async (resetInput: RuntimeModuleResetInput): Promise<void> => {
    for (const module of input.modules) {
      if (module.onApplicationReset) {
        const context = createModuleContext(input, module);
        await runModuleHook(module.moduleName, 'reset', () => module.onApplicationReset!(context, resetInput));
      }
    }
  };

  return Object.freeze({
    runPreSetup,
    runInstall,
    runResetHooks,
  });
};
