import {createRequestId, nowTimestampMs, topologyLateResultMaxTtlMs} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  onCommand,
  type ActorExecutionContext,
  type ActorDefinition,
  primarySurfaceReadyCommand,
} from '@catering-v2s/kernel-base-runtime';
import {
  requestTerminalUpdateDownloadGrantCommand,
  readTerminalDataCommand,
  subscribeTerminalTopicCommand,
  acceptTerminalTopicNotificationCommand,
  terminalTopicChangedCommand,
  terminalDataHeartbeatCommand,
  type TerminalDataHeartbeatPayload,
  type TerminalUpdateRuleSnapshotItem,
  type TerminalUpdateRuleSnapshotPage,
  selectActivationState,
  submitTerminalUpdateReportCommand,
  selectConnectionState,
  selectTerminalTopicSubscriptions,
  type TerminalUpdateDownloadGrantResult,
  type TerminalUpdateReportPayload,
} from '@catering-v2s/kernel-base-terminal-data-client';
import type {
  TerminalUpdateArtifact,
  UpdateActualVersions,
  UpdateFacts,
  UpdatePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName} from '../../moduleName';
import {terminalUpdateSliceName} from '../slices/terminalUpdate';
import {terminalUpdateActions} from '../slices/terminalUpdate';
import {
  acceptTerminalUpdateTargetCommand,
  clearTerminalUpdateReportContextCommand,
  confirmTerminalUpdateBootCommand,
  refreshTerminalUpdateRuleSnapshotCommand,
  reconcileTerminalUpdateCommand,
} from '../commands/commands';
import type {
  FixedUpdateTarget,
  TerminalUpdateRecentStatus,
  TerminalUpdateState,
  TerminalUpdateTask,
  UpdateNetworkSnapshotReader,
  UpdateTargetSourceProvider,
  UpdateRuleSnapshotContext,
  StoredTerminalUpdateArtifactSummary,
  StoredTerminalUpdateRule,
} from '../../types/terminalUpdate';

