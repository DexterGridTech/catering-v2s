import {useEffect, useMemo, useState, type UIEvent} from 'react';
import {useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {InventoryConsumptionTargetCandidatePage} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';

export type InventoryConsumptionTargetCandidate = InventoryConsumptionTargetCandidatePage['data']['items'][number];

type Options = {
  scopeRef?: string;
  brandRef?: string;
  resetKey: string;
  excludedTargetRef?: string | null;
  /**
   * A BOM cannot consume the stock target that belongs to the very owner
   * being configured. This is an identity guard only; eligibility remains
   * exclusively inventory-owner controlled.
   */
  excludedOwner?: {itemRef: string; productSkuRef?: string | null} | null;
};

export function isCurrentOwnerConsumptionTarget(
  candidate: InventoryConsumptionTargetCandidate,
  owner: Options['excludedOwner'],
) {
  return Boolean(
    owner && candidate.itemRef === owner.itemRef && (candidate.productSkuRef ?? null) === (owner.productSkuRef ?? null),
  );
}

/**
 * Candidate transport stays cursor-backed and owner-provided.  The hook only
 * owns query text, continuation and presentation-level self filtering; it
 * never reconstructs eligibility from the catalog list.
 */
export function useInventoryConsumptionTargetCandidates({
  scopeRef,
  brandRef,
  resetKey,
  excludedTargetRef,
  excludedOwner,
}: Options) {
  const [keyword, setKeyword] = useState('');
  const candidateState = useCursorCandidates<InventoryConsumptionTargetCandidate>({
    queryText: keyword,
    resetKey,
    pageSize: 20,
    keyOf: candidate => candidate.targetRef,
  });
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsInventoryConsumptionTargetCandidates(
        {},
        {
          query: {
            dataNodeRef: wireUuid(scopeRef ?? ''),
            ...(candidateState.debouncedQueryText ? {keyword: candidateState.debouncedQueryText} : {}),
            ...(candidateState.cursor ? {cursor: candidateState.cursor} : {}),
            pageSize: candidateState.pageSize,
          },
          headers,
        },
      ),
    [candidateState.cursor, candidateState.debouncedQueryText, candidateState.pageSize, headers, scopeRef],
  );
  const query = operationsRtk.useGetOperationsInventoryConsumptionTargetCandidatesQuery(request, {
    skip: !scopeRef,
  });
  const page = query.currentData?.data;
  const acceptPage = candidateState.acceptPage;
  useEffect(() => {
    if (!page) return;
    acceptPage(page.items, {
      pageSize: candidateState.pageSize,
      total: page.total,
      nextCursor: page.nextCursor,
    });
  }, [acceptPage, candidateState.pageSize, page]);

  const items = useMemo(
    () =>
      candidateState.items.filter(
        candidate => candidate.targetRef !== excludedTargetRef && !isCurrentOwnerConsumptionTarget(candidate, excludedOwner),
      ),
    [candidateState.items, excludedOwner, excludedTargetRef],
  );

  return {
    keyword,
    setKeyword,
    items,
    total: candidateState.total,
    loading: query.isLoading || query.isFetching,
    error: query.error,
    hasNext: Boolean(candidateState.nextCursor),
    loadNext: () => candidateState.loadNext(query.isFetching),
    onPopupScroll: (event: UIEvent<HTMLElement>) => candidateState.onPopupScroll(event, query.isFetching),
    retry: query.refetch,
  };
}
