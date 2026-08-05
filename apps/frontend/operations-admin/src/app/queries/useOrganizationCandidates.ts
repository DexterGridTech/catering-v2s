import {useCallback, useEffect, useMemo, useRef, useState, type UIEvent} from 'react';
import {operationsRtk} from '../api/OperationsTransport';
import {operationsAdminRtkRequest} from '../api/generated/operations-edge.rtk';
import type {OrganizationCandidateQuerySubjectType} from '../api/generated/operations-edge';
import type {OperationsPageProps} from '../routing/model';

type Query = NonNullable<Parameters<typeof operationsAdminRtkRequest.getOperationsOrganizationCandidates>[1]['query']>;

const PAGE_SIZE = 50;

/** Shared candidate query primitive; consumers keep their own selection and search state. */
export function useOrganizationCandidates({open, queryContext, subjectType, candidateUsage = 'DEFAULT', queryText, pageSize = PAGE_SIZE, selectedId, projectId, brandId, tenantId}: {open: boolean; queryContext: OperationsPageProps['queryContext']; subjectType: OrganizationCandidateQuerySubjectType; candidateUsage?: 'DEFAULT' | 'CONTRACT_LIST'; queryText?: string; pageSize?: number; selectedId?: string; projectId?: string; brandId?: string; tenantId?: string}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Array<{id: string; name: string; code: string}>>([]);
  const query: Query = useMemo(() => ({expectedContextVersion: queryContext.expectedContextVersion, subjectType, candidateUsage, queryText: queryText?.trim() || undefined, page, pageSize, selectedId, projectId, brandId, tenantId}), [brandId, candidateUsage, page, pageSize, projectId, queryContext.expectedContextVersion, queryText, selectedId, subjectType, tenantId]);
  const request = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationCandidates({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query}), [query, queryContext.groupWorkspaceKey]);
  const result = operationsRtk.useGetOperationsOrganizationCandidatesQuery(request, {skip: !open});
  const identity = `${queryContext.groupWorkspaceKey}|${queryContext.expectedContextVersion}|${subjectType}|${candidateUsage}|${queryText?.trim() ?? ''}|${selectedId ?? ''}|${projectId ?? ''}|${brandId ?? ''}|${tenantId ?? ''}`;
  const previousIdentity = useRef(identity);

  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    setPage(1);
    setItems([]);
  }, [identity]);

  useEffect(() => {
    if (!result.data) return;
    setItems((current) => {
      const byId = new Map((page === 1 ? [] : current).map((item) => [item.id, item]));
      for (const item of result.data?.items ?? []) byId.set(item.id, item);
      return [...byId.values()];
    });
  }, [page, result.data]);

  const onPopupScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight < target.scrollHeight - 8) return;
    if (!result.data || result.isFetching || page * result.data.metadata.pageSize >= result.data.metadata.total) return;
    setPage((current) => current + 1);
  }, [page, result.data, result.isFetching]);

  return {...result, items, total: result.data?.metadata.total ?? 0, page, pageSize, onPopupScroll};
}
