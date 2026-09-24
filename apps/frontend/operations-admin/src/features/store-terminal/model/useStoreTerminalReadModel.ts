import {useRefreshVersion, useCursorCandidates, useCursorStack} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsContentTabRefreshSignal, operationsRtk} from '../../../app/api/OperationsTransport';
import type {
  StoreTerminalAreaCandidate,
  StoreTerminalTagCandidate,
  Uuid,
} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import {STORE_TERMINAL_PAGE_SIZE} from './storeTerminalModel';

const emptyUuid = '' as Uuid;

export function useStoreTerminalReadModel({
  queryContext,
  gateReady,
  selectedTerminalRef,
  editorOpen,
}: {
  queryContext: OperationsPageProps['queryContext'];
  gateReady: boolean;
  selectedTerminalRef?: string;
  editorOpen: boolean;
}) {
  const storeRef = queryContext.scopeRef;
  const storeWireRef = storeRef ? wireUuid(storeRef) : emptyUuid;
  const scopeReady = Boolean(storeRef);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const [areaQueryText, setAreaQueryText] = useState('');
  const [tagQueryText, setTagQueryText] = useState('');
  const terminalCursor = useCursorStack({resetKey: `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}`});
  const terminalRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreTerminals(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {query: {cursor: terminalCursor.cursor, pageSize: STORE_TERMINAL_PAGE_SIZE}},
      ),
    [queryContext.groupWorkspaceKey, storeWireRef, terminalCursor.cursor],
  );
  const terminalsQuery = operationsRtk.useGetOperationsStoreTerminalsQuery(terminalRequest, {
    skip: !gateReady || !scopeReady,
  });
  const terminals = terminalsQuery.currentData?.items ?? [];

  const selectedWireRef = selectedTerminalRef ? wireUuid(selectedTerminalRef) : emptyUuid;
  const detailRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreTerminal(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeWireRef,
          terminalRef: selectedWireRef,
        },
        {query: {}},
      ),
    [queryContext.groupWorkspaceKey, selectedWireRef, storeWireRef],
  );
  const detailQuery = operationsRtk.useGetOperationsStoreTerminalQuery(detailRequest, {
    skip: !gateReady || !scopeReady || !selectedTerminalRef,
  });

  const areaCandidates = useCursorCandidates<StoreTerminalAreaCandidate>({
    queryText: areaQueryText,
    resetKey: `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}:areas:${contentTabRefreshVersion}`,
    pageSize: 50,
    keyOf: item => String(item.areaRef),
  });
  const areaCandidateRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreTerminalAreaCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {
          query: {
            ...(areaCandidates.debouncedQueryText ? {query: areaCandidates.debouncedQueryText} : {}),
            ...(areaCandidates.cursor ? {cursor: areaCandidates.cursor} : {}),
            pageSize: areaCandidates.pageSize,
          },
        },
      ),
    [
      areaCandidates.cursor,
      areaCandidates.debouncedQueryText,
      areaCandidates.pageSize,
      queryContext.groupWorkspaceKey,
      storeWireRef,
    ],
  );
  const areaCandidatesQuery = operationsRtk.useGetOperationsStoreTerminalAreaCandidatesQuery(areaCandidateRequest, {
    skip: !editorOpen || !gateReady || !scopeReady,
  });
  useEffect(() => {
    const page = areaCandidatesQuery.currentData;
    if (page) areaCandidates.acceptPage(page.items, {nextCursor: page.nextCursor, total: page.total});
  }, [areaCandidates, areaCandidatesQuery.currentData]);

  const tagCandidates = useCursorCandidates<StoreTerminalTagCandidate>({
    queryText: tagQueryText,
    resetKey: `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}:tags:${contentTabRefreshVersion}`,
    pageSize: 50,
    keyOf: item => String(item.tagRef),
  });
  const tagCandidateRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreTerminalTagCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {
          query: {
            ...(tagCandidates.debouncedQueryText ? {query: tagCandidates.debouncedQueryText} : {}),
            ...(tagCandidates.cursor ? {cursor: tagCandidates.cursor} : {}),
            pageSize: tagCandidates.pageSize,
          },
        },
      ),
    [
      queryContext.groupWorkspaceKey,
      storeWireRef,
      tagCandidates.cursor,
      tagCandidates.debouncedQueryText,
      tagCandidates.pageSize,
    ],
  );
  const tagCandidatesQuery = operationsRtk.useGetOperationsStoreTerminalTagCandidatesQuery(tagCandidateRequest, {
    skip: !editorOpen || !gateReady || !scopeReady,
  });
  useEffect(() => {
    const page = tagCandidatesQuery.currentData;
    if (page) tagCandidates.acceptPage(page.items, {nextCursor: page.nextCursor, total: page.total});
  }, [tagCandidates, tagCandidatesQuery.currentData]);

  const refetchTerminals = terminalsQuery.refetch;
  const refetchDetail = detailQuery.refetch;
  const refetchAreaCandidates = areaCandidatesQuery.refetch;
  const refetchTagCandidates = tagCandidatesQuery.refetch;

  useEffect(() => {
    if (contentTabRefreshVersion === 0) return;
    void refetchTerminals();
    if (selectedTerminalRef) void refetchDetail();
    if (editorOpen) {
      void refetchAreaCandidates();
      void refetchTagCandidates();
    }
  }, [
    contentTabRefreshVersion,
    editorOpen,
    refetchAreaCandidates,
    refetchDetail,
    refetchTagCandidates,
    refetchTerminals,
    selectedTerminalRef,
  ]);

  const detail = detailQuery.currentData?.terminalRef === selectedWireRef ? detailQuery.currentData : undefined;

  return {
    storeWireRef,
    scopeReady,
    terminalCursor,
    terminals,
    terminalsQuery,
    detail,
    detailQuery,
    areaCandidates,
    areaCandidatesQuery,
    tagCandidates,
    tagCandidatesQuery,
    areaQueryText,
    setAreaQueryText,
    tagQueryText,
    setTagQueryText,
    refetchTerminals,
    refetchDetail,
  };
}

export type StoreTerminalReadModel = ReturnType<typeof useStoreTerminalReadModel>;
