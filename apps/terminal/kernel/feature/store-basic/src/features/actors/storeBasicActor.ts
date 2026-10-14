import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {ActorDefinition, ActorExecutionContext, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  acceptTerminalTopicNotificationCommand,
  subscribeTerminalTopicCommand,
  terminalActivationSucceededCommand,
  terminalTopicChangedCommand,
  unsubscribeTerminalTopicCommand,
  selectActivationState,
  type TerminalActivationSucceededPayload,
  type TerminalTopicChangedPayload,
  type TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  type TerminalOperationId,
  type TerminalOperationResult,
  type TerminalRequestMap,
  type TerminalContractRead,
  type TerminalServicePointAreaRead,
  type TerminalServicePointRead,
  type TerminalStoreActiveContractsRead,
  type TerminalStoreBasicRead,
  type TerminalStoreServicePointAreasRead,
  type TerminalStoreServicePointsRead,
} from '../../generated/terminalApi';
import {createLoadStore} from './shared/loadStore';
import {createOwnerHttpClient} from './shared/createOwnerHttpClient';
import {refreshStoreAreas, refreshStoreContracts, refreshStoreServicePoints} from './shared/refreshStoreCollections';
import {applyAreaDetail, applyContractDetail, applyServicePointDetail} from './shared/refreshStoreDetails';
import {moduleName} from '../../moduleName';
import {selectStoreBasicState} from '../../selectors/selectStoreBasicState';
import {storeBasicActions} from '../slices/storeBasicState';
import type {StoreBasicBinding, StoreBasicState} from '../../types/types';
import {
  initializeStoreBasicCommand,
  initializeStoreServicePointsCommand,
  refreshStoreBasicTopicCommand,
  storeBasicInformationLoadedCommand,
} from '../../declarations/commands';

const bindingKey = (binding: StoreBasicBinding): string =>
  `${binding.terminalRef}:${binding.bindingGeneration}:${binding.storeRef}`;
const sameBinding = (left: StoreBasicBinding | null, right: StoreBasicBinding): boolean =>
  right !== null &&
  left !== null &&
  left.terminalRef === right.terminalRef &&
  left.storeRef === right.storeRef &&
  left.groupWorkspaceKey === right.groupWorkspaceKey &&
  left.bindingGeneration === right.bindingGeneration;
const currentBinding = (context: ActorExecutionContext): StoreBasicBinding | null => {
  const activation = selectActivationState(context.getState());
  if (
    activation.status !== 'active' ||
    activation.terminalRef === null ||
    activation.storeRef === null ||
    activation.groupWorkspaceKey === null ||
    activation.bindingGeneration === null
  )
    return null;
  return Object.freeze({
    terminalRef: activation.terminalRef,
    storeRef: activation.storeRef,
    groupWorkspaceKey: activation.groupWorkspaceKey,
    bindingGeneration: activation.bindingGeneration,
  });
};
const childResult = (result: CommandDispatchResult): StateJsonValue | null =>
  result.actorResults.length === 1 && result.actorResults[0]?.status === 'completed'
    ? result.actorResults[0].result
    : null;
