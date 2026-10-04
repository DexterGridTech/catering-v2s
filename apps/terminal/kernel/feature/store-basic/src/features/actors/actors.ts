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
  const dispatched = await context.dispatchCommand(readTerminalDataCommand, request, {requestId: createRequestId()});
  const value = childResult(dispatched);
  return dispatched.status === 'completed' && value !== null ? successfulOperationResult(value) : null;
};
const subscribe = async (
  input: Readonly<{
    context: ActorExecutionContext;
    topicKey: TerminalTopicKey;
    ownerRef: string;
    initialTimeEpochMillis: number;
  }>,
): Promise<boolean> => {
  const {context, topicKey, ownerRef, initialTimeEpochMillis} = input;
  const result = await context.dispatchCommand(subscribeTerminalTopicCommand, {
    subscriberKey: moduleName,
    topicKey,
    ownerRef,
    initialTimeEpochMillis,
  });
  const succeeded =
    result.status === 'completed' && ['subscribed', 'already-subscribed'].includes(childOutcomeStatus(result) ?? '');
  if (!succeeded) currentTopicStatus(context, topicKey, 'TOPIC_SUBSCRIBE_FAILED');
  return succeeded;
};
const accept = async (
  context: ActorExecutionContext,
  payload: TerminalTopicChangedPayload,
  isLatest: () => boolean,
): Promise<boolean> => {
  const result = await context.dispatchCommand(acceptTerminalTopicNotificationCommand, {
    subscriberKey: moduleName,
    subscriptionId: payload.notification.subscriptionId,
    notificationId: payload.notification.notificationId,
  });
  const succeeded = result.status === 'completed' && ['accepted', 'accepted-locally'].includes(childOutcomeStatus(result) ?? '');
  if (!succeeded && isLatest()) currentTopicStatus(context, payload.notification.topicKey, 'TOPIC_ACCEPT_FAILED');
  return succeeded;
};
const unsubscribe = async (
  context: ActorExecutionContext,
  topicKey: TerminalTopicKey,
  ownerRef: string,
): Promise<boolean> => {
  const result = await context.dispatchCommand(unsubscribeTerminalTopicCommand, {
    subscriberKey: moduleName,
    topicKey,
    ownerRef,
  });
  const succeeded =
    result.status === 'completed' && ['unsubscribed', 'not-subscribed'].includes(childOutcomeStatus(result) ?? '');
  if (!succeeded) currentTopicStatus(context, topicKey, 'TOPIC_UNSUBSCRIBE_FAILED');
  return succeeded;
};
const checkCurrentBinding = (context: ActorExecutionContext, binding: StoreBasicBinding): boolean =>
  sameBinding(currentBinding(context), binding) &&
  sameBinding(selectStoreBasicState(context.getState()).binding, binding);
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
  return checkCurrentBinding(context, binding);
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
        await context.dispatchCommand(initializeStoreServicePointsCommand, {binding});
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
        await loadOrganizationAndContracts(context, binding);
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
        currentTopicStatus(context, 'STORE', error instanceof Error ? error.message : 'STORE_PERSISTENCE_FAILED');
        return {status: 'store-persistence-failed'};
      }
      await subscribe({
        context,
        topicKey: 'STORE',
        ownerRef: binding.storeRef,
        initialTimeEpochMillis: body.storeUpdatedAtEpochMillis,
      });
      await subscribe({
        context,
        topicKey: 'STORE_OPERATING_RULE',
        ownerRef: binding.storeRef,
        initialTimeEpochMillis: body.operatingRulesUpdatedAtEpochMillis,
      });
      completedStoreLoads.add(key);
      logRead(context, 'terminalReadStoreBasic', 'loaded');
      await context.dispatchCommand(storeBasicInformationLoadedCommand, {
        terminalRef: binding.terminalRef,
        storeRef: binding.storeRef,
        groupWorkspaceKey: binding.groupWorkspaceKey,
        bindingGeneration: binding.bindingGeneration,
      });
      await context.dispatchCommand(initializeStoreServicePointsCommand, {binding});
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
    const pathResult = await readOperation(context, {
      operationId: 'terminalReadStoreOrganizationPath',
      pathParameters: {storeRef: binding.storeRef},
    });
    if (pathResult?.kind === 'success' && checkCurrentBinding(context, binding)) {
      const path = pathResult.body as TerminalStoreOrganizationPathRead;
      context.dispatchAction(storeBasicActions.setOrganizationPath(path));
      setLoaded(context, 'PROJECT');
      setLoaded(context, 'REGION');
      setLoaded(context, 'COMMERCIAL_GROUP');
      await flush(context);
      await subscribe({
        context,
        topicKey: 'PROJECT',
        ownerRef: path.projectRef,
        initialTimeEpochMillis: path.projectUpdatedAtEpochMillis,
      });
      await subscribe({
        context,
        topicKey: 'REGION',
        ownerRef: path.regionRef,
        initialTimeEpochMillis: path.regionUpdatedAtEpochMillis,
      });
      await subscribe({
        context,
        topicKey: 'COMMERCIAL_GROUP',
        ownerRef: path.commercialGroupRef,
        initialTimeEpochMillis: path.commercialGroupUpdatedAtEpochMillis,
      });
    } else {
      const code = pathResult?.kind === 'business-rejection' ? pathResult.errorCode : 'ORGANIZATION_PATH_READ_FAILED';
      for (const key of ['PROJECT', 'REGION', 'COMMERCIAL_GROUP'] as const) currentTopicStatus(context, key, code);
    }
    const contractsResult = await readOperation(context, {
      operationId: 'terminalReadStoreActiveContracts',
      pathParameters: {storeRef: binding.storeRef},
    });
    if (contractsResult?.kind === 'success' && checkCurrentBinding(context, binding)) {
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
      await subscribe({
        context,
        topicKey: 'VALID_CONTRACT_COLLECTION',
        ownerRef: binding.storeRef,
        initialTimeEpochMillis: value.collectionUpdatedAtEpochMillis,
      });
      for (const contract of value.items)
        await subscribe({
          context,
          topicKey: 'CONTRACT',
          ownerRef: contract.id,
          initialTimeEpochMillis: contract.updatedAt,
        });
    } else {
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
    if (!checkCurrentBinding(context, binding) || selectStoreBasicState(context.getState()).store === null)
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
      if (areasResult?.kind === 'success' && checkCurrentBinding(context, binding)) {
        const value = areasResult.body as TerminalStoreServicePointAreasRead;
        context.dispatchAction(
          storeBasicActions.setAreas({value: value.items, updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis}),
        );
        setLoaded(context, 'SERVICE_POINT_AREA_COLLECTION');
        setLoaded(context, 'SERVICE_POINT_AREA');
        await flush(context);
        await subscribe({
          context,
          topicKey: 'SERVICE_POINT_AREA_COLLECTION',
          ownerRef: binding.storeRef,
          initialTimeEpochMillis: value.collectionUpdatedAtEpochMillis,
        });
        for (const area of value.items)
          await subscribe({
            context,
            topicKey: 'SERVICE_POINT_AREA',
            ownerRef: area.areaRef,
            initialTimeEpochMillis: area.updatedAt,
          });
      } else {
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
      if (pointsResult?.kind === 'success' && checkCurrentBinding(context, binding)) {
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
        await subscribe({
          context,
          topicKey: 'SERVICE_POINT_COLLECTION',
          ownerRef: binding.storeRef,
          initialTimeEpochMillis: value.collectionUpdatedAtEpochMillis,
        });
        for (const point of value.items)
          await subscribe({
            context,
            topicKey: 'SERVICE_POINT',
            ownerRef: point.pointRef,
            initialTimeEpochMillis: point.updatedAt,
          });
      } else {
        allReadsSucceeded = false;
        currentTopicStatus(
          context,
          'SERVICE_POINT_COLLECTION',
          pointsResult?.kind === 'business-rejection' ? pointsResult.errorCode : 'SERVICE_POINT_READ_FAILED',
        );
      }
      if (allReadsSucceeded) {
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
    if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER' || !sameBinding(currentBinding(context), binding))
      return {status: 'stale-binding'};
    const topicId = `${notification.topicKey}:${notification.ownerRef}`;
    latestNotificationByTopic.set(topicId, notification.notificationId);
    const isLatest = (): boolean =>
      latestNotificationByTopic.get(topicId) === notification.notificationId && checkCurrentBinding(context, binding);
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
        const result = await context.dispatchCommand(refreshStoreBasicTopicCommand, {
          binding,
          notification: payload.notification,
        });
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
  const previous = selectStoreBasicState(context.getState()).activeContracts?.value ?? [];
  const oldIds = new Set(previous.map(item => item.id));
  const nextIds = new Set(value.items.map(item => item.id));
  context.dispatchAction(
    storeBasicActions.setActiveContracts({
      value: value.items,
      updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
    }),
  );
  setLoaded(context, 'VALID_CONTRACT_COLLECTION');
  setLoaded(context, 'CONTRACT');
  await flush(context);
  for (const id of oldIds) if (!nextIds.has(id)) await unsubscribe(context, 'CONTRACT', id);
  for (const contract of value.items)
    if (!oldIds.has(contract.id))
      await subscribe({
        context,
        topicKey: 'CONTRACT',
        ownerRef: contract.id,
        initialTimeEpochMillis: contract.updatedAt,
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
  const previous = selectStoreBasicState(context.getState()).areas?.value ?? [];
  const oldIds = new Set(previous.map(item => item.areaRef));
  const nextIds = new Set(value.items.map(item => item.areaRef));
  context.dispatchAction(
    storeBasicActions.setAreas({value: value.items, updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis}),
  );
  setLoaded(context, 'SERVICE_POINT_AREA_COLLECTION');
  setLoaded(context, 'SERVICE_POINT_AREA');
  await flush(context);
  for (const id of oldIds) if (!nextIds.has(id)) await unsubscribe(context, 'SERVICE_POINT_AREA', id);
  for (const item of value.items)
    if (!oldIds.has(item.areaRef))
      await subscribe({
        context,
        topicKey: 'SERVICE_POINT_AREA',
        ownerRef: item.areaRef,
        initialTimeEpochMillis: item.updatedAt,
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
  const previous = selectStoreBasicState(context.getState()).servicePoints?.value ?? [];
  const oldIds = new Set(previous.map(item => item.pointRef));
  const nextIds = new Set(value.items.map(item => item.pointRef));
  context.dispatchAction(
    storeBasicActions.setServicePoints({
      value: value.items,
      updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
    }),
  );
  setLoaded(context, 'SERVICE_POINT_COLLECTION');
  setLoaded(context, 'SERVICE_POINT');
  await flush(context);
  for (const id of oldIds) if (!nextIds.has(id)) await unsubscribe(context, 'SERVICE_POINT', id);
  for (const item of value.items)
    if (!oldIds.has(item.pointRef))
      await subscribe({
        context,
        topicKey: 'SERVICE_POINT',
        ownerRef: item.pointRef,
        initialTimeEpochMillis: item.updatedAt,
      });
};

const applyContractDetail = async (
  input: Readonly<{
    context: ActorExecutionContext;
    id: string;
    value: TerminalContractRead;
    isLatest: () => boolean;
  }>,
): Promise<boolean> => {
  const {context, id, value, isLatest} = input;
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
  return value.contract.status !== 'VALID' ? unsubscribe(context, 'CONTRACT', id) : true;
};

const applyAreaDetail = async (
  input: Readonly<{
    context: ActorExecutionContext;
    id: string;
    value: TerminalServicePointAreaRead;
    isLatest: () => boolean;
  }>,
): Promise<boolean> => {
  const {context, id, value, isLatest} = input;
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
  return value.area.status !== 'ENABLED' ? unsubscribe(context, 'SERVICE_POINT_AREA', id) : true;
};

const applyServicePointDetail = async (
  input: Readonly<{
    context: ActorExecutionContext;
    id: string;
    value: TerminalServicePointRead;
    isLatest: () => boolean;
  }>,
): Promise<boolean> => {
  const {context, id, value, isLatest} = input;
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
  return value.servicePoint.status !== 'ENABLED' ? unsubscribe(context, 'SERVICE_POINT', id) : true;
};
