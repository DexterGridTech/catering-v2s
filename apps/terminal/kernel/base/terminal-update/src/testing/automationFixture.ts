import type {
  PortFailure,
  PortResult,
  TerminalUpdateArtifact,
  UpdateAction,
  UpdateActualVersions,
  UpdatePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {unavailableUpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {FixedUpdateTarget, UpdateTargetSourceProvider} from '../types/terminalUpdate';

type AutomationMode = 'fixed' | 'install-result' | 'compatibility' | 'owner-flow';

export type TerminalUpdateAutomationFixtureInput = Readonly<{
  runId: string;
  applicationId: string;
  scenario?: string;
}>;

export type TerminalUpdateAutomationFixture = Readonly<{
  port: UpdatePort;
  sourceProvider: UpdateTargetSourceProvider;
}>;

const modeFor = (scenario: string | undefined): AutomationMode =>
  scenario === 'update.install-result'
    ? 'install-result'
    : scenario === 'update.compatibility'
      ? 'compatibility'
      : scenario === 'update.owner-flow'
        ? 'owner-flow'
        : 'fixed';

const succeeded = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: Date.now() as TimestampMs,
});

const failed = (capability: string, code: string): PortFailure => ({
  status: 'failed',
  port: 'update',
  capability,
  error: {code, message: code, retryable: false},
});

const actualFromArtifact = (input: Readonly<{
  applicationId: string;
  artifact: TerminalUpdateArtifact;
  apkSha256?: string | null;
  bootId: string;
  entryKind: UpdateActualVersions['entryKind'];
}>): UpdateActualVersions => {
  const {applicationId, artifact, apkSha256, bootId, entryKind} = input;
  return Object.freeze({
    applicationId,
    nativeVersion: artifact.nativeVersion,
    nativeBuildNumber: artifact.nativeBuildNumber,
    ...(apkSha256 === undefined ? {} : {apkSha256}),
    bundleVersion: artifact.bundleVersion,
    runtimeVersion: artifact.runtimeVersion,
    publicationId: artifact.publicationId,
    bootId,
    entryKind,
  });
};

