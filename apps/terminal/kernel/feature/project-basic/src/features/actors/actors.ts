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
  readTerminalDataCommand,
  selectActivationState,
  selectTerminalTopicSubscriptions,
  subscribeTerminalTopicCommand,
  terminalActivationSucceededCommand,
  terminalTopicChangedCommand,
  unsubscribeTerminalTopicCommand,
  type TerminalActivationSucceededPayload,
  type TerminalDataReadPayload,
  type TerminalOperationResult,
  type TerminalReadOperationId,
  type TerminalStoreOrganizationPathRead,
  type TerminalTopicChangedPayload,
  type TerminalTopicKey,
  type TerminalUpdateRuleSnapshotItem,
  type TerminalUpdateRuleSnapshotPage,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  initializeStoreBasicCommand,
  selectStore,
  selectStoreBasicBinding,
  selectStoreBasicLoadReadiness,
  storeBasicInformationLoadedCommand,
  type StoreBasicBinding,
} from '@catering-v2s/kernel-feature-store-basic';
import {moduleName} from '../../moduleName';
import {
  fixedTargetFromProjectCandidate,
  selectProjectBasicState,
  selectProjectTerminalUpdateCandidate,
  selectProjectTerminalUpdateContextFacts,
} from '../../selectors/selectors';
import {projectBasicActions, projectBasicContextIdentity} from '../slices/slice';
import type {ProjectBasicState, StoredTerminalUpdateArtifactSummary, StoredTerminalUpdateRule} from '../../types/types';
import {
  initializeProjectBasicCommand,
  evaluateProjectTerminalUpdateCommand,
  refreshProjectBasicTopicCommand,
  refreshProjectTerminalUpdateRulesCommand,
} from '../commands/commands';

