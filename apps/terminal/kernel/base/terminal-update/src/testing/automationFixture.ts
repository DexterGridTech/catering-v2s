import type {
  PortResult,
  UpdateAction,
  UpdateActualVersions,
  UpdatePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {unavailableUpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {FixedUpdateTarget, UpdateTargetSourceProvider} from '../types/terminalUpdate';

type AutomationMode = 'fixed' | 'install-result' | 'compatibility';

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
      : 'fixed';

const succeeded = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: Date.now() as TimestampMs,
});

export const createTerminalUpdateAutomationFixture = (
  input: TerminalUpdateAutomationFixtureInput,
): TerminalUpdateAutomationFixture => {
  const {runId, applicationId} = input;
  const mode = modeFor(input.scenario);
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
    bootId: `web-owner-fixture-${runId}`,
    entryKind: 'embedded',
  });
  const currentActual: UpdateActualVersions =
    mode === 'compatibility'
      ? Object.freeze({...actual, bundleVersion: '1.0.5', publicationId: 'f'.repeat(64), entryKind: 'hot'})
      : actual;
  const targetArtifact =
    mode === 'install-result'
      ? Object.freeze({...artifact, nativeBuildNumber: 2, bundleVersion: '1.0.1', publicationId: 'c'.repeat(64)})
      : artifact;
  const compatibilityFull = Object.freeze({
    ...artifact,
    nativeBuildNumber: 2,
    bundleVersion: '1.0.4',
    publicationId: 'd'.repeat(64),
  });
  const compatibilityHot = Object.freeze({
    ...artifact,
    nativeBuildNumber: 2,
    bundleVersion: '1.0.6',
    publicationId: 'e'.repeat(64),
  });
  const target: FixedUpdateTarget = Object.freeze({
    ruleRef: `automation-${runId}`,
    collectionHash: `automation-collection-${runId}`,
    createdAt: 1 as TimestampMs,
    applicationId,
    full: Object.freeze({
      sourceRef: `run:${runId}:full`,
      expectedSha256: mode === 'compatibility' ? compatibilityFull.publicationId : targetArtifact.publicationId,
      artifact: mode === 'compatibility' ? compatibilityFull : targetArtifact,
      manifest: mode === 'compatibility' ? compatibilityFull : targetArtifact,
    }),
    hot: Object.freeze({
      sourceRef: `run:${runId}:hot`,
      expectedSha256: mode === 'compatibility' ? compatibilityHot.publicationId : targetArtifact.publicationId,
      artifact: mode === 'compatibility' ? compatibilityHot : targetArtifact,
      manifest: mode === 'compatibility' ? compatibilityHot : targetArtifact,
    }),
    policy: Object.freeze({nSeconds: 300, hotStrategy: 'IMMEDIATE' as const, mSeconds: null}),
    strategy: Object.freeze({maxNetworkAttempts: 2, bootTimeoutMs: 60_000}),
    selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: runId, ruleRef: `automation-${runId}`}),
  });

  let currentAction: UpdateAction | null = null;
  let actionCount = 0;
  let firstCancellationObserved = false;
  const port: UpdatePort = {
    ...unavailableUpdatePort,
    readFacts: async () =>
      succeeded(
        Object.freeze({
          actual: currentActual,
          embedded: artifact,
          selectedPublicationId: currentActual.publicationId,
          previousPublicationId: null,
          candidatePublicationId: null,
          installerActionId: null,
          installerState: 'none' as const,
          selectionResetReason: null,
        }),
      ),
    prepareArtifact: async source =>
      succeeded(Object.freeze({preparedId: `prepared:${source.sourceRef}`, artifact: source.artifact})),
    applyPrepared: async command => {
      actionCount += 1;
      currentAction = Object.freeze({
        actionId: command.actionId,
        taskId: command.taskId,
        state: mode === 'install-result' ? ('waiting-user' as const) : ('accepted' as const),
        reason: null,
        publicationId: targetArtifact.publicationId,
        bootId: currentActual.bootId,
      });
      return succeeded(currentAction);
    },
    readAction: async command => {
      if (
        currentAction === null ||
        currentAction.taskId !== command.taskId ||
        currentAction.actionId !== command.actionId
      )
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
      selectionContext.contextIdentity === runId && selectionContext.selectedSpace === 'development' &&
      selectionContext.ruleRef === target.ruleRef ? target : null,
    resolveSourcePath: sourceRef =>
      sourceRef === target.full?.sourceRef
        ? '/fixtures/full.zip'
        : sourceRef === target.hot?.sourceRef
          ? '/fixtures/hot.zip'
          : null,
  };

  return Object.freeze({port, sourceProvider});
};
