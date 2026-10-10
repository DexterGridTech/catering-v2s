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
  left !== null && right !== null && left.terminalRef === right.terminalRef && left.storeRef === right.storeRef &&
  left.groupWorkspaceKey === right.groupWorkspaceKey && left.bindingGeneration === right.bindingGeneration;
const currentBinding = (context: ActorExecutionContext): StoreBasicBinding | null => {
  const activation = selectActivationState(context.getState());
  if (activation.status !== 'active' || activation.terminalRef === null || activation.storeRef === null ||
      activation.groupWorkspaceKey === null || activation.bindingGeneration === null) return null;
  return Object.freeze({terminalRef: activation.terminalRef, storeRef: activation.storeRef,
    groupWorkspaceKey: activation.groupWorkspaceKey, bindingGeneration: activation.bindingGeneration});
};
const isCurrentMasterBinding = (context: ActorExecutionContext, binding: StoreBasicBinding): boolean =>
  selectRuntimeInstanceMode(context.getState()) === 'MASTER' && sameBinding(currentBinding(context), binding) &&
  sameBinding(selectStoreBasicBinding(context.getState()), binding);
const currentStoreIsReady = (context: ActorExecutionContext, binding: StoreBasicBinding): boolean => {
  const readiness = selectStoreBasicLoadReadiness(context.getState());
  const store = selectStore(context.getState());
  return readiness.runtimeId === context.runtimeId && sameBinding(readiness.binding, binding) &&
    readiness.storeStatus === 'flushed' && store !== null && store.value.id === binding.storeRef &&
    store.value.groupWorkspaceKey === binding.groupWorkspaceKey && store.value.project.id.length > 0;
};
const readState = (context: ActorExecutionContext): ProjectBasicState => selectProjectBasicState(context.getState());
const childRequestId = (context: ActorExecutionContext) => context.command.requestId ?? createRequestId();
const childResult = (result: CommandDispatchResult): StateJsonValue | null =>
  result.actorResults.length === 1 && result.actorResults[0]?.status === 'completed' ? result.actorResults[0].result : null;
