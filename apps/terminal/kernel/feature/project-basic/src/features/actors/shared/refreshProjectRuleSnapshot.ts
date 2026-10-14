import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {
  selectTerminalTopicSubscriptions,
  type TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import type {TerminalOperationId, TerminalOperationResult, TerminalRequestMap, TerminalUpdateRuleSnapshotItem, TerminalUpdateRuleSnapshotPage, TerminalStoreOrganizationPathRead} from '../../../generated/terminalApi';
import {moduleName} from '../../../moduleName';
import {terminalUpdateTopicKey} from '../../../declarations/topics';
import {projectBasicActions, projectBasicContextIdentity} from '../../slices/projectBasicState';
import type {ProjectBasicState, StoredTerminalUpdateArtifactSummary, StoredTerminalUpdateRule} from '../../../types/types';
import type {StoreBasicBinding} from '@catering-v2s/kernel-feature-store-basic';

const snapshotPageLimit = 100;
const snapshotPageByteLimit = 1_048_576;
const snapshotTotalByteLimit = 8_388_608;

export type ProjectOwnerReadOperationId = Extract<TerminalOperationId, `terminalRead${string}`>;
export type ProjectOwnerReadPayload = {
  readonly [OperationId in ProjectOwnerReadOperationId]: Readonly<{
    readonly operationId: OperationId;
    readonly pathParameters: TerminalRequestMap[OperationId]['pathParameters'];
    readonly queryParameters?: TerminalRequestMap[OperationId]['queryParameters'];
  }>;
}[ProjectOwnerReadOperationId];

type SubscriptionInput = Readonly<{
  topicKey: TerminalTopicKey;
  ownerRef: string;
  initialTimeEpochMillis: number;
}>;
type Log = (
  context: ActorExecutionContext,
  input: Readonly<{
    event: string;
    data: Readonly<Record<string, string | number | boolean | null>>;
    requestId?: ActorExecutionContext['command']['requestId'];
  }>,
) => void;
type Dependencies = Readonly<{
  isCurrentMasterBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
  currentStoreIsReady: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
  readState: (context: ActorExecutionContext) => ProjectBasicState;
  subscribe: (context: ActorExecutionContext, input: SubscriptionInput) => Promise<boolean>;
  unsubscribe: (context: ActorExecutionContext, topicKey: TerminalTopicKey, ownerRef: string) => Promise<boolean>;
  readOperation: (
    context: ActorExecutionContext,
    request: ProjectOwnerReadPayload,
  ) => Promise<TerminalOperationResult<ProjectOwnerReadOperationId> | null>;
  log: Log;
}>;

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

export const createProjectRuleSnapshotRefresher = (dependencies: Dependencies) => {
  let refreshGeneration = 0;
  const {
    isCurrentMasterBinding,
    currentStoreIsReady,
    readState,
    subscribe,
    unsubscribe,
    readOperation,
    log,
  } = dependencies;

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

  const persistSnapshot = async (
    context: ActorExecutionContext,
    snapshot: ProjectBasicState['ruleSnapshot'],
  ): Promise<boolean> => {
    context.dispatchAction(projectBasicActions.setRuleSnapshot(snapshot));
    const result = await context.flushPersistence();
    return result.status === 'succeeded';
  };

  const failRefresh = (
    context: ActorExecutionContext,
    generation: number,
    reason: string,
  ): Readonly<{status: string; reason?: string}> => {
    if (generation !== refreshGeneration) return {status: 'stale-refresh'};
    context.dispatchAction(
      projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'failed', errorCode: reason})),
    );
    context.dispatchAction(
      projectBasicActions.setTopicState({topicKey: terminalUpdateTopicKey, status: 'failed', errorCode: reason}),
    );
    log(context, {event: 'rules-snapshot-failed', data: {reasonCode: reason}});
    return {status: 'failed', reason};
  };

  return async (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    path: TerminalStoreOrganizationPathRead,
  ): Promise<Readonly<{status: string; reason?: string}>> => {
    if (!isCurrentMasterBinding(context, binding) || !currentStoreIsReady(context, binding))
      return {status: 'stale-binding'};
    const generation = ++refreshGeneration;
    const isLatest = () => generation === refreshGeneration;
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
      if (!(await persistSnapshot(context, cleared))) {
        failRefresh(context, generation, 'RULE_SNAPSHOT_FLUSH_FAILED');
        return {status: 'persistence-failed'};
      }
      if (!isLatest()) return {status: 'stale-refresh'};
    }
    const subscriptionReady = await ensureRulesSubscription(context, binding, path.projectRef);
    if (!isCurrentContext()) return {status: 'stale-context'};
    if (!subscriptionReady) return failRefresh(context, generation, 'RULE_TOPIC_SUBSCRIPTION_FAILED');
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
          const reason =
            result?.kind === 'business-rejection'
              ? result.errorCode
              : result?.kind === 'failure'
                ? result.code
                : 'RULE_SNAPSHOT_READ_FAILED';
          return failRefresh(context, generation, reason);
        }
        const page = result.body as TerminalUpdateRuleSnapshotPage;
        const bytes = jsonByteLength(page);
        totalBytes += bytes;
        if (bytes > snapshotPageByteLimit || totalBytes > snapshotTotalByteLimit) {
          const reason = bytes > snapshotPageByteLimit ? 'SNAPSHOT_PAGE_TOO_LARGE' : 'SNAPSHOT_TOO_LARGE';
          return failRefresh(context, generation, reason);
        }
        if (collectionHash === null) collectionHash = page.collectionHash;
        if (page.collectionHash !== collectionHash) {
          changed = true;
          break;
        }
        for (const item of page.items) {
          const stored = storedSnapshotRule(item);
          if (stored === null) return failRefresh(context, generation, 'SNAPSHOT_ITEM_INVALID');
          items.push(stored);
        }
        cursor = page.nextCursor;
        if (cursor !== null && seen.has(cursor)) return failRefresh(context, generation, 'SNAPSHOT_CURSOR_REPEATED');
        if (cursor !== null) seen.add(cursor);
      } while (cursor !== null);
      if (changed) {
        if (attempt < 3) continue;
        failRefresh(context, generation, 'SNAPSHOT_COLLECTION_CHANGED');
        return {status: 'failed', reason: 'SNAPSHOT_COLLECTION_CHANGED'};
      }
      if (!isCurrentContext()) return {status: 'stale-context'};
      if (new Set(items.map(item => item.ruleRef)).size !== items.length)
        return failRefresh(context, generation, 'SNAPSHOT_DUPLICATE_RULE');
      const ready = Object.freeze({
        contextIdentity: currentIdentity,
        selectedSpace: binding.groupWorkspaceKey,
        projectRef: path.projectRef,
        collectionHash,
        items: Object.freeze(items),
      });
      if (!(await persistSnapshot(context, ready))) {
        failRefresh(context, generation, 'RULE_SNAPSHOT_FLUSH_FAILED');
        return {status: 'persistence-failed', reason: 'RULE_SNAPSHOT_FLUSH_FAILED'};
      }
      if (!isCurrentContext()) return {status: 'stale-context'};
      context.dispatchAction(
        projectBasicActions.setRuleSnapshotStatus(Object.freeze({status: 'ready', errorCode: null})),
      );
      context.dispatchAction(projectBasicActions.setTopicState({topicKey: terminalUpdateTopicKey, status: 'loaded'}));
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
    failRefresh(context, generation, 'SNAPSHOT_COLLECTION_CHANGED');
    return {status: 'failed', reason: 'SNAPSHOT_COLLECTION_CHANGED'};
  };
};