const orgTopicKeys = ['PROJECT', 'REGION', 'COMMERCIAL_GROUP'] as const;
const terminalUpdateTopicKey = 'TERMINAL_UPDATE_RULES' as const;
const snapshotPageLimit = 100;
const snapshotPageByteLimit = 1_048_576;
const snapshotTotalByteLimit = 8_388_608;

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
  request: TerminalDataReadPayload,
): Promise<TerminalOperationResult<TerminalReadOperationId> | null> => {
  const requestId = childRequestId(context);
  const startedAt = Date.now();
  log(context, {event: 'owner-read-started', data: {operationId: request.operationId}, requestId});
  try {
    const dispatched = await context.dispatchCommand(readTerminalDataCommand, request, {requestId});
    const result = childResult(dispatched);
    const resultKind = isRecord(result) && typeof result.kind === 'string' ? result.kind : 'invalid';
    const errorCode =
      isRecord(result) && typeof result.errorCode === 'string'
        ? result.errorCode
        : isRecord(result) && typeof result.code === 'string'
          ? result.code
          : null;
    log(context, {
      event: 'owner-read-completed',
      data: {
        operationId: request.operationId,
        dispatchStatus: dispatched.status,
        resultKind,
        errorCode,
        elapsedMs: Math.max(0, Date.now() - startedAt),
      },
      requestId,
    });
    if (
      dispatched.status !== 'completed' ||
      typeof result !== 'object' ||
      result === null ||
      Array.isArray(result) ||
      !('kind' in result)
    )
      return null;
    return result as TerminalOperationResult<TerminalReadOperationId>;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const jsonByteLength = (value: unknown): number => {
  const json = JSON.stringify(value);
  let bytes = 0;
  for (let index = 0; index < json.length; index += 1) {
    const code = json.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
      continue;
    }
    if (code < 0x800) {
      bytes += 2;
      continue;
    }
    const isHighSurrogate =
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < json.length &&
      json.charCodeAt(index + 1) >= 0xdc00 &&
      json.charCodeAt(index + 1) <= 0xdfff;
    if (isHighSurrogate) {
      bytes += 4;
      index += 1;
      continue;
    }
    bytes += 3;
  }
  return bytes;
};
const snapshotArtifact = (value: unknown): StoredTerminalUpdateArtifactSummary | null => {
  if (
    !isRecord(value) ||
    typeof value.artifactRef !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.applicationId !== 'string' ||
    typeof value.runtimeVersion !== 'string' ||
    !Number.isSafeInteger(value.nativeBuildNumber) ||
    typeof value.apkVersion !== 'string' ||
    typeof value.jsVersion !== 'string' ||
    typeof value.publicationId !== 'string' ||
    !(value.apkSha256 === null || (typeof value.apkSha256 === 'string' && /^[a-f0-9]{64}$/u.test(value.apkSha256))) ||
    typeof value.zipSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.zipSha256) ||
    !Number.isSafeInteger(value.byteSize) ||
    !Number.isSafeInteger(value.createdAtEpochMillis)
  )
    return null;
  if ((value.kind !== 'FULL' && value.kind !== 'HOT') || (value.kind === 'FULL') !== (value.apkSha256 !== null))
    return null;
  return Object.freeze({
    artifactRef: value.artifactRef,
    kind: value.kind,
    applicationId: value.applicationId,
    runtimeVersion: value.runtimeVersion,
    nativeBuildNumber: value.nativeBuildNumber as number,
    apkVersion: value.apkVersion,
    jsVersion: value.jsVersion,
    publicationId: value.publicationId,
    apkSha256: value.apkSha256 as string | null,
    zipSha256: value.zipSha256,
    byteSize: value.byteSize as number,
    createdAtEpochMillis: value.createdAtEpochMillis as number,
  });
};
const storedSnapshotRule = (item: TerminalUpdateRuleSnapshotItem): StoredTerminalUpdateRule | null => {
  const full = snapshotArtifact(item.full);
  const hot = item.hot === null ? null : snapshotArtifact(item.hot);
  if (
    typeof item.ruleRef !== 'string' ||
    item.ruleRef.length === 0 ||
    (item.targetMode !== 'ALL' && item.targetMode !== 'STORE_REFS') ||
    !Array.isArray(item.storeRefs) ||
    item.storeRefs.some(value => typeof value !== 'string') ||
    typeof item.applicationId !== 'string' ||
    item.applicationId.length === 0 ||
    !Number.isSafeInteger(item.createdAtEpochMillis) ||
    item.createdAtEpochMillis < 0 ||
    full === null ||
    full.kind !== 'FULL' ||
    (item.hot !== null && (hot === null || hot.kind !== 'HOT')) ||
    !Number.isSafeInteger(item.nSeconds) ||
    item.nSeconds < 60 ||
    item.nSeconds > 86_400 ||
    (item.hot === null
      ? item.hotStrategy !== null || item.mSeconds !== null
      : item.hotStrategy === 'IMMEDIATE'
        ? item.mSeconds !== null
        : item.hotStrategy !== 'IDLE' ||
          item.mSeconds === null ||
          !Number.isSafeInteger(item.mSeconds) ||
          item.mSeconds < 60 ||
          item.mSeconds > 86_400) ||
    (item.description !== null && typeof item.description !== 'string')
  )
    return null;
  return Object.freeze({
    ruleRef: item.ruleRef,
    targetMode: item.targetMode,
    storeRefs: Object.freeze([...item.storeRefs]),
    applicationId: item.applicationId,
    createdAtEpochMillis: item.createdAtEpochMillis,
    full,
    hot,
    nSeconds: item.nSeconds,
    hotStrategy: item.hotStrategy,
    mSeconds: item.mSeconds,
    description: item.description,
  });
};

