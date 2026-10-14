import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {
  TerminalUpdateDownloadGrantResult,
  TerminalUpdateReportRequest,
  TerminalUpdateReportRecent,
} from '../generated/terminalApi';
import type {TerminalUpdateArtifact, UpdateActualVersions, UpdateFacts} from '@catering-v2s/kernel-base-platform-ports';
import type {
  FixedUpdateTarget,
  TerminalUpdateRecentStatus,
  TerminalUpdateState,
  TerminalUpdateTask,
  TerminalUpdateReportPayload,
} from '../types/terminalUpdate';

export const actualVersionObservationFactsKey = (actual: UpdateActualVersions): string =>
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

export const actualMatchesArtifact = (
  actual: UpdateActualVersions | null,
  artifact: Pick<
    TerminalUpdateArtifact,
    'applicationId' | 'nativeVersion' | 'nativeBuildNumber' | 'bundleVersion' | 'runtimeVersion' | 'publicationId'
  >,
): boolean =>
  actual !== null &&
  actual.applicationId === artifact.applicationId &&
  actual.nativeVersion === artifact.nativeVersion &&
  actual.nativeBuildNumber === artifact.nativeBuildNumber &&
  actual.bundleVersion === artifact.bundleVersion &&
  actual.runtimeVersion === artifact.runtimeVersion &&
  actual.publicationId === artifact.publicationId;

export const invalid = (code: string): never => {
  throw new Error(`TERMINAL_UPDATE_${code}`);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArtifactSource = (value: unknown): value is NonNullable<FixedUpdateTarget['full']> => {
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
export const validTarget = (value: unknown): value is FixedUpdateTarget => {
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

export const fullManifestFromGrant = (
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

export const createStatus = (
  taskId: string | null,
  state: TerminalUpdateState['recentStatus']['state'],
  reason: string | null,
) => Object.freeze({taskId, state, reason, changedAt: nowTimestampMs()});

export const toReportReason = (reason: string | null): TerminalUpdateReportRecent['reason'] => {
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

export const toReportState = (
  state: TerminalUpdateRecentStatus['state'],
  task: TerminalUpdateTask | null,
): TerminalUpdateReportRecent['state'] => {
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

export const createReportPayload = (
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
  const body: TerminalUpdateReportRequest = Object.freeze({
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

export const compareVersion = (left: string, right: string): number => {
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

export const nextArtifact = (
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
