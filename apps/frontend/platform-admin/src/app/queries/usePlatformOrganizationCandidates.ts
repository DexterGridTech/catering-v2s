import {useEffect, useMemo} from 'react';
import {useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {platformAdminRtkRequest} from '../api/generated/platform-edge.rtk';
import {platformRtk} from '../api/PlatformTransport';
import type {OrganizationCandidateQuerySubjectType} from '../api/generated/platform-edge';
import {wireUuid} from '../api/wireUuid';

const PAGE_SIZE = 50;
type PlatformOrganizationCandidate = {id: string; name: string; code: string};

/** Platform-administrator relation selectors use the same organization owner candidate semantics as operations. */
export function usePlatformOrganizationCandidates({
  open,
  groupWorkspaceKey,
  subjectType,
  queryText,
  selectedId,
  projectId,
}: {
  open: boolean;
  groupWorkspaceKey: string;
  subjectType: OrganizationCandidateQuerySubjectType;
  queryText?: string;
  selectedId?: string;
  projectId?: string;
}) {
  const candidates = useCursorCandidates<PlatformOrganizationCandidate>({
    queryText,
    resetKey: `${open}|${groupWorkspaceKey}|${subjectType}|${selectedId ?? ''}|${projectId ?? ''}`,
    pageSize: PAGE_SIZE,
    keyOf: item => item.id,
  });
  const query = useMemo(
    () => ({
      subjectType,
      candidateUsage: 'CONTRACT_LIST' as const,
      queryText: candidates.debouncedQueryText,
      page: candidates.page,
      pageSize: PAGE_SIZE,
      ...(selectedId ? {selectedId: wireUuid(selectedId)} : {}),
      ...(projectId ? {projectId: wireUuid(projectId)} : {}),
    }),
    [candidates.debouncedQueryText, candidates.page, projectId, selectedId, subjectType],
  );
  const request = useMemo(
    () => platformAdminRtkRequest.getPlatformOrganizationCandidates({groupWorkspaceKey}, {query}),
    [groupWorkspaceKey, query],
  );
  const result = platformRtk.useGetPlatformOrganizationCandidatesQuery(request, {skip: !open});
  useEffect(() => {
    const data = result.data;
    if (!data) return;
    candidates.acceptPage(data.items, data.metadata);
  }, [candidates.acceptPage, candidates.page, result.data]);
  const onPopupScroll = (event: Parameters<typeof candidates.onPopupScroll>[0]) =>
    candidates.onPopupScroll(event, result.isFetching);
  return {
    ...result,
    items: candidates.items,
    total: candidates.total,
    page: candidates.page,
    pageSize: candidates.pageSize,
    onPopupScroll,
  };
}
