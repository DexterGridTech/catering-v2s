import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {ActorDefinition, ActorExecutionContext, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  acceptTerminalTopicNotificationCommand,
  readTerminalDataCommand,
  subscribeTerminalTopicCommand,
  terminalActivationSucceededCommand,
  terminalTopicChangedCommand,
  unsubscribeTerminalTopicCommand,
  selectActivationState,
  selectTerminalTopicSubscriptions,
  type TerminalActivationSucceededPayload,
  type TerminalDataReadPayload,
  type TerminalOperationResult,
  type TerminalReadOperationId,
  type TerminalTopicChangedPayload,
  type TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName} from '../../moduleName';
import {selectStoreBasicState} from '../../selectors/selectors';
import {storeBasicActions} from '../slices/slice';
import type {StoreBasicBinding} from '../../types/types';
import {
  initializeStoreBasicCommand,
  initializeStoreServicePointsCommand,
  refreshStoreBasicTopicCommand,
  storeBasicInformationLoadedCommand,
} from '../commands/commands';
import type {
  TerminalContractRead,
  TerminalServicePointAreaRead,
  TerminalServicePointRead,
  TerminalStoreActiveContractsRead,
  TerminalStoreBasicRead,
  TerminalStoreOrganizationPathRead,
  TerminalStoreServicePointAreasRead,
  TerminalStoreServicePointsRead,
} from '@catering-v2s/kernel-base-terminal-data-client';

const bindingKey = (binding: StoreBasicBinding): string =>
  `${binding.terminalRef}:${binding.bindingGeneration}:${binding.storeRef}`;