const childRequestId = (context: ActorExecutionContext) => context.command.requestId ?? createRequestId();
const childOutcomeStatus = (result: CommandDispatchResult): string | null => {
  const value = childResult(result);
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'status' in value
    ? String(value.status)
    : null;
};
const childOutcomeReason = (result: CommandDispatchResult): string | null => {
  const value = childResult(result);
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !('reason' in value)) return null;
  const reason = value.reason;
  return typeof reason === 'string' && /^[A-Z][A-Z0-9_:-]{1,95}$/u.test(reason) ? reason : 'UNCLASSIFIED';
};
const currentTopicStatus = (context: ActorExecutionContext, topicKey: TerminalTopicKey, errorCode: string): void => {
  context.dispatchAction(storeBasicActions.setFailure({topicKey, errorCode}));
};
const setLoaded = (context: ActorExecutionContext, topicKey: TerminalTopicKey): void => {
  context.dispatchAction(storeBasicActions.setReadState({topicKey, status: 'loaded'}));
};
const setStoreLoading = (context: ActorExecutionContext): void => {
  context.dispatchAction(storeBasicActions.setReadState({topicKey: 'STORE', status: 'loading'}));
};
const applyStoreRead = (context: ActorExecutionContext, body: TerminalStoreBasicRead): void => {
  context.dispatchAction(
    storeBasicActions.setStore({value: body.store, updatedAtEpochMillis: body.storeUpdatedAtEpochMillis}),
  );
  context.dispatchAction(
    storeBasicActions.setOperatingRules({
      value: body.operatingRules,
      updatedAtEpochMillis: body.operatingRulesUpdatedAtEpochMillis,
    }),
  );
};
const flush = async (context: ActorExecutionContext): Promise<void> => {
  const result = await context.flushPersistence();
  if (result.status !== 'succeeded') throw new Error(`STORE_BASIC_PERSISTENCE_${result.status.toUpperCase()}`);
};
const logRead = (context: ActorExecutionContext, operationId: string, result: string): void => {
  context.platformPorts.logger
    .scope({moduleName, layer: 'kernel', subsystem: 'store-basic', component: 'data-read'})
    .info({
      category: 'terminal.store-basic.read',
      event: 'read-result',
      message: 'Store basic generated read completed',
      context: {commandId: context.command.commandId},
      data: {operationId, result},
    });
};
type OwnerReadOperationId = Extract<TerminalOperationId, `terminalRead${string}`>;
type OwnerReadPayload = {
  readonly [OperationId in OwnerReadOperationId]: Readonly<{
    readonly operationId: OperationId;
    readonly pathParameters: TerminalRequestMap[OperationId]['pathParameters'];
    readonly queryParameters?: TerminalRequestMap[OperationId]['queryParameters'];
  }>;
}[OwnerReadOperationId];
const readOperation = async (context: ActorExecutionContext, request: OwnerReadPayload) => {
  const api = createOwnerHttpClient(context, childRequestId(context));
  const operation = api[request.operationId] as (
    input: TerminalRequestMap[typeof request.operationId],
  ) => Promise<TerminalOperationResult<typeof request.operationId>>;
  return operation({
    pathParameters: request.pathParameters,
    queryParameters: request.queryParameters ?? {},
    headers: {},
  } as TerminalRequestMap[typeof request.operationId]);
};
const subscribe = async (
  input: Readonly<{
    context: ActorExecutionContext;
    binding: StoreBasicBinding;
    isLatest: () => boolean;
    topicKey: TerminalTopicKey;
    ownerRef: string;
    initialTimeEpochMillis: number;
  }>,
): Promise<boolean> => {
  const {context, binding, isLatest, topicKey, ownerRef, initialTimeEpochMillis} = input;
  if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
  const result = await context.dispatchCommand(
    subscribeTerminalTopicCommand,
    {
      subscriberKey: moduleName,
      topicKey,
      ownerRef,
      initialTimeEpochMillis,
    },
    {requestId: childRequestId(context)},
  );
  const succeeded =
    result.status === 'completed' && ['subscribed', 'already-subscribed'].includes(childOutcomeStatus(result) ?? '');
  if (!succeeded && isLatest() && checkCurrentMasterBinding(context, binding)) {
    context.platformPorts.logger
      .scope({moduleName, layer: 'kernel', subsystem: 'store-basic', component: 'topic-subscription'})
      .error({
        category: 'terminal.store-basic.subscription',
        event: 'topic-subscribe-failed',
        message: 'Store basic topic subscription command did not complete successfully',
        data: {
          topicKey,
          dispatchStatus: result.status,
          outcomeStatus: childOutcomeStatus(result),
          reason: childOutcomeReason(result),
        },
      });
    currentTopicStatus(context, topicKey, 'TOPIC_SUBSCRIBE_FAILED');
  }
  return succeeded;
};
const accept = async (
  context: ActorExecutionContext,
  payload: TerminalTopicChangedPayload,
  isLatest: () => boolean,
): Promise<boolean> => {
  const result = await context.dispatchCommand(
    acceptTerminalTopicNotificationCommand,
    {
      subscriberKey: moduleName,
      subscriptionId: payload.notification.subscriptionId,
      notificationId: payload.notification.notificationId,
    },
    {requestId: childRequestId(context)},
  );
  const succeeded =
    result.status === 'completed' && ['accepted', 'accepted-locally'].includes(childOutcomeStatus(result) ?? '');
  if (!succeeded && isLatest()) currentTopicStatus(context, payload.notification.topicKey, 'TOPIC_ACCEPT_FAILED');
  return succeeded;
};
const unsubscribe = async (input: {
  context: ActorExecutionContext;
  binding: StoreBasicBinding;
  isLatest: () => boolean;
  topicKey: TerminalTopicKey;
  ownerRef: string;
}): Promise<boolean> => {
  const {context, binding, isLatest, topicKey, ownerRef} = input;
  if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
  const result = await context.dispatchCommand(
    unsubscribeTerminalTopicCommand,
    {
      subscriberKey: moduleName,
      topicKey,
      ownerRef,
    },
    {requestId: childRequestId(context)},
  );
  const succeeded =
    result.status === 'completed' && ['unsubscribed', 'not-subscribed'].includes(childOutcomeStatus(result) ?? '');
  if (!succeeded && isLatest() && checkCurrentMasterBinding(context, binding))
    currentTopicStatus(context, topicKey, 'TOPIC_UNSUBSCRIBE_FAILED');
  return succeeded;
};

