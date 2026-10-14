import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {ActorDefinition, ActorExecutionContext, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  createRequestTerminalUpdatePayload,
  requestTerminalUpdateCommand,
  selectTerminalUpdateActualVersions,
  selectTerminalUpdateTask,
} from '@catering-v2s/kernel-base-terminal-update';
import {
  acceptTerminalTopicNotificationCommand,
  selectActivationState,
  subscribeTerminalTopicCommand,
  terminalActivationSucceededCommand,
  terminalTopicChangedCommand,
  unsubscribeTerminalTopicCommand,
  type TerminalTopicChangedPayload,
  type TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  type TerminalOperationResult,
  type TerminalRequestMap,
  type TerminalStoreOrganizationPathRead,
} from '../../generated/terminalApi';
import {createOwnerHttpClient} from './shared/createOwnerHttpClient';
import {createLoadProjectContext} from './shared/loadProjectContext';
import {reconcileProjectTopicSubscriptions} from './shared/reconcileProjectTopicSubscriptions';
import {
  createProjectRuleSnapshotRefresher,
  type ProjectOwnerReadOperationId,
  type ProjectOwnerReadPayload,
} from './shared/refreshProjectRuleSnapshot';
import {organizationTopicKeys as orgTopicKeys, terminalUpdateTopicKey} from '../../declarations/topics';
import {
  initializeStoreBasicCommand,
  selectStore,
  selectStoreBasicBinding,
  selectStoreBasicLoadReadiness,
  storeBasicInformationLoadedCommand,
  type StoreBasicBinding,
} from '@catering-v2s/kernel-feature-store-basic';
import {moduleName} from '../../moduleName';
import {fixedTargetFromProjectCandidate} from '../../selectors/fixedTargetFromProjectCandidate';
import {selectProjectBasicState} from '../../selectors/selectProjectBasicState';
import {selectProjectTerminalUpdateCandidate} from '../../selectors/selectProjectTerminalUpdateCandidate';
import {selectProjectTerminalUpdateContextFacts} from '../../selectors/selectProjectTerminalUpdateContextFacts';
import {projectBasicActions} from '../slices/projectBasicState';
import type {ProjectBasicState} from '../../types/types';
import {
  initializeProjectBasicCommand,
  evaluateProjectTerminalUpdateCommand,
  refreshProjectBasicTopicCommand,
  refreshProjectTerminalUpdateRulesCommand,
} from '../../declarations/commands';

const sameBinding = (left: StoreBasicBinding | null, right: StoreBasicBinding | null): boolean =>
  left !== null &&
  right !== null &&
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
const isCurrentMasterBinding = (context: ActorExecutionContext, binding: StoreBasicBinding): boolean =>
  selectRuntimeInstanceMode(context.getState()) === 'MASTER' &&
  sameBinding(currentBinding(context), binding) &&
  sameBinding(selectStoreBasicBinding(context.getState()), binding);
const currentStoreIsReady = (context: ActorExecutionContext, binding: StoreBasicBinding): boolean => {
  const readiness = selectStoreBasicLoadReadiness(context.getState());
  const store = selectStore(context.getState());
  return (
    readiness.runtimeId === context.runtimeId &&
    sameBinding(readiness.binding, binding) &&
    readiness.storeStatus === 'flushed' &&
    store !== null &&
    store.value.id === binding.storeRef &&
    store.value.groupWorkspaceKey === binding.groupWorkspaceKey &&
    store.value.project.id.length > 0
  );
};
const readState = (context: ActorExecutionContext): ProjectBasicState => selectProjectBasicState(context.getState());
const childRequestId = (context: ActorExecutionContext) => context.command.requestId ?? createRequestId();
const childResult = (result: CommandDispatchResult): StateJsonValue | null =>
  result.actorResults.length === 1 && result.actorResults[0]?.status === 'completed'
    ? result.actorResults[0].result
    : null;