const sameBinding = (left: StoreBasicBinding | null, right: StoreBasicBinding): boolean =>
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
const successfulOperationResult = (result: StateJsonValue): TerminalOperationResult<TerminalReadOperationId> | null => {
  if (typeof result !== 'object' || result === null || Array.isArray(result) || !('kind' in result)) return null;
  return result as TerminalOperationResult<TerminalReadOperationId>;
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
const currentTopicStatus = (context: ActorExecutionContext, topicKey: TerminalTopicKey, errorCode: string): void => {
  context.dispatchAction(storeBasicActions.setFailure({topicKey, errorCode}));
};
const setLoaded = (context: ActorExecutionContext, topicKey: TerminalTopicKey): void => {
  context.dispatchAction(storeBasicActions.setReadState({topicKey, status: 'loaded'}));
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
const readOperation = async (
  context: ActorExecutionContext,
  request: TerminalDataReadPayload,
): Promise<TerminalOperationResult<TerminalReadOperationId> | null> => {
  const dispatched = await context.dispatchCommand(readTerminalDataCommand, request, {
    requestId: childRequestId(context),
  });
  const value = childResult(dispatched);
  return dispatched.status === 'completed' && value !== null ? successfulOperationResult(value) : null;
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
  if (!succeeded && isLatest() && checkCurrentMasterBinding(context, binding))
    currentTopicStatus(context, topicKey, 'TOPIC_SUBSCRIBE_FAILED');
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

const reconcileTopicSubscriptions = async (
  input: Readonly<{
    context: ActorExecutionContext;
    binding: StoreBasicBinding;
    isLatest: () => boolean;
    topicKey: TerminalTopicKey;
    desired: readonly Readonly<{ownerRef: string; updatedAt: number}>[];
  }>,
): Promise<boolean> => {
  const {context, binding, isLatest, topicKey, desired} = input;
  if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
  const actual = selectTerminalTopicSubscriptions(context.getState()).filter(
    subscription => subscription.subscriberKey === moduleName && subscription.topicKey === topicKey,
  );
  const wanted = new Map(desired.map(item => [item.ownerRef, item.updatedAt]));
  let succeeded = true;
  let failureCode: string | null = null;
  for (const subscription of actual) {
    if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
    if (!wanted.has(subscription.ownerRef)) {
      const result = await context.dispatchCommand(
        unsubscribeTerminalTopicCommand,
        {subscriberKey: moduleName, topicKey, ownerRef: subscription.ownerRef},
        {requestId: childRequestId(context)},
      );
      const removed =
        result.status === 'completed' && ['unsubscribed', 'not-subscribed'].includes(childOutcomeStatus(result) ?? '');
      if (!removed) {
        succeeded = false;
        failureCode ??= 'TOPIC_UNSUBSCRIBE_FAILED';
      }
    }
  }
  for (const [ownerRef, updatedAt] of wanted) {
    if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
    const stillSubscribed = selectTerminalTopicSubscriptions(context.getState()).some(
      subscription =>
        subscription.subscriberKey === moduleName &&
        subscription.topicKey === topicKey &&
        subscription.ownerRef === ownerRef,
    );
    if (
      !stillSubscribed &&
      !(await subscribe({context, binding, isLatest, topicKey, ownerRef, initialTimeEpochMillis: updatedAt}))
    ) {
      succeeded = false;
      failureCode ??= 'TOPIC_SUBSCRIBE_FAILED';
    }
  }
  if (!succeeded && isLatest() && checkCurrentMasterBinding(context, binding))
    currentTopicStatus(context, topicKey, failureCode ?? 'TOPIC_SUBSCRIPTION_RECONCILE_FAILED');
  return succeeded;
};

export const createStoreBasicActors = (): readonly ActorDefinition[] => {
  const activeInitialLoads = new Set<string>();
  const completedStoreLoads = new Set<string>();
  const completedServicePointLoads = new Set<string>();
  const latestNotificationByTopic = new Map<string, string>();

  const loadStore = async (
    context: ActorExecutionContext,
    requestedBinding?: TerminalActivationSucceededPayload,
  ): Promise<StateJsonValue> => {
    const binding = currentBinding(context);
    if (binding === null || (requestedBinding !== undefined && !sameBinding(binding, requestedBinding)))
      return {status: 'inactive-or-stale'};
    if (!(await withBinding(context, binding))) return {status: 'stale-binding'};
    const key = bindingKey(binding);
    if (completedStoreLoads.has(key)) {
      if (!completedServicePointLoads.has(key))
        await context.dispatchCommand(
          initializeStoreServicePointsCommand,
          {binding},
          {
            requestId: childRequestId(context),
          },
        );
      return {status: 'already-loaded'};
    }
    if (activeInitialLoads.has(key)) return {status: 'already-loading'};
    activeInitialLoads.add(key);
    context.dispatchAction(storeBasicActions.setReadState({topicKey: 'STORE', status: 'loading'}));
    try {
      const result = await readOperation(context, {
        operationId: 'terminalReadStoreBasic',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      if (result?.kind !== 'success') {
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
        if (checkCurrentMasterBinding(context, binding)) await loadOrganizationAndContracts(context, binding);
        return {status: 'store-read-failed'};
      }
      if (!checkCurrentBinding(context, binding)) return {status: 'stale-binding'};
      const body = result.body as TerminalStoreBasicRead;
      context.dispatchAction(
        storeBasicActions.setStore({value: body.store, updatedAtEpochMillis: body.storeUpdatedAtEpochMillis}),
      );
      context.dispatchAction(
        storeBasicActions.setOperatingRules({
          value: body.operatingRules,
          updatedAtEpochMillis: body.operatingRulesUpdatedAtEpochMillis,
        }),
      );
      setLoaded(context, 'STORE');
      setLoaded(context, 'STORE_OPERATING_RULE');
      try {
        await flush(context);
      } catch (error) {
        if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        currentTopicStatus(context, 'STORE', error instanceof Error ? error.message : 'STORE_PERSISTENCE_FAILED');
        return {status: 'store-persistence-failed'};
      }
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
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
      if (!checkCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
      await context.dispatchCommand(
        initializeStoreServicePointsCommand,
        {binding},
        {
          requestId: childRequestId(context),
        },
      );
      await loadOrganizationAndContracts(context, binding);
      return {status: 'store-loaded'};
    } finally {
      activeInitialLoads.delete(key);
    }
  };

  const loadOrganizationAndContracts = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
  ): Promise<void> => {
    if (!checkCurrentMasterBinding(context, binding)) return;
    const pathResult = await readOperation(context, {
      operationId: 'terminalReadStoreOrganizationPath',
      pathParameters: {storeRef: binding.storeRef},
    });
    if (!checkCurrentMasterBinding(context, binding)) return;
    if (pathResult?.kind === 'success') {
      const path = pathResult.body as TerminalStoreOrganizationPathRead;
      context.dispatchAction(storeBasicActions.setOrganizationPath(path));
      setLoaded(context, 'PROJECT');
      setLoaded(context, 'REGION');
      setLoaded(context, 'COMMERCIAL_GROUP');
      await flush(context);
      if (!checkCurrentMasterBinding(context, binding)) return;
      await subscribe({
        context,
        binding,
        isLatest: () => checkCurrentMasterBinding(context, binding),
        topicKey: 'PROJECT',
        ownerRef: path.projectRef,
        initialTimeEpochMillis: path.projectUpdatedAtEpochMillis,
      });
      await subscribe({
        context,
        binding,
        isLatest: () => checkCurrentMasterBinding(context, binding),
        topicKey: 'REGION',
        ownerRef: path.regionRef,
        initialTimeEpochMillis: path.regionUpdatedAtEpochMillis,
      });
      await subscribe({
        context,
        binding,
        isLatest: () => checkCurrentMasterBinding(context, binding),
        topicKey: 'COMMERCIAL_GROUP',
        ownerRef: path.commercialGroupRef,
        initialTimeEpochMillis: path.commercialGroupUpdatedAtEpochMillis,
      });
    } else {
      if (!checkCurrentMasterBinding(context, binding)) return;
      const code = pathResult?.kind === 'business-rejection' ? pathResult.errorCode : 'ORGANIZATION_PATH_READ_FAILED';
      for (const key of ['PROJECT', 'REGION', 'COMMERCIAL_GROUP'] as const) currentTopicStatus(context, key, code);
    }
    if (!checkCurrentMasterBinding(context, binding)) return;
    const contractsResult = await readOperation(context, {
      operationId: 'terminalReadStoreActiveContracts',
      pathParameters: {storeRef: binding.storeRef},
    });
    if (!checkCurrentMasterBinding(context, binding)) return;
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
      if (!checkCurrentMasterBinding(context, binding)) return;
      await subscribe({
        context,
        binding,
        isLatest: () => checkCurrentMasterBinding(context, binding),
        topicKey: 'VALID_CONTRACT_COLLECTION',
        ownerRef: binding.storeRef,
        initialTimeEpochMillis: value.collectionUpdatedAtEpochMillis,
      });
      for (const contract of value.items) {
        if (!checkCurrentMasterBinding(context, binding)) return;
        await subscribe({
          context,
          binding,
          isLatest: () => checkCurrentMasterBinding(context, binding),
          topicKey: 'CONTRACT',
          ownerRef: contract.id,
          initialTimeEpochMillis: contract.updatedAt,
        });
      }
    } else {
      if (!checkCurrentMasterBinding(context, binding)) return;
      currentTopicStatus(
        context,
        'VALID_CONTRACT_COLLECTION',
        contractsResult?.kind === 'business-rejection' ? contractsResult.errorCode : 'CONTRACT_COLLECTION_READ_FAILED',
      );
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
    let read: TerminalOperationResult<TerminalReadOperationId> | null = null;
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
      case 'PROJECT':
      case 'REGION':
      case 'COMMERCIAL_GROUP':
        read = await readOperation(context, {
          operationId: 'terminalReadStoreOrganizationPath',
          pathParameters: {storeRef: binding.storeRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'ORGANIZATION_PATH_READ_FAILED');
        context.dispatchAction(storeBasicActions.setOrganizationPath(read.body as TerminalStoreOrganizationPathRead));
        break;
      case 'VALID_CONTRACT_COLLECTION':
        read = await readOperation(context, {
          operationId: 'terminalReadStoreActiveContracts',
          pathParameters: {storeRef: binding.storeRef},
        });
        if (!isLatest()) return {status: 'stale-result'};
        if (read?.kind !== 'success')
          return fail(read?.kind === 'business-rejection' ? read.errorCode : 'CONTRACT_COLLECTION_READ_FAILED');
        await replaceContracts({context, value: read.body as TerminalStoreActiveContractsRead, isLatest});
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
        await replaceAreas({context, value: read.body as TerminalStoreServicePointAreasRead, isLatest});
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
        await replaceServicePoints({context, value: read.body as TerminalStoreServicePointsRead, isLatest});
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
        });
        break;
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
      onCommand(storeBasicInformationLoadedCommand, () => null),
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

const replaceContracts = async (
  input: Readonly<{
    context: ActorExecutionContext;
    value: TerminalStoreActiveContractsRead;
    isLatest: () => boolean;
  }>,
): Promise<void> => {
  const {context, value, isLatest} = input;
  if (!isLatest()) return;
  const binding = currentBinding(context);
  if (binding === null || !checkCurrentMasterBinding(context, binding)) return;
  context.dispatchAction(
    storeBasicActions.setActiveContracts({
      value: value.items,
      updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
    }),
  );
  setLoaded(context, 'VALID_CONTRACT_COLLECTION');
  setLoaded(context, 'CONTRACT');
  await flush(context);
  if (!isLatest()) return;
  await reconcileTopicSubscriptions({
    context,
    binding,
    isLatest,
    topicKey: 'CONTRACT',
    desired: value.items.map(item => ({ownerRef: item.id, updatedAt: item.updatedAt})),
  });
};

const replaceAreas = async (
  input: Readonly<{
    context: ActorExecutionContext;
    value: TerminalStoreServicePointAreasRead;
    isLatest: () => boolean;
  }>,
): Promise<void> => {
  const {context, value, isLatest} = input;
  if (!isLatest()) return;
  const binding = currentBinding(context);
  if (binding === null || !checkCurrentMasterBinding(context, binding)) return;
  context.dispatchAction(
    storeBasicActions.setAreas({value: value.items, updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis}),
  );
  setLoaded(context, 'SERVICE_POINT_AREA_COLLECTION');
  setLoaded(context, 'SERVICE_POINT_AREA');
  await flush(context);
  if (!isLatest()) return;
  await reconcileTopicSubscriptions({
    context,
    binding,
    isLatest,
    topicKey: 'SERVICE_POINT_AREA',
    desired: value.items.map(item => ({ownerRef: item.areaRef, updatedAt: item.updatedAt})),
  });
};

const replaceServicePoints = async (
  input: Readonly<{
    context: ActorExecutionContext;
    value: TerminalStoreServicePointsRead;
    isLatest: () => boolean;
  }>,
): Promise<void> => {
  const {context, value, isLatest} = input;
  if (!isLatest()) return;
  const binding = currentBinding(context);
  if (binding === null || !checkCurrentMasterBinding(context, binding)) return;
  context.dispatchAction(
    storeBasicActions.setServicePoints({
      value: value.items,
      updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
    }),
  );
  setLoaded(context, 'SERVICE_POINT_COLLECTION');
  setLoaded(context, 'SERVICE_POINT');
  await flush(context);
  if (!isLatest()) return;
  await reconcileTopicSubscriptions({
    context,
    binding,
    isLatest,
    topicKey: 'SERVICE_POINT',
    desired: value.items.map(item => ({ownerRef: item.pointRef, updatedAt: item.updatedAt})),
  });
};

const applyContractDetail = async (
  input: Readonly<{
    context: ActorExecutionContext;
    binding: StoreBasicBinding;
    id: string;
    value: TerminalContractRead;
    isLatest: () => boolean;
  }>,
): Promise<boolean> => {
  const {context, binding, id, value, isLatest} = input;
  if (!isLatest()) return true;
  const current = selectStoreBasicState(context.getState()).activeContracts;
  if (current === null || !current.value.some(item => item.id === id)) return true;
  const items =
    value.contract.status === 'VALID'
      ? current.value.map(item => (item.id === id ? value.contract : item))
      : current.value.filter(item => item.id !== id);
  context.dispatchAction(
    storeBasicActions.setActiveContracts({value: items, updatedAtEpochMillis: current.updatedAtEpochMillis}),
  );
  return value.contract.status !== 'VALID'
    ? unsubscribe({context, binding, isLatest, topicKey: 'CONTRACT', ownerRef: id})
    : true;
};

const applyAreaDetail = async (
  input: Readonly<{
    context: ActorExecutionContext;
    binding: StoreBasicBinding;
    id: string;
    value: TerminalServicePointAreaRead;
    isLatest: () => boolean;
  }>,
): Promise<boolean> => {
  const {context, binding, id, value, isLatest} = input;
  if (!isLatest()) return true;
  const current = selectStoreBasicState(context.getState()).areas;
  if (current === null || !current.value.some(item => item.areaRef === id)) return true;
  const items =
    value.area.status === 'ENABLED'
      ? current.value.map(item => (item.areaRef === id ? value.area : item))
      : current.value.filter(item => item.areaRef !== id);
  context.dispatchAction(
    storeBasicActions.setAreas({value: items, updatedAtEpochMillis: current.updatedAtEpochMillis}),
  );
  return value.area.status !== 'ENABLED'
    ? unsubscribe({context, binding, isLatest, topicKey: 'SERVICE_POINT_AREA', ownerRef: id})
    : true;
};

const applyServicePointDetail = async (
  input: Readonly<{
    context: ActorExecutionContext;
    binding: StoreBasicBinding;
    id: string;
    value: TerminalServicePointRead;
    isLatest: () => boolean;
  }>,
): Promise<boolean> => {
  const {context, binding, id, value, isLatest} = input;
  if (!isLatest()) return true;
  const current = selectStoreBasicState(context.getState()).servicePoints;
  if (current === null || !current.value.some(item => item.pointRef === id)) return true;
  const items =
    value.servicePoint.status === 'ENABLED'
      ? current.value.map(item => (item.pointRef === id ? value.servicePoint : item))
      : current.value.filter(item => item.pointRef !== id);
  context.dispatchAction(
    storeBasicActions.setServicePoints({value: items, updatedAtEpochMillis: current.updatedAtEpochMillis}),
  );
  return value.servicePoint.status !== 'ENABLED'
    ? unsubscribe({context, binding, isLatest, topicKey: 'SERVICE_POINT', ownerRef: id})
    : true;
};
