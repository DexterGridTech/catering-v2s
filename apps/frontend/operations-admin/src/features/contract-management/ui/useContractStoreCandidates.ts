import {useCallback, useEffect, useMemo, useState} from 'react';
import {useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {StoreContractStoreCandidate} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageContext} from '../../../app/routing/model';

const PAGE_SIZE = 50;

export function useContractStoreCandidates({
  open,
  queryContext,
  selectedStoreId,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  selectedStoreId?: string;
}) {
  const [storeSearch, setStoreSearchState] = useState<string>();
  const candidates = useCursorCandidates<StoreContractStoreCandidate>({
    queryText: storeSearch,
    resetKey: [open, queryContext.groupWorkspaceKey, queryContext.expectedContextVersion, selectedStoreId ?? ''].join(
      '|',
    ),
    pageSize: PAGE_SIZE,
    keyOf: store => store.id,
  });
  const request = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsContractCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {
          query: {
            expectedContextVersion: queryContext.expectedContextVersion,
            selectedStoreId,
            storeSearch: candidates.debouncedQueryText,
            page: candidates.page,
            pageSize: PAGE_SIZE,
          },
        },
      ),
    [
      candidates.debouncedQueryText,
      candidates.page,
      queryContext.expectedContextVersion,
      queryContext.groupWorkspaceKey,
      selectedStoreId,
    ],
  );
  const result = operationsRtk.useGetOperationsContractCandidatesQuery(request, {skip: !open});
  const acceptPage = candidates.acceptPage;
  const page = candidates.page;
  useEffect(() => {
    const data = result.currentData;
    if (!data) return;
    acceptPage(data.stores, data.metadata);
  }, [acceptPage, page, result.currentData]);

  const setStoreSearch = useCallback((value: string) => {
    setStoreSearchState(value);
  }, []);
  const onPopupScroll = (event: Parameters<typeof candidates.onPopupScroll>[0]) =>
    candidates.onPopupScroll(event, result.isFetching);

  return {
    ...result,
    data: result.currentData,
    stores: candidates.items,
    storeSearch,
    setStoreSearch,
    onPopupScroll,
  };
}