const childStatus = (result: CommandDispatchResult): string | null => {
  const value = childResult(result);
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'status' in value
    ? String(value.status)
    : null;
};
const childReasonCode = (result: CommandDispatchResult): string | null => {
  const value = childResult(result);
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !('reason' in value)) return null;
  return typeof value.reason === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(value.reason) ? value.reason : null;
};
const flush = async (context: ActorExecutionContext): Promise<void> => {
  const result = await context.flushPersistence();
  if (result.status !== 'succeeded') throw new Error(`PROJECT_BASIC_PERSISTENCE_${result.status.toUpperCase()}`);
};
const log = (
  context: ActorExecutionContext,
  input: Readonly<{
    event: string;
    data: Readonly<Record<string, string | number | boolean | null>>;
    requestId?: ActorExecutionContext['command']['requestId'];
  }>,
): void => {
  const {event, data} = input;
  const requestId = input.requestId === undefined ? context.command.requestId : input.requestId;
  context.platformPorts.logger
    .scope({moduleName, layer: 'kernel', subsystem: 'project-basic', component: 'data-read'})
    .info({
      category: 'terminal.project-basic.read',
      event,
      message: 'Project basic owner data operation',
      context: {commandId: context.command.commandId, ...(requestId == null ? {} : {requestId})},
      data,
    });
};
const readOperation = async (
  context: ActorExecutionContext,
  request: ProjectOwnerReadPayload,
): Promise<TerminalOperationResult<ProjectOwnerReadOperationId> | null> => {
  const requestId = childRequestId(context);
  const startedAt = Date.now();
  log(context, {event: 'owner-read-started', data: {operationId: request.operationId}, requestId});
  try {
    const api = createOwnerHttpClient(context, requestId);
    const operation = api[request.operationId] as (
      input: TerminalRequestMap[typeof request.operationId],
    ) => Promise<TerminalOperationResult<ProjectOwnerReadOperationId>>;
    const result = await operation({
      pathParameters: request.pathParameters,
      queryParameters: request.queryParameters ?? {},
      headers: {},
    } as TerminalRequestMap[typeof request.operationId]);
    const resultKind = result.kind;
    const errorCode = 'errorCode' in result ? result.errorCode : 'code' in result ? result.code : null;
    log(context, {
      event: 'owner-read-completed',
      data: {
        operationId: request.operationId,
        resultKind,
        errorCode,
        elapsedMs: Math.max(0, Date.now() - startedAt),
      },
      requestId,
    });
    return result;
  } catch (error) {
    log(context, {
      event: 'owner-read-threw',
      data: {
        operationId: request.operationId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        elapsedMs: Math.max(0, Date.now() - startedAt),
      },
      requestId,
    });
    throw error;
  }
};
const validPathForStore = (path: TerminalStoreOrganizationPathRead, storeProjectRef: string): boolean =>
  path.projectRef === storeProjectRef &&
  path.projectRef.length > 0 &&
  path.regionRef.length > 0 &&
  path.commercialGroupRef.length > 0 &&
  path.projectUpdatedAtEpochMillis >= 0 &&
  path.regionUpdatedAtEpochMillis >= 0 &&
  path.commercialGroupUpdatedAtEpochMillis >= 0;

