import {createRequestId, nowTimestampMs, topologyLateResultMaxTtlMs} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  onCommand,
  type ActorExecutionContext,
  type ActorDefinition,
  primarySurfaceReadyCommand,
  selectLastLocalInteraction,
  selectRuntimeInstanceMode,
} from '@catering-v2s/kernel-base-runtime';
import {
  requestTerminalUpdateDownloadGrantCommand,
  terminalDataHeartbeatCommand,
  type TerminalDataHeartbeatPayload,
  selectActivationState,
  submitTerminalUpdateReportCommand,
  selectConnectionState,
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
import type {UpdatePresentation} from '@catering-v2s/kernel-base-platform-ports';
import {terminalUpdateSliceName} from '../slices/terminalUpdate';
import {terminalUpdateActions} from '../slices/terminalUpdate';
import {
  requestTerminalUpdateCommand,
  clearTerminalUpdateReportContextCommand,
  confirmTerminalUpdateBootCommand,
  confirmTerminalUpdateInstallCommand,
  deferTerminalUpdateInstallCommand,
  reconcileTerminalUpdateCommand,
  terminalUpdateDeadlineCommand,
  updatePresentationChangedCommand,
} from '../commands/commands';
import type {
  FixedUpdateTarget,
  TerminalUpdateRecentStatus,
  TerminalUpdateState,
  TerminalUpdateTask,
  CurrentUpdateTargetReader,
  UpdateNetworkSnapshotReader,
  UpdateTargetSourceProvider,
  TerminalUpdateContextFacts,
} from '../../types/terminalUpdate';

const actualVersionObservationFactsKey = (actual: UpdateActualVersions): string =>
  JSON.stringify([
    actual.applicationId,
    actual.nativeVersion,
    actual.nativeBuildNumber,
    actual.apkSha256 ?? null,
    actual.runtimeVersion,
    actual.bundleVersion,
    actual.publicationId,
    actual.entryKind,
  ]);

type TerminalUpdateActorInput = Readonly<{
  port: UpdatePort;
  createProtocolUuid: () => string;
  sourceProvider?: UpdateTargetSourceProvider;
  readCurrentTarget?: CurrentUpdateTargetReader;
  readTerminalUpdateContextFacts?: (
    state: ReturnType<ActorExecutionContext['getState']>,
  ) => TerminalUpdateContextFacts | null;
  readFixedTerminalUpdateContextFacts?: (
    state: ReturnType<ActorExecutionContext['getState']>,
  ) => TerminalUpdateContextFacts | null;
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
const writeLifecycleLog = (
  input: Readonly<{
    context: ActorExecutionContext;
    event: string;
    data: Readonly<Record<string, string | number | boolean | null>>;
    level: 'info' | 'warn';
  }>,
): void => {
  const {context, event, data, level} = input;
  const baseLogger = context.platformPorts.logger;
  const logger =
    typeof baseLogger.scope === 'function'
      ? baseLogger.scope({
          moduleName,
          layer: 'kernel',
          subsystem: 'terminal-update',
          component: 'update-lifecycle',
        })
      : baseLogger;
  const log = level === 'warn' ? logger.warn.bind(logger) : logger.info.bind(logger);
  log({
    category: 'terminal.update.lifecycle',
    event,
    message: 'Terminal update owner lifecycle boundary',
    context: {
      commandId: context.command.commandId,
      ...(context.command.requestId == null ? {} : {requestId: context.command.requestId}),
    },
    data,
  });
};
const logLifecycle = (
  context: ActorExecutionContext,
  event: string,
  data: Readonly<Record<string, string | number | boolean | null>>,
): void => writeLifecycleLog({context, event, data, level: 'info'});
const logLifecycleWarning = (
  context: ActorExecutionContext,
  event: string,
  data: Readonly<Record<string, string | number | boolean | null>>,
): void => writeLifecycleLog({context, event, data, level: 'warn'});
const logLifecycleAtLevel = (
  context: ActorExecutionContext,
  input: Readonly<{
    event: string;
    data: Readonly<Record<string, string | number | boolean | null>>;
    level: 'info' | 'warn';
  }>,
): void => writeLifecycleLog({...input, context});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isArtifactSource = (value: unknown): value is NonNullable<FixedUpdateTarget['full']> => {
  if (
    !isRecord(value) ||
    typeof value.sourceRef !== 'string' ||
    value.sourceRef.length === 0 ||
    typeof value.expectedSha256 !== 'string' ||
    !isRecord(value.artifact)
  )
    return false;
  const artifact = value.artifact;
  return (
    typeof artifact.applicationId === 'string' &&
    typeof artifact.nativeVersion === 'string' &&
    Number.isSafeInteger(artifact.nativeBuildNumber) &&
    typeof artifact.bundleVersion === 'string' &&
    typeof artifact.runtimeVersion === 'string' &&
    typeof artifact.publicationId === 'string' &&
    (value.apkSha256 === undefined || value.apkSha256 === null || typeof value.apkSha256 === 'string') &&
    (value.artifactRef === undefined || typeof value.artifactRef === 'string') &&
    (value.manifest === undefined || isRecord(value.manifest))
  );
};
const validTarget = (value: unknown): value is FixedUpdateTarget => {
  if (
    !isRecord(value) ||
    typeof value.ruleRef !== 'string' ||
    value.ruleRef.length === 0 ||
    typeof value.collectionHash !== 'string' ||
    value.collectionHash.length === 0 ||
    !Number.isSafeInteger(value.createdAt) ||
    typeof value.applicationId !== 'string' ||
    value.applicationId.length === 0 ||
    !isRecord(value.policy) ||
    !isRecord(value.strategy) ||
    !isRecord(value.selectionContext)
  )
    return false;
  const full = value.full;
  const hot = value.hot;
  const policy = value.policy;
  const strategy = value.strategy;
  const selection = value.selectionContext;
  if (
    !(full === null || isArtifactSource(full)) ||
    !(hot === null || isArtifactSource(hot)) ||
    (full === null && hot === null) ||
    !Number.isSafeInteger(policy.nSeconds) ||
    Number(policy.nSeconds) < 60 ||
    Number(policy.nSeconds) > 86_400 ||
    !Number.isSafeInteger(strategy.maxNetworkAttempts) ||
    Number(strategy.maxNetworkAttempts) < 0 ||
    !Number.isSafeInteger(strategy.bootTimeoutMs) ||
    Number(strategy.bootTimeoutMs) <= 0 ||
    typeof selection.selectedSpace !== 'string' ||
    typeof selection.contextIdentity !== 'string' ||
    typeof selection.ruleRef !== 'string' ||
    selection.ruleRef !== value.ruleRef
  )
    return false;
  const hotStrategy = policy.hotStrategy;
  const mSeconds = policy.mSeconds;
  if (
    hot === null
      ? hotStrategy !== null || mSeconds !== null
      : hotStrategy === 'IMMEDIATE'
        ? mSeconds !== null
        : hotStrategy !== 'IDLE' ||
          !Number.isSafeInteger(mSeconds) ||
          Number(mSeconds) < 60 ||
          Number(mSeconds) > 86_400
  )
    return false;
  return (
    (full === null ||
      (full as NonNullable<FixedUpdateTarget['full']>).artifact.applicationId === value.applicationId) &&
    (hot === null || (hot as NonNullable<FixedUpdateTarget['hot']>).artifact.applicationId === value.applicationId) &&
    (full === null ||
      hot === null ||
      (full as NonNullable<FixedUpdateTarget['full']>).artifact.runtimeVersion ===
        (hot as NonNullable<FixedUpdateTarget['hot']>).artifact.runtimeVersion)
  );
};

const fullManifestFromGrant = (
  input: Readonly<{
    manifest: TerminalUpdateDownloadGrantResult['artifact'];
    expected: FixedUpdateTarget['full'] | FixedUpdateTarget['hot'];
    expectedFull: FixedUpdateTarget['full'];
    requireMinimumFull: boolean;
  }>,
): TerminalUpdateArtifact | null => {
  const {manifest, expected, expectedFull, requireMinimumFull} = input;
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
  if (value === 'APPLICATION_ID_MISMATCH') return 'INCOMPATIBLE';
  if (
    value === 'FULL_RUNTIME_MISMATCH' ||
    value === 'HOT_RUNTIME_MISMATCH' ||
    value === 'FULL_IDENTITY_CONFLICT' ||
    value === 'HOT_IDENTITY_CONFLICT'
  )
    return 'INCOMPATIBLE';
  if (value === 'FULL_ONLY_VERSION_DOWNGRADE' || value === 'HOT_VERSION_DOWNGRADE') return 'WOULD_DOWNGRADE';
  if (value === 'FAILED_ARTIFACT_REENTRY_FORBIDDEN') return 'FAILED_ARTIFACT';
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
  task: TerminalUpdateTask | null,
): TerminalUpdateReportPayload['body']['recent']['state'] => {
  switch (state) {
    case 'waiting-idle':
      return 'WAITING_IDLE';
    case 'waiting-user':
      return 'WAITING_USER';
    case 'admission-rejected':
      return 'ADMISSION_REJECTED';
    case 'preparing':
      return 'DOWNLOADING';
    case 'applying':
      return task?.actionKind === 'hot' || task?.phase === 'applying-hot' ? 'APPLYING_HOT' : 'INSTALLING';
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
  input: Readonly<{
    reportId: string;
    sequence: number;
    task: TerminalUpdateTask | null;
    actual: UpdateActualVersions | null;
    status: TerminalUpdateRecentStatus;
  }>,
): TerminalUpdateReportPayload | null => {
  const {reportId, sequence, task, actual, status} = input;
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
      unknownReason:
        actual === null
          ? 'READBACK_UNAVAILABLE'
          : actual.entryKind === 'file-recovery' || actual.entryKind === 'unknown'
            ? 'OTHER'
            : null,
    }),
    recent: Object.freeze({
      state: toReportState(status.state, task),
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
  input: Readonly<{
    target: FixedUpdateTarget;
    actual: UpdateActualVersions | null;
    embedded: UpdateFacts['embedded'];
    originalBundleVersion: string;
  }>,
): Readonly<{
  kind: 'full' | 'hot';
  sourceRef: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['sourceRef'];
  artifactRef?: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['artifactRef'];
  expectedSha256: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['expectedSha256'];
  artifact: NonNullable<FixedUpdateTarget['full'] | FixedUpdateTarget['hot']>['artifact'];
  manifest?: TerminalUpdateArtifact;
}> | null => {
  const {target, actual, embedded, originalBundleVersion} = input;
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
  let currentPresentation: UpdatePresentation = 'unknown';
  const emptyReportDescriptor = (
    bindingIdentity: string | null,
    contextIdentity: string | null = null,
    nextReportSequence = 1,
  ): TerminalUpdateState['reportDescriptor'] =>
    Object.freeze({
      bindingIdentity,
      contextIdentity,
      nextReportSequence,
      lastObservationFactsKey: null,
      pendingReports: Object.freeze({}),
      sendPaused: false,
      latestDeliveryFailure: null,
    });
  const reportDescriptorForContext = (
    previous: TerminalUpdateState['reportDescriptor'],
    bindingIdentity: string,
    contextIdentity: string,
  ): TerminalUpdateState['reportDescriptor'] => {
    if (previous.bindingIdentity !== bindingIdentity) return emptyReportDescriptor(bindingIdentity, contextIdentity);
    if (previous.contextIdentity === contextIdentity) return previous;
    // A project/context change invalidates pending bodies, but report sequence is
    // scoped to the binding cycle and must remain monotonic for CBS uniqueness.
    return emptyReportDescriptor(bindingIdentity, contextIdentity, previous.nextReportSequence);
  };
  const writeReportDescriptor = async (
    context: ActorExecutionContext,
    descriptor: TerminalUpdateState['reportDescriptor'],
  ): Promise<boolean> => {
    const previous = readState(context).reportDescriptor;
    context.dispatchAction(actions.replaceReportDescriptor(descriptor));
    const persistStartedAt = Date.now();
    const persistResult = await context.flushPersistence();
    const persisted = persistResult.status === 'succeeded';
    logLifecycleAtLevel(context, {
      event: persisted ? 'report-descriptor-persisted' : 'report-descriptor-persist-failed',
      data: {
        nextReportSequence: descriptor.nextReportSequence,
        pendingReportCount: Object.keys(descriptor.pendingReports).length,
        sendPaused: descriptor.sendPaused,
        bindingIdentityPresent: descriptor.bindingIdentity !== null,
        contextIdentityPresent: descriptor.contextIdentity !== null,
        persistenceStatus: persistResult.status,
        elapsedMs: Math.max(0, Date.now() - persistStartedAt),
      },
      level: persisted ? 'info' : 'warn',
    });
    if (persisted) return true;
    context.dispatchAction(actions.replaceReportDescriptor(previous));
    return false;
  };
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
  const currentUpdateTargetBindingIdentity = (
    context: ActorExecutionContext,
  ): Readonly<{identity: string; generation: number}> | null => {
    let activation: ReturnType<typeof selectActivationState>;
    let instanceMode: ReturnType<typeof selectRuntimeInstanceMode>;
    try {
      const state = context.getState();
      activation = selectActivationState(state);
      instanceMode = selectRuntimeInstanceMode(state);
    } catch {
      return null;
    }
    const statusMatchesRole =
      (instanceMode === 'MASTER' && activation.status === 'active') ||
      (instanceMode === 'SLAVE' && activation.status === 'inactive');
    if (!statusMatchesRole || activation.terminalRef === null || activation.bindingGeneration === null) return null;
    return Object.freeze({
      identity: `${activation.terminalRef}:${activation.bindingGeneration}`,
      generation: activation.bindingGeneration,
    });
  };
  const currentRuleContext = (
    context: ActorExecutionContext,
    fixedTask = false,
  ): Readonly<{
    readonly facts: TerminalUpdateContextFacts;
    readonly identity: string;
  }> | null => {
    const contextReader = fixedTask
      ? (input.readFixedTerminalUpdateContextFacts ?? input.readTerminalUpdateContextFacts)
      : input.readTerminalUpdateContextFacts;
    const facts = contextReader?.(context.getState());
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
  const writeTaskWithOptions = async (
    options: Readonly<{
      context: ActorExecutionContext;
      task: TerminalUpdateTask | null;
      status: TerminalUpdateState['recentStatus'];
      initialObservation?: boolean;
    }>,
  ): Promise<boolean> => {
    const {context, task, status, initialObservation = false} = options;
    const before = readState(context);
    const binding = currentBindingIdentity(context);
    const identity = binding?.identity ?? null;
    const previousDescriptor = before.reportDescriptor ?? emptyReportDescriptor(null);
    const associatedTask = initialObservation
      ? null
      : (task ?? (before.currentTask?.taskId === status.taskId ? before.currentTask : null));
    const reportContextIdentity =
      associatedTask?.target.selectionContext.contextIdentity ?? currentRuleContext(context)?.identity ?? null;
    let descriptor =
      identity === null || reportContextIdentity === null
        ? previousDescriptor.bindingIdentity === identity
          ? previousDescriptor
          : emptyReportDescriptor(identity, reportContextIdentity)
        : reportDescriptorForContext(previousDescriptor, identity, reportContextIdentity);
    if (descriptor.contextIdentity === null && reportContextIdentity !== null)
      descriptor = Object.freeze({...descriptor, contextIdentity: reportContextIdentity});
    const recent: TerminalUpdateRecentStatus = Object.freeze({
      ...status,
      applicationId:
        associatedTask?.target.applicationId ??
        status.applicationId ??
        (initialObservation ? null : (before.recentStatus.applicationId ?? null)),
      ruleRef:
        associatedTask !== null
          ? associatedTask.target.ruleRef
          : Object.hasOwn(status, 'ruleRef')
            ? (status.ruleRef ?? null)
            : initialObservation
              ? null
              : (before.recentStatus.ruleRef ?? null),
      fullArtifactRef:
        associatedTask !== null
          ? (associatedTask.target.full?.artifactRef ?? null)
          : Object.hasOwn(status, 'fullArtifactRef')
            ? (status.fullArtifactRef ?? null)
            : initialObservation
              ? null
              : (before.recentStatus.fullArtifactRef ?? null),
      hotArtifactRef:
        associatedTask !== null
          ? (associatedTask.target.hot?.artifactRef ?? null)
          : Object.hasOwn(status, 'hotArtifactRef')
            ? (status.hotArtifactRef ?? null)
            : initialObservation
              ? null
              : (before.recentStatus.hotArtifactRef ?? null),
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
    const observationFactsKey =
      initialObservation && before.actualVersions !== null
        ? actualVersionObservationFactsKey(before.actualVersions)
        : null;
    const report =
      identity === null ||
      (unchangedRecent && !initialObservation) ||
      (initialObservation && observationFactsKey !== null && descriptor.lastObservationFactsKey === observationFactsKey)
        ? null
        : createReportPayload({
            reportId: input.createProtocolUuid(),
            sequence: descriptor.nextReportSequence,
            task: associatedTask,
            actual: before.actualVersions,
            status: stableRecent,
          });
    if (report !== null) {
      const key = recent.taskId ?? 'observation';
      descriptor = Object.freeze({
        ...descriptor,
        nextReportSequence: descriptor.nextReportSequence + 1,
        ...(initialObservation && observationFactsKey !== null ? {lastObservationFactsKey: observationFactsKey} : {}),
        pendingReports: Object.freeze({...descriptor.pendingReports, [key]: report}),
      });
    }
    context.dispatchAction(actions.replaceTask(task));
    context.dispatchAction(actions.replaceRecentStatus(stableRecent));
    context.dispatchAction(actions.replaceReportDescriptor(descriptor));
    const invitation = before.invitation ?? null;
    const actualBootId = before.actualVersions?.bootId ?? null;
    if (
      invitation !== null &&
      (task?.taskId !== invitation.taskId ||
        task.actionId !== invitation.actionId ||
        actualBootId !== invitation.bootId ||
        status.state !== 'waiting-user')
    )
      context.dispatchAction(actions.replaceInvitation(null));
    if (await persist(context)) return true;
    context.dispatchAction(actions.replaceTask(before.currentTask));
    context.dispatchAction(actions.replaceRecentStatus(before.recentStatus));
    context.dispatchAction(actions.replaceReportDescriptor(previousDescriptor));
    context.dispatchAction(actions.replaceInvitation(invitation));
    return false;
  };
  const writeTask = async (
    context: ActorExecutionContext,
    task: TerminalUpdateTask | null,
    status: TerminalUpdateState['recentStatus'],
  ): Promise<boolean> => writeTaskWithOptions({context, task, status});
  const writeInitialObservation = async (context: ActorExecutionContext): Promise<boolean> =>
    writeTaskWithOptions({context, task: null, status: createStatus(null, 'idle', null), initialObservation: true});

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
      const next = reportDescriptorForContext(existingDescriptor, binding.identity, current.identity);
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
    const reportStartedAt = Date.now();
    logLifecycle(context, 'report-submit-started', {
      attemptId,
      reportSequence: payload.body.reportSequence,
      reportState: payload.body.recent.state,
      taskIdPresent: payload.body.taskId !== null,
      taskMatchesCurrentTask: payload.body.taskId !== null && payload.body.taskId === state.currentTask?.taskId,
      taskMatchesRecentStatus: payload.body.taskId === state.recentStatus.taskId,
    });
    try {
      const dispatched = await context.dispatchCommand(submitTerminalUpdateReportCommand, payload, {
        lateResultTtlMs: topologyLateResultMaxTtlMs,
        lateOutcome: () => {
          if (reportSendInFlight?.attemptId === attemptId) reportSendInFlight = null;
        },
      });
      const reportActorResult = dispatched.actorResults.find(record => record.status === 'completed')?.result;
      const reportResultKind =
        typeof reportActorResult === 'object' &&
        reportActorResult !== null &&
        !Array.isArray(reportActorResult) &&
        'kind' in reportActorResult
          ? String(reportActorResult.kind)
          : 'unavailable';
      const reportReceipt =
        isRecord(reportActorResult) && isRecord(reportActorResult.body) ? reportActorResult.body : null;
      logLifecycleAtLevel(context, {
        event: 'report-submit-returned',
        data: {
          attemptId,
          reportSequence: payload.body.reportSequence,
          dispatchStatus: dispatched.status,
          resultKind: reportResultKind,
          receiptTaskIdPresent: reportReceipt !== null && reportReceipt.taskId !== null,
          receiptTaskMatchesPayload: reportReceipt !== null && reportReceipt.taskId === payload.body.taskId,
          receiptSequenceMatchesPayload:
            reportReceipt !== null && reportReceipt.acceptedSequence === payload.body.reportSequence,
          receiptOutcome:
            reportReceipt !== null && typeof reportReceipt.outcome === 'string'
              ? reportReceipt.outcome
              : 'UNAVAILABLE',
          elapsedMs: Math.max(0, Date.now() - reportStartedAt),
        },
        level: dispatched.status === 'completed' ? 'info' : 'warn',
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
        | {kind: 'failure'; category: string; code: string; status?: number}
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
      const rejectCurrentReport = async (reasonCode: string, pause: boolean) => {
        const pendingReports = {...current.pendingReports};
        if (!pause) delete pendingReports[key];
        context.dispatchAction(
          actions.replaceReportDescriptor(
            Object.freeze({
              ...current,
              pendingReports: Object.freeze(pendingReports),
              sendPaused: current.sendPaused || pause,
              latestDeliveryFailure: Object.freeze({
                taskId: payload.body.taskId,
                reportId: payload.body.reportId,
                reportSequence: payload.body.reportSequence,
                reasonCode,
                observedAt: nowTimestampMs(),
              }),
            }),
          ),
        );
        // A receipt flush failure is retryable because the server accepted the
        // report. A terminal rejection must stay non-sendable in this Runtime.
        return (await persist(context))
          ? Object.freeze({status: 'terminal-rejection'})
          : Object.freeze({status: 'rejection-flush-failed'});
      };
      if (dispatched.status === 'completed' && result?.kind === 'success')
        return rejectCurrentReport('REPORT_RESPONSE_INVALID', false);
      if (dispatched.status === 'completed' && result?.kind === 'business-rejection') {
        const identityRejected =
          result.status === 401 ||
          result.status === 403 ||
          result.errorCode === 'TERMINAL_BINDING_CREDENTIAL_INVALID' ||
          result.errorCode === 'STORE_TERMINAL_DISABLED' ||
          result.errorCode === 'PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED' ||
          result.errorCode === 'PLATFORM_COMMON_ACCESS_DENIED';
        if (identityRejected) return rejectCurrentReport(result.errorCode || 'REPORT_IDENTITY_REJECTED', true);
        if (result.status >= 400 && result.status < 500)
          return rejectCurrentReport(
            result.status === 404 || result.status === 409 || result.status === 422
              ? result.errorCode
              : 'REPORT_SUBMISSION_INVALID',
            false,
          );
      }
      if (dispatched.status === 'completed' && result?.kind === 'failure') {
        if (result.status === 401 || result.status === 403)
          return rejectCurrentReport('REPORT_IDENTITY_REJECTED', true);
        if (result.code === 'INVALID_TERMINAL_UPDATE_REPORT')
          return rejectCurrentReport('REPORT_SUBMISSION_INVALID', false);
        if (result.code === 'TERMINAL_RESPONSE_SCHEMA_INVALID')
          return rejectCurrentReport('REPORT_RESPONSE_INVALID', false);
        if (result.status !== undefined && result.status < 500)
          return rejectCurrentReport('REPORT_SUBMISSION_INVALID', false);
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

  const applyPreparedArtifact = async (
    context: ActorExecutionContext,
    task: TerminalUpdateTask,
    input: Readonly<{
      actionId: string;
      preparedId: string;
      kind: 'full' | 'hot';
      interactionRevision?: number;
      newlyPrepared?: boolean;
    }>,
  ) => {
    const actualBootId = readState(context).actualVersions?.bootId;
    if (typeof actualBootId !== 'string' || actualBootId.length === 0) {
      if (input.newlyPrepared === true) await port.releasePrepared({timeoutMs: 10_000, preparedId: input.preparedId});
      return Object.freeze({status: 'unknown', reason: 'ACTUAL_BOOT_ID_UNAVAILABLE'});
    }
    const applyingPhase = input.kind === 'full' ? ('applying-full' as const) : ('applying-hot' as const);
    const applying = Object.freeze({
      ...task,
      bootId: actualBootId,
      phase: applyingPhase,
      actionId: input.actionId,
      actionKind: input.kind,
      preparedId: input.preparedId,
    });
    if (!(await writeTask(context, applying, createStatus(task.taskId, 'applying', null)))) {
      if (input.newlyPrepared === true) await port.releasePrepared({timeoutMs: 10_000, preparedId: input.preparedId});
      await writeTask(
        context,
        task,
        createStatus(
          task.taskId,
          task.phase === 'waiting-idle' ? 'waiting-idle' : 'fixed',
          'PERSISTENCE_FAILED_BEFORE_APPLY',
        ),
      );
      return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_APPLY'});
    }
    if (
      input.interactionRevision !== undefined &&
      selectLastLocalInteraction(context.getState()).revision !== input.interactionRevision
    ) {
      const waiting = Object.freeze({
        ...task,
        phase: 'waiting-idle' as const,
        actionId: input.actionId,
        actionKind: 'hot' as const,
      });
      await writeTask(context, waiting, createStatus(task.taskId, 'waiting-idle', null));
      return Object.freeze({status: 'waiting-idle', reason: 'LOCAL_INTERACTION_CHANGED'});
    }
    const applyStartedAt = Date.now();
    logLifecycle(context, 'artifact-apply-started', {
      taskId: task.taskId,
      actionId: input.actionId,
      artifactKind: input.kind,
    });
    let applied: Awaited<ReturnType<UpdatePort['applyPrepared']>>;
    try {
      applied = await port.applyPrepared({
        timeoutMs: input.kind === 'hot' ? 60_000 : 120_000,
        taskId: task.taskId,
        actionId: input.actionId,
        preparedId: input.preparedId,
        kind: input.kind,
      });
    } catch (error) {
      logLifecycleWarning(context, 'artifact-apply-threw', {
        taskId: task.taskId,
        actionId: input.actionId,
        artifactKind: input.kind,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        elapsedMs: Math.max(0, Date.now() - applyStartedAt),
      });
      throw error;
    }
    logLifecycleAtLevel(context, {
      event: 'artifact-apply-returned',
      data: {
        taskId: task.taskId,
        actionId: input.actionId,
        artifactKind: input.kind,
        portStatus: applied.status,
        actionState: applied.status === 'succeeded' ? applied.value.state : null,
        errorCode: applied.status === 'failed' ? applied.error.code : null,
        elapsedMs: Math.max(0, Date.now() - applyStartedAt),
      },
      level: applied.status === 'failed' ? 'warn' : 'info',
    });
    if (applied.status !== 'succeeded') {
      const reason = applied.status === 'failed' ? applied.error.code : `APPLY_${applied.status.toUpperCase()}`;
      const state =
        applied.status === 'timed-out' || applied.status === 'unavailable' ? ('unknown' as const) : ('failed' as const);
      const failedTask = Object.freeze({...applying, phase: state, failureCode: reason});
      if (state === 'failed')
        recordFailedArtifact(
          context,
          task,
          (input.kind === 'full' ? task.target.full : task.target.hot)!.artifact.publicationId,
        );
      await writeTask(context, failedTask, createStatus(task.taskId, state, reason));
      return Object.freeze({status: state, reason});
    }
    const action = applied.value;
    if (action.taskId !== task.taskId || action.actionId !== input.actionId) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'ACTION_IDENTITY_MISMATCH'));
      return Object.freeze({status: 'unknown', reason: 'ACTION_IDENTITY_MISMATCH'});
    }
    const artifact = input.kind === 'full' ? task.target.full : task.target.hot;
    if (artifact === null || action.publicationId !== artifact.artifact.publicationId) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'ACTION_PUBLICATION_IDENTITY_MISMATCH'));
      return Object.freeze({status: 'unknown', reason: 'ACTION_PUBLICATION_IDENTITY_MISMATCH'});
    }
    if (action.state === 'failed') recordFailedArtifact(context, task, action.publicationId);
    const fullTerminal = input.kind === 'full' && (action.state === 'succeeded' || action.state === 'failed');
    if (fullTerminal && !(await releaseUnreferencedFullArtifact(applying, action.publicationId))) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
      return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
    }
    if (action.state === 'succeeded' && input.kind === 'full' && task.target.hot !== null) {
      if (action.bootId === null) {
        const unknown = Object.freeze({
          ...applying,
          phase: 'unknown' as const,
          failureCode: 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE',
        });
        await writeTask(context, unknown, createStatus(task.taskId, 'unknown', 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE'));
        return Object.freeze({status: 'unknown', reason: 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE'});
      }
      const fixed = Object.freeze({
        ...applying,
        phase: 'fixed' as const,
        actionId: null,
        actionKind: null,
        preparedId: null,
      });
      if (!(await writeTask(context, fixed, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_FULL'});
      return Object.freeze({status: 'fixed', continuation: 'PRIMARY_READY'});
    }
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
    const updated = Object.freeze({
      ...applying,
      phase,
      preparedId: fullTerminal ? null : input.preparedId,
      lastInviteAt:
        input.kind === 'full' && status === 'waiting-user' ? nowTimestampMs() : (applying.lastInviteAt ?? null),
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, updated, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, actionId: action.actionId, reason: action.reason});
  };

  const executeNextArtifact = async (context: ActorExecutionContext, task: TerminalUpdateTask) => {
    const factsStartedAt = Date.now();
    let factsResult = await port.readFacts({timeoutMs: 10_000});
    logLifecycleAtLevel(context, {
      event: 'update-facts-read-returned',
      data: {
        taskId: task.taskId,
        portStatus: factsResult.status,
        actualPresent: factsResult.status === 'succeeded' && factsResult.value.actual !== null,
        embeddedPresent: factsResult.status === 'succeeded' && factsResult.value.embedded !== null,
        elapsedMs: Math.max(0, Date.now() - factsStartedAt),
      },
      level: factsResult.status === 'failed' ? 'warn' : 'info',
    });
    if (factsResult.status !== 'succeeded') {
      if (!(await writeTask(context, task, createStatus(task.taskId, 'unknown', 'ACTUAL_FACTS_UNAVAILABLE'))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
      return Object.freeze({status: 'unknown', reason: factsResult.status});
    }
    context.dispatchAction(actions.replaceActualVersions(factsResult.value.actual));
    let fixedTask = task;
    if (fixedTask.originalBundleVersion == null) {
      const snapshot = Object.freeze({
        ...fixedTask,
        originalBundleVersion: fixedTask.originalBundleVersion ?? factsResult.value.actual?.bundleVersion ?? null,
      });
      if (snapshot.originalBundleVersion === null) {
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
      selected = nextArtifact({
        target: fixedTask.target,
        actual: factsResult.value.actual,
        embedded: factsResult.value.embedded,
        originalBundleVersion: fixedTask.originalBundleVersion,
      });
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
    const executionBootId = factsResult.value.actual?.bootId;
    if (typeof executionBootId !== 'string' || executionBootId.length === 0) {
      const reason = 'ACTUAL_BOOT_ID_UNAVAILABLE';
      const unknown = Object.freeze({...fixedTask, phase: 'unknown' as const, failureCode: reason});
      await writeTask(context, unknown, createStatus(task.taskId, 'unknown', reason));
      return Object.freeze({status: 'unknown', reason});
    }
    const actionId = createRequestId();
    const preparingPhase = selected.kind === 'full' ? ('preparing-full' as const) : ('preparing-hot' as const);
    const beforePrepare = Object.freeze({
      ...fixedTask,
      bootId: executionBootId,
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
      const grantContext = currentRuleContext(context, true);
      if (grantContext === null) {
        const reason = 'UPDATE_CONTEXT_NOT_READY';
        logLifecycle(context, 'fixed-task-context-not-ready', {
          taskId: task.taskId,
          artifactKind: selected.kind,
          contextReady: false,
          reasonCode: reason,
        });
        if (!(await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', null))))
          return Object.freeze({status: 'persistence-failed', reason: 'FIXED_TASK_DEFER_PERSISTENCE_FAILED'});
        return Object.freeze({status: 'deferred', reason});
      }
      if (grantContext.identity !== task.target.selectionContext.contextIdentity) {
        const reason = 'DOWNLOAD_GRANT_CONTEXT_CHANGED';
        await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', reason));
        return Object.freeze({status: 'stale-context', reason});
      }
      const grantNetwork = readNetworkSnapshot(context.getState(), 'business');
      const grantStartedAt = Date.now();
      logLifecycle(context, 'download-grant-request-started', {
        taskId: task.taskId,
        actionId,
        artifactKind: selected.kind,
      });
      const issued = await context.dispatchCommand(
        requestTerminalUpdateDownloadGrantCommand,
        Object.freeze({artifactRef: selected.artifactRef}),
      );
      const result = issued.actorResults.find(record => record.status === 'completed')?.result as
        | {kind: 'success'; body: TerminalUpdateDownloadGrantResult}
        | {kind: 'business-rejection'; status: number; errorCode: string}
        | {kind: 'failure'; category: string; code: string}
        | undefined;
      const afterGrant = readState(context);
      const currentTask = afterGrant.currentTask;
      const stillOwnsPreparation =
        currentTask !== null &&
        currentTask.taskId === task.taskId &&
        currentTask.actionId === actionId &&
        currentTask.actionKind === selected.kind &&
        currentTask.phase === preparingPhase;
      if (!stillOwnsPreparation) return Object.freeze({status: 'stale-task'});
      const currentGrantContext = currentRuleContext(context, true);
      const currentGrantNetwork = readNetworkSnapshot(context.getState(), 'business');
      if (
        currentGrantContext?.identity !== grantContext.identity ||
        JSON.stringify(currentGrantNetwork) !== JSON.stringify(grantNetwork)
      ) {
        const reason = 'DOWNLOAD_GRANT_CONTEXT_CHANGED';
        const restored = Object.freeze({
          ...fixedTask,
          phase: 'fixed' as const,
          actionId: null,
          actionKind: null,
          preparedId: null,
        });
        if (!(await writeTask(context, restored, createStatus(task.taskId, 'fixed', reason))))
          return Object.freeze({status: 'persistence-failed', reason: 'DOWNLOAD_GRANT_CONTEXT_RESTORE_FAILED'});
        return Object.freeze({status: 'stale-context', reason});
      }
      logLifecycleAtLevel(context, {
        event: 'download-grant-request-returned',
        data: {
          taskId: task.taskId,
          actionId,
          artifactKind: selected.kind,
          dispatchStatus: issued.status,
          resultKind: result?.kind ?? 'unavailable',
          errorCode:
            result?.kind === 'business-rejection' ? result.errorCode : result?.kind === 'failure' ? result.code : null,
          elapsedMs: Math.max(0, Date.now() - grantStartedAt),
        },
        level: result?.kind === 'success' ? 'info' : 'warn',
      });
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
      artifactForPrepare = fullManifestFromGrant({
        manifest: result.body.artifact,
        expected: expectedSource,
        expectedFull: fixedTask.target.full,
        requireMinimumFull: selected.kind === 'hot',
      });
      if (artifactForPrepare === null) {
        const reason = 'DOWNLOAD_ARTIFACT_IDENTITY_MISMATCH';
        const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
        await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
        return Object.freeze({status: 'failed', reason});
      }
    } else {
      sourcePath = await sourceProvider!.resolveSourcePath!(selected.sourceRef);
      const localArtifact = (selected.manifest ?? selected.artifact) as TerminalUpdateArtifact;
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
    const prepareStartedAt = Date.now();
    logLifecycle(context, 'artifact-prepare-started', {
      taskId: task.taskId,
      actionId,
      artifactKind: selected.kind,
      sourceKind: selected.artifactRef === undefined ? 'local' : 'remote',
    });
    let prepared: Awaited<ReturnType<UpdatePort['prepareArtifact']>>;
    try {
      prepared = await port.prepareArtifact({
        timeoutMs: 120_000,
        sourceRef: selected.sourceRef,
        expectedSha256: selected.expectedSha256,
        artifact: artifactForPrepare!,
        sourcePath,
        ...(downloadGrant === undefined ? {} : {downloadGrant}),
        network,
        kind: selected.kind,
      });
    } catch (error) {
      logLifecycleWarning(context, 'artifact-prepare-threw', {
        taskId: task.taskId,
        actionId,
        artifactKind: selected.kind,
        sourceKind: selected.artifactRef === undefined ? 'local' : 'remote',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        elapsedMs: Math.max(0, Date.now() - prepareStartedAt),
      });
      throw error;
    }
    logLifecycleAtLevel(context, {
      event: 'artifact-prepare-returned',
      data: {
        taskId: task.taskId,
        actionId,
        artifactKind: selected.kind,
        sourceKind: selected.artifactRef === undefined ? 'local' : 'remote',
        portStatus: prepared.status,
        errorCode: prepared.status === 'failed' ? prepared.error.code : null,
        elapsedMs: Math.max(0, Date.now() - prepareStartedAt),
      },
      level: prepared.status === 'failed' ? 'warn' : 'info',
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

    const preparedTask = Object.freeze({...beforePrepare, preparedId: prepared.value.preparedId});
    if (selected.kind === 'hot' && fixedTask.target.policy.hotStrategy === 'IDLE') {
      const waiting = Object.freeze({...preparedTask, phase: 'waiting-idle' as const});
      if (!(await writeTask(context, waiting, createStatus(task.taskId, 'waiting-idle', null)))) {
        await port.releasePrepared({timeoutMs: 10_000, preparedId: prepared.value.preparedId});
        await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', 'PERSISTENCE_FAILED_BEFORE_IDLE_WAIT'));
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_IDLE_WAIT'});
      }
      return Object.freeze({status: 'waiting-idle', taskId: task.taskId, actionId});
    }
    return applyPreparedArtifact(context, preparedTask, {
      actionId,
      preparedId: prepared.value.preparedId,
      kind: selected.kind,
      newlyPrepared: true,
    });
  };

  const reconcile = async (context: ActorExecutionContext, resumeFixedTask: boolean) => {
    const result = await port.readFacts({timeoutMs: 10_000});
    if (result.status !== 'succeeded') return Object.freeze({status: 'unavailable', reason: result.status});
    context.dispatchAction(actions.replaceActualVersions(result.value.actual));
    const task = readState(context).currentTask;
    if (task === null) {
      const binding = currentBindingIdentity(context);
      const ruleContext = currentRuleContext(context);
      let descriptor = readState(context).reportDescriptor;
      const actual = result.value.actual;
      const currentDescriptor =
        binding !== null &&
        ruleContext !== null &&
        binding.identity === `${ruleContext.facts.terminalRef}:${ruleContext.facts.bindingGeneration}`
          ? reportDescriptorForContext(descriptor, binding.identity, ruleContext.identity)
          : descriptor;
      if (currentDescriptor !== descriptor) {
        if (!(await writeReportDescriptor(context, currentDescriptor)))
          return Object.freeze({status: 'persistence-failed', reason: 'REPORT_CONTEXT_PERSISTENCE_FAILED'});
        descriptor = currentDescriptor;
      }
      if (
        binding !== null &&
        ruleContext !== null &&
        binding.identity === `${ruleContext.facts.terminalRef}:${ruleContext.facts.bindingGeneration}` &&
        actual !== null &&
        typeof actual.applicationId === 'string' &&
        actual.applicationId.length > 0 &&
        descriptor.lastObservationFactsKey !== actualVersionObservationFactsKey(actual) &&
        !descriptor.sendPaused
      ) {
        if (!(await writeInitialObservation(context)))
          return Object.freeze({status: 'persistence-failed', reason: 'INITIAL_VERSION_REPORT_PERSISTENCE_FAILED'});
        return Object.freeze({status: 'read', observation: 'queued'});
      }
      return Object.freeze({status: 'read'});
    }
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
    if (task.phase === 'waiting-idle') return Object.freeze({status: 'waiting-idle', taskId: task.taskId});
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
      return Object.freeze({status: 'applying', actionId: task.actionId, actionState: action.state});
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
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, updated, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, reason: action.reason, actionState: action.state});
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

  const handleDeadline = async (
    context: ActorExecutionContext,
    payload: Readonly<{
      taskId: string;
      bootId: string;
      kind: 'hot-idle' | 'full-reminder';
      interactionRevision: number;
      deadlineAt: number;
      scheduleGeneration: number;
    }>,
  ) => {
    const current = readState(context);
    const task = current.currentTask;
    if (task === null || task.taskId !== payload.taskId || currentPresentation !== 'foreground')
      return Object.freeze({status: 'stale-deadline'});
    const facts = await port.readFacts({timeoutMs: 10_000});
    if (facts.status !== 'succeeded' || facts.value.actual?.bootId !== payload.bootId)
      return Object.freeze({status: 'stale-boot'});
    const actual = facts.value.actual;
    context.dispatchAction(actions.replaceActualVersions(actual));

    if (payload.kind === 'hot-idle') {
      const mSeconds = task.target.policy.mSeconds;
      if (
        task.phase !== 'waiting-idle' ||
        task.actionKind !== 'hot' ||
        task.actionId === null ||
        task.preparedId === null ||
        task.target.hot === null ||
        task.target.policy.hotStrategy !== 'IDLE' ||
        mSeconds === null
      )
        return Object.freeze({status: 'stale-deadline'});
      const interaction = selectLastLocalInteraction(context.getState());
      const dueAt = interaction.lastClickAt + mSeconds * 1000;
      if (
        interaction.revision !== payload.interactionRevision ||
        dueAt !== payload.deadlineAt ||
        nowTimestampMs() < dueAt
      )
        return Object.freeze({status: 'rescheduled', reason: 'LOCAL_INTERACTION_CHANGED'});
      const ready = task.bootId === payload.bootId ? task : Object.freeze({...task, bootId: payload.bootId});
      if (ready !== task && !(await writeTask(context, ready, createStatus(task.taskId, 'waiting-idle', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_HOT_APPLY'});
      return applyPreparedArtifact(context, ready, {
        actionId: ready.actionId!,
        preparedId: ready.preparedId!,
        kind: 'hot',
        interactionRevision: payload.interactionRevision,
      });
    }

    const nSeconds = task.target.policy.nSeconds;
    if (
      task.phase !== 'waiting-user' ||
      task.actionKind !== 'full' ||
      task.actionId === null ||
      task.preparedId === null ||
      task.target.full === null
    )
      return Object.freeze({status: 'stale-deadline'});
    const lastInviteAt =
      task.lastInviteAt ??
      (current.recentStatus.taskId === task.taskId && current.recentStatus.state === 'waiting-user'
        ? current.recentStatus.changedAt
        : null);
    if (lastInviteAt === null) return Object.freeze({status: 'stale-deadline'});
    const dueAt = lastInviteAt + nSeconds * 1000;
    if (dueAt !== payload.deadlineAt || nowTimestampMs() < dueAt)
      return Object.freeze({status: 'rescheduled', reason: 'INVITATION_NOT_DUE'});
    const actionResult = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId: task.actionId});
    const action = actionResult.status === 'succeeded' ? actionResult.value : null;
    if (
      action === null ||
      action.taskId !== task.taskId ||
      action.actionId !== task.actionId ||
      action.publicationId !== task.target.full.artifact.publicationId
    ) {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'unknown' as const}),
        createStatus(task.taskId, 'unknown', 'INSTALLER_STATE_UNAVAILABLE'),
      );
      return Object.freeze({status: 'readback-unknown'});
    }
    if (action.state === 'accepted') {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'applying-full' as const}),
        createStatus(task.taskId, 'applying', null),
      );
      return Object.freeze({status: 'installing'});
    }
    if (action.state === 'unknown') {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'unknown' as const}),
        createStatus(task.taskId, 'unknown', action.reason ?? 'INSTALLER_STATE_UNKNOWN'),
      );
      return Object.freeze({status: 'readback-unknown'});
    }
    if (action.state === 'succeeded' || action.state === 'failed') return reconcile(context, true);
    if (action.state !== 'waiting-user' && action.state !== 'user-cancelled')
      return Object.freeze({status: 'not-invitable'});
    const invited = Object.freeze({...task, lastInviteAt: nowTimestampMs()});
    if (!(await writeTask(context, invited, createStatus(task.taskId, 'waiting-user', action.reason))))
      return Object.freeze({status: 'persistence-failed', reason: 'INVITATION_TIME_PERSISTENCE_FAILED'});
    context.dispatchAction(
      actions.replaceInvitation({taskId: task.taskId, actionId: task.actionId, bootId: payload.bootId}),
    );
    return Object.freeze({status: 'invited', taskId: task.taskId});
  };

  const installDecisionIsCurrent = (
    context: ActorExecutionContext,
    payload: Readonly<{taskId: string; actionId: string | null; bootId: string}>,
  ): TerminalUpdateTask | null => {
    const {currentTask, invitation} = readState(context);
    const actual = readState(context).actualVersions;
    if (
      currentTask === null ||
      invitation === null ||
      invitation === undefined ||
      actual === null ||
      currentPresentation !== 'foreground' ||
      invitation.taskId !== payload.taskId ||
      invitation.actionId !== payload.actionId ||
      invitation.bootId !== payload.bootId ||
      actual.bootId !== payload.bootId ||
      currentTask.taskId !== payload.taskId ||
      currentTask.actionId !== payload.actionId ||
      currentTask.phase !== 'waiting-user'
    )
      return null;
    return currentTask;
  };

  const confirmInstall = async (
    context: ActorExecutionContext,
    payload: Parameters<typeof installDecisionIsCurrent>[1],
  ) => {
    const task = installDecisionIsCurrent(context, payload);
    if (task === null) return Object.freeze({status: 'rejected', reason: 'INSTALL_INVITATION_STALE'});
    const actionId = task.actionId;
    if (actionId === null || task.target.full === null || task.preparedId === null)
      return Object.freeze({status: 'unknown', reason: 'FIXED_FULL_ACTION_UNAVAILABLE'});
    const result = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId});
    if (result.status !== 'succeeded' || result.value === null)
      return Object.freeze({status: 'unknown', reason: 'INSTALLER_STATE_UNAVAILABLE'});
    const action = result.value;
    if (
      action.taskId !== task.taskId ||
      action.actionId !== actionId ||
      action.publicationId !== task.target.full.artifact.publicationId
    )
      return Object.freeze({status: 'unknown', reason: 'INSTALLER_IDENTITY_MISMATCH'});
    if (action.state === 'waiting-user') {
      const invited = Object.freeze({...task, lastInviteAt: nowTimestampMs()});
      if (!(await writeTask(context, invited, createStatus(task.taskId, 'waiting-user', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'INVITATION_TIME_PERSISTENCE_FAILED'});
      const presented = await port.presentInstallerConfirmation({
        timeoutMs: 10_000,
        taskId: task.taskId,
        actionId,
        publicationId: task.target.full.artifact.publicationId,
        trigger: 'user-confirm',
      });
      if (presented.status === 'succeeded' && presented.value.status === 'presented') {
        context.dispatchAction(actions.replaceInvitation(null));
        return Object.freeze({status: 'presented'});
      }
      return Object.freeze({
        status: presented.status === 'failed' ? 'failed' : presented.status,
        reason: presented.status === 'failed' ? presented.error.code : 'INSTALLER_CONFIRMATION_NOT_PRESENTED',
      });
    }
    if (action.state === 'user-cancelled') {
      const nextActionId = createRequestId();
      const prepared = Object.freeze({...task, actionId: nextActionId, actionKind: 'full' as const});
      const applied = await applyPreparedArtifact(context, prepared, {
        actionId: nextActionId,
        preparedId: task.preparedId,
        kind: 'full',
      });
      return applied;
    }
    if (action.state === 'accepted') {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'applying-full' as const}),
        createStatus(task.taskId, 'applying', null),
      );
      context.dispatchAction(actions.replaceInvitation(null));
      return Object.freeze({status: 'installing'});
    }
    if (action.state === 'succeeded' || action.state === 'failed') {
      context.dispatchAction(actions.replaceInvitation(null));
      return reconcile(context, true);
    }
    return Object.freeze({status: 'unknown', reason: action.reason ?? 'INSTALLER_STATE_UNKNOWN'});
  };

  const deferInstall = async (
    context: ActorExecutionContext,
    payload: Parameters<typeof installDecisionIsCurrent>[1],
  ) => {
    const task = installDecisionIsCurrent(context, payload);
    if (task === null) return Object.freeze({status: 'rejected', reason: 'INSTALL_INVITATION_STALE'});
    const deferred = Object.freeze({...task, lastInviteAt: nowTimestampMs()});
    if (!(await writeTask(context, deferred, createStatus(task.taskId, 'waiting-user', null))))
      return Object.freeze({status: 'persistence-failed', reason: 'INVITATION_TIME_PERSISTENCE_FAILED'});
    context.dispatchAction(actions.replaceInvitation(null));
    return Object.freeze({status: 'deferred'});
  };

  return defineActor(moduleName, 'update-owner', [
    onCommand(clearTerminalUpdateReportContextCommand, async context => {
      context.dispatchAction(actions.replaceReportDescriptor(emptyReportDescriptor(null)));
      return Object.freeze({status: (await persist(context)) ? 'cleared' : 'persistence-failed'});
    }),
    onCommand(terminalDataHeartbeatCommand, context => sendPendingReport(context, context.command.payload)),
    onCommand(updatePresentationChangedCommand, async context => {
      const {runtimeIdentity, presentation} = context.command.payload;
      if (runtimeIdentity !== context.runtimeId) {
        context.platformPorts.logger.warn({
          category: 'terminal-update.presentation',
          event: 'terminal-update.presentation.stale-runtime-ignored',
          message: 'Ignored a presentation observation from another Runtime instance',
          data: {status: 'ignored'},
        });
        return Object.freeze({status: 'ignored', reason: 'runtime-identity-mismatch'});
      }
      if (presentation === currentPresentation) return Object.freeze({status: 'unchanged', presentation});
      currentPresentation = presentation;
      if (presentation === 'foreground') {
        const readback = await reconcile(context, false);
        const current = readState(context);
        const task = current.currentTask;
        if (
          readback.status === 'waiting-user' &&
          'actionState' in readback &&
          readback.actionState === 'waiting-user' &&
          currentPresentation === 'foreground' &&
          task !== null &&
          task.actionKind === 'full' &&
          task.actionId !== null &&
          task.target.full !== null &&
          task.phase === 'waiting-user' &&
          current.actualVersions !== null
        ) {
          const resumed = await port.presentInstallerConfirmation({
            timeoutMs: 10_000,
            taskId: task.taskId,
            actionId: task.actionId,
            publicationId: task.target.full.artifact.publicationId,
            trigger: 'source-permission-return',
          });
          if (resumed.status !== 'succeeded' && resumed.status !== 'unavailable') {
            context.platformPorts.logger.warn({
              category: 'terminal-update.installer-confirmation',
              event: 'terminal-update.installer-confirmation.source-permission-return-incomplete',
              message: 'Source-permission return did not restore the exact pending installer confirmation',
              data: {
                taskId: task.taskId,
                actionIdPresent: true,
                status: resumed.status,
                code: resumed.status === 'failed' ? resumed.error.code : null,
              },
            });
          }
        }
      }
      return Object.freeze({status: 'updated', presentation});
    }),
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
    onCommand(terminalUpdateDeadlineCommand, context => handleDeadline(context, context.command.payload)),
    onCommand(confirmTerminalUpdateInstallCommand, context => confirmInstall(context, context.command.payload)),
    onCommand(deferTerminalUpdateInstallCommand, context => deferInstall(context, context.command.payload)),
    onCommand(requestTerminalUpdateCommand, async context => {
      const reportAdmissionRejection = async (target: FixedUpdateTarget, reason: string) => {
        logLifecycleWarning(context, 'target-admission-rejected', {reasonCode: reason});
        const status = Object.freeze({
          ...createStatus(null, 'admission-rejected', reason),
          applicationId: target.applicationId,
          ruleRef: target.ruleRef,
          fullArtifactRef: target.full?.artifactRef ?? null,
          hotArtifactRef: target.hot?.artifactRef ?? null,
        });
        return (await writeTask(context, null, status))
          ? Object.freeze({status: 'rejected', reason})
          : Object.freeze({status: 'persistence-failed', reason: 'ADMISSION_REJECTION_REPORT_PERSISTENCE_FAILED'});
      };
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
      const rawTarget = context.command.payload.target;
      if (rawTarget !== null && !validTarget(rawTarget))
        return Object.freeze({status: 'rejected', reason: 'TARGET_INVALID'});
      const target = rawTarget === null ? null : rawTarget;
      if (target === null) {
        const currentTask = readState(context).currentTask;
        if (currentTask !== null) {
          if (currentTask.phase === 'fixed' && currentTask.actionId === null) return reconcile(context, true);
          return Object.freeze({status: 'already-fixed'});
        }
        const observed = await reconcile(context, false);
        return Object.freeze({status: 'no-candidate', observation: observed.status});
      }
      const selectionContext = target.selectionContext;
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

      const readCurrentCandidate = async (): Promise<FixedUpdateTarget | null> => {
        if (input.readCurrentTarget !== undefined) return input.readCurrentTarget(context.getState(), target);
        return sourceProvider === undefined ? null : sourceProvider.readTarget(selectionContext);
      };
      const logTargetRevalidationFailure = (
        phase: 'before-facts' | 'before-commit' | 'context',
        currentTarget: FixedUpdateTarget | null,
        contextMatches?: Readonly<{identity: boolean; binding: boolean}>,
      ): void => {
        const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
        const currentTargetValid = currentTarget !== null && validTarget(currentTarget);
        context.platformPorts.logger.warn({
          category: 'terminal.update.lifecycle',
          event: 'target-revalidation-rejected',
          message: 'The selected update target changed before it could be accepted',
          data: {
            phase,
            reasonCode: phase === 'context' ? 'TARGET_CONTEXT_MISMATCH' : 'TARGET_CHANGED',
            candidatePresent: currentTarget !== null,
            targetValid: currentTargetValid,
            targetMatches: currentTargetValid && same(currentTarget, target),
            ruleMatches: currentTargetValid && currentTarget.ruleRef === target.ruleRef,
            collectionMatches: currentTargetValid && currentTarget.collectionHash === target.collectionHash,
            applicationMatches: currentTargetValid && currentTarget.applicationId === target.applicationId,
            fullArtifactMatches: currentTargetValid && same(currentTarget.full, target.full),
            hotArtifactMatches: currentTargetValid && same(currentTarget.hot, target.hot),
            policyMatches: currentTargetValid && same(currentTarget.policy, target.policy),
            strategyMatches: currentTargetValid && same(currentTarget.strategy, target.strategy),
            selectionMatches: currentTargetValid && same(currentTarget.selectionContext, target.selectionContext),
            createdAtMatches: currentTargetValid && currentTarget.createdAt === target.createdAt,
            contextIdentityMatches: contextMatches?.identity ?? null,
            bindingIdentityMatches: contextMatches?.binding ?? null,
          },
        });
      };
      const initialTarget = await readCurrentCandidate();
      if (
        initialTarget === null ||
        !validTarget(initialTarget) ||
        JSON.stringify(initialTarget) !== JSON.stringify(target)
      ) {
        logTargetRevalidationFailure('before-facts', initialTarget);
        return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
      }

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
      if (!applicationMatches) return reportAdmissionRejection(target, 'APPLICATION_ID_MISMATCH');
      let candidate: ReturnType<typeof nextArtifact>;
      try {
        const actual = actualIdentity.value.actual!;
        candidate = nextArtifact({
          target,
          actual,
          embedded: actualIdentity.value.embedded,
          originalBundleVersion: actual.bundleVersion,
        });
        if (candidate === null) return Object.freeze({status: 'no-update', reason: 'ALREADY_AT_TARGET'});
      } catch (error) {
        const reason = error instanceof Error ? error.message.replace(/^TERMINAL_UPDATE_/u, '') : 'TARGET_INVALID';
        if (
          reason === 'FULL_ONLY_VERSION_DOWNGRADE' ||
          reason === 'HOT_VERSION_DOWNGRADE' ||
          reason === 'FULL_RUNTIME_MISMATCH' ||
          reason === 'HOT_RUNTIME_MISMATCH' ||
          reason === 'FULL_IDENTITY_CONFLICT' ||
          reason === 'HOT_IDENTITY_CONFLICT'
        )
          return reportAdmissionRejection(target, reason);
        return Object.freeze({status: 'rejected', reason});
      }

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

      // Reserve the existing narrow target-commit slot before the final async
      // eligibility read. A newer rule/context cannot be fixed while this
      // candidate is being revalidated.
      let finishTargetCommit!: () => void;
      const targetCommit = new Promise<void>(resolve => {
        finishTargetCommit = resolve;
      });
      targetCommitPending = targetCommit;
      try {
        const latestTarget = await readCurrentCandidate();
        if (latestTarget === null) {
          logTargetRevalidationFailure('before-commit', latestTarget);
          return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
        }
        if (!validTarget(latestTarget) || JSON.stringify(latestTarget) !== JSON.stringify(target)) {
          logTargetRevalidationFailure('before-commit', latestTarget);
          return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
        }
        const currentContext = currentRuleContext(context);
        if (currentContext !== null) {
          const currentBinding = currentUpdateTargetBindingIdentity(context);
          const contextIdentityMatches = currentContext.identity === selectionContext.contextIdentity;
          const bindingIdentityMatches =
            currentBinding !== null &&
            currentBinding.identity === `${currentContext.facts.terminalRef}:${currentContext.facts.bindingGeneration}`;
          if (!contextIdentityMatches || !bindingIdentityMatches) {
            logTargetRevalidationFailure('context', latestTarget, {
              identity: contextIdentityMatches,
              binding: bindingIdentityMatches,
            });
            return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
          }
        } else if (input.readCurrentTarget === undefined && sourceProvider === undefined) {
          logTargetRevalidationFailure('context', latestTarget, {identity: false, binding: false});
          return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
        }

        // Do not persist a new fixed task when the actual next artifact is
        // already known to have failed. The execution-side check remains as a
        // guard for a recovered fixed task whose facts changed after commit.
        if (candidate !== null && readState(context).failedArtifactIds.includes(candidate.artifact.publicationId)) {
          context.platformPorts.logger.warn({
            category: 'terminal-update.rules',
            event: 'terminal-update.rules.failed-artifact-reentry-blocked',
            message: 'Rejected an update candidate whose publication already failed on this installation',
            data: {publicationId: candidate.artifact.publicationId},
          });
          return reportAdmissionRejection(target, 'FAILED_ARTIFACT_REENTRY_FORBIDDEN');
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
        const beforeCommit = readState(context);
        context.dispatchAction(actions.replaceTask(task));
        context.dispatchAction(actions.replaceRecentStatus(createStatus(taskId, 'fixed', null)));
        if (!(await persist(context))) {
          context.dispatchAction(actions.replaceTask(beforeCommit.currentTask));
          context.dispatchAction(actions.replaceRecentStatus(beforeCommit.recentStatus));
          await persist(context);
          return Object.freeze({status: 'persistence-failed', taskId});
        }
        return executeNextArtifact(context, task);
      } finally {
        if (targetCommitPending === targetCommit) targetCommitPending = null;
        finishTargetCommit();
      }
    }),
    onCommand(confirmTerminalUpdateBootCommand, context => confirmBoot(context, context.command.payload)),
  ]);
};