const childStatus = (result: CommandDispatchResult): string | null => {
  const value = childResult(result);
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'status' in value ? String(value.status) : null;
};
const flush = async (context: ActorExecutionContext): Promise<void> => {
  const result = await context.flushPersistence();
  if (result.status !== 'succeeded') throw new Error(`PROJECT_BASIC_PERSISTENCE_${result.status.toUpperCase()}`);
};
const log = (context: ActorExecutionContext, event: string, data: Readonly<Record<string, string | number | boolean | null>>): void => {
  context.platformPorts.logger.scope({moduleName, layer: 'kernel', subsystem: 'project-basic', component: 'data-read'}).info({
    category: 'terminal.project-basic.read', event, message: 'Project basic owner data operation',
    context: {commandId: context.command.commandId}, data,
  });
};
const readOperation = async (context: ActorExecutionContext, request: TerminalDataReadPayload): Promise<TerminalOperationResult<TerminalReadOperationId> | null> => {
  const dispatched = await context.dispatchCommand(readTerminalDataCommand, request, {requestId: childRequestId(context)});
  const result = childResult(dispatched);
  if (dispatched.status !== 'completed' || typeof result !== 'object' || result === null || Array.isArray(result) || !('kind' in result)) return null;
  return result as TerminalOperationResult<TerminalReadOperationId>;
};
const validPathForStore = (path: TerminalStoreOrganizationPathRead, storeProjectRef: string): boolean =>
  path.projectRef === storeProjectRef && path.projectRef.length > 0 && path.regionRef.length > 0 &&
  path.commercialGroupRef.length > 0 && path.projectUpdatedAtEpochMillis >= 0 &&
  path.regionUpdatedAtEpochMillis >= 0 && path.commercialGroupUpdatedAtEpochMillis >= 0;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const jsonByteLength = (value: unknown): number => {
  const json = JSON.stringify(value);
  let bytes = 0;
  for (let index = 0; index < json.length; index += 1) {
    const code = json.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < json.length && json.charCodeAt(index + 1) >= 0xdc00 && json.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index += 1; }
    else bytes += 3;
  }
  return bytes;
};
const snapshotArtifact = (value: unknown): StoredTerminalUpdateArtifactSummary | null => {
  if (!isRecord(value) || typeof value.artifactRef !== 'string' || typeof value.kind !== 'string' ||
      typeof value.applicationId !== 'string' || typeof value.runtimeVersion !== 'string' ||
      !Number.isSafeInteger(value.nativeBuildNumber) || typeof value.apkVersion !== 'string' ||
      typeof value.jsVersion !== 'string' || typeof value.publicationId !== 'string' ||
      !(value.apkSha256 === null || (typeof value.apkSha256 === 'string' && /^[a-f0-9]{64}$/u.test(value.apkSha256))) ||
      typeof value.zipSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.zipSha256) ||
      !Number.isSafeInteger(value.byteSize) || !Number.isSafeInteger(value.createdAtEpochMillis)) return null;
  if ((value.kind !== 'FULL' && value.kind !== 'HOT') || ((value.kind === 'FULL') !== (value.apkSha256 !== null))) return null;
  return Object.freeze({artifactRef: value.artifactRef, kind: value.kind, applicationId: value.applicationId,
    runtimeVersion: value.runtimeVersion, nativeBuildNumber: value.nativeBuildNumber as number,
    apkVersion: value.apkVersion, jsVersion: value.jsVersion, publicationId: value.publicationId,
    apkSha256: value.apkSha256 as string | null, zipSha256: value.zipSha256, byteSize: value.byteSize as number,
    createdAtEpochMillis: value.createdAtEpochMillis as number});
};
const storedSnapshotRule = (item: TerminalUpdateRuleSnapshotItem): StoredTerminalUpdateRule | null => {
  const full = snapshotArtifact(item.full);
  const hot = item.hot === null ? null : snapshotArtifact(item.hot);
  if (typeof item.ruleRef !== 'string' || item.ruleRef.length === 0 ||
      (item.targetMode !== 'ALL' && item.targetMode !== 'STORE_REFS') || !Array.isArray(item.storeRefs) ||
      item.storeRefs.some(value => typeof value !== 'string') || typeof item.applicationId !== 'string' ||
      item.applicationId.length === 0 || !Number.isSafeInteger(item.createdAtEpochMillis) || item.createdAtEpochMillis < 0 ||
      full === null || full.kind !== 'FULL' || (item.hot !== null && (hot === null || hot.kind !== 'HOT')) ||
      !Number.isSafeInteger(item.nSeconds) || item.nSeconds < 60 || item.nSeconds > 86_400 ||
      (item.hot === null ? item.hotStrategy !== null || item.mSeconds !== null : item.hotStrategy === 'IMMEDIATE'
        ? item.mSeconds !== null : item.hotStrategy !== 'IDLE' || item.mSeconds === null ||
          !Number.isSafeInteger(item.mSeconds) || item.mSeconds < 60 || item.mSeconds > 86_400) ||
      (item.description !== null && typeof item.description !== 'string')) return null;
  return Object.freeze({ruleRef: item.ruleRef, targetMode: item.targetMode, storeRefs: Object.freeze([...item.storeRefs]),
    applicationId: item.applicationId, createdAtEpochMillis: item.createdAtEpochMillis, full, hot,
    nSeconds: item.nSeconds, hotStrategy: item.hotStrategy, mSeconds: item.mSeconds, description: item.description});
};