export const createProjectBasicActor = (): readonly ActorDefinition[] => {
  const activeLoads = new Set<string>();
  const completedLoads = new Set<string>();
  const activeUpdateRequests = new Set<string>();
  let organizationReadGeneration = 0;
  const latestNotificationByTopic = new Map<string, string>();
  const bindingKey = (binding: StoreBasicBinding): string =>
    `${binding.terminalRef}:${binding.bindingGeneration}:${binding.storeRef}`;
  const setTopic = (
    context: ActorExecutionContext,
    input: Readonly<{
      topicKey: keyof ProjectBasicState['readStates'];
      status: 'idle' | 'loading' | 'loaded' | 'failed';
      errorCode?: string | null;
    }>,
  ): void => {
    const {topicKey, status, errorCode} = input;
    context.dispatchAction(projectBasicActions.setTopicState({topicKey, status, errorCode}));
  };
  const setReadiness = (
    context: ActorExecutionContext,
    input: Readonly<{
      binding: StoreBasicBinding;
      status: ProjectBasicState['loadReadiness']['status'];
      projectRef: string | null;
    }>,
  ): void => {
    const {binding, status, projectRef} = input;
    context.dispatchAction(
      projectBasicActions.setLoadReadiness(Object.freeze({runtimeId: context.runtimeId, binding, status, projectRef})),
    );
  };
  const markOrganizationFailed = (context: ActorExecutionContext, binding: StoreBasicBinding, reason: string): void => {
    setReadiness(context, {binding, status: 'failed', projectRef: null});
    for (const topicKey of orgTopicKeys) setTopic(context, {topicKey, status: 'failed', errorCode: reason});
    log(context, {event: 'organization-refresh-failed', data: {reason}});
  };
  const applyOrganizationPath = (
    context: ActorExecutionContext,
    path: TerminalStoreOrganizationPathRead,
    previousPath: TerminalStoreOrganizationPathRead | null,
  ): void => {
    context.dispatchAction(
      projectBasicActions.setOrganizationPath(
        Object.freeze({value: path, updatedAtEpochMillis: path.projectUpdatedAtEpochMillis}),
      ),
    );
    if (
      previousPath?.projectRef !== path.projectRef ||
      previousPath?.projectUpdatedAtEpochMillis !== path.projectUpdatedAtEpochMillis
    ) {
      const empty = Object.freeze({
        contextIdentity: null,
        selectedSpace: null,
        projectRef: null,
        collectionHash: null,
        items: Object.freeze([]),
      });
      context.dispatchAction(projectBasicActions.setRuleSnapshot(empty));
      context.dispatchAction(
        projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'empty', errorCode: null})),
      );
    }
  };
  const subscribe = async (
    context: ActorExecutionContext,
    input: Readonly<{topicKey: TerminalTopicKey; ownerRef: string; initialTimeEpochMillis: number}>,
  ): Promise<boolean> => {
    const {topicKey, ownerRef, initialTimeEpochMillis} = input;
    const result = await context.dispatchCommand(
      subscribeTerminalTopicCommand,
      {subscriberKey: moduleName, topicKey, ownerRef, initialTimeEpochMillis},
      {requestId: childRequestId(context)},
    );
    return result.status === 'completed' && ['subscribed', 'already-subscribed'].includes(childStatus(result) ?? '');
  };
  const unsubscribe = async (
    context: ActorExecutionContext,
    topicKey: TerminalTopicKey,
    ownerRef: string,
  ): Promise<boolean> => {
    const result = await context.dispatchCommand(
      unsubscribeTerminalTopicCommand,
      {subscriberKey: moduleName, topicKey, ownerRef},
      {requestId: childRequestId(context)},
    );
    return result.status === 'completed' && ['unsubscribed', 'not-subscribed'].includes(childStatus(result) ?? '');
  };
  const refreshRules = createProjectRuleSnapshotRefresher({
    isCurrentMasterBinding,
    currentStoreIsReady,
    readState,
    subscribe,
    unsubscribe,
    readOperation,
    log,
  });
  const loadProject = createLoadProjectContext({
    activeLoads,
    completedLoads,
    currentBinding,
    sameBinding,
    currentStoreIsReady,
    isCurrentMasterBinding,
    bindingKey,
    readState,
    beginOrganizationRead: (context, binding) => {
      const organizationRead = ++organizationReadGeneration;
      return () =>
        organizationRead === organizationReadGeneration &&
        isCurrentMasterBinding(context, binding) &&
        currentStoreIsReady(context, binding);
    },
    log,
    setBinding: (context, binding) => context.dispatchAction(projectBasicActions.setBinding(binding)),
    flush,
    setReadiness,
    setTopic,
    readOperation,
    markOrganizationFailed,
    applyOrganizationPath,
    validPathForStore,
    subscribe,
    unsubscribe,
    refreshRules,
  });
  const evaluateUpdate = async (context: ActorExecutionContext): Promise<StateJsonValue> => {
    const state = context.getState();
    const binding = selectStoreBasicBinding(state);
    if (binding === null || selectProjectTerminalUpdateContextFacts(state) === null) return {status: 'not-ready'};
    const projectState = readState(context);
    if (projectState.ruleSnapshotStatus.status !== 'ready') return {status: 'not-ready'};
    const currentTask = selectTerminalUpdateTask(context.getState());
    if (currentTask !== null && (currentTask.phase !== 'fixed' || currentTask.actionId !== null))
      return {status: 'fixed-task-present'};
    let target: ReturnType<typeof fixedTargetFromProjectCandidate> | null = null;
    if (currentTask === null) {
      const actual = selectTerminalUpdateActualVersions(context.getState());
      if (actual?.applicationId === null || actual?.applicationId === undefined || actual.applicationId.length === 0)
        return {status: 'actual-application-unavailable'};
      const candidate = selectProjectTerminalUpdateCandidate(
        context.getState(),
        actual.applicationId,
        binding.storeRef,
      );
      target = candidate === null ? null : fixedTargetFromProjectCandidate(candidate);
    }
    const requestKey = JSON.stringify([
      binding.terminalRef,
      binding.bindingGeneration,
      projectState.ruleSnapshot.contextIdentity,
      projectState.ruleSnapshot.collectionHash,
      currentTask === null ? target : ['resume-fixed-task', currentTask.taskId],
    ]);
    if (activeUpdateRequests.has(requestKey)) return {status: 'already-requested'};
    activeUpdateRequests.add(requestKey);
    try {
      const payload = createRequestTerminalUpdatePayload(target);
      const requestId = childRequestId(context);
      const startedAt = Date.now();
      log(context, {event: 'terminal-update-request-started', data: {candidatePresent: target !== null}, requestId});
      const dispatched = await context.dispatchCommand(requestTerminalUpdateCommand, payload, {requestId});
      const result = childResult(dispatched);
      log(context, {
        event: 'terminal-update-requested',
        data: {
          dispatchStatus: dispatched.status,
          candidatePresent: target !== null,
          resultStatus: childStatus(dispatched) ?? 'unavailable',
          reasonCode: childReasonCode(dispatched),
          elapsedMs: Math.max(0, Date.now() - startedAt),
        },
        requestId,
      });
      return result ?? {status: 'request-failed', dispatchStatus: dispatched.status};
    } finally {
      activeUpdateRequests.delete(requestKey);
    }
  };
  const onTopicChanged = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    notification: TerminalTopicChangedPayload['notification'],
  ): Promise<StateJsonValue> => {
    if (!isCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
    const current = readState(context);
    const path = current.organizationPath?.value;
    if (path === undefined) return {status: 'not-ready'};
    const notificationKey = `${notification.topicKey}:${notification.ownerRef}`;
    latestNotificationByTopic.set(notificationKey, notification.notificationId);
    let organizationRead: number | null = null;
    const isLatest = () =>
      latestNotificationByTopic.get(notificationKey) === notification.notificationId &&
      isCurrentMasterBinding(context, binding) &&
      (organizationRead === null || organizationRead === organizationReadGeneration);
    if (orgTopicKeys.includes(notification.topicKey as (typeof orgTopicKeys)[number])) {
      organizationRead = ++organizationReadGeneration;
      setReadiness(context, {binding, status: 'loading', projectRef: null});
      for (const topicKey of orgTopicKeys) setTopic(context, {topicKey, status: 'loading'});
      const read = await readOperation(context, {
        operationId: 'terminalReadStoreOrganizationPath',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!isLatest()) return {status: 'stale-result'};
      if (read?.kind !== 'success') {
        const reason =
          read?.kind === 'business-rejection'
            ? read.errorCode
            : read?.kind === 'failure'
              ? read.code
              : 'ORGANIZATION_PATH_READ_FAILED';
        markOrganizationFailed(context, binding, reason);
        return {status: 'organization-read-failed', reason};
      }
      const nextPath = read.body as TerminalStoreOrganizationPathRead;
      const store = selectStore(context.getState());
      if (store === null || !validPathForStore(nextPath, store.value.project.id)) {
        markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_MISMATCH');
        return {status: 'organization-path-mismatch'};
      }
      context.dispatchAction(
        projectBasicActions.setOrganizationPath(
          Object.freeze({value: nextPath, updatedAtEpochMillis: nextPath.projectUpdatedAtEpochMillis}),
        ),
      );
      if (
        nextPath.projectRef !== path.projectRef ||
        nextPath.projectUpdatedAtEpochMillis !== path.projectUpdatedAtEpochMillis
      ) {
        const empty = Object.freeze({
          contextIdentity: null,
          selectedSpace: null,
          projectRef: null,
          collectionHash: null,
          items: Object.freeze([]),
        });
        context.dispatchAction(projectBasicActions.setRuleSnapshot(empty));
        context.dispatchAction(
          projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'empty', errorCode: null})),
        );
      }
      try {
        await flush(context);
      } catch {
        markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_FLUSH_FAILED');
        return {status: 'persistence-failed'};
      }
      if (!isLatest()) return {status: 'stale-result'};
      setReadiness(context, {binding, status: 'flushed', projectRef: nextPath.projectRef});
      const orgSubscriptionsReady = await reconcileProjectTopicSubscriptions({
        context,
        path: nextPath,
        isCurrent: isLatest,
        subscribe,
        unsubscribe,
      });
      if (!isLatest()) return {status: 'stale-result'};
      if (!orgSubscriptionsReady) return {status: 'organization-subscribe-failed'};
      if (
        nextPath.projectRef !== path.projectRef ||
        nextPath.projectUpdatedAtEpochMillis !== path.projectUpdatedAtEpochMillis
      ) {
        const refreshed = await refreshRules(context, binding, nextPath);
        if (!isLatest()) return {status: 'stale-result'};
        if (refreshed.status !== 'ready') return refreshed;
      }
    } else if (notification.topicKey === terminalUpdateTopicKey && notification.ownerRef === path.projectRef) {
      const refreshed = await refreshRules(context, binding, path);
      if (refreshed.status !== 'ready') return refreshed;
    } else return {status: 'unowned-topic'};
    if (!isLatest()) return {status: 'stale-result'};
    const accepted = await context.dispatchCommand(
      acceptTerminalTopicNotificationCommand,
      {
        subscriberKey: moduleName,
        subscriptionId: notification.subscriptionId,
        notificationId: notification.notificationId,
      },
      {requestId: childRequestId(context)},
    );
    if (!isLatest()) return {status: 'stale-result'};
    const acceptedStatus = childStatus(accepted);
    const wasAccepted =
      accepted.status === 'completed' && ['accepted', 'accepted-locally'].includes(acceptedStatus ?? '');
    if (!wasAccepted) {
      // Earlier branches return for every topic not owned by project-basic.
      setTopic(context, {
        topicKey: notification.topicKey as keyof ProjectBasicState['readStates'],
        status: 'failed',
        errorCode: 'TOPIC_ACCEPT_FAILED',
      });
      log(context, {
        event: 'topic-notification-accept-failed',
        data: {
          topicKey: notification.topicKey,
          dispatchStatus: accepted.status,
          resultStatus: acceptedStatus,
        },
      });
    }
    return Object.freeze({status: wasAccepted ? 'refreshed' : 'accept-failed'});
  };

  return [
    defineActor(moduleName, 'project-basic', [
      onCommand(initializeProjectBasicCommand, async context => {
        const result = await context.dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {
          requestId: childRequestId(context),
        });
        return Object.freeze({
          status: result.status === 'completed' ? 'store-initialization-requested' : 'store-initialization-failed',
        });
      }),
      onCommand(storeBasicInformationLoadedCommand, context => loadProject(context, context.command.payload)),
      onCommand(terminalActivationSucceededCommand, async context => {
        const init = await context.dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {
          requestId: childRequestId(context),
        });
        return Object.freeze({
          status: init.status === 'completed' ? 'store-initialization-requested' : 'store-initialization-failed',
        });
      }),
      onCommand(refreshProjectBasicTopicCommand, context => {
        const payload = context.command.payload;
        return onTopicChanged(context, payload.binding, payload.notification);
      }),
      onCommand(refreshProjectTerminalUpdateRulesCommand, async context => {
        const binding = currentBinding(context);
        const path = readState(context).organizationPath?.value;
        if (binding === null || path === undefined) return {status: 'not-ready'};
        return refreshRules(context, binding, path);
      }),
      onCommand(evaluateProjectTerminalUpdateCommand, context => evaluateUpdate(context)),
      onCommand(terminalTopicChangedCommand, async context => {
        const payload = context.command.payload;
        if (payload.subscriberKey !== moduleName) return {status: 'other-subscriber'};
        const binding = currentBinding(context);
        if (
          binding === null ||
          payload.terminalRef !== binding.terminalRef ||
          payload.bindingGeneration !== binding.bindingGeneration
        )
          return {status: 'stale-binding'};
        const result = await context.dispatchCommand(
          refreshProjectBasicTopicCommand,
          {binding, notification: payload.notification},
          {requestId: childRequestId(context)},
        );
        return result.status === 'completed'
          ? (childResult(result) ?? {status: 'refresh-failed'})
          : {status: 'refresh-failed'};
      }),
    ]),
  ];
};
