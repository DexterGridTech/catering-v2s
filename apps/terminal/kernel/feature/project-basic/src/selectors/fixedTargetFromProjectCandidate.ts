import type {FixedUpdateTarget} from '@catering-v2s/kernel-base-terminal-update';
import type {ProjectTerminalUpdateCandidate} from '../types/types';

export const fixedTargetFromProjectCandidate = (candidate: ProjectTerminalUpdateCandidate): FixedUpdateTarget => {
  const source = (artifact: ProjectTerminalUpdateCandidate['rule']['full']): NonNullable<FixedUpdateTarget['full']> =>
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
  return Object.freeze({
    ruleRef: candidate.rule.ruleRef,
    collectionHash: candidate.collectionHash,
    createdAt: candidate.rule.createdAtEpochMillis as FixedUpdateTarget['createdAt'],
    applicationId: candidate.rule.applicationId,
    full: source(candidate.rule.full),
    hot: candidate.rule.hot === null ? null : source(candidate.rule.hot),
    policy: Object.freeze({
      nSeconds: candidate.rule.nSeconds,
      hotStrategy: candidate.rule.hotStrategy,
      mSeconds: candidate.rule.mSeconds,
    }),
    strategy: Object.freeze({maxNetworkAttempts: 2, bootTimeoutMs: 60_000}),
    selectionContext: Object.freeze({
      selectedSpace: candidate.selectedSpace,
      contextIdentity: candidate.contextIdentity,
      ruleRef: candidate.rule.ruleRef,
    }),
  });
};
