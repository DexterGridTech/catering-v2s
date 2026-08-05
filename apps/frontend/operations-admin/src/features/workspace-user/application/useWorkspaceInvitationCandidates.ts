import {contextScopedQueryArgs} from '@catering-v2s/admin-ui-foundation';
import {useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';

type TargetType = 'GROUP' | 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE';
type SubjectType = 'ORGANIZATION' | 'ROLE';
type CandidateUsage = 'LIST_FILTER' | 'INVITATION_TARGET';

type CandidateInput = {
  targetType: TargetType;
  queryContext: OperationsPageProps['queryContext'];
  subjectType: SubjectType;
  candidateUsage: CandidateUsage;
  queryText?: string;
  page?: number;
  pageSize?: number;
  selectedOrganizationRef?: string;
  enabled?: boolean;
};

/** One generated operations face per target type, backed by the same workspace-IAM candidate owner query. */
export function useWorkspaceInvitationCandidates({targetType, queryContext, subjectType, candidateUsage, queryText, page = 1, pageSize = 50, selectedOrganizationRef, enabled = true}: CandidateInput) {
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const options = useMemo(() => ({query: contextScopedQueryArgs({
    scopeRef: queryContext.scopeRef,
    subjectType,
    candidateUsage,
    queryText: queryText?.trim() || undefined,
    page,
    pageSize,
    selectedOrganizationRef: selectedOrganizationRef || undefined,
  }, {
    groupWorkspaceKey: queryContext.groupWorkspaceKey,
    expectedContextVersion: queryContext.expectedContextVersion,
  })}), [candidateUsage, page, pageSize, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef, queryText, selectedOrganizationRef, subjectType]);
  const group = operationsRtk.useGetOperationsWorkspaceGroupInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceGroupInvitationCandidates(path, options), {skip: !enabled || targetType !== 'GROUP'});
  const region = operationsRtk.useGetOperationsWorkspaceRegionInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceRegionInvitationCandidates(path, options), {skip: !enabled || targetType !== 'REGION'});
  const project = operationsRtk.useGetOperationsWorkspaceProjectInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceProjectInvitationCandidates(path, options), {skip: !enabled || targetType !== 'PROJECT'});
  const headCompany = operationsRtk.useGetOperationsWorkspaceHeadCompanyInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyInvitationCandidates(path, options), {skip: !enabled || targetType !== 'HEAD_COMPANY'});
  const store = operationsRtk.useGetOperationsWorkspaceStoreInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceStoreInvitationCandidates(path, options), {skip: !enabled || targetType !== 'STORE'});
  return targetType === 'GROUP' ? group : targetType === 'REGION' ? region : targetType === 'PROJECT' ? project : targetType === 'HEAD_COMPANY' ? headCompany : store;
}