const subscribeDetails = async (input: {
  context: ActorExecutionContext;
  binding: StoreBasicBinding;
  topicKey: TerminalTopicKey;
  details: readonly {ownerRef: string; updatedAt: number}[];
}): Promise<void> => {
  const {context, binding, topicKey, details} = input;
  for (const detail of details) {
    if (!checkCurrentMasterBinding(context, binding)) return;
    await subscribe({
      context,
      binding,
      isLatest: () => checkCurrentMasterBinding(context, binding),
      topicKey,
      ownerRef: detail.ownerRef,
      initialTimeEpochMillis: detail.updatedAt,
    });
  }
};
const checkCurrentBinding = (context: ActorExecutionContext, binding: StoreBasicBinding): boolean =>
  sameBinding(currentBinding(context), binding) &&
  sameBinding(selectStoreBasicState(context.getState()).binding, binding);
const checkCurrentMasterBinding = (context: ActorExecutionContext, binding: StoreBasicBinding): boolean =>
  selectRuntimeInstanceMode(context.getState()) === 'MASTER' && checkCurrentBinding(context, binding);
const updateLoadReadiness = (
  context: ActorExecutionContext,
  binding: StoreBasicBinding,
  patch: Partial<StoreBasicState['loadReadiness']>,
): void => {
  const current = selectStoreBasicState(context.getState()).loadReadiness;
  const same = current.runtimeId === context.runtimeId && sameBinding(current.binding, binding);
  context.dispatchAction(
    storeBasicActions.setLoadReadiness(
      Object.freeze({
        runtimeId: context.runtimeId,
        binding,
        storeStatus: same ? current.storeStatus : 'idle',
        ...patch,
      }),
    ),
  );
};
const withBinding = async (context: ActorExecutionContext, binding: StoreBasicBinding): Promise<boolean> => {
  if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER' || !sameBinding(currentBinding(context), binding))
    return false;
  const current = selectStoreBasicState(context.getState()).binding;
  if (!sameBinding(current, binding)) {
    context.dispatchAction(storeBasicActions.setBinding(binding));
    try {
      await flush(context);
    } catch {
      return false;
    }
  }
  return checkCurrentMasterBinding(context, binding);
};

