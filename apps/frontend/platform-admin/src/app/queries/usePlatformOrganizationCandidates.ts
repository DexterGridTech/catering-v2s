import {useEffect, useMemo} from 'react';
import {useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {platformAdminRtkRequest} from '../api/generated/platform-edge.rtk';
import {platformRtk} from '../api/PlatformTransport';
import type {
  OrganizationCandidatePageItemsItem,
  OrganizationCandidateQuerySubjectType,
} from '../api/generated/platform-edge';
import {wireUuid} from '../api/wireUuid';

const PAGE_SIZE = 50;
type PlatformOrganizationCandidate = OrganizationCandidatePageItemsItem;

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
  const {acceptPage, debouncedQueryText, items, page, pageSize, total} = candidates;
  const query = useMemo(
    () => ({
      subjectType,
      candidateUsage: 'EXTERNAL_BINDING' as const,
      queryText: debouncedQueryText,
      page,
      pageSize: PAGE_SIZE,
      ...(selectedId ? {selectedId: wireUuid(selectedId)} : {}),
      ...(projectId ? {projectId: wireUuid(projectId)} : {}),
    }),
    [debouncedQueryText, page, projectId, selectedId, subjectType],
  );
  const request = useMemo(
    () => platformAdminRtkRequest.getPlatformOrganizationCandidates({groupWorkspaceKey}, {query}),
    [groupWorkspaceKey, query],
  );
  const result = platformRtk.useGetPlatformOrganizationCandidatesQuery(request, {skip: !open});
  useEffect(() => {
    const data = result.data;
    if (!data) return;
    acceptPage(data.items, data.metadata);
  }, [acceptPage, page, result.data]);
  const onPopupScroll = (event: Parameters<typeof candidates.onPopupScroll>[0]) =>
    candidates.onPopupScroll(event, result.isFetching);
  return {
    ...result,
    items,
    total,
    page,
    pageSize,
    onPopupScroll,
  };
}