export const createProjectBasicActors = (): readonly ActorDefinition[] => {
  const activeLoads = new Set<string>();
  const completedLoads = new Set<string>();
  const activeUpdateRequests = new Set<string>();
  let ruleRefreshGeneration = 0;
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
  const reconcilePathTopics = async (
    context: ActorExecutionContext,
    path: TerminalStoreOrganizationPathRead,
    isCurrent: () => boolean = () => true,
  ): Promise<boolean> => {
    const desired = new Map<TerminalTopicKey, {ownerRef: string; updatedAt: number}>([
      ['PROJECT', {ownerRef: path.projectRef, updatedAt: path.projectUpdatedAtEpochMillis}],
      ['REGION', {ownerRef: path.regionRef, updatedAt: path.regionUpdatedAtEpochMillis}],
      ['COMMERCIAL_GROUP', {ownerRef: path.commercialGroupRef, updatedAt: path.commercialGroupUpdatedAtEpochMillis}],
    ]);
    let succeeded = true;
    const current = selectTerminalTopicSubscriptions(context.getState()).filter(
      item =>
        item.subscriberKey === moduleName && orgTopicKeys.includes(item.topicKey as (typeof orgTopicKeys)[number]),
    );
    for (const item of current) {
      if (!isCurrent()) return false;
      const next = desired.get(item.topicKey);
      if (next === undefined || next.ownerRef !== item.ownerRef) {
        const removed = await unsubscribe(context, item.topicKey, item.ownerRef);
        if (!isCurrent()) return false;
        succeeded = removed && succeeded;
      }
    }
    for (const [topicKey, value] of desired) {
      if (!isCurrent()) return false;
      const exists = selectTerminalTopicSubscriptions(context.getState()).some(
        item => item.subscriberKey === moduleName && item.topicKey === topicKey && item.ownerRef === value.ownerRef,
      );
      if (!exists) {
        const added = await subscribe(context, {
            topicKey,
            ownerRef: value.ownerRef,
            initialTimeEpochMillis: value.updatedAt,
          });
        if (!isCurrent()) return false;
        succeeded = added && succeeded;
      }
    }
    if (!isCurrent()) return false;
    for (const topicKey of orgTopicKeys)
      setTopic(context, {
        topicKey,
        status: succeeded ? 'loaded' : 'failed',
        errorCode: succeeded ? null : 'TOPIC_SUBSCRIPTION_FAILED',
      });
    return succeeded;
  };
  const ensureRulesSubscription = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    projectRef: string,
  ): Promise<boolean> => {
    const accepted = selectTerminalTopicSubscriptions(context.getState()).find(
      item =>
        item.subscriberKey === moduleName && item.topicKey === terminalUpdateTopicKey && item.ownerRef === projectRef,
    );
    const subscriptions = selectTerminalTopicSubscriptions(context.getState()).filter(
      item =>
        item.subscriberKey === moduleName && item.topicKey === terminalUpdateTopicKey && item.ownerRef !== projectRef,
    );
    let removed = true;
    for (const item of subscriptions)
      removed = (await unsubscribe(context, terminalUpdateTopicKey, item.ownerRef)) && removed;
    if (!removed || !isCurrentMasterBinding(context, binding)) return false;
    if (accepted !== undefined) return true;
    return subscribe(context, {topicKey: terminalUpdateTopicKey, ownerRef: projectRef, initialTimeEpochMillis: 0});
  };
  const persistRuleSnapshot = async (
    context: ActorExecutionContext,
    snapshot: ProjectBasicState['ruleSnapshot'],
  ): Promise<boolean> => {
    context.dispatchAction(projectBasicActions.setRuleSnapshot(snapshot));
    try {
      await flush(context);
      return true;
    } catch {
      return false;
    }
  };
  const failRuleRefresh = (
    context: ActorExecutionContext,
    generation: number,
    reason: string,
  ): Readonly<{status: string; reason?: string}> => {
    if (generation !== ruleRefreshGeneration) return {status: 'stale-refresh'};
    context.dispatchAction(
      projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'failed', errorCode: reason})),
    );
    setTopic(context, {topicKey: terminalUpdateTopicKey, status: 'failed', errorCode: reason});
    log(context, {event: 'rules-snapshot-failed', data: {reasonCode: reason}});
    return {status: 'failed', reason};
  };
  const failChangedRuleSnapshot = (
    context: ActorExecutionContext,
    generation: number,
  ): Promise<Readonly<{status: string; reason?: string}>> => {
    return Promise.resolve(failRuleRefresh(context, generation, 'SNAPSHOT_COLLECTION_CHANGED'));
  };
  const refreshRules = async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    path: TerminalStoreOrganizationPathRead,
  ): Promise<Readonly<{status: string; reason?: string}>> => {
    if (!isCurrentMasterBinding(context, binding) || !currentStoreIsReady(context, binding))
      return {status: 'stale-binding'};
    const generation = ++ruleRefreshGeneration;
    const isLatest = () => generation === ruleRefreshGeneration;
    const currentIdentity = projectBasicContextIdentity(binding, path);
    const isCurrentContext = () => {
      const current = readState(context);
      const currentPath = current.organizationPath?.value;
      return (
        isLatest() &&
        isCurrentMasterBinding(context, binding) &&
        currentStoreIsReady(context, binding) &&
        currentPath?.projectRef === path.projectRef &&
        projectBasicContextIdentity(binding, currentPath ?? path) === currentIdentity
      );
    };
    const previous = readState(context).ruleSnapshot;
    context.dispatchAction(
      projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'loading', errorCode: null})),
    );
    if (previous.contextIdentity !== currentIdentity || previous.projectRef !== path.projectRef) {
      const cleared = Object.freeze({
        contextIdentity: currentIdentity,
        selectedSpace: binding.groupWorkspaceKey,
        projectRef: path.projectRef,
        collectionHash: null,
        items: Object.freeze([]),
      });
      if (!(await persistRuleSnapshot(context, cleared))) {
        failRuleRefresh(context, generation, 'RULE_SNAPSHOT_FLUSH_FAILED');
        return {status: 'persistence-failed'};
      }
      if (!isLatest()) return {status: 'stale-refresh'};
    }
    const subscriptionReady = await ensureRulesSubscription(context, binding, path.projectRef);
    if (!isCurrentContext()) return {status: 'stale-context'};
    if (!subscriptionReady) return failRuleRefresh(context, generation, 'RULE_TOPIC_SUBSCRIPTION_FAILED');
    for (let attempt = 1; attempt <= 3; attempt++) {
      let cursor: string | null = null;
      let collectionHash: string | null = null;
      const seen = new Set<string>();
      const items: StoredTerminalUpdateRule[] = [];
      let totalBytes = 0;
      let changed = false;
      do {
        const result = await readOperation(context, {
          operationId: 'terminalReadProjectUpdateRuleSnapshotPage',
          pathParameters: {projectRef: path.projectRef},
          queryParameters: {collectionHash, cursor, limit: snapshotPageLimit},
        });
        if (!isCurrentContext()) return {status: 'stale-context'};
        if (result?.kind === 'business-rejection' && result.errorCode === 'TERMINAL_UPDATE_SNAPSHOT_CHANGED') {
          changed = true;
          break;
        }
        if (result?.kind !== 'success') {
          const reason = result?.kind === 'business-rejection' ? result.errorCode : 'RULE_SNAPSHOT_READ_FAILED';
          return failRuleRefresh(context, generation, reason);
        }
        const page = result.body as TerminalUpdateRuleSnapshotPage;
        const bytes = jsonByteLength(page);
        totalBytes += bytes;
        if (bytes > snapshotPageByteLimit || totalBytes > snapshotTotalByteLimit) {
          const reason = bytes > snapshotPageByteLimit ? 'SNAPSHOT_PAGE_TOO_LARGE' : 'SNAPSHOT_TOO_LARGE';
          return failRuleRefresh(context, generation, reason);
        }
        if (collectionHash === null) collectionHash = page.collectionHash;
        if (page.collectionHash !== collectionHash) {
          changed = true;
          break;
        }
        for (const item of page.items) {
          const stored = storedSnapshotRule(item);
          if (stored === null) {
            const reason = 'SNAPSHOT_ITEM_INVALID';
            return failRuleRefresh(context, generation, reason);
          }
          items.push(stored);
        }
        cursor = page.nextCursor;
        if (cursor !== null && seen.has(cursor)) {
          const reason = 'SNAPSHOT_CURSOR_REPEATED';
          return failRuleRefresh(context, generation, reason);
        }
        if (cursor !== null) seen.add(cursor);
      } while (cursor !== null);
      if (changed) {
        if (attempt < 3) continue;
        return failChangedRuleSnapshot(context, generation);
      }
      if (!isCurrentContext()) return {status: 'stale-context'};
      if (new Set(items.map(item => item.ruleRef)).size !== items.length)
        return failRuleRefresh(context, generation, 'SNAPSHOT_DUPLICATE_RULE');
      const ready = Object.freeze({
        contextIdentity: currentIdentity,
        selectedSpace: binding.groupWorkspaceKey,
        projectRef: path.projectRef,
        collectionHash,
        items: Object.freeze(items),
      });
      if (!(await persistRuleSnapshot(context, ready))) {
        failRuleRefresh(context, generation, 'RULE_SNAPSHOT_FLUSH_FAILED');
        return {status: 'persistence-failed', reason: 'RULE_SNAPSHOT_FLUSH_FAILED'};
      }
      if (!isCurrentContext()) return {status: 'stale-context'};
      context.dispatchAction(
        projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'ready', errorCode: null})),
      );
      setTopic(context, {topicKey: terminalUpdateTopicKey, status: 'loaded'});
      log(context, {
        event: 'rules-snapshot-ready',
        data: {
          itemCount: items.length,
          collectionHashPresent: collectionHash !== null,
          attempt,
        },
      });
      return {status: 'ready'};
    }
    return failChangedRuleSnapshot(context, generation);
  };
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
      const candidate = selectProjectTerminalUpdateCandidate(context.getState(), actual.applicationId, binding.storeRef);
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
  const loadProject = async (
    context: ActorExecutionContext,
    requestedBinding: TerminalActivationSucceededPayload,
  ): Promise<StateJsonValue> => {
    const binding = currentBinding(context);
    if (
      binding === null ||
      !sameBinding(binding, requestedBinding) ||
      !currentStoreIsReady(context, binding) ||
      !isCurrentMasterBinding(context, binding)
    )
      return {status: 'store-prerequisite-missing'};
    const loadStartedAt = Date.now();
    log(context, {event: 'organization-load-started', data: {projectBasicReady: false}});
    const key = bindingKey(binding);
    if (
      completedLoads.has(key) &&
      readState(context).loadReadiness.runtimeId === context.runtimeId &&
      sameBinding(readState(context).loadReadiness.binding, binding)
    )
      return {status: 'already-loaded'};
    if (activeLoads.has(key)) return {status: 'already-loading'};
    activeLoads.add(key);
    const organizationRead = ++organizationReadGeneration;
    const isCurrentOrganizationRead = () =>
      organizationRead === organizationReadGeneration &&
      isCurrentMasterBinding(context, binding) &&
      currentStoreIsReady(context, binding);
    try {
      const current = readState(context);
      if (!sameBinding(current.binding, binding)) {
        context.dispatchAction(projectBasicActions.setBinding(binding));
        try {
          await flush(context);
        } catch {
          return {status: 'persistence-failed'};
        }
        if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      }
      setReadiness(context, {binding, status: 'loading', projectRef: null});
      for (const keyTopic of orgTopicKeys) setTopic(context, {topicKey: keyTopic, status: 'loading'});
      const result = await readOperation(context, {
        operationId: 'terminalReadStoreOrganizationPath',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      if (result?.kind !== 'success') {
        const reason = result?.kind === 'business-rejection' ? result.errorCode : 'ORGANIZATION_PATH_READ_FAILED';
        markOrganizationFailed(context, binding, reason);
        return {status: 'organization-read-failed', reason};
      }
      const path = result.body as TerminalStoreOrganizationPathRead;
      const store = selectStore(context.getState());
      if (store === null || !validPathForStore(path, store.value.project.id)) {
        markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_MISMATCH');
        return {status: 'organization-path-mismatch'};
      }
      const previousPath = readState(context).organizationPath?.value;
      context.dispatchAction(
        projectBasicActions.setOrganizationPath(
          Object.freeze({value: path, updatedAtEpochMillis: path.projectUpdatedAtEpochMillis}),
        ),
      );
      try {
        await flush(context);
      } catch {
        markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_FLUSH_FAILED');
        return {status: 'persistence-failed'};
      }
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      setReadiness(context, {binding, status: 'flushed', projectRef: path.projectRef});
      const orgSubscriptionsReady = await reconcilePathTopics(context, path, isCurrentOrganizationRead);
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      if (!orgSubscriptionsReady) return {status: 'organization-subscribe-failed'};
      const refreshed = await refreshRules(context, binding, path);
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      if (refreshed.status === 'ready') completedLoads.add(key);
      log(context, {
        event: 'organization-load-complete',
        data: {
          status: refreshed.status,
          projectRefMatchesStore: path.projectRef === store.value.project.id,
          projectChanged: previousPath?.projectRef !== path.projectRef,
          elapsedMs: Math.max(0, Date.now() - loadStartedAt),
        },
      });
      return refreshed;
    } finally {
      activeLoads.delete(key);
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
        const reason = read?.kind === 'business-rejection' ? read.errorCode : 'ORGANIZATION_PATH_READ_FAILED';
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
      const orgSubscriptionsReady = await reconcilePathTopics(context, nextPath, isLatest);
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
