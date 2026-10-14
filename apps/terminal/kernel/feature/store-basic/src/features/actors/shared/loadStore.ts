import type {RequestId} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {storeBasicInformationLoadedCommand} from '../../../declarations/commands';
import {selectStoreBasicState} from '../../../selectors/selectStoreBasicState';
import type {StoreBasicBinding, StoreBasicState} from '../../../types/types';
import type {
  TerminalActivationSucceededPayload,
  TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import type {
  TerminalOperationResult,
  TerminalRequestMap,
  TerminalStoreBasicRead,
} from '../../../generated/terminalApi';

type LoadStoreResult = Promise<StateJsonValue>;
type StoreBasicReadRequest = Readonly<{
  readonly operationId: 'terminalReadStoreBasic';
  readonly pathParameters: TerminalRequestMap['terminalReadStoreBasic']['pathParameters'];
}>;

export type LoadStoreDependencies = Readonly<{
  readonly activeInitialLoads: Set<string>;
  readonly completedStoreLoads: Set<string>;
  readonly completedContractLoads: Set<string>;
  readonly completedServicePointLoads: Set<string>;
  readonly currentBinding: (context: ActorExecutionContext) => StoreBasicBinding | null;
  readonly sameBinding: (left: StoreBasicBinding | null, right: StoreBasicBinding | null) => boolean;
  readonly bindingKey: (binding: StoreBasicBinding) => string;
  readonly withBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => Promise<boolean>;
  readonly checkCurrentMasterBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
  readonly checkCurrentBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
  readonly updateLoadReadiness: (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    patch: Partial<StoreBasicState['loadReadiness']>,
  ) => void;
  readonly currentTopicStatus: (context: ActorExecutionContext, topicKey: TerminalTopicKey, errorCode: string) => void;
  readonly readOperation: (
    context: ActorExecutionContext,
    request: StoreBasicReadRequest,
  ) => Promise<TerminalOperationResult<'terminalReadStoreBasic'>>;
  readonly setLoaded: (context: ActorExecutionContext, topicKey: TerminalTopicKey) => void;
  readonly setStoreLoading: (context: ActorExecutionContext) => void;
  readonly applyStoreRead: (context: ActorExecutionContext, value: TerminalStoreBasicRead) => void;
  readonly flush: (context: ActorExecutionContext) => Promise<void>;
  readonly subscribe: (input: Readonly<{
    readonly context: ActorExecutionContext;
    readonly binding: StoreBasicBinding;
    readonly isLatest: () => boolean;
    readonly topicKey: TerminalTopicKey;
    readonly ownerRef: string;
    readonly initialTimeEpochMillis: number;
  }>) => Promise<boolean>;
  readonly logRead: (context: ActorExecutionContext, operationId: string, result: string) => void;
  readonly childRequestId: (context: ActorExecutionContext) => RequestId;
}>;

export const createLoadStore = (dependencies: LoadStoreDependencies) => {
  const {
    activeInitialLoads,
    completedStoreLoads,
    completedContractLoads,
    completedServicePointLoads,
    currentBinding,
    sameBinding,
    bindingKey,
    withBinding,
    checkCurrentMasterBinding,
    checkCurrentBinding,
    updateLoadReadiness,
    currentTopicStatus,
    readOperation,
    setLoaded,
    setStoreLoading,
    applyStoreRead,
    flush,
    subscribe,
    logRead,
    childRequestId,
  } = dependencies;

  return async (
    context: ActorExecutionContext,
    requestedBinding?: TerminalActivationSucceededPayload,
  ): LoadStoreResult => {
    const binding = currentBinding(context);
    if (binding === null || (requestedBinding !== undefined && !sameBinding(binding, requestedBinding)))
      return {status: 'inactive-or-stale'};
    if (!(await withBinding(context, binding))) return {status: 'stale-binding'};
    const key = bindingKey(binding);
    if (activeInitialLoads.has(key)) return {status: 'already-loading'};
    if (completedStoreLoads.has(key)) {
      const readiness = selectStoreBasicState(context.getState()).loadReadiness;
      const storeReady =
        readiness.runtimeId === context.runtimeId &&
        sameBinding(readiness.binding, binding) &&
        readiness.storeStatus === 'flushed';
      if (!storeReady) {
        completedStoreLoads.delete(key);
        completedContractLoads.delete(key);
        completedServicePointLoads.delete(key);
      } else {
        await context.dispatchCommand(
          storeBasicInformationLoadedCommand,
          {
            terminalRef: binding.terminalRef,
            storeRef: binding.storeRef,
            groupWorkspaceKey: binding.groupWorkspaceKey,
            bindingGeneration: binding.bindingGeneration,
          },
          {requestId: childRequestId(context)},
        );
        return {status: 'already-loaded'};
      }
    }
    if (activeInitialLoads.has(key)) return {status: 'already-loading'};
    activeInitialLoads.add(key);
    updateLoadReadiness(context, binding, {storeStatus: 'loading'});
    setStoreLoading(context);
    try {
      const result = await readOperation(context, {
        operationId: 'terminalReadStoreBasic',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      if (result?.kind !== 'success') {
        updateLoadReadiness(context, binding, {storeStatus: 'failed'});
        currentTopicStatus(
          context,
          'STORE',
          result?.kind === 'business-rejection'
            ? result.errorCode
            : result?.kind === 'failure'
              ? result.code
              : 'STORE_READ_FAILED',
        );
        logRead(context, 'terminalReadStoreBasic', 'failed');
        return {status: 'store-read-failed'};
      }
      if (!checkCurrentBinding(context, binding)) return {status: 'stale-binding'};
      const body = result.body as TerminalStoreBasicRead;
      applyStoreRead(context, body);
      setLoaded(context, 'STORE');
      setLoaded(context, 'STORE_OPERATING_RULE');
      try {
        await flush(context);
      } catch (error) {
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        updateLoadReadiness(context, binding, {storeStatus: 'failed'});
        currentTopicStatus(context, 'STORE', error instanceof Error ? error.message : 'STORE_PERSISTENCE_FAILED');
        return {status: 'store-persistence-failed'};
      }
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      updateLoadReadiness(context, binding, {storeStatus: 'flushed'});
      await subscribe({
        context,
        binding,
        isLatest: () => checkCurrentMasterBinding(context, binding),
        topicKey: 'STORE',
        ownerRef: binding.storeRef,
        initialTimeEpochMillis: body.storeUpdatedAtEpochMillis,
      });
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      await subscribe({
        context,
        binding,
        isLatest: () => checkCurrentMasterBinding(context, binding),
        topicKey: 'STORE_OPERATING_RULE',
        ownerRef: binding.storeRef,
        initialTimeEpochMillis: body.operatingRulesUpdatedAtEpochMillis,
      });
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      completedStoreLoads.add(key);
      logRead(context, 'terminalReadStoreBasic', 'loaded');
      await context.dispatchCommand(
        storeBasicInformationLoadedCommand,
        {
          terminalRef: binding.terminalRef,
          storeRef: binding.storeRef,
          groupWorkspaceKey: binding.groupWorkspaceKey,
          bindingGeneration: binding.bindingGeneration,
        },
        {requestId: childRequestId(context)},
      );
      return {status: 'store-loaded'};
    } finally {
      activeInitialLoads.delete(key);
    }
  };
};
