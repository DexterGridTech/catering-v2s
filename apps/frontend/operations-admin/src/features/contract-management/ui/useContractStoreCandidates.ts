import {useCallback, useEffect, useMemo, useRef, useState, type UIEvent} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {StoreContractStoreCandidate} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageContext} from '../../../app/routing/model';

const PAGE_SIZE = 50;

export function useContractStoreCandidates({open, queryContext, projectId, selectedStoreId}: {
  open: boolean;
  queryContext: OperationsPageContext;
  projectId?: string;
  selectedStoreId?: string;
}) {
  const [storeSearch, setStoreSearchState] = useState<string>();
  const [page, setPage] = useState(1);
  const [stores, setStores] = useState<StoreContractStoreCandidate[]>([]);
  const request = useMemo(() => operationsAdminRtkRequest.getOperationsContractCandidates(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {
      expectedContextVersion: queryContext.expectedContextVersion,
      projectId: projectId ?? '',
      selectedStoreId,
      storeSearch,
      page,
      pageSize: PAGE_SIZE,
    }},
  ), [page, projectId, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, selectedStoreId, storeSearch]);
  const result = operationsRtk.useGetOperationsContractCandidatesQuery(request, {skip: !open || !projectId});
  const queryIdentity = `${queryContext.groupWorkspaceKey}|${queryContext.expectedContextVersion}|${projectId ?? ''}|${selectedStoreId ?? ''}|${storeSearch ?? ''}`;
  const previousIdentity = useRef(queryIdentity);

  useEffect(() => {
    if (previousIdentity.current === queryIdentity) return;
    previousIdentity.current = queryIdentity;
    setPage(1);
    setStores([]);
  }, [queryIdentity]);

  useEffect(() => {
    const data = result.data;
    if (!data) return;
    setStores((current) => {
      const next = page === 1 ? [] : current;
      const byId = new Map(next.map((store) => [store.id, store]));
      for (const store of data.stores) byId.set(store.id, store);
      return [...byId.values()];
    });
  }, [page, result.data]);

  const setStoreSearch = useCallback((value: string) => {
    setStoreSearchState(value.trim() || undefined);
    setPage(1);
    setStores([]);
  }, []);
  const onPopupScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight < target.scrollHeight - 8) return;
    if (!result.data || result.isFetching || page * result.data.metadata.pageSize >= result.data.metadata.total) return;
    setPage((current) => current + 1);
  }, [page, result.data, result.isFetching]);

  return {
    ...result,
    data: result.data,
    stores,
    storeSearch,
    setStoreSearch,
    onPopupScroll,
  };
}
