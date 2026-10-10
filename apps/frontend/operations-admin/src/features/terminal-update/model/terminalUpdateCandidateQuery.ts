import type {FaceOperationContracts} from '../../../app/api/generated/operations-edge';

type CandidateQuery = FaceOperationContracts['getOperationsTerminalUpdateArtifactCandidatePage']['query'];

type CandidateQueryInput = Pick<CandidateQuery, 'expectedContextVersion' | 'projectRef' | 'kind' | 'limit'> & {
  queryText?: string;
  cursor?: string;
  minimumFullArtifactRef?: CandidateQuery['minimumFullArtifactRef'];
};

export function terminalUpdateCandidateQuery(input: CandidateQueryInput): CandidateQuery {
  const queryText = input.queryText?.trim();
  return {
    expectedContextVersion: input.expectedContextVersion,
    projectRef: input.projectRef,
    kind: input.kind,
    ...(queryText ? {queryText} : {}),
    ...(input.cursor ? {cursor: input.cursor} : {}),
    ...(input.minimumFullArtifactRef ? {minimumFullArtifactRef: input.minimumFullArtifactRef} : {}),
    limit: input.limit,
  };
}