const ruleTopicSubscriberKey = moduleName;
const terminalUpdateTopicKey = 'TERMINAL_UPDATE_RULES' as const;
const ruleSnapshotPageLimit = 100;
const ruleSnapshotPageByteLimit = 1_048_576;
const ruleSnapshotTotalByteLimit = 8_388_608;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const utf8JsonByteLength = (value: unknown): number => {
  const json = JSON.stringify(value);
  let bytes = 0;
  for (let index = 0; index < json.length; index += 1) {
    const code = json.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < json.length &&
      json.charCodeAt(index + 1) >= 0xdc00 &&
      json.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
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
  if (value.kind !== 'FULL' && value.kind !== 'HOT') return null;
  if ((value.kind === 'FULL') !== (value.apkSha256 !== null)) return null;
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

const sourceFromSnapshotArtifact = (
  artifact: StoredTerminalUpdateArtifactSummary,
): NonNullable<FixedUpdateTarget['full']> =>
  Object.freeze({
    sourceRef: `terminal-update-artifact:${artifact.artifactRef}`,
    expectedSha256: artifact.zipSha256,
    apkSha256: artifact.apkSha256,
    artifactRef: artifact.artifactRef,
    artifact: Object.freeze({
      applicationId: artifact.applicationId,
      nativeVersion: artifact.apkVersion,
      nativeBuildNumber: artifact.nativeBuildNumber,
      bundleVersion: artifact.jsVersion,
      runtimeVersion: artifact.runtimeVersion,
      publicationId: artifact.publicationId,
    }),
  });

type TerminalUpdateActorInput = Readonly<{
  port: UpdatePort;
  createProtocolUuid: () => string;
  sourceProvider?: UpdateTargetSourceProvider;
  readRuleSnapshotContext?: (state: ReturnType<ActorExecutionContext['getState']>) => UpdateRuleSnapshotContext | null;
  actions?: typeof terminalUpdateActions;
  readNetworkSnapshot?: UpdateNetworkSnapshotReader;
}>;

const invalid = (code: string): never => {
  throw new Error(`TERMINAL_UPDATE_${code}`);
};
const readState = (context: ActorExecutionContext): TerminalUpdateState => {
  const value = context.getState()[terminalUpdateSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid('STATE_MISSING');
  return value as TerminalUpdateState;
};
const persist = async (context: ActorExecutionContext): Promise<boolean> =>
  (await context.flushPersistence()).status === 'succeeded';
const validTarget = (target: FixedUpdateTarget): boolean =>
  typeof target.ruleRef === 'string' &&
  target.ruleRef.length > 0 &&
  typeof target.applicationId === 'string' &&
  target.applicationId.length > 0 &&
  (target.full !== null || target.hot !== null) &&
  (target.full === null || target.full.artifact.applicationId === target.applicationId) &&
  (target.hot === null || target.hot.artifact.applicationId === target.applicationId) &&
  (target.full === null ||
    target.hot === null ||
    target.full.artifact.runtimeVersion === target.hot.artifact.runtimeVersion) &&
  Number.isSafeInteger(target.strategy.maxNetworkAttempts) &&
  target.strategy.maxNetworkAttempts >= 0 &&
  Number.isSafeInteger(target.strategy.bootTimeoutMs) &&
  target.strategy.bootTimeoutMs > 0;

const fullManifestFromGrant = (
  manifest: TerminalUpdateDownloadGrantResult['artifact'],
  expected: FixedUpdateTarget['full'] | FixedUpdateTarget['hot'],
  expectedFull: FixedUpdateTarget['full'],
  requireMinimumFull: boolean,
): TerminalUpdateArtifact | null => {
  const minimumFull = manifest.minimumFull;
  const minimumFullMatches =
    expectedFull !== null &&
    expectedFull.apkSha256 != null &&
    minimumFull !== undefined &&
    minimumFull !== null &&
    minimumFull.applicationId === expectedFull.artifact.applicationId &&
    minimumFull.nativeBuildNumber === expectedFull.artifact.nativeBuildNumber &&
    minimumFull.runtimeVersion === expectedFull.artifact.runtimeVersion &&
    minimumFull.publicationId === expectedFull.artifact.publicationId &&
    minimumFull.apkSha256 === expectedFull.apkSha256;
  if (
    expected === null ||
    manifest.applicationId !== expected.artifact.applicationId ||
    manifest.nativeBuildNumber !== expected.artifact.nativeBuildNumber ||
    manifest.nativeVersion !== expected.artifact.nativeVersion ||
    manifest.bundleVersion !== expected.artifact.bundleVersion ||
    manifest.runtimeVersion !== expected.artifact.runtimeVersion ||
    manifest.publicationId !== expected.artifact.publicationId ||
    manifest.files.length === 0 ||
    (expected.apkSha256 != null && manifest.apk?.sha256 !== expected.apkSha256) ||
    (requireMinimumFull && !minimumFullMatches)
  )
    return null;
  return Object.freeze({
    ...manifest,
    minimumFull: manifest.minimumFull ?? undefined,
    apk: manifest.apk ?? undefined,
  });
};

const createStatus = (
  taskId: string | null,
  state: TerminalUpdateState['recentStatus']['state'],
  reason: string | null,
) => Object.freeze({taskId, state, reason, changedAt: nowTimestampMs()});

const toReportReason = (reason: string | null): TerminalUpdateReportPayload['body']['recent']['reason'] => {
  if (reason === null) return 'NONE';
  const value = reason.toUpperCase();
  if (value.includes('NETWORK') || value.includes('TIMEOUT')) return 'NETWORK';
  if (value.includes('HASH') || value.includes('DIGEST')) return 'HASH_MISMATCH';
  if (value.includes('INSTALLER') && value.includes('CANCEL')) return 'INSTALLER_CANCELLED';
  if (value.includes('HOT')) return 'HOT_APPLY_FAILED';
  if (value.includes('INSTALL')) return 'INSTALL_FAILED';
  if (value.includes('HTTP') || value.includes('REJECT') || value.includes('GRANT')) return 'HTTP_REJECTED';
  if (value.includes('PREPARE') || value.includes('SOURCE')) return 'PREPARE_FAILED';
  return 'UNKNOWN';
};

const toReportState = (
  state: TerminalUpdateRecentStatus['state'],
): TerminalUpdateReportPayload['body']['recent']['state'] => {
  switch (state) {
    case 'waiting-user':
      return 'WAITING_USER';
    case 'preparing':
      return 'DOWNLOADING';
    case 'applying':
      return 'INSTALLING';
    case 'succeeded':
      return 'SUCCEEDED';
    case 'failed':
      return 'FAILED';
    case 'unknown':
      return 'UNKNOWN';
    case 'idle':
    case 'fixed':
      return 'WAITING_USER';
  }
};

const createReportPayload = (
  reportId: string,
  sequence: number,
  task: TerminalUpdateTask | null,
  actual: UpdateActualVersions | null,
  status: TerminalUpdateRecentStatus,
): TerminalUpdateReportPayload | null => {
  const applicationId = actual?.applicationId ?? task?.target.applicationId ?? status.applicationId ?? undefined;
  if (applicationId === undefined) return null;
  const body: TerminalUpdateReportPayload['body'] = Object.freeze({
    reportId,
    reportSequence: sequence,
    taskId: status.taskId,
    actual: Object.freeze({
      apkVersion: actual?.nativeVersion ?? null,
      nativeBuildNumber: actual?.nativeBuildNumber ?? null,
      applicationId,
      runtimeVersion: actual?.runtimeVersion ?? 'unknown',
      jsVersion: actual?.bundleVersion ?? null,
      publicationId: actual?.publicationId ?? null,
      apkSha256: actual?.apkSha256 ?? null,
      bundleSha256: null,
      entryKind:
        actual === null
          ? 'UNKNOWN'
          : actual.entryKind === 'embedded'
            ? 'EMBEDDED_BUNDLE'
            : actual.entryKind === 'hot'
              ? 'HOT_BUNDLE'
              : 'UNKNOWN',
      unknownReason: actual === null ? 'READBACK_UNAVAILABLE' : null,
    }),
    recent: Object.freeze({
      state: toReportState(status.state),
      reason: toReportReason(status.reason),
      changedAtEpochMillis: Number(status.changedAt),
      ruleRef: task?.target.ruleRef ?? status.ruleRef ?? null,
      fullArtifactRef: task?.target.full?.artifactRef ?? status.fullArtifactRef ?? null,
      hotArtifactRef: task?.target.hot?.artifactRef ?? status.hotArtifactRef ?? null,
    }),
  });
  return Object.freeze({idempotencyKey: reportId, body});
};

const compareVersion = (left: string, right: string): number => {
  const parse = (value: string): readonly number[] => {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)) invalid('VERSION_INVALID');
    return value.split('.').map(Number);
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
};

const nextArtifact = (
  target: FixedUpdateTarget,
  actual: UpdateActualVersions | null,
  embedded: UpdateFacts['embedded'],
  originalBundleVersion: string,
): Readonly<{
  kind: 'full' | 'hot';
  sourceRef: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['sourceRef'];
  artifactRef?: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['artifactRef'];
  expectedSha256: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['expectedSha256'];
  artifact: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['artifact'];
  manifest?: TerminalUpdateArtifact;
}> | null => {
  if (actual === null || actual.applicationId !== target.applicationId) return invalid('ACTUAL_IDENTITY_UNAVAILABLE');
  const full = target.full;
  const hot = target.hot;
  const finalBundleVersion = hot?.artifact.bundleVersion ?? full?.artifact.bundleVersion;
  if (finalBundleVersion !== undefined && compareVersion(finalBundleVersion, originalBundleVersion) < 0)
    return invalid(hot === null ? 'FULL_ONLY_VERSION_DOWNGRADE' : 'HOT_VERSION_DOWNGRADE');
  if (full !== null) {
    if (actual.nativeBuildNumber < full.artifact.nativeBuildNumber) {
      return Object.freeze({kind: 'full', ...full});
    }
    if (
      actual.nativeBuildNumber === full.artifact.nativeBuildNumber &&
      full.apkSha256 != null &&
      actual.apkSha256 !== full.apkSha256
    ) {
      return invalid('FULL_IDENTITY_CONFLICT');
    }
    if (
      actual.nativeBuildNumber === full.artifact.nativeBuildNumber &&
      (embedded === null ||
        embedded.applicationId !== full.artifact.applicationId ||
        embedded.nativeBuildNumber !== full.artifact.nativeBuildNumber ||
        embedded.runtimeVersion !== full.artifact.runtimeVersion ||
        embedded.publicationId !== full.artifact.publicationId)
    ) {
      return invalid('FULL_IDENTITY_CONFLICT');
    }
    if (hot === null && full.artifact.runtimeVersion !== actual.runtimeVersion) return invalid('FULL_RUNTIME_MISMATCH');
  }
  if (hot !== null) {
    if (hot.artifact.runtimeVersion !== actual.runtimeVersion) {
      return invalid('HOT_RUNTIME_MISMATCH');
    }
    const order = compareVersion(hot.artifact.bundleVersion, actual.bundleVersion);
    if (order < 0) return invalid('HOT_VERSION_DOWNGRADE');
    if (order > 0) return Object.freeze({kind: 'hot', ...hot});
    if (hot.artifact.publicationId !== actual.publicationId) return invalid('HOT_IDENTITY_CONFLICT');
  }
  return null;
};

export const createTerminalUpdateActor = (input: TerminalUpdateActorInput): ActorDefinition => {
  const {port, sourceProvider, readNetworkSnapshot} = input;
  const actions = input.actions ?? terminalUpdateActions;
  let targetCommitPending: Promise<void> | null = null;
  let reportSendInFlight: Readonly<{attemptId: number; expiresAt: number}> | null = null;
  let nextReportSendAttemptId = 0;
  let ruleSnapshotRefresh: Promise<Readonly<{status: string; reason?: string}>> | null = null;
  const emptyReportDescriptor = (
    bindingIdentity: string | null,
    contextIdentity: string | null = null,
  ): TerminalUpdateState['reportDescriptor'] =>
    Object.freeze({
      bindingIdentity,
      contextIdentity,
      nextReportSequence: 1,
      pendingReports: Object.freeze({}),
      sendPaused: false,
      latestDeliveryFailure: null,
    });
  const currentBindingIdentity = (
    context: ActorExecutionContext,
  ): Readonly<{identity: string; generation: number}> | null => {
    let activation: ReturnType<typeof selectActivationState>;
    try {
      activation = selectActivationState(context.getState());
    } catch {
      return null;
    }
    if (activation.status !== 'active' || activation.terminalRef === null || activation.bindingGeneration === null)
      return null;
    return Object.freeze({
      identity: `${activation.terminalRef}:${activation.bindingGeneration}`,
      generation: activation.bindingGeneration,
    });
  };
  const currentRuleContext = (
    context: ActorExecutionContext,
  ): Readonly<{
    readonly facts: UpdateRuleSnapshotContext;
    readonly identity: string;
  }> | null => {
    const facts = input.readRuleSnapshotContext?.(context.getState());
    if (
      facts === undefined ||
      facts === null ||
      !Number.isSafeInteger(facts.bindingGeneration) ||
      facts.bindingGeneration < 1 ||
      !Number.isSafeInteger(facts.projectUpdatedAtEpochMillis) ||
      facts.projectUpdatedAtEpochMillis < 0
    )
      return null;
    const identity = `${facts.terminalRef}:${facts.bindingGeneration}:${facts.selectedSpace}:${facts.storeRef}:${facts.projectRef}:${facts.projectUpdatedAtEpochMillis}`;
    return Object.freeze({facts, identity});
  };
  const writeRuleSnapshot = async (
    context: ActorExecutionContext,
    snapshot: TerminalUpdateState['ruleSnapshot'],
    status: TerminalUpdateState['ruleSnapshotStatus'],
  ): Promise<boolean> => {
    const before = readState(context).ruleSnapshot;
    const beforeStatus = readState(context).ruleSnapshotStatus;
    context.dispatchAction(actions.replaceRuleSnapshot(snapshot));
    context.dispatchAction(actions.replaceRuleSnapshotStatus(status));
    if (await persist(context)) return true;
    context.dispatchAction(actions.replaceRuleSnapshot(before));
    context.dispatchAction(actions.replaceRuleSnapshotStatus(beforeStatus));
    return false;
  };
  const writeReportDescriptor = async (
    context: ActorExecutionContext,
    next: TerminalUpdateState['reportDescriptor'],
  ): Promise<boolean> => {
    const before = readState(context).reportDescriptor;
    context.dispatchAction(actions.replaceReportDescriptor(next));
    if (await persist(context)) return true;
    context.dispatchAction(actions.replaceReportDescriptor(before));
    return false;
  };
  const refreshRuleSnapshot = (context: ActorExecutionContext) => {
    if (ruleSnapshotRefresh !== null) return ruleSnapshotRefresh;
    ruleSnapshotRefresh = (async () => {
      const current = currentRuleContext(context);
      if (current === null) {
        const binding = currentBindingIdentity(context);
        if (binding === null) {
          const descriptor = readState(context).reportDescriptor;
          if (
            descriptor.bindingIdentity !== null ||
            descriptor.contextIdentity !== null ||
            Object.keys(descriptor.pendingReports).length > 0 ||
            descriptor.sendPaused ||
            descriptor.latestDeliveryFailure !== null
          ) {
            if (!(await writeReportDescriptor(context, emptyReportDescriptor(null))))
              return Object.freeze({status: 'persistence-failed'});
          }
        }
        const before = readState(context).ruleSnapshot;
        if (readState(context).ruleSnapshotStatus.status !== 'empty' || before.items.length > 0) {
          const cleared = Object.freeze({
            contextIdentity: null,
            selectedSpace: null,
            projectRef: null,
            collectionHash: null,
            items: Object.freeze([]),
          });
          if (!(await writeRuleSnapshot(context, cleared, Object.freeze({status: 'empty', errorCode: null}))))
            return Object.freeze({status: 'persistence-failed'});
        }
        return Object.freeze({status: 'not-ready'});
      }
      const binding = currentBindingIdentity(context);
      const reportDescriptor = readState(context).reportDescriptor;
      if (binding === null || binding.identity !== `${current.facts.terminalRef}:${current.facts.bindingGeneration}`)
        return Object.freeze({status: 'stale-context'});
      if (
        reportDescriptor.bindingIdentity !== binding.identity ||
        reportDescriptor.contextIdentity !== current.identity
      ) {
        if (!(await writeReportDescriptor(context, emptyReportDescriptor(binding.identity, current.identity))))
          return Object.freeze({status: 'persistence-failed'});
      }
      const existing = readState(context).ruleSnapshot;
      if (
        existing.contextIdentity !== current.identity ||
        existing.selectedSpace !== current.facts.selectedSpace ||
        existing.projectRef !== current.facts.projectRef
      ) {
        const cleared = Object.freeze({
          contextIdentity: current.identity,
          selectedSpace: current.facts.selectedSpace,
          projectRef: current.facts.projectRef,
          collectionHash: null,
          items: Object.freeze([]),
        });
        if (!(await writeRuleSnapshot(context, cleared, Object.freeze({status: 'empty', errorCode: null}))))
          return Object.freeze({status: 'persistence-failed'});
      }
      const credential = selectActivationState(context.getState());
      if (
        credential.status !== 'active' ||
        credential.terminalRef !== current.facts.terminalRef ||
        credential.bindingGeneration !== current.facts.bindingGeneration ||
        credential.groupWorkspaceKey !== current.facts.selectedSpace
      )
        return Object.freeze({status: 'stale-context'});
      const acceptedTopic = selectTerminalTopicSubscriptions(context.getState()).find(
        subscription =>
          subscription.subscriberKey === ruleTopicSubscriberKey &&
          subscription.topicKey === terminalUpdateTopicKey &&
          subscription.ownerRef === current.facts.projectRef,
      );
      context.platformPorts.logger.info({
        category: 'terminal-update.rules',
        event: 'terminal-update.rules.topic-subscribe.begin',
        message: 'Starting the terminal update rule topic subscription',
        data: {topicKey: terminalUpdateTopicKey, existingSubscription: acceptedTopic !== undefined},
      });
      const subscribe = await context.dispatchCommand(
        subscribeTerminalTopicCommand,
        Object.freeze({
          subscriberKey: ruleTopicSubscriberKey,
          topicKey: terminalUpdateTopicKey,
          ownerRef: current.facts.projectRef,
          initialTimeEpochMillis: acceptedTopic?.acceptedTimeEpochMillis ?? 0,
        }),
      );
      const subscribeActor = subscribe.actorResults.find(result => result.status === 'completed');
      const subscribeResult =
        subscribeActor !== undefined &&
        typeof subscribeActor.result === 'object' &&
        subscribeActor.result !== null &&
        !Array.isArray(subscribeActor.result)
          ? (subscribeActor.result as Record<string, unknown>)
          : undefined;
      const topicSubscriptionsAfterSubscribe = selectTerminalTopicSubscriptions(context.getState());
      const matchingTopicSubscription = topicSubscriptionsAfterSubscribe.find(
        subscription =>
          subscription.subscriberKey === ruleTopicSubscriberKey &&
          subscription.topicKey === terminalUpdateTopicKey &&
          subscription.ownerRef === current.facts.projectRef,
      );
      context.platformPorts.logger.info({
        category: 'terminal-update.rules',
        event: 'terminal-update.rules.topic-subscribe.readback',
        message: 'Read the topic subscription command outcome',
        data: {
          dispatchStatus: subscribe.status,
          actorStatus: subscribeActor?.status ?? 'none',
          resultStatus: typeof subscribeResult?.status === 'string' ? subscribeResult.status : 'none',
          resultReason:
            typeof subscribeResult?.reason === 'string' && /^[A-Z0-9_]+$/u.test(subscribeResult.reason)
              ? subscribeResult.reason
              : 'none',
          subscriptionCount: topicSubscriptionsAfterSubscribe.length,
          matchingSubscriptionPresent: matchingTopicSubscription !== undefined,
          pendingNotificationPresent:
            matchingTopicSubscription?.pendingNotification !== null &&
            matchingTopicSubscription?.pendingNotification !== undefined,
        },
      });
      if (subscribe.status !== 'completed') return Object.freeze({status: 'subscribe-failed'});

      let cursor: string | null = null;
      let collectionHash: string | null = null;
      const seenCursors = new Set<string>();
      const items: StoredTerminalUpdateRule[] = [];
      let totalBytes = 0;
      const failSnapshot = async (reason: string) => {
        const previous = readState(context).ruleSnapshot;
        const retained =
          previous.contextIdentity === current.identity &&
          previous.selectedSpace === current.facts.selectedSpace &&
          previous.projectRef === current.facts.projectRef
            ? previous.items
            : Object.freeze([]);
        const failed = Object.freeze({
          contextIdentity: current.identity,
          selectedSpace: current.facts.selectedSpace,
          projectRef: current.facts.projectRef,
          collectionHash: previous.contextIdentity === current.identity ? previous.collectionHash : null,
          items: retained,
        });
        await writeRuleSnapshot(context, failed, Object.freeze({status: 'failed', errorCode: reason}));
        return Object.freeze({status: 'failed', reason});
      };
      do {
        context.platformPorts.logger.info({
          category: 'terminal-update.rules',
          event: 'terminal-update.rules.page-read.begin',
          message: 'Starting a page read for the terminal update rule snapshot',
          data: {
            cursorPresent: cursor !== null,
            collectionHashPresent: collectionHash !== null,
            pageLimit: ruleSnapshotPageLimit,
          },
        });
        const pageCommand = await context.dispatchCommand(
          readTerminalDataCommand,
          Object.freeze({
            operationId: 'terminalReadProjectUpdateRuleSnapshotPage',
            pathParameters: {projectRef: current.facts.projectRef},
            queryParameters: {collectionHash, cursor, limit: ruleSnapshotPageLimit},
          }),
        );
        const result = pageCommand.actorResults.find(record => record.status === 'completed')?.result as
          | {kind: 'success'; body: TerminalUpdateRuleSnapshotPage}
          | {kind: 'business-rejection'; errorCode: string}
          | {kind: 'failure'; code: string}
          | undefined;
        context.platformPorts.logger.info({
          category: 'terminal-update.rules',
          event: 'terminal-update.rules.page-read.readback',
          message: 'Read the terminal update rule page command outcome',
          data: {
            dispatchStatus: pageCommand.status,
            actorCount: pageCommand.actorResults.length,
            actorStatus: pageCommand.actorResults.find(record => record.status === 'completed')?.status ?? 'none',
            resultKind: result?.kind ?? 'none',
            resultCode:
              result?.kind === 'business-rejection' || result?.kind === 'failure'
                ? result.kind === 'business-rejection'
                  ? result.errorCode
                  : result.code
                : 'none',
          },
        });
        if (pageCommand.status !== 'completed' || result?.kind !== 'success')
          return failSnapshot(result?.kind === 'business-rejection' ? result.errorCode : 'RULE_SNAPSHOT_READ_FAILED');
        const page = result.body;
        const pageBytes = utf8JsonByteLength(page);
        if (pageBytes > ruleSnapshotPageByteLimit) return failSnapshot('SNAPSHOT_PAGE_TOO_LARGE');
        totalBytes += pageBytes;
        if (totalBytes > ruleSnapshotTotalByteLimit) return failSnapshot('SNAPSHOT_TOO_LARGE');
        if (collectionHash === null) collectionHash = page.collectionHash;
        if (page.collectionHash !== collectionHash) return failSnapshot('SNAPSHOT_COLLECTION_CHANGED');
        for (const item of page.items) {
          const stored = storedSnapshotRule(item);
          if (stored === null) return failSnapshot('SNAPSHOT_ITEM_INVALID');
          items.push(stored);
        }
        cursor = page.nextCursor;
        if (cursor !== null && seenCursors.has(cursor)) return failSnapshot('SNAPSHOT_CURSOR_REPEATED');
        if (cursor !== null) seenCursors.add(cursor);
      } while (cursor !== null);
      if (currentRuleContext(context)?.identity !== current.identity) return Object.freeze({status: 'stale-context'});
      const uniqueRules = new Set(items.map(item => item.ruleRef));
      if (uniqueRules.size !== items.length) return failSnapshot('SNAPSHOT_DUPLICATE_RULE');
      const ready = Object.freeze({
        contextIdentity: current.identity,
        selectedSpace: current.facts.selectedSpace,
        projectRef: current.facts.projectRef,
        collectionHash,
        items: Object.freeze(items),
      });
      if (!(await writeRuleSnapshot(context, ready, Object.freeze({status: 'ready', errorCode: null}))))
        return Object.freeze({status: 'persistence-failed'});
      return Object.freeze({status: 'ready'});
    })().finally(() => {
      ruleSnapshotRefresh = null;
    });
    return ruleSnapshotRefresh;
  };
  const targetFromRuleSnapshot = (
    context: ActorExecutionContext,
    selectionContext: FixedUpdateTarget['selectionContext'],
  ): FixedUpdateTarget | null => {
    const current = currentRuleContext(context);
    const snapshot = readState(context).ruleSnapshot;
    if (
      current === null ||
      readState(context).ruleSnapshotStatus.status !== 'ready' ||
      snapshot.contextIdentity !== current.identity ||
      snapshot.selectedSpace !== selectionContext.selectedSpace ||
      snapshot.contextIdentity !== selectionContext.contextIdentity ||
      selectionContext.selectedSpace !== current.facts.selectedSpace
    )
      return null;
    const rule = snapshot.items.find(item => item.ruleRef === selectionContext.ruleRef);
    if (
      rule === undefined ||
      rule.applicationId.length === 0 ||
      (rule.targetMode === 'STORE_REFS' && !rule.storeRefs.includes(current.facts.storeRef))
    )
      return null;
    const fullArtifact = rule.full;
    const hotArtifact = rule.hot;
    if (
      fullArtifact === null ||
      fullArtifact.kind !== 'FULL' ||
      (rule.hot !== null && (hotArtifact === null || hotArtifact.kind !== 'HOT'))
    )
      return null;
    const strategy = Object.freeze({maxNetworkAttempts: 2, bootTimeoutMs: 60_000});
    return Object.freeze({
      ruleRef: rule.ruleRef,
      createdAt: rule.createdAtEpochMillis as never,
      applicationId: rule.applicationId,
      full: sourceFromSnapshotArtifact(fullArtifact),
      hot: hotArtifact === null ? null : sourceFromSnapshotArtifact(hotArtifact),
      strategy,
      selectionContext,
    });
  };
  const writeTask = async (
    context: ActorExecutionContext,
    task: TerminalUpdateTask | null,
    status: TerminalUpdateState['recentStatus'],
  ): Promise<boolean> => {
    const before = readState(context);
    const binding = currentBindingIdentity(context);
    const identity = binding?.identity ?? null;
    const previousDescriptor = before.reportDescriptor ?? emptyReportDescriptor(null);
    const associatedTask = task ?? (before.currentTask?.taskId === status.taskId ? before.currentTask : null);
    const reportContextIdentity =
      associatedTask?.target.selectionContext.contextIdentity ??
      currentRuleContext(context)?.identity ??
      before.ruleSnapshot.contextIdentity ??
      null;
    let descriptor =
      previousDescriptor.bindingIdentity === identity &&
      (reportContextIdentity === null ||
        previousDescriptor.contextIdentity === null ||
        previousDescriptor.contextIdentity === reportContextIdentity)
        ? previousDescriptor
        : emptyReportDescriptor(identity, reportContextIdentity);
    if (descriptor.contextIdentity === null && reportContextIdentity !== null)
      descriptor = Object.freeze({...descriptor, contextIdentity: reportContextIdentity});
    const recent: TerminalUpdateRecentStatus = Object.freeze({
      ...status,
      applicationId:
        associatedTask?.target.applicationId ?? status.applicationId ?? before.recentStatus.applicationId ?? null,
      ruleRef: associatedTask?.target.ruleRef ?? status.ruleRef ?? before.recentStatus.ruleRef ?? null,
      fullArtifactRef:
        associatedTask?.target.full?.artifactRef ??
        status.fullArtifactRef ??
        before.recentStatus.fullArtifactRef ??
        null,
      hotArtifactRef:
        associatedTask?.target.hot?.artifactRef ?? status.hotArtifactRef ?? before.recentStatus.hotArtifactRef ?? null,
    });
    const unchangedRecent =
      before.recentStatus.taskId === recent.taskId &&
      before.recentStatus.state === recent.state &&
      before.recentStatus.reason === recent.reason &&
      before.recentStatus.applicationId === recent.applicationId &&
      before.recentStatus.ruleRef === recent.ruleRef &&
      before.recentStatus.fullArtifactRef === recent.fullArtifactRef &&
      before.recentStatus.hotArtifactRef === recent.hotArtifactRef;
    const stableRecent = unchangedRecent
      ? Object.freeze({...recent, changedAt: before.recentStatus.changedAt})
      : recent;
    const report =
      identity === null || unchangedRecent
        ? null
        : createReportPayload(
            input.createProtocolUuid(),
            descriptor.nextReportSequence,
            associatedTask,
            before.actualVersions,
            stableRecent,
          );
    if (report !== null) {
      const key = recent.taskId ?? 'observation';
      const exists = Object.prototype.hasOwnProperty.call(descriptor.pendingReports, key);
      if (exists || Object.keys(descriptor.pendingReports).length < 64) {
        descriptor = Object.freeze({
          ...descriptor,
          nextReportSequence: descriptor.nextReportSequence + 1,
          pendingReports: Object.freeze({...descriptor.pendingReports, [key]: report}),
        });
      } else {
        descriptor = Object.freeze({
          ...descriptor,
          latestDeliveryFailure: Object.freeze({
            taskId: report.body.taskId,
            reportId: report.body.reportId,
            reportSequence: report.body.reportSequence,
            reasonCode: 'PENDING_REPORT_LIMIT',
            observedAt: nowTimestampMs(),
          }),
        });
      }
    }
    context.dispatchAction(actions.replaceTask(task));
    context.dispatchAction(actions.replaceRecentStatus(stableRecent));
    context.dispatchAction(actions.replaceReportDescriptor(descriptor));
    if (await persist(context)) return true;
    context.dispatchAction(actions.replaceTask(before.currentTask));
    context.dispatchAction(actions.replaceRecentStatus(before.recentStatus));
    context.dispatchAction(actions.replaceReportDescriptor(previousDescriptor));
    return false;
  };

  const sendPendingReport = async (context: ActorExecutionContext, signal: TerminalDataHeartbeatPayload) => {
    const checkedAt = nowTimestampMs();
    if (reportSendInFlight !== null && reportSendInFlight.expiresAt > checkedAt)
      return Object.freeze({status: 'in-flight'});
    reportSendInFlight = null;
    const binding = currentBindingIdentity(context);
    if (binding === null || binding.generation !== signal.bindingGeneration)
      return Object.freeze({status: 'stale-binding'});
    const current = currentRuleContext(context);
    const state = readState(context);
    const existingDescriptor = state.reportDescriptor ?? emptyReportDescriptor(null);
    if (current === null && existingDescriptor.contextIdentity !== null)
      return Object.freeze({status: 'context-not-ready'});
    if (current !== null && existingDescriptor.contextIdentity !== current.identity) {
      const next =
        existingDescriptor.bindingIdentity === binding.identity &&
        existingDescriptor.contextIdentity === null &&
        Object.keys(existingDescriptor.pendingReports).length === 0
          ? Object.freeze({...existingDescriptor, contextIdentity: current.identity})
          : emptyReportDescriptor(binding.identity, current.identity);
      context.dispatchAction(actions.replaceReportDescriptor(next));
      if (!(await persist(context))) {
        context.dispatchAction(actions.replaceReportDescriptor(existingDescriptor));
        return Object.freeze({status: 'context-reset-flush-failed'});
      }
      if (Object.keys(existingDescriptor.pendingReports).length > 0 || existingDescriptor.sendPaused)
        return Object.freeze({status: 'context-reset'});
    }
    const connection = selectConnectionState(context.getState());
    if (connection.status !== 'connected' || connection.sessionId !== signal.sessionId)
      return Object.freeze({status: 'stale-connection'});
    const descriptor = readState(context).reportDescriptor ?? emptyReportDescriptor(null);
    if (descriptor.bindingIdentity !== binding.identity) {
      context.dispatchAction(actions.replaceReportDescriptor(emptyReportDescriptor(binding.identity)));
      return Object.freeze({status: (await persist(context)) ? 'binding-reset' : 'persistence-failed'});
    }
    if (descriptor.sendPaused) return Object.freeze({status: 'paused'});
    const first = Object.entries(descriptor.pendingReports).sort(
      (a, b) => a[1].body.reportSequence - b[1].body.reportSequence,
    )[0];
    if (first === undefined) return Object.freeze({status: 'empty'});
    const [key, payload] = first;
    const attemptId = ++nextReportSendAttemptId;
    reportSendInFlight = Object.freeze({attemptId, expiresAt: checkedAt + topologyLateResultMaxTtlMs});
    let dispatchTimedOut = false;
    try {
      const dispatched = await context.dispatchCommand(submitTerminalUpdateReportCommand, payload, {
        lateResultTtlMs: topologyLateResultMaxTtlMs,
        lateOutcome: () => {
          if (reportSendInFlight?.attemptId === attemptId) reportSendInFlight = null;
        },
      });
      dispatchTimedOut = dispatched.status === 'timed-out';
      const currentBinding = currentBindingIdentity(context);
      const after = readState(context);
      const current = after.reportDescriptor ?? emptyReportDescriptor(null);
      if (
        currentBinding?.identity !== binding.identity ||
        current.bindingIdentity !== binding.identity ||
        current.pendingReports[key]?.idempotencyKey !== payload.idempotencyKey
      )
        return Object.freeze({status: 'stale-result'});
      const result = dispatched.actorResults.find(item => item.status === 'completed')?.result as
        | {
            kind: 'success';
            body: {
              reportId: string;
              taskId: string | null;
              acceptedSequence: number;
              outcome: 'ACCEPTED' | 'SUPERSEDED';
            };
          }
        | {kind: 'business-rejection'; status: number; errorCode: string}
        | {kind: 'failure'; category: string; code: string}
        | undefined;
      if (
        dispatched.status === 'completed' &&
        result?.kind === 'success' &&
        result.body.reportId === payload.body.reportId &&
        result.body.taskId === payload.body.taskId &&
        (result.body.outcome === 'ACCEPTED'
          ? result.body.acceptedSequence === payload.body.reportSequence
          : result.body.acceptedSequence > payload.body.reportSequence)
      ) {
        const pendingReports = {...current.pendingReports};
        delete pendingReports[key];
        context.dispatchAction(
          actions.replaceReportDescriptor(Object.freeze({...current, pendingReports: Object.freeze(pendingReports)})),
        );
        if (await persist(context)) return Object.freeze({status: 'accepted'});
        context.dispatchAction(actions.replaceReportDescriptor(current));
        return Object.freeze({status: 'receipt-flush-failed'});
      }
      if (result?.kind === 'business-rejection') {
        const identityRejected =
          result.errorCode === 'TERMINAL_BINDING_CREDENTIAL_INVALID' ||
          result.errorCode === 'STORE_TERMINAL_DISABLED' ||
          result.errorCode === 'PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED' ||
          result.errorCode === 'PLATFORM_COMMON_ACCESS_DENIED';
        if (identityRejected || result.status === 409 || result.status === 422 || result.status === 404) {
          const pendingReports = {...current.pendingReports};
          delete pendingReports[key];
          context.dispatchAction(
            actions.replaceReportDescriptor(
              Object.freeze({
                ...current,
                pendingReports: Object.freeze(pendingReports),
                sendPaused: current.sendPaused || identityRejected,
                latestDeliveryFailure: Object.freeze({
                  taskId: payload.body.taskId,
                  reportId: payload.body.reportId,
                  reportSequence: payload.body.reportSequence,
                  reasonCode: result.errorCode,
                  observedAt: nowTimestampMs(),
                }),
              }),
            ),
          );
          if (await persist(context)) return Object.freeze({status: 'terminal-rejection'});
          context.dispatchAction(actions.replaceReportDescriptor(current));
          return Object.freeze({status: 'rejection-flush-failed'});
        }
      }
      return Object.freeze({status: 'retry-retained'});
    } finally {
      if (!dispatchTimedOut && reportSendInFlight?.attemptId === attemptId) reportSendInFlight = null;
    }
  };

  const recordFailedArtifact = (context: ActorExecutionContext, task: TerminalUpdateTask, publicationId: string) => {
    const isFixedArtifact =
      task.target.full?.artifact.publicationId === publicationId ||
      task.target.hot?.artifact.publicationId === publicationId;
    if (!isFixedArtifact) return;
    const failedArtifactIds = readState(context).failedArtifactIds;
    if (!failedArtifactIds.includes(publicationId)) {
      context.dispatchAction(actions.replaceFailedArtifactIds([...failedArtifactIds, publicationId]));
    }
  };

  const releaseUnreferencedFullArtifact = async (task: TerminalUpdateTask, publicationId: string): Promise<boolean> => {
    if (task.preparedId === null || task.target.full?.artifact.publicationId !== publicationId) return true;
    const released = await port.releasePrepared({timeoutMs: 10_000, preparedId: task.preparedId});
    return released.status === 'succeeded' && released.value.released;
  };

  const executeNextArtifact = async (context: ActorExecutionContext, task: TerminalUpdateTask) => {
    let factsResult = await port.readFacts({timeoutMs: 10_000});
    if (factsResult.status !== 'succeeded') {
      if (!(await writeTask(context, task, createStatus(task.taskId, 'unknown', 'ACTUAL_FACTS_UNAVAILABLE'))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
      return Object.freeze({status: 'unknown', reason: factsResult.status});
    }
    context.dispatchAction(actions.replaceActualVersions(factsResult.value.actual));
    let fixedTask = task;
    if (fixedTask.originalBundleVersion == null || fixedTask.bootId === null) {
      const snapshot = Object.freeze({
        ...fixedTask,
        originalBundleVersion: fixedTask.originalBundleVersion ?? factsResult.value.actual?.bundleVersion ?? null,
        bootId: fixedTask.bootId ?? factsResult.value.actual?.bootId ?? null,
      });
      if (snapshot.originalBundleVersion === null || snapshot.bootId === null) {
        if (
          !(await writeTask(
            context,
            snapshot,
            createStatus(task.taskId, 'unknown', 'ACTUAL_BUNDLE_VERSION_UNAVAILABLE'),
          ))
        )
          return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
        return Object.freeze({status: 'unknown', reason: 'ACTUAL_BUNDLE_VERSION_UNAVAILABLE'});
      }
      if (!(await writeTask(context, snapshot, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_SELECTION'});
      fixedTask = snapshot;
    }
    if (fixedTask.originalBundleVersion == null) {
      if (
        !(await writeTask(
          context,
          fixedTask,
          createStatus(task.taskId, 'unknown', 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE'),
        ))
      )
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
      return Object.freeze({status: 'unknown', reason: 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE'});
    }
    let selected: ReturnType<typeof nextArtifact>;
    try {
      selected = nextArtifact(
        fixedTask.target,
        factsResult.value.actual,
        factsResult.value.embedded,
        fixedTask.originalBundleVersion,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/^TERMINAL_UPDATE_/u, '') : 'TARGET_INVALID';
      const failedTask = Object.freeze({...fixedTask, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    if (selected === null) {
      const complete = Object.freeze({
        ...fixedTask,
        phase: 'succeeded' as const,
        actionId: null,
        actionKind: null,
        preparedId: null,
        bootId: factsResult.value.actual?.bootId ?? fixedTask.bootId,
      });
      await writeTask(context, complete, createStatus(task.taskId, 'succeeded', null));
      return Object.freeze({status: 'succeeded'});
    }
    if (readState(context).failedArtifactIds.includes(selected.artifact.publicationId)) {
      const reason = 'FAILED_ARTIFACT_REENTRY_FORBIDDEN';
      const failedTask = Object.freeze({...fixedTask, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    if (
      readNetworkSnapshot === undefined ||
      (selected.artifactRef === undefined && sourceProvider?.resolveSourcePath === undefined)
    ) {
      const reason = 'UPDATE_SOURCE_OR_NETWORK_UNAVAILABLE';
      const failedTask = Object.freeze({...fixedTask, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    const actionId = createRequestId();
    const preparingPhase = selected.kind === 'full' ? ('preparing-full' as const) : ('preparing-hot' as const);
    const beforePrepare = Object.freeze({
      ...fixedTask,
      actionId,
      actionKind: selected.kind,
      preparedId: null,
      phase: preparingPhase,
    });
    if (!(await writeTask(context, beforePrepare, createStatus(task.taskId, 'preparing', null)))) {
      const reason = 'PERSISTENCE_FAILED_BEFORE_PREPARE';
      await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', reason));
      return Object.freeze({status: 'persistence-failed', reason});
    }

    let sourcePath: string | null = null;
    let downloadGrant: string | undefined;
    let artifactForPrepare: TerminalUpdateArtifact | null = null;
    if (selected.artifactRef !== undefined) {
      const issued = await context.dispatchCommand(
        requestTerminalUpdateDownloadGrantCommand,
        Object.freeze({artifactRef: selected.artifactRef}),
      );
      const result = issued.actorResults.find(record => record.status === 'completed')?.result as
        | {kind: 'success'; body: TerminalUpdateDownloadGrantResult}
        | {kind: 'business-rejection'; status: number; errorCode: string}
        | {kind: 'failure'; category: string; code: string}
        | undefined;
      if (
        issued.status !== 'completed' ||
        result?.kind !== 'success' ||
        result.body.artifactRef !== selected.artifactRef ||
        result.body.expiresAtEpochMillis <= Date.now() ||
        result.body.zipSha256 !== selected.expectedSha256
      ) {
        const reason = result?.kind === 'business-rejection' ? result.errorCode : 'DOWNLOAD_GRANT_UNAVAILABLE';
        const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
        await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
        return Object.freeze({status: 'failed', reason});
      }
      sourcePath = result.body.relativeContentPath;
      downloadGrant = result.body.grant;
      const expectedSource = selected.kind === 'full' ? fixedTask.target.full : fixedTask.target.hot;
      artifactForPrepare = fullManifestFromGrant(
        result.body.artifact,
        expectedSource,
        fixedTask.target.full,
        selected.kind === 'hot',
      );
      if (artifactForPrepare === null) {
        const reason = 'DOWNLOAD_ARTIFACT_IDENTITY_MISMATCH';
        const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
        await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
        return Object.freeze({status: 'failed', reason});
      }
    } else {
      sourcePath = await sourceProvider!.resolveSourcePath!(selected.sourceRef);
      const localArtifact = selected.manifest ?? (selected.artifact as TerminalUpdateArtifact);
      if (
        !Array.isArray(localArtifact.files) ||
        localArtifact.files.length === 0 ||
        localArtifact.entry.length === 0 ||
        localArtifact.publicationId !== selected.artifact.publicationId
      ) {
        const reason = 'LOCAL_ARTIFACT_MANIFEST_INVALID';
        const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
        await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
        return Object.freeze({status: 'failed', reason});
      }
      artifactForPrepare = localArtifact;
    }
    if (sourcePath === null) {
      const reason = 'SOURCE_UNAVAILABLE';
      const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    const network = readNetworkSnapshot(context.getState(), 'business');
    const prepared = await port.prepareArtifact({
      timeoutMs: 120_000,
      sourceRef: selected.sourceRef,
      expectedSha256: selected.expectedSha256,
      artifact: artifactForPrepare!,
      sourcePath,
      ...(downloadGrant === undefined ? {} : {downloadGrant}),
      network,
      kind: selected.kind,
    });
    if (prepared.status !== 'succeeded') {
      const reason = prepared.status === 'failed' ? prepared.error.code : `PREPARE_${prepared.status.toUpperCase()}`;
      const state =
        prepared.status === 'timed-out' || prepared.status === 'unavailable'
          ? ('unknown' as const)
          : ('failed' as const);
      const failedTask = Object.freeze({...beforePrepare, phase: state, failureCode: reason});
      if (state === 'failed') recordFailedArtifact(context, fixedTask, selected.artifact.publicationId);
      await writeTask(context, failedTask, createStatus(task.taskId, state, reason));
      return Object.freeze({status: state, reason});
    }

    const applyingPhase = selected.kind === 'full' ? ('applying-full' as const) : ('applying-hot' as const);
    const applying = Object.freeze({...beforePrepare, preparedId: prepared.value.preparedId, phase: applyingPhase});
    if (!(await writeTask(context, applying, createStatus(task.taskId, 'applying', null)))) {
      await port.releasePrepared({timeoutMs: 10_000, preparedId: prepared.value.preparedId});
      const reason = 'PERSISTENCE_FAILED_BEFORE_APPLY';
      await writeTask(context, task, createStatus(task.taskId, 'fixed', reason));
      return Object.freeze({status: 'persistence-failed', reason});
    }

    const applied = await port.applyPrepared({
      timeoutMs: selected.kind === 'hot' ? 60_000 : 120_000,
      taskId: task.taskId,
      actionId,
      preparedId: prepared.value.preparedId,
      kind: selected.kind,
    });
    if (applied.status !== 'succeeded') {
      const reason = applied.status === 'failed' ? applied.error.code : `APPLY_${applied.status.toUpperCase()}`;
      const state =
        applied.status === 'timed-out' || applied.status === 'unavailable' ? ('unknown' as const) : ('failed' as const);
      const failedTask = Object.freeze({...applying, phase: state, failureCode: reason});
      if (state === 'failed') recordFailedArtifact(context, fixedTask, selected.artifact.publicationId);
      await writeTask(context, failedTask, createStatus(task.taskId, state, reason));
      return Object.freeze({status: state, reason});
    }
    const action = applied.value;
    if (action.taskId !== task.taskId || action.actionId !== applying.actionId) {
      const reason = 'ACTION_IDENTITY_MISMATCH';
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', reason));
      return Object.freeze({status: 'unknown', reason});
    }
    if (action.state === 'failed') recordFailedArtifact(context, fixedTask, action.publicationId);
    const fullActionTerminal = selected.kind === 'full' && (action.state === 'succeeded' || action.state === 'failed');
    const fullPreparedReleased =
      !fullActionTerminal || (await releaseUnreferencedFullArtifact(applying, action.publicationId));
    const status =
      action.state === 'waiting-user' || action.state === 'user-cancelled'
        ? ('waiting-user' as const)
        : action.state === 'failed'
          ? ('failed' as const)
          : action.state === 'succeeded'
            ? ('succeeded' as const)
            : action.state === 'unknown'
              ? ('unknown' as const)
              : ('applying' as const);
    const phase =
      action.state === 'waiting-user' || action.state === 'user-cancelled'
        ? ('waiting-user' as const)
        : action.state === 'failed'
          ? ('failed' as const)
          : action.state === 'succeeded'
            ? ('succeeded' as const)
            : action.state === 'unknown' && action.reason !== 'INSTALLER_AWAITING_READBACK'
              ? ('unknown' as const)
              : applyingPhase;
    if (fullActionTerminal && !fullPreparedReleased) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
      return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
    }
    const next = Object.freeze({
      ...applying,
      phase,
      preparedId: fullActionTerminal ? null : applying.preparedId,
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, next, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, actionId: action.actionId, reason: action.reason});
  };

  const reconcile = async (context: ActorExecutionContext, resumeFixedTask: boolean) => {
    const result = await port.readFacts({timeoutMs: 10_000});
    if (result.status !== 'succeeded') return Object.freeze({status: 'unavailable', reason: result.status});
    context.dispatchAction(actions.replaceActualVersions(result.value.actual));
    const task = readState(context).currentTask;
    if (task === null) return Object.freeze({status: 'read'});
    if (
      (task.phase === 'succeeded' || task.phase === 'failed') &&
      result.value.actual !== null &&
      task.bootId !== null &&
      task.bootId !== result.value.actual.bootId
    ) {
      const recentStatus = readState(context).recentStatus;
      if (!(await writeTask(context, null, recentStatus)))
        return Object.freeze({status: 'persistence-failed', reason: 'TERMINAL_TASK_RELEASE_FAILED'});
      return Object.freeze({status: 'terminal-task-released', taskId: task.taskId});
    }
    if (task.phase === 'fixed' && task.actionId === null && !resumeFixedTask) {
      return Object.freeze({status: 'fixed', continuation: 'PRIMARY_READY'});
    }
    if (task.actionId === null)
      return task.phase === 'fixed' ? executeNextArtifact(context, task) : Object.freeze({status: task.phase});
    const actionResult = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId: task.actionId});
    if (actionResult.status !== 'succeeded' || actionResult.value === null) {
      const reason =
        actionResult.status === 'failed' ? actionResult.error.code : `ACTION_${actionResult.status.toUpperCase()}`;
      context.dispatchAction(actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', reason)));
      return Object.freeze({status: 'unknown', reason});
    }
    const action = actionResult.value;
    if (action.taskId !== task.taskId || action.actionId !== task.actionId) {
      context.dispatchAction(
        actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', 'ACTION_IDENTITY_MISMATCH')),
      );
      return Object.freeze({status: 'unknown', reason: 'ACTION_IDENTITY_MISMATCH'});
    }
    const actionArtifact =
      task.actionKind === 'full' ? task.target.full : task.actionKind === 'hot' ? task.target.hot : null;
    if (actionArtifact === null || action.publicationId !== actionArtifact.artifact.publicationId) {
      const reason = 'ACTION_PUBLICATION_IDENTITY_MISMATCH';
      context.dispatchAction(actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', reason)));
      return Object.freeze({status: 'unknown', reason});
    }
    if (action.state === 'accepted') {
      // The native system accepted the action but has not reported a terminal
      // outcome. Preserve the task phase and action identity for the next real
      // readback; treating this as UNKNOWN loses the FULL→HOT continuation.
      await writeTask(context, task, createStatus(task.taskId, 'applying', null));
      return Object.freeze({status: 'applying', actionId: task.actionId});
    }
    const actualBootId = result.value.actual?.bootId ?? null;
    if (action.state === 'succeeded' && actualBootId === null) {
      const reason = 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE';
      const unknown = Object.freeze({...task, phase: 'unknown' as const, failureCode: reason});
      await writeTask(context, unknown, createStatus(task.taskId, 'unknown', reason));
      return Object.freeze({status: 'unknown', reason});
    }
    if (action.state === 'succeeded' && task.actionKind === 'full' && task.target.hot !== null) {
      if (task.originalBundleVersion == null) {
        const reason = 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE';
        const unknown = Object.freeze({...task, phase: 'unknown' as const, failureCode: reason});
        await writeTask(context, unknown, createStatus(task.taskId, 'unknown', reason));
        return Object.freeze({status: 'unknown', reason});
      }
      if (!(await releaseUnreferencedFullArtifact(task, action.publicationId))) {
        await writeTask(context, task, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
        return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
      }
      const fixed = Object.freeze({
        ...task,
        phase: 'fixed' as const,
        actionId: null,
        actionKind: null,
        preparedId: null,
        bootId: actualBootId,
      });
      if (!(await writeTask(context, fixed, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', taskId: task.taskId});
      if (!resumeFixedTask) {
        return Object.freeze({status: 'fixed', continuation: 'PRIMARY_READY'});
      }
      return executeNextArtifact(context, fixed);
    }
    if (action.state === 'failed') recordFailedArtifact(context, task, action.publicationId);
    const status =
      action.state === 'succeeded'
        ? ('succeeded' as const)
        : action.state === 'waiting-user' || action.state === 'user-cancelled'
          ? ('waiting-user' as const)
          : action.state === 'failed'
            ? ('failed' as const)
            : ('unknown' as const);
    const phase =
      action.state === 'succeeded'
        ? ('succeeded' as const)
        : action.state === 'waiting-user' || action.state === 'user-cancelled'
          ? ('waiting-user' as const)
          : action.state === 'failed'
            ? ('failed' as const)
            : ('unknown' as const);
    const isCompletedFullAction =
      task.target.full?.artifact.publicationId === action.publicationId &&
      (action.state === 'succeeded' || action.state === 'failed');
    if (isCompletedFullAction && !(await releaseUnreferencedFullArtifact(task, action.publicationId))) {
      await writeTask(context, task, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
      return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
    }
    const updated = Object.freeze({
      ...task,
      phase,
      preparedId: isCompletedFullAction ? null : task.preparedId,
      bootId: action.state === 'succeeded' ? actualBootId : (action.bootId ?? task.bootId),
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, updated, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, reason: action.reason});
  };

  const confirmBoot = async (
    context: ActorExecutionContext,
    payload: Readonly<{bootToken: string; publicationId: string}>,
  ) => {
    const current = readState(context);
    const actual = current.actualVersions;
    if (actual === null || actual.bootId !== payload.bootToken || actual.publicationId !== payload.publicationId)
      return Object.freeze({status: 'rejected', reason: 'BOOT_IDENTITY_NOT_CURRENT'});
    const task = current.currentTask;
    const result = await port.confirmBoot({
      timeoutMs: task?.target.strategy.bootTimeoutMs ?? 10_000,
      bootToken: payload.bootToken,
      publicationId: payload.publicationId,
    });
    if (result.status !== 'succeeded') {
      const reason = result.status === 'failed' ? result.error.code : `CONFIRM_${result.status.toUpperCase()}`;
      const reconciled = await reconcile(context, true);
      if (reconciled.status === 'failed') return reconciled;
      return Object.freeze({status: 'unknown', reason});
    }
    return reconcile(context, true);
  };

  return defineActor(moduleName, 'update-owner', [
    onCommand(clearTerminalUpdateReportContextCommand, async context => {
      context.dispatchAction(actions.replaceReportDescriptor(emptyReportDescriptor(null)));
      return Object.freeze({status: (await persist(context)) ? 'cleared' : 'persistence-failed'});
    }),
    onCommand(refreshTerminalUpdateRuleSnapshotCommand, context => refreshRuleSnapshot(context)),
    onCommand(terminalTopicChangedCommand, async context => {
      const payload = context.command.payload;
      const notification = payload.notification;
      const current = currentRuleContext(context);
      if (
        payload.subscriberKey !== ruleTopicSubscriberKey ||
        current === null ||
        notification.topicKey !== terminalUpdateTopicKey ||
        notification.ownerRef !== current.facts.projectRef ||
        payload.terminalRef !== current.facts.terminalRef ||
        payload.bindingGeneration !== current.facts.bindingGeneration
      )
        return Object.freeze({status: 'ignored'});
      const refreshed = await refreshRuleSnapshot(context);
      if (refreshed.status !== 'ready') return Object.freeze({status: 'refresh-failed', reason: refreshed.status});
      const accepted = await context.dispatchCommand(
        acceptTerminalTopicNotificationCommand,
        Object.freeze({
          subscriberKey: ruleTopicSubscriberKey,
          subscriptionId: notification.subscriptionId,
          notificationId: notification.notificationId,
        }),
      );
      return Object.freeze({status: accepted.status === 'completed' ? 'accepted' : 'accept-failed'});
    }),
    onCommand(terminalDataHeartbeatCommand, context => sendPendingReport(context, context.command.payload)),
    onCommand(primarySurfaceReadyCommand, context => {
      const current = readState(context);
      const task = current.currentTask;
      context.platformPorts.logger.info({
        category: 'terminal-update.primary-ready',
        event: 'terminal-update.primary-ready-received',
        message: 'Terminal update owner received the generic primary-surface readiness fact',
        data: {
          contentReady: context.command.payload.contentReady,
          taskPhase: task?.phase ?? 'NONE',
          actionPending: task?.actionId === null || task === null ? 0 : 1,
        },
      });
      if (!context.command.payload.contentReady) return Object.freeze({status: 'not-ready'});
      const actual = current.actualVersions;
      // Primary readiness is a lifecycle acknowledgement, not an update
      // completion barrier. A resumed artifact may wait on network/storage for
      // minutes; keeping that work on the startup actor leaves the native
      // loading surface over the now-rendered app and prevents real UI input.
      // Keep update policy here in the base owner, but run it through the
      // existing commands after acknowledging the readiness fact.
      if (actual === null) return Object.freeze({status: 'actual-boot-unavailable'});
      void (async () => {
        const result = await context.dispatchCommand(confirmTerminalUpdateBootCommand, {
          bootToken: actual.bootId,
          publicationId: actual.publicationId,
        });
        context.platformPorts.logger.info({
          category: 'terminal-update.primary-ready',
          event: 'terminal-update.primary-ready-continuation-result',
          message: 'Terminal update owner completed its primary-ready readback',
          data: {
            taskId: task?.taskId ?? null,
            dispatchStatus: result.status,
          },
        });
      })().catch(error => {
        context.platformPorts.logger.error({
          category: 'terminal-update.primary-ready',
          event: 'terminal-update.primary-ready-continuation-failed',
          message: 'Terminal update owner failed its asynchronous primary-ready continuation',
          data: {taskId: task?.taskId ?? null, errorName: error instanceof Error ? error.name : 'UnknownError'},
        });
      });
      return Object.freeze({status: 'scheduled', taskId: task?.taskId ?? null});
    }),
    onCommand(reconcileTerminalUpdateCommand, context => reconcile(context, context.command.payload.resumeFixedTask)),
    onCommand(acceptTerminalUpdateTargetCommand, async context => {
      const resumeAfterCancelledInstall = async (task: TerminalUpdateTask, publicationId: string) => {
        // A later explicit acceptance may recreate a session for the same fixed
        // target. Pending or unknown installer sessions stay untouched.
        if (task.target.full?.artifact.publicationId !== publicationId) {
          const reason = 'ACTION_ARTIFACT_IDENTITY_MISMATCH';
          await writeTask(context, task, createStatus(task.taskId, 'unknown', reason));
          return Object.freeze({status: 'unknown', reason});
        }
        if (!(await releaseUnreferencedFullArtifact(task, publicationId))) {
          await writeTask(context, task, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
          return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
        }
        const ready = Object.freeze({
          ...task,
          phase: 'fixed' as const,
          actionId: null,
          actionKind: null,
          preparedId: null,
          failureCode: null,
        });
        if (!(await writeTask(context, ready, createStatus(task.taskId, 'fixed', null))))
          return Object.freeze({status: 'persistence-failed', taskId: task.taskId});
        return executeNextArtifact(context, ready);
      };
      const selectionContext = context.command.payload.selectionContext;
      if (targetCommitPending !== null) await targetCommitPending;
      const current = readState(context);
      if (current.currentTask !== null) {
        const sameSelection =
          JSON.stringify(current.currentTask.target.selectionContext) === JSON.stringify(selectionContext);
        if (!sameSelection) return Object.freeze({status: 'rejected', reason: 'IDENTITY_CONFLICT'});
        const task = current.currentTask;
        if (task.actionId !== null) {
          const observed = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId: task.actionId});
          if (
            observed.status !== 'succeeded' ||
            observed.value === null ||
            observed.value.taskId !== task.taskId ||
            observed.value.actionId !== task.actionId
          ) {
            return Object.freeze({status: 'unknown', reason: 'INSTALLER_STATE_UNAVAILABLE'});
          }
          if (observed.value.state === 'user-cancelled')
            return resumeAfterCancelledInstall(task, observed.value.publicationId);
        }
        return Object.freeze({status: 'already-fixed', reason: null});
      }

      const target =
        sourceProvider === undefined
          ? targetFromRuleSnapshot(context, selectionContext)
          : await sourceProvider.readTarget(selectionContext);
      if (target === null) return Object.freeze({status: 'rejected', reason: 'SOURCE_UNAVAILABLE'});
      if (!validTarget(target) || JSON.stringify(target.selectionContext) !== JSON.stringify(selectionContext))
        return Object.freeze({status: 'rejected', reason: 'TARGET_INVALID'});

      const actualIdentity = await port.readFacts({timeoutMs: 10_000});
      if (
        actualIdentity.status !== 'succeeded' ||
        typeof actualIdentity.value.actual?.applicationId !== 'string' ||
        actualIdentity.value.actual.applicationId.length === 0
      ) {
        context.platformPorts.logger.warn({
          category: 'terminal-update.rules',
          event: 'terminal-update.rules.target-identity-unavailable',
          message: 'Could not verify the current application identity before accepting an update target',
          data: {
            readStatus: actualIdentity.status,
            actualIdentityPresent:
              actualIdentity.status === 'succeeded' &&
              typeof actualIdentity.value.actual?.applicationId === 'string' &&
              actualIdentity.value.actual.applicationId.length > 0,
          },
        });
        return Object.freeze({status: 'unknown', reason: 'ACTUAL_IDENTITY_UNAVAILABLE'});
      }
      context.dispatchAction(actions.replaceActualVersions(actualIdentity.value.actual));
      const applicationMatches = target.applicationId === actualIdentity.value.actual.applicationId;
      context.platformPorts.logger.info({
        category: 'terminal-update.rules',
        event: 'terminal-update.rules.target-identity-checked',
        message: 'Compared the selected rule application with this application before fixing the target',
        data: {applicationMatches},
      });
      if (!applicationMatches) return Object.freeze({status: 'rejected', reason: 'APPLICATION_ID_MISMATCH'});

      // Another root command may have fixed a target while the provider was awaited.
      // Serialize only this persistence commit, then re-read its authoritative result.
      if (targetCommitPending !== null) await targetCommitPending;
      const latestTask = readState(context).currentTask;
      if (latestTask !== null) {
        const sameTarget = JSON.stringify(latestTask.target) === JSON.stringify(target);
        return Object.freeze({
          status: sameTarget ? 'already-fixed' : 'rejected',
          reason: sameTarget ? null : 'IDENTITY_CONFLICT',
        });
      }
      const taskId = input.createProtocolUuid();
      const task: TerminalUpdateTask = Object.freeze({
        taskId,
        target,
        phase: 'fixed',
        actionId: null,
        actionKind: null,
        preparedId: null,
        bootId: null,
        failureCode: null,
        originalBundleVersion: null,
      });
      let finishTargetCommit!: () => void;
      const targetCommit = new Promise<void>(resolve => {
        finishTargetCommit = resolve;
      });
      targetCommitPending = targetCommit;
      const beforeCommit = readState(context);
      try {
        context.dispatchAction(actions.replaceTask(task));
        context.dispatchAction(actions.replaceRecentStatus(createStatus(taskId, 'fixed', null)));
        if (!(await persist(context))) {
          context.dispatchAction(actions.replaceTask(beforeCommit.currentTask));
          context.dispatchAction(actions.replaceRecentStatus(beforeCommit.recentStatus));
          await persist(context);
          return Object.freeze({status: 'persistence-failed', taskId});
        }
      } finally {
        if (targetCommitPending === targetCommit) targetCommitPending = null;
        finishTargetCommit();
      }
      return executeNextArtifact(context, task);
    }),
    onCommand(confirmTerminalUpdateBootCommand, context => confirmBoot(context, context.command.payload)),
  ]);
};
