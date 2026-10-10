import type {FaceOperationContracts, TerminalUpdateStageResult} from '../../../app/api/generated/platform-edge';

type ArtifactPageQuery = FaceOperationContracts['getPlatformTerminalUpdateArtifactPage']['query'];
type MinimumFull = NonNullable<TerminalUpdateStageResult['minimumFull']>;

export function platformMinimumFullCandidateQuery(minimumFull: MinimumFull | undefined): ArtifactPageQuery {
  if (minimumFull === undefined) return {kind: 'FULL', limit: 50};
  return {
    kind: 'FULL',
    limit: 50,
    appId: minimumFull.applicationId,
    runtimeVersion: minimumFull.runtimeVersion,
    minimumFullNativeBuildNumber: minimumFull.nativeBuildNumber,
    minimumFullPublicationId: minimumFull.publicationId,
    minimumFullApkSha256: minimumFull.apkSha256,
  };
}
