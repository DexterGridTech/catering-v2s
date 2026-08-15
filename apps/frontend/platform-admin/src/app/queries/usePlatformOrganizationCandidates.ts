import {useCallback, useEffect, useMemo, useRef, useState, type UIEvent} from 'react';
import {platformAdminRtkRequest} from '../api/generated/platform-edge.rtk';
import {platformRtk} from '../api/PlatformTransport';
import type {OrganizationCandidateQuerySubjectType} from '../api/generated/platform-edge';
import {wireUuid} from '../api/wireUuid';

const PAGE_SIZE = 50;

/** Platform-administrator relation selectors use the same organization owner candidate semantics as operations. */
export function usePlatformOrganizationCandidates({open, groupWorkspaceKey, subjectType, queryText, selectedId, projectId}: {open: boolean; groupWorkspaceKey: string; subjectType: OrganizationCandidateQuerySubjectType; queryText?: string; selectedId?: string; projectId?: string}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Array<{id: string; name: string; code: string}>>([]);
  const query = useMemo(() => ({subjectType, candidateUsage: 'CONTRACT_LIST' as const, queryText: queryText?.trim() || undefined, page, pageSize: PAGE_SIZE, ...(selectedId ? {selectedId: wireUuid(selectedId)} : {}), ...(projectId ? {projectId: wireUuid(projectId)} : {})}), [page, projectId, queryText, selectedId, subjectType]);
  const request = useMemo(() => platformAdminRtkRequest.getPlatformOrganizationCandidates({groupWorkspaceKey}, {query}), [groupWorkspaceKey, query]);
  const result = platformRtk.useGetPlatformOrganizationCandidatesQuery(request, {skip: !open});
  const identity = `${groupWorkspaceKey}|${subjectType}|${queryText?.trim() ?? ''}|${selectedId ?? ''}|${projectId ?? ''}`;
  const previousIdentity = useRef(identity);

  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    setPage(1);
    setItems([]);
  }, [identity]);
  useEffect(() => {
    const data = result.data;
    if (!data) return;
    setItems((current) => {
      const byId = new Map((page === 1 ? [] : current).map((item) => [item.id, item]));
      for (const item of data.items) byId.set(item.id, item);
      return [...byId.values()];
    });
  }, [page, result.data]);
  const onPopupScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight < target.scrollHeight - 8) return;
    if (!result.data || result.isFetching || page * result.data.metadata.pageSize >= result.data.metadata.total) return;
    setPage((current) => current + 1);
  }, [page, result.data, result.isFetching]);
  return {...result, items, onPopupScroll};
}