export const createProjectBasicActors = (): readonly ActorDefinition[] => {
  const activeLoads = new Set<string>();
  const completedLoads = new Set<string>();
  const activeUpdateRequests = new Set<string>();
  const latestNotificationByTopic = new Map<string, string>();
  const bindingKey = (binding: StoreBasicBinding): string => `${binding.terminalRef}:${binding.bindingGeneration}:${binding.storeRef}`;
  const setTopic = (context: ActorExecutionContext, topicKey: keyof ProjectBasicState['readStates'], status: 'idle'|'loading'|'loaded'|'failed', errorCode?: string | null): void => {
    context.dispatchAction(projectBasicActions.setTopicState({topicKey, status, errorCode}));
  };
  const setReadiness = (context: ActorExecutionContext, binding: StoreBasicBinding, status: ProjectBasicState['loadReadiness']['status'], projectRef: string | null): void => {
    context.dispatchAction(projectBasicActions.setLoadReadiness(Object.freeze({runtimeId: context.runtimeId, binding, status, projectRef})));
  };
  const markOrganizationFailed = (context: ActorExecutionContext, binding: StoreBasicBinding, reason: string): void => {
    setReadiness(context, binding, 'failed', null);
    for (const topicKey of orgTopicKeys) setTopic(context, topicKey, 'failed', reason);
    log(context, 'organization-refresh-failed', {reason});
  };
  const subscribe = async (context: ActorExecutionContext, topicKey: TerminalTopicKey, ownerRef: string, initialTimeEpochMillis: number): Promise<boolean> => {
    const result = await context.dispatchCommand(subscribeTerminalTopicCommand, {subscriberKey: moduleName, topicKey, ownerRef, initialTimeEpochMillis}, {requestId: childRequestId(context)});
    return result.status === 'completed' && ['subscribed', 'already-subscribed'].includes(childStatus(result) ?? '');
  };
  const unsubscribe = async (context: ActorExecutionContext, topicKey: TerminalTopicKey, ownerRef: string): Promise<boolean> => {
    const result = await context.dispatchCommand(unsubscribeTerminalTopicCommand, {subscriberKey: moduleName, topicKey, ownerRef}, {requestId: childRequestId(context)});
    return result.status === 'completed' && ['unsubscribed', 'not-subscribed'].includes(childStatus(result) ?? '');
  };
  const reconcilePathTopics = async (context: ActorExecutionContext, path: TerminalStoreOrganizationPathRead): Promise<boolean> => {
    const desired = new Map<TerminalTopicKey, {ownerRef: string; updatedAt: number}>([
      ['PROJECT', {ownerRef: path.projectRef, updatedAt: path.projectUpdatedAtEpochMillis}],
      ['REGION', {ownerRef: path.regionRef, updatedAt: path.regionUpdatedAtEpochMillis}],
      ['COMMERCIAL_GROUP', {ownerRef: path.commercialGroupRef, updatedAt: path.commercialGroupUpdatedAtEpochMillis}],
    ]);
    let succeeded = true;
    const current = selectTerminalTopicSubscriptions(context.getState()).filter(item => item.subscriberKey === moduleName && orgTopicKeys.includes(item.topicKey as typeof orgTopicKeys[number]));
    for (const item of current) {
      const next = desired.get(item.topicKey);
      if (next === undefined || next.ownerRef !== item.ownerRef) succeeded = (await unsubscribe(context, item.topicKey, item.ownerRef)) && succeeded;
    }
    for (const [topicKey, value] of desired) {
      const exists = selectTerminalTopicSubscriptions(context.getState()).some(item => item.subscriberKey === moduleName && item.topicKey === topicKey && item.ownerRef === value.ownerRef);
      if (!exists) succeeded = (await subscribe(context, topicKey, value.ownerRef, value.updatedAt)) && succeeded;
    }
    for (const topicKey of orgTopicKeys) setTopic(context, topicKey, succeeded ? 'loaded' : 'failed', succeeded ? null : 'TOPIC_SUBSCRIPTION_FAILED');
    return succeeded;
  };
  const ensureRulesSubscription = async (context: ActorExecutionContext, binding: StoreBasicBinding, projectRef: string): Promise<boolean> => {
    const accepted = selectTerminalTopicSubscriptions(context.getState()).find(item => item.subscriberKey === moduleName && item.topicKey === terminalUpdateTopicKey && item.ownerRef === projectRef);
    const subscriptions = selectTerminalTopicSubscriptions(context.getState()).filter(item => item.subscriberKey === moduleName && item.topicKey === terminalUpdateTopicKey && item.ownerRef !== projectRef);
    let removed = true;
    for (const item of subscriptions) removed = (await unsubscribe(context, terminalUpdateTopicKey, item.ownerRef)) && removed;
    if (!removed || !isCurrentMasterBinding(context, binding)) return false;
    if (accepted !== undefined) return true;
    return subscribe(context, terminalUpdateTopicKey, projectRef, 0);
  };
  const writeRuleSnapshot = async (context: ActorExecutionContext, snapshot: ProjectBasicState['ruleSnapshot'], status: ProjectBasicState['ruleSnapshotStatus']): Promise<boolean> => {
    const before = readState(context);
    context.dispatchAction(projectBasicActions.setRuleSnapshot(snapshot));
    context.dispatchAction(projectBasicActions.setRuleSnapshotStatus(status));
    try { await flush(context); return true; }
    catch {
      context.dispatchAction(projectBasicActions.setRuleSnapshot(before.ruleSnapshot));
      context.dispatchAction(projectBasicActions.setRuleSnapshotStatus(before.ruleSnapshotStatus));
      return false;
    }
  };
  const refreshRules = async (context: ActorExecutionContext, binding: StoreBasicBinding, path: TerminalStoreOrganizationPathRead): Promise<Readonly<{status: string; reason?: string}>> => {
    if (!isCurrentMasterBinding(context, binding) || !currentStoreIsReady(context, binding)) return {status: 'stale-binding'};
    const currentIdentity = projectBasicContextIdentity(binding, path);
    const previous = readState(context).ruleSnapshot;
    if (previous.contextIdentity !== currentIdentity || previous.projectRef !== path.projectRef) {
      const cleared = Object.freeze({contextIdentity: currentIdentity, selectedSpace: binding.groupWorkspaceKey, projectRef: path.projectRef, collectionHash: null, items: Object.freeze([])});
      if (!(await writeRuleSnapshot(context, cleared, Object.freeze({status: 'loading', errorCode: null})))) return {status: 'persistence-failed'};
    } else context.dispatchAction(projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'loading', errorCode: null})));
    if (!(await ensureRulesSubscription(context, binding, path.projectRef))) return {status: 'subscribe-failed'};
    for (let attempt = 1; attempt <= 3; attempt++) {
      let cursor: string | null = null;
      let collectionHash: string | null = null;
      const seen = new Set<string>();
      const items: StoredTerminalUpdateRule[] = [];
      let totalBytes = 0;
      let changed = false;
      do {
        const result = await readOperation(context, {operationId: 'terminalReadProjectUpdateRuleSnapshotPage', pathParameters: {projectRef: path.projectRef}, queryParameters: {collectionHash, cursor, limit: snapshotPageLimit}});
        if (!isCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
        if (result?.kind === 'business-rejection' && result.errorCode === 'TERMINAL_UPDATE_SNAPSHOT_CHANGED') { changed = true; break; }
        if (result?.kind !== 'success') {
          const reason = result?.kind === 'business-rejection' ? result.errorCode : 'RULE_SNAPSHOT_READ_FAILED';
          await writeRuleSnapshot(context, readState(context).ruleSnapshot, Object.freeze({status: 'failed', errorCode: reason}));
          setTopic(context, terminalUpdateTopicKey, 'failed', reason);
          return {status: 'failed', reason};
        }
        const page = result.body as TerminalUpdateRuleSnapshotPage;
        const bytes = jsonByteLength(page);
        totalBytes += bytes;
        if (bytes > snapshotPageByteLimit || totalBytes > snapshotTotalByteLimit) {
          const reason = bytes > snapshotPageByteLimit ? 'SNAPSHOT_PAGE_TOO_LARGE' : 'SNAPSHOT_TOO_LARGE';
          await writeRuleSnapshot(context, readState(context).ruleSnapshot, Object.freeze({status: 'failed', errorCode: reason}));
          setTopic(context, terminalUpdateTopicKey, 'failed', reason);
          return {status: 'failed', reason};
        }
        if (collectionHash === null) collectionHash = page.collectionHash;
        if (page.collectionHash !== collectionHash) { changed = true; break; }
        for (const item of page.items) {
          const stored = storedSnapshotRule(item);
          if (stored === null) {
            const reason = 'SNAPSHOT_ITEM_INVALID';
            await writeRuleSnapshot(context, readState(context).ruleSnapshot, Object.freeze({status: 'failed', errorCode: reason}));
            setTopic(context, terminalUpdateTopicKey, 'failed', reason);
            return {status: 'failed', reason};
          }
          items.push(stored);
        }
        cursor = page.nextCursor;
        if (cursor !== null && seen.has(cursor)) {
          const reason = 'SNAPSHOT_CURSOR_REPEATED';
          await writeRuleSnapshot(context, readState(context).ruleSnapshot, Object.freeze({status: 'failed', errorCode: reason}));
          setTopic(context, terminalUpdateTopicKey, 'failed', reason);
          return {status: 'failed', reason};
        }
        if (cursor !== null) seen.add(cursor);
      } while (cursor !== null);
      if (changed) { if (attempt < 3) continue; return {status: 'failed', reason: 'SNAPSHOT_COLLECTION_CHANGED'}; }
      if (!isCurrentMasterBinding(context, binding) || !currentStoreIsReady(context, binding)) return {status: 'stale-binding'};
      if (readState(context).organizationPath?.value.projectRef !== path.projectRef || projectBasicContextIdentity(binding, readState(context).organizationPath?.value ?? path) !== currentIdentity) return {status: 'stale-context'};
      if (new Set(items.map(item => item.ruleRef)).size !== items.length) return {status: 'failed', reason: 'SNAPSHOT_DUPLICATE_RULE'};
      const ready = Object.freeze({contextIdentity: currentIdentity, selectedSpace: binding.groupWorkspaceKey, projectRef: path.projectRef, collectionHash, items: Object.freeze(items)});
      if (!(await writeRuleSnapshot(context, ready, Object.freeze({status: 'ready', errorCode: null})))) return {status: 'persistence-failed'};
      setTopic(context, terminalUpdateTopicKey, 'loaded');
      log(context, 'rules-snapshot-ready', {itemCount: items.length, collectionHashPresent: collectionHash !== null, attempt});
      return {status: 'ready'};
    }
    return {status: 'failed', reason: 'SNAPSHOT_COLLECTION_CHANGED'};
  };
  const evaluateUpdate = async (context: ActorExecutionContext): Promise<StateJsonValue> => {
    const state = context.getState();
    const binding = selectStoreBasicBinding(state);
    if (binding === null || selectProjectTerminalUpdateContextFacts(state) === null)
      return {status: 'not-ready'};
    const projectState = readState(context);
    if (projectState.ruleSnapshotStatus.status !== 'ready')
      return {status: 'not-ready'};
    if (selectTerminalUpdateTask(context.getState()) !== null) return {status: 'fixed-task-present'};
    const actual = selectTerminalUpdateActualVersions(context.getState());
    if (actual?.applicationId === null || actual?.applicationId === undefined || actual.applicationId.length === 0)
      return {status: 'actual-application-unavailable'};
    const candidate = selectProjectTerminalUpdateCandidate(context.getState(), actual.applicationId, binding.storeRef);
    const target = candidate === null ? null : fixedTargetFromProjectCandidate(candidate);
    const requestKey = JSON.stringify([
      binding.terminalRef,
      binding.bindingGeneration,
      projectState.ruleSnapshot.contextIdentity,
      projectState.ruleSnapshot.collectionHash,
      target,
    ]);
    if (activeUpdateRequests.has(requestKey)) return {status: 'already-requested'};
    activeUpdateRequests.add(requestKey);
    try {
      const payload = createRequestTerminalUpdatePayload(target);
      const dispatched = await context.dispatchCommand(requestTerminalUpdateCommand, payload, {requestId: childRequestId(context)});
      const result = childResult(dispatched);
      log(context, 'terminal-update-requested', {
        dispatchStatus: dispatched.status,
        candidatePresent: target !== null,
        resultStatus: childStatus(dispatched) ?? 'unavailable',
      });
      return result ?? {status: 'request-failed', dispatchStatus: dispatched.status};
    } finally {
      activeUpdateRequests.delete(requestKey);
    }
  };
  const loadProject = async (context: ActorExecutionContext, requestedBinding: TerminalActivationSucceededPayload): Promise<StateJsonValue> => {
    const binding = currentBinding(context);
    if (binding === null || !sameBinding(binding, requestedBinding) || !currentStoreIsReady(context, binding) || !isCurrentMasterBinding(context, binding)) return {status: 'store-prerequisite-missing'};
    const key = bindingKey(binding);
    if (completedLoads.has(key) && readState(context).loadReadiness.runtimeId === context.runtimeId && sameBinding(readState(context).loadReadiness.binding, binding)) return {status: 'already-loaded'};
    if (activeLoads.has(key)) return {status: 'already-loading'};
    activeLoads.add(key);
    try {
      const current = readState(context);
      if (!sameBinding(current.binding, binding)) {
        context.dispatchAction(projectBasicActions.setBinding(binding));
        try { await flush(context); } catch { return {status: 'persistence-failed'}; }
      }
      setReadiness(context, binding, 'loading', null);
      for (const keyTopic of orgTopicKeys) setTopic(context, keyTopic, 'loading');
      const result = await readOperation(context, {operationId: 'terminalReadStoreOrganizationPath', pathParameters: {storeRef: binding.storeRef}});
      if (!isCurrentMasterBinding(context, binding) || !currentStoreIsReady(context, binding)) return {status: 'stale-binding'};
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
      context.dispatchAction(projectBasicActions.setOrganizationPath(Object.freeze({value: path, updatedAtEpochMillis: path.projectUpdatedAtEpochMillis})));
      try { await flush(context); } catch { markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_FLUSH_FAILED'); return {status: 'persistence-failed'}; }
      if (!isCurrentMasterBinding(context, binding) || !currentStoreIsReady(context, binding)) return {status: 'stale-binding'};
      setReadiness(context, binding, 'flushed', path.projectRef);
      const orgSubscriptionsReady = await reconcilePathTopics(context, path);
      if (!orgSubscriptionsReady) return {status: 'organization-subscribe-failed'};
      const refreshed = await refreshRules(context, binding, path);
      if (refreshed.status === 'ready') completedLoads.add(key);
      log(context, 'organization-load-complete', {status: refreshed.status, projectRefMatchesStore: path.projectRef === store.value.project.id, projectChanged: previousPath?.projectRef !== path.projectRef});
      return refreshed;
    } finally { activeLoads.delete(key); }
  };
  const onTopicChanged = async (context: ActorExecutionContext, binding: StoreBasicBinding, notification: TerminalTopicChangedPayload['notification']): Promise<StateJsonValue> => {
    if (!isCurrentMasterBinding(context, binding)) return {status: 'stale-binding'};
    const current = readState(context);
    const path = current.organizationPath?.value;
    if (path === undefined) return {status: 'not-ready'};
    const notificationKey = `${notification.topicKey}:${notification.ownerRef}`;
    latestNotificationByTopic.set(notificationKey, notification.notificationId);
    const isLatest = () => latestNotificationByTopic.get(notificationKey) === notification.notificationId && isCurrentMasterBinding(context, binding);
    if (orgTopicKeys.includes(notification.topicKey as typeof orgTopicKeys[number])) {
      setReadiness(context, binding, 'loading', null);
      for (const topicKey of orgTopicKeys) setTopic(context, topicKey, 'loading');
      const read = await readOperation(context, {operationId: 'terminalReadStoreOrganizationPath', pathParameters: {storeRef: binding.storeRef}});
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
      context.dispatchAction(projectBasicActions.setOrganizationPath(Object.freeze({value: nextPath, updatedAtEpochMillis: nextPath.projectUpdatedAtEpochMillis})));
      if (nextPath.projectRef !== path.projectRef || nextPath.projectUpdatedAtEpochMillis !== path.projectUpdatedAtEpochMillis) {
        const empty = Object.freeze({contextIdentity: null, selectedSpace: null, projectRef: null, collectionHash: null, items: Object.freeze([])});
        context.dispatchAction(projectBasicActions.setRuleSnapshot(empty));
        context.dispatchAction(projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'empty', errorCode: null})));
      }
      try { await flush(context); } catch {
        markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_FLUSH_FAILED');
        return {status: 'persistence-failed'};
      }
      if (!isLatest()) return {status: 'stale-result'};
      setReadiness(context, binding, 'flushed', nextPath.projectRef);
      await reconcilePathTopics(context, nextPath);
      if (nextPath.projectRef !== path.projectRef || nextPath.projectUpdatedAtEpochMillis !== path.projectUpdatedAtEpochMillis)
        await refreshRules(context, binding, nextPath);
    } else if (notification.topicKey === terminalUpdateTopicKey && notification.ownerRef === path.projectRef) {
      const refreshed = await refreshRules(context, binding, path);
      if (refreshed.status !== 'ready') return refreshed;
    } else return {status: 'unowned-topic'};
    if (!isLatest()) return {status: 'stale-result'};
    const accepted = await context.dispatchCommand(acceptTerminalTopicNotificationCommand, {subscriberKey: moduleName, subscriptionId: notification.subscriptionId, notificationId: notification.notificationId}, {requestId: childRequestId(context)});
    return Object.freeze({status: accepted.status === 'completed' ? 'refreshed' : 'accept-failed'});
  };

  return [defineActor(moduleName, 'project-basic', [
    onCommand(initializeProjectBasicCommand, async context => {
      const result = await context.dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {requestId: childRequestId(context)});
      return Object.freeze({status: result.status === 'completed' ? 'store-initialization-requested' : 'store-initialization-failed'});
    }),
    onCommand(storeBasicInformationLoadedCommand, context => loadProject(context, context.command.payload)),
    onCommand(terminalActivationSucceededCommand, async context => {
      const init = await context.dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {requestId: childRequestId(context)});
      return Object.freeze({status: init.status === 'completed' ? 'store-initialization-requested' : 'store-initialization-failed'});
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
      if (binding === null || payload.terminalRef !== binding.terminalRef || payload.bindingGeneration !== binding.bindingGeneration) return {status: 'stale-binding'};
      const result = await context.dispatchCommand(refreshProjectBasicTopicCommand, {binding, notification: payload.notification}, {requestId: childRequestId(context)});
      return result.status === 'completed' ? childResult(result) ?? {status: 'refresh-failed'} : {status: 'refresh-failed'};
    }),
  ])];
};
