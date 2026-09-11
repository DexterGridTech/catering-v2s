import {useCallback, useEffect, useMemo, useState} from 'react';
import {useCursorCandidates} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../api/OperationsTransport';
import {operationsAdminRtkRequest} from '../api/generated/operations-edge.rtk';
import type {OrganizationCandidateQuerySubjectType} from '../api/generated/operations-edge';
import type {OperationsPageProps} from '../routing/model';

type Query = NonNullable<Parameters<typeof operationsAdminRtkRequest.getOperationsOrganizationCandidates>[1]['query']>;

const PAGE_SIZE = 50;
type OrganizationCandidate = {id: string; name: string; code: string};

/** Shared candidate query primitive; consumers keep their own selection and search state. */
export function useOrganizationCandidates({
  open,
  queryContext,
  subjectType,
  candidateUsage = 'DEFAULT',
  queryText,
  pageSize = PAGE_SIZE,
  selectedId,
  projectId,
  brandId,
  tenantId,
}: {
  open: boolean;
  queryContext: OperationsPageProps['queryContext'];
  subjectType: OrganizationCandidateQuerySubjectType;
  candidateUsage?: 'DEFAULT' | 'CONTRACT_LIST';
  queryText?: string;
  pageSize?: number;
  selectedId?: string;
  projectId?: string;
  brandId?: string;
  tenantId?: string;
}) {
  const [internalQueryText, setInternalQueryText] = useState<string>();
  const effectiveQueryText = queryText ?? internalQueryText;
  const candidates = useCursorCandidates<OrganizationCandidate>({
    queryText: effectiveQueryText,
    resetKey: [
      open,
      queryContext.groupWorkspaceKey,
      queryContext.expectedContextVersion,
      subjectType,
      candidateUsage,
      selectedId ?? '',
      projectId ?? '',
      brandId ?? '',
      tenantId ?? '',
    ].join('|'),
    pageSize,
    keyOf: item => item.id,
  });
  const query: Query = useMemo(
    () => ({
      expectedContextVersion: queryContext.expectedContextVersion,
      subjectType,
      candidateUsage,
      queryText: candidates.debouncedQueryText,
      page: candidates.page,
      pageSize,
      selectedId,
      projectId,
      brandId,
      tenantId,
    }),
    [
      brandId,
      candidateUsage,
      candidates.debouncedQueryText,
      candidates.page,
      pageSize,
      projectId,
      queryContext.expectedContextVersion,
      selectedId,
      subjectType,
      tenantId,
    ],
  );
  const request = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query},
      ),
    [query, queryContext.groupWorkspaceKey],
  );
  const result = operationsRtk.useGetOperationsOrganizationCandidatesQuery(request, {skip: !open});
  const acceptPage = candidates.acceptPage;
  const page = candidates.page;
  useEffect(() => {
    if (!result.currentData) return;
    acceptPage(result.currentData.items, result.currentData.metadata);
  }, [acceptPage, page, result.currentData]);

  const onPopupScroll = (event: Parameters<typeof candidates.onPopupScroll>[0]) =>
    candidates.onPopupScroll(event, result.isFetching);
  const setStoreSearch = useCallback((value: string) => setInternalQueryText(value), []);
  return {
    ...result,
    data: result.currentData,
    items: candidates.items,
    total: candidates.total,
    page: candidates.page,
    pageSize: candidates.pageSize,
    setStoreSearch,
    onPopupScroll,
  };
}