export const createStoreBasicActor = (): readonly ActorDefinition[] => {
  const activeInitialLoads = new Set<string>();
  const activeContractLoads = new Set<string>();
  const completedStoreLoads = new Set<string>();
  const completedContractLoads = new Set<string>();
  const completedServicePointLoads = new Set<string>();
  const latestNotificationByTopic = new Map<string, string>();
  const collectionRefresh = Object.freeze({
    checkCurrentMasterBinding,
    setLoaded,
    setStoreLoading,
    applyStoreRead,
    flush,
    subscribe,
    unsubscribe,
    setFailure: currentTopicStatus,
  });

  const loadStore = createLoadStore({
    activeInitialLoads,
    completedStoreLoads,
    completedContractLoads,
    completedServicePointLoads,
    currentBinding,
    sameBinding: (left, right) => left !== null && right !== null && sameBinding(left, right),
    bindingKey,
    withBinding,
    checkCurrentMasterBinding,
    checkCurrentBinding,
    updateLoadReadiness,
    currentTopicStatus,
    readOperation: (context, request) =>
      readOperation(context, request as OwnerReadPayload) as Promise<
        TerminalOperationResult<'terminalReadStoreBasic'>
      >,
    setLoaded,
    setStoreLoading,
    applyStoreRead,
    flush,
    subscribe,
    logRead,
    childRequestId,
  });

  const subscribeContractDetails = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    contracts: TerminalStoreActiveContractsRead['items'],
  ): Promise<boolean> => {
    for (const contract of contracts) {
      if (!checkCurrentMasterBinding(context, binding)) return false;
      await subscribe({
        context,
        binding,
        isLatest: () => checkCurrentMasterBinding(context, binding),
        topicKey: 'CONTRACT',
        ownerRef: contract.id,
        initialTimeEpochMillis: contract.updatedAt,
      });
    }
    return true;
  };

  const loadActiveContracts = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
  ): Promise<StateJsonValue> => {
    const key = bindingKey(binding);
    if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
    if (completedContractLoads.has(key)) return {status: 'already-loaded'};
    if (activeContractLoads.has(key)) return {status: 'already-loading'};
    activeContractLoads.add(key);
    try {
      const contractsResult = await readOperation(context, {
        operationId: 'terminalReadStoreActiveContracts',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      if (contractsResult?.kind === 'success') {
        const value = contractsResult.body as TerminalStoreActiveContractsRead;
        context.dispatchAction(
          storeBasicActions.setActiveContracts({
            value: value.items,
            updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
          }),
        );
        setLoaded(context, 'VALID_CONTRACT_COLLECTION');
        setLoaded(context, 'CONTRACT');
        await flush(context);
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        await subscribe({
          context,
          binding,
          isLatest: () => checkCurrentMasterBinding(context, binding),
          topicKey: 'VALID_CONTRACT_COLLECTION',
          ownerRef: binding.storeRef,
          initialTimeEpochMillis: value.collectionUpdatedAtEpochMillis,
        });
        if (!(await subscribeContractDetails(context, binding, value.items))) return {status: 'stale-binding'};
        if (checkCurrentMasterBinding(context, binding)) completedContractLoads.add(key);
        return {status: 'contracts-loaded'};
      } else {
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        currentTopicStatus(
          context,
          'VALID_CONTRACT_COLLECTION',
          contractsResult?.kind === 'business-rejection'
            ? contractsResult.errorCode
            : 'CONTRACT_COLLECTION_READ_FAILED',
        );
        return {status: 'contract-read-failed'};
      }
    } finally {
      activeContractLoads.delete(key);
    }
  };

  const loadServicePoints = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
  ): Promise<StateJsonValue> => {
    const key = bindingKey(binding);
    if (
      !checkCurrentMasterBinding(context, binding) ||
      !completedStoreLoads.has(key) ||
      selectStoreBasicState(context.getState()).store === null
    )
      return {status: 'store-prerequisite-missing'};
    if (completedServicePointLoads.has(key)) return {status: 'already-loaded'};
    if (activeInitialLoads.has(`service:${key}`)) return {status: 'already-loading'};
    activeInitialLoads.add(`service:${key}`);
    let allReadsSucceeded = true;
    try {
      const areasResult = await readOperation(context, {
        operationId: 'terminalReadStoreServicePointAreas',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      if (areasResult?.kind === 'success') {
        const value = areasResult.body as TerminalStoreServicePointAreasRead;
        context.dispatchAction(
          storeBasicActions.setAreas({value: value.items, updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis}),
        );
        setLoaded(context, 'SERVICE_POINT_AREA_COLLECTION');
        setLoaded(context, 'SERVICE_POINT_AREA');
        await flush(context);
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        await subscribe({
          context,
          binding,
          isLatest: () => checkCurrentMasterBinding(context, binding),
          topicKey: 'SERVICE_POINT_AREA_COLLECTION',
          ownerRef: binding.storeRef,
          initialTimeEpochMillis: value.collectionUpdatedAtEpochMillis,
        });
        await subscribeDetails({
          context,
          binding,
          topicKey: 'SERVICE_POINT_AREA',
          details: value.items.map(area => ({ownerRef: area.areaRef, updatedAt: area.updatedAt})),
        });
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      } else {
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        allReadsSucceeded = false;
        currentTopicStatus(
          context,
          'SERVICE_POINT_AREA_COLLECTION',
          areasResult?.kind === 'business-rejection' ? areasResult.errorCode : 'SERVICE_POINT_AREA_READ_FAILED',
        );
      }
      const pointsResult = await readOperation(context, {
        operationId: 'terminalReadStoreServicePoints',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      if (pointsResult?.kind === 'success') {
        const value = pointsResult.body as TerminalStoreServicePointsRead;
        context.dispatchAction(
          storeBasicActions.setServicePoints({
            value: value.items,
            updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
          }),
        );
        setLoaded(context, 'SERVICE_POINT_COLLECTION');
        setLoaded(context, 'SERVICE_POINT');
        await flush(context);
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        await subscribe({
          context,
          binding,
          isLatest: () => checkCurrentMasterBinding(context, binding),
          topicKey: 'SERVICE_POINT_COLLECTION',
          ownerRef: binding.storeRef,
          initialTimeEpochMillis: value.collectionUpdatedAtEpochMillis,
        });
        await subscribeDetails({
          context,
          binding,
          topicKey: 'SERVICE_POINT',
          details: value.items.map(point => ({ownerRef: point.pointRef, updatedAt: point.updatedAt})),
        });
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      } else {
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        allReadsSucceeded = false;
        currentTopicStatus(
          context,
          'SERVICE_POINT_COLLECTION',
          pointsResult?.kind === 'business-rejection' ? pointsResult.errorCode : 'SERVICE_POINT_READ_FAILED',
        );
      }
      if (allReadsSucceeded && checkCurrentMasterBinding(context, binding)) {
        completedServicePointLoads.add(key);
        return {status: 'service-points-loaded'};
      }
      return {status: 'service-points-read-failed'};
    } finally {
      activeInitialLoads.delete(`service:${key}`);
    }
  };

  const loadAfterStore = async (
    context: ActorExecutionContext,
    requestedBinding: TerminalActivationSucceededPayload,
  ): Promise<StateJsonValue> => {
    const binding = currentBinding(context);
    if (binding === null || !sameBinding(binding, requestedBinding) || !checkCurrentMasterBinding(context, binding))
      return {status: 'inactive-or-stale'};
    const state = selectStoreBasicState(context.getState());
    const readiness = state.loadReadiness;
    if (
      readiness.runtimeId !== context.runtimeId ||
      !sameBinding(readiness.binding, binding) ||
      readiness.storeStatus !== 'flushed' ||
      state.store === null ||
      state.store.value.id !== binding.storeRef ||
      state.store.value.groupWorkspaceKey !== binding.groupWorkspaceKey ||
      state.store.value.project.id.length === 0
    )
      return {status: 'store-prerequisite-missing'};

    const servicePoints = context.dispatchCommand(
      initializeStoreServicePointsCommand,
      {binding},
      {requestId: childRequestId(context)},
    );
    const [contractsResult, servicePointsResult] = await Promise.all([
      loadActiveContracts(context, binding),
      servicePoints,
    ]);
    return Object.freeze({
      status: 'store-followups-settled',
      contracts: contractsResult,
      servicePoints: childOutcomeStatus(servicePointsResult) ?? servicePointsResult.status,
    });
  };

  const onTopicChanged = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    notification: TerminalTopicChangedPayload['notification'],
  ): Promise<StateJsonValue> => {
    const payload: TerminalTopicChangedPayload = Object.freeze({
      subscriberKey: moduleName,
      terminalRef: binding.terminalRef,
      bindingGeneration: binding.bindingGeneration,
      notification,
    });
    if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
    const topicId = `${notification.topicKey}:${notification.ownerRef}`;
    latestNotificationByTopic.set(topicId, notification.notificationId);
    const isLatest = (): boolean =>
      latestNotificationByTopic.get(topicId) === notification.notificationId &&
      checkCurrentMasterBinding(context, binding);
    const fail = (code: string): StateJsonValue => {
      currentTopicStatus(context, notification.topicKey, code);
      return {status: 'refresh-failed', errorCode: code};
    };
    let read: TerminalOperationResult<OwnerReadOperationId> | null = null;
    let topicSubscriptionSucceeded = true;
    switch (notification.topicKey) {
      case 'STORE':
      case 'STORE_OPERATING_RULE':
        read = await readOperation(context, {
          operationId: 'terminalReadStoreBasic',
          pathParameters: {storeRef: binding.storeRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'STORE_READ_FAILED');
        if (notification.topicKey === 'STORE')
          context.dispatchAction(
            storeBasicActions.setStore({
              value: (read.body as TerminalStoreBasicRead).store,
              updatedAtEpochMillis: (read.body as TerminalStoreBasicRead).storeUpdatedAtEpochMillis,
            }),
          );
        else
          context.dispatchAction(
            storeBasicActions.setOperatingRules({
              value: (read.body as TerminalStoreBasicRead).operatingRules,
              updatedAtEpochMillis: (read.body as TerminalStoreBasicRead).operatingRulesUpdatedAtEpochMillis,
            }),
          );
        break;
      case 'VALID_CONTRACT_COLLECTION':
        read = await readOperation(context, {
          operationId: 'terminalReadStoreActiveContracts',
          pathParameters: {storeRef: binding.storeRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'CONTRACT_COLLECTION_READ_FAILED');
        await refreshStoreContracts({
          context,
          binding,
          value: read.body as TerminalStoreActiveContractsRead,
          isLatest,
          ...collectionRefresh,
        });
        break;
      case 'CONTRACT':
        read = await readOperation(context, {
          operationId: 'terminalReadContract',
          pathParameters: {contractRef: notification.ownerRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'CONTRACT_READ_FAILED');
        topicSubscriptionSucceeded = await applyContractDetail({
          context,
          binding,
          id: notification.ownerRef,
          value: read.body as TerminalContractRead,
          isLatest,
          unsubscribe,
        });
        break;
      case 'SERVICE_POINT_AREA_COLLECTION':
        read = await readOperation(context, {
          operationId: 'terminalReadStoreServicePointAreas',
          pathParameters: {storeRef: binding.storeRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'SERVICE_POINT_AREA_READ_FAILED');
        await refreshStoreAreas({
          context,
          binding,
          value: read.body as TerminalStoreServicePointAreasRead,
          isLatest,
          ...collectionRefresh,
        });
        break;
      case 'SERVICE_POINT_AREA':
        read = await readOperation(context, {
          operationId: 'terminalReadServicePointArea',
          pathParameters: {areaRef: notification.ownerRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'SERVICE_POINT_AREA_READ_FAILED');
        topicSubscriptionSucceeded = await applyAreaDetail({
          context,
          binding,
          id: notification.ownerRef,
          value: read.body as TerminalServicePointAreaRead,
          isLatest,
          unsubscribe,
        });
        break;
      case 'SERVICE_POINT_COLLECTION':
        read = await readOperation(context, {
          operationId: 'terminalReadStoreServicePoints',
          pathParameters: {storeRef: binding.storeRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'SERVICE_POINT_READ_FAILED');
        await refreshStoreServicePoints({
          context,
          binding,
          value: read.body as TerminalStoreServicePointsRead,
          isLatest,
          ...collectionRefresh,
        });
        break;
      case 'SERVICE_POINT':
        read = await readOperation(context, {
          operationId: 'terminalReadServicePoint',
          pathParameters: {pointRef: notification.ownerRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'SERVICE_POINT_READ_FAILED');
        topicSubscriptionSucceeded = await applyServicePointDetail({
          context,
          binding,
          id: notification.ownerRef,
          value: read.body as TerminalServicePointRead,
          isLatest,
          unsubscribe,
        });
        break;
      default:
        return {status: 'unowned-topic'};
    }
    if (!isLatest()) return {status: 'stale-result'};
    if (topicSubscriptionSucceeded) setLoaded(context, notification.topicKey);
    if (!isLatest()) return {status: 'stale-result'};
    try {
      await flush(context);
    } catch (error) {
      if (!isLatest()) return {status: 'stale-result'};
      return fail(error instanceof Error ? error.message : 'STORE_BASIC_PERSISTENCE_FAILED');
    }
    const accepted = await accept(context, payload, isLatest);
    if (!isLatest()) return {status: 'stale-result'};
    if (!accepted) return {status: 'accept-failed'};
    return topicSubscriptionSucceeded ? {status: 'refreshed'} : {status: 'subscription-adjustment-failed'};
  };

  return [
    defineActor(moduleName, 'store-basic', [
      onCommand(initializeStoreBasicCommand, context => loadStore(context)),
      onCommand(terminalActivationSucceededCommand, context => loadStore(context, context.command.payload)),
      onCommand(storeBasicInformationLoadedCommand, context => loadAfterStore(context, context.command.payload)),
      onCommand(initializeStoreServicePointsCommand, context =>
        loadServicePoints(context, context.command.payload.binding),
      ),
      onCommand(refreshStoreBasicTopicCommand, context =>
        onTopicChanged(context, context.command.payload.binding, context.command.payload.notification),
      ),
      onCommand(terminalTopicChangedCommand, async context => {
        const payload = context.command.payload;
        if (payload.subscriberKey !== moduleName) return {status: 'other-subscriber'};
        const binding = currentBinding(context);
        if (
          binding === null ||
          binding.terminalRef !== payload.terminalRef ||
          binding.bindingGeneration !== payload.bindingGeneration
        )
          return {status: 'stale-binding'};
        const result = await context.dispatchCommand(
          refreshStoreBasicTopicCommand,
          {
            binding,
            notification: payload.notification,
          },
          {requestId: childRequestId(context)},
        );
        const value = childResult(result);
        return result.status === 'completed' && value !== null ? value : {status: 'refresh-command-failed'};
      }),
    ]),
  ];
};