export const createTerminalUpdateAutomationFixture = (
  input: TerminalUpdateAutomationFixtureInput,
): TerminalUpdateAutomationFixture => {
  const {runId, applicationId} = input;
  const mode = modeFor(input.scenario);
  const ownerFlowFullApkSha256 = '5'.repeat(64);
  const artifact: TerminalUpdateArtifact = Object.freeze({
    schemaVersion: 1,
    platform: 'android',
    applicationId,
    nativeVersion: '1.0.0',
    nativeBuildNumber: 1,
    bundleVersion: '1.0.0',
    runtimeVersion: '1',
    entry: 'index.android.bundle',
    files: Object.freeze([{path: 'index.android.bundle', sizeBytes: 1, sha256: '2'.repeat(64)}]),
    publicationId: '1'.repeat(64),
  });
  const baseActual = actualFromArtifact({
    applicationId,
    artifact,
    bootId: `web-owner-fixture-${runId}`,
    entryKind: 'embedded',
  });
  let currentActual: UpdateActualVersions =
    mode === 'compatibility'
      ? Object.freeze({...baseActual, bundleVersion: '1.0.5', publicationId: '5'.repeat(64), entryKind: 'hot'})
      : baseActual;
  let currentEmbedded = artifact;
  const targetArtifact =
    mode === 'install-result'
      ? Object.freeze({...artifact, nativeBuildNumber: 2, bundleVersion: '1.0.1', publicationId: '6'.repeat(64)})
      : mode === 'owner-flow'
        ? Object.freeze({
            ...artifact,
            nativeBuildNumber: 2,
            bundleVersion: '1.0.1',
            publicationId: '3'.repeat(64),
            apk: Object.freeze({
              path: 'sample-terminal.apk',
              sha256: ownerFlowFullApkSha256,
              certificateSha256: '7'.repeat(64),
            }),
          })
      : artifact;
  const compatibilityFull: TerminalUpdateArtifact = Object.freeze({
    ...artifact,
    nativeBuildNumber: 2,
    bundleVersion: '1.0.4',
    publicationId: '7'.repeat(64),
  });
  const compatibilityHot: TerminalUpdateArtifact = Object.freeze({
    ...artifact,
    nativeBuildNumber: 2,
    bundleVersion: '1.0.6',
    publicationId: '8'.repeat(64),
  });
  const sourceFull = mode === 'compatibility' ? compatibilityFull : targetArtifact;
  const ownerFlowHot: TerminalUpdateArtifact = Object.freeze({
    ...artifact,
    nativeBuildNumber: targetArtifact.nativeBuildNumber,
    bundleVersion: '1.0.2',
    publicationId: '9'.repeat(64),
    minimumFull: Object.freeze({
      applicationId,
      nativeBuildNumber: targetArtifact.nativeBuildNumber,
      runtimeVersion: targetArtifact.runtimeVersion,
      publicationId: targetArtifact.publicationId,
      apkSha256: ownerFlowFullApkSha256,
    }),
  });
  const sourceHot =
    mode === 'compatibility'
      ? compatibilityHot
      : mode === 'owner-flow'
        ? ownerFlowHot
        : Object.freeze({...targetArtifact, publicationId: '9'.repeat(64)});
  const source = (kind: 'full' | 'hot', targetArtifactForKind: TerminalUpdateArtifact) =>
    Object.freeze({
      sourceRef: `run:${runId}:${kind}`,
      expectedSha256: targetArtifactForKind.publicationId,
      apkSha256: kind === 'full' ? (targetArtifactForKind.apk?.sha256 ?? null) : null,
      artifact: targetArtifactForKind,
      manifest: targetArtifactForKind,
    });
  const target: FixedUpdateTarget = Object.freeze({
    ruleRef: `automation-${runId}`,
    collectionHash: `automation-collection-${runId}`,
    createdAt: 1 as TimestampMs,
    applicationId,
    full: source('full', sourceFull),
    hot: source('hot', sourceHot),
    policy: Object.freeze({nSeconds: 300, hotStrategy: 'IMMEDIATE' as const, mSeconds: null}),
    strategy: Object.freeze({maxNetworkAttempts: 2, bootTimeoutMs: 60_000}),
    selectionContext: Object.freeze({
      selectedSpace: 'development',
      contextIdentity: runId,
      ruleRef: `automation-${runId}`,
    }),
  });

  let currentAction: UpdateAction | null = null;
  let prepared: Readonly<{preparedId: string; kind: 'full' | 'hot'; artifact: TerminalUpdateArtifact}> | null = null;
  let actionCount = 0;
  let firstCancellationObserved = false;
  const port: UpdatePort = {
    ...unavailableUpdatePort,
    readFacts: async () =>
      succeeded(
        Object.freeze({
          actual: currentActual,
          embedded: currentEmbedded,
          selectedPublicationId: currentActual.publicationId,
          previousPublicationId: null,
          candidatePublicationId: null,
          installerActionId: null,
          installerState: 'none' as const,
          selectionResetReason: null,
        }),
      ),
    prepareArtifact: async request => {
      if (prepared !== null && prepared.preparedId !== `prepared:${request.sourceRef}`) {
        return failed('prepareArtifact', 'PREPARED_ARTIFACT_ALREADY_ACTIVE');
      }
      const preparedId = `prepared:${request.sourceRef}`;
      prepared = Object.freeze({preparedId, kind: request.kind, artifact: request.artifact});
      return succeeded(Object.freeze({preparedId, artifact: request.artifact}));
    },
    applyPrepared: async command => {
      const currentPrepared = prepared;
      if (
        currentPrepared === null ||
        currentPrepared.preparedId !== command.preparedId ||
        currentPrepared.kind !== command.kind
      ) {
        return failed('applyPrepared', 'PREPARED_ARTIFACT_IDENTITY_MISMATCH');
      }
      actionCount += 1;
      if (mode === 'owner-flow') {
        const bootId = command.kind === 'full' ? `web-owner-fixture-${runId}-${actionCount}` : currentActual.bootId;
        if (command.kind === 'full') currentEmbedded = currentPrepared.artifact;
        currentActual = actualFromArtifact({
          applicationId,
          artifact: currentPrepared.artifact,
          apkSha256:
            command.kind === 'full' ? (currentPrepared.artifact.apk?.sha256 ?? null) : currentActual.apkSha256,
          bootId,
          entryKind: command.kind === 'hot' ? 'hot' : 'embedded',
        });
      }
      currentAction = Object.freeze({
        actionId: command.actionId,
        taskId: command.taskId,
        state: mode === 'install-result' ? 'waiting-user' : mode === 'owner-flow' ? 'succeeded' : 'accepted',
        reason: null,
        publicationId: currentPrepared.artifact.publicationId,
        bootId: currentActual.bootId,
      });
      return succeeded(currentAction);
    },
    readAction: async command => {
      if (
        currentAction === null ||
        currentAction.taskId !== command.taskId ||
        currentAction.actionId !== command.actionId
      ) {
        return succeeded(null);
      }
      if (mode === 'install-result' && actionCount === 1 && !firstCancellationObserved) {
        firstCancellationObserved = true;
        currentAction = Object.freeze({...currentAction, state: 'user-cancelled', reason: 'ENDED_NOT_INSTALLED'});
      }
      return succeeded(currentAction);
    },
    confirmBoot: async () => ({
      status: 'unavailable' as const,
      port: 'update' as const,
      capability: 'confirmBoot',
      reason: 'PLATFORM_UNSUPPORTED' as const,
      message: 'Web fixture does not confirm native boot',
    }),
    releasePrepared: async command => {
      if (prepared?.preparedId !== command.preparedId) return failed('releasePrepared', 'PREPARED_IDENTITY_MISMATCH');
      prepared = null;
      return succeeded({released: true});
    },
  };

  const sourceProvider: UpdateTargetSourceProvider = {
    readTarget: async selectionContext =>
      selectionContext.contextIdentity === runId &&
      selectionContext.selectedSpace === 'development' &&
      selectionContext.ruleRef === target.ruleRef
        ? target
        : null,
    resolveSourcePath: sourceRef =>
      sourceRef === target.full?.sourceRef
        ? '/fixtures/full.zip'
        : sourceRef === target.hot?.sourceRef
          ? '/fixtures/hot.zip'
          : null,
  };

  return Object.freeze({port, sourceProvider});
};
