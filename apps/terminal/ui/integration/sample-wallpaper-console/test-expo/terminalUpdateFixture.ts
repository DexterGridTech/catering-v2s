import type {PortResult, UpdateAction, UpdateActualVersions, UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import type {FixedUpdateTarget, UpdateTargetSourceProvider} from '@catering-v2s/kernel-base-terminal-update';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';

const applicationId = 'com.catering.v2s.terminal.samplewallpaper';
const publicationId = 'a'.repeat(64);
const artifact = Object.freeze({
  schemaVersion: 1 as const,
  platform: 'android' as const,
  applicationId,
  nativeVersion: '1.0.0',
  nativeBuildNumber: 1,
  bundleVersion: '1.0.0',
  runtimeVersion: '1',
  entry: 'index.android.bundle',
  files: Object.freeze([{path: 'index.android.bundle', sizeBytes: 1, sha256: 'b'.repeat(64)}]),
  publicationId,
});

const actual: UpdateActualVersions = Object.freeze({
  applicationId,
  nativeVersion: artifact.nativeVersion,
  nativeBuildNumber: artifact.nativeBuildNumber,
  runtimeVersion: artifact.runtimeVersion,
  bundleVersion: artifact.bundleVersion,
  publicationId,
  bootId: 'web-wallpaper-owner-fixture-boot',
  entryKind: 'embedded',
});

const succeeded = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: Date.now() as TimestampMs,
});

export const createTerminalUpdateAutomationFixture = (
  runId: string,
  mode: 'fixed' | 'install-result' = 'fixed',
): Readonly<{
  port: UpdatePort;
  sourceProvider: UpdateTargetSourceProvider;
}> => {
  const targetArtifact = mode === 'install-result'
    ? Object.freeze({...artifact, nativeBuildNumber: 2, bundleVersion: '1.0.1', publicationId: 'c'.repeat(64)})
    : artifact;
  const target: FixedUpdateTarget = Object.freeze({
    ruleRef: `automation-${runId}`,
    createdAt: 1 as TimestampMs,
    applicationId,
    full: Object.freeze({sourceRef: `run:${runId}:full`, expectedSha256: targetArtifact.publicationId, artifact: targetArtifact}),
    hot: Object.freeze({sourceRef: `run:${runId}:hot`, expectedSha256: targetArtifact.publicationId, artifact: targetArtifact}),
    strategy: Object.freeze({maxNetworkAttempts: 2, bootTimeoutMs: 60_000}),
    selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: runId}),
  });

  let currentAction: UpdateAction | null = null;
  let actionCount = 0;
  let firstCancellationObserved = false;
  const port: UpdatePort = {
    readFacts: async () => succeeded(Object.freeze({
      actual,
      embedded: artifact,
      selectedPublicationId: publicationId,
      previousPublicationId: null,
      candidatePublicationId: null,
      installerActionId: null,
      installerState: 'none' as const,
      selectionResetReason: null,
    })),
    prepareArtifact: async input => succeeded(Object.freeze({preparedId: `prepared:${input.sourceRef}`, artifact: input.artifact})),
    applyPrepared: async input => {
      actionCount += 1;
      currentAction = Object.freeze({
        actionId: input.actionId,
        taskId: input.taskId,
        state: mode === 'install-result' ? 'waiting-user' as const : 'accepted' as const,
        reason: null,
        publicationId: targetArtifact.publicationId,
        bootId: actual.bootId,
      });
      return succeeded(currentAction);
    },
    readAction: async input => {
      if (currentAction === null || currentAction.taskId !== input.taskId || currentAction.actionId !== input.actionId)
        return succeeded(null);
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
    releasePrepared: async () => succeeded({released: true}),
  };

  const sourceProvider: UpdateTargetSourceProvider = {
    readTarget: async selectionContext =>
      selectionContext.contextIdentity === runId && selectionContext.selectedSpace === 'development' ? target : null,
    resolveSourcePath: sourceRef => sourceRef === target.full?.sourceRef ? '/fixtures/full.apk' :
      sourceRef === target.hot?.sourceRef ? '/fixtures/hot.zip' : null,
  };

  return Object.freeze({port, sourceProvider});
};
