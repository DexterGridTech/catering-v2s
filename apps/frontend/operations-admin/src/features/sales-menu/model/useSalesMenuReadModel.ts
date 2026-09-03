import {useCursorStack, useRefreshVersion} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {operationsContentTabRefreshSignal, operationsLogger, operationsRtk} from '../../../app/api/OperationsTransport';
import type {
  BusinessChannelPage,
  SalesMenuCandidatePage,
  SalesMenuDetail,
  SalesMenuItemPage,
  SalesMenuOperationRecordPage,
  SalesMenuPage,
  SalesMenuPublicationPreview,
  SalesMenuPublishedItemPage,
  SalesMenuPublishedSectionList,
  SalesMenuSectionList,
  Uuid,
} from '../../../app/api/generated/operations-edge';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';
import {SALES_MENU_PAGE_SIZE, salesMenuQueryIdentity, type SalesMenuMode} from './salesMenuModel';

type SalesMenuPageProps = Pick<OperationsPageProps, 'queryContext'>;

const emptyUuid = '' as Uuid;

function queryRefetchFailed(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'error' in value && (value as {error?: unknown}).error);
}

export function useSalesMenuReadModel({queryContext}: SalesMenuPageProps) {
  const storeRef = queryContext.scopeRef;
  const scopeReady = Boolean(storeRef);
  const [mode, setMode] = useState<SalesMenuMode>('DRAFT');
  const [selectedChannelRef, setSelectedChannelRef] = useState<Uuid>();
  const [selectedMenuRef, setSelectedMenuRef] = useState<Uuid>();
  const [selectedSectionRef, setSelectedSectionRef] = useState<Uuid>();
  const [selectorQuery, setSelectorQuery] = useState('');
  const [managerQuery, setManagerQuery] = useState('');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidateCategoryRef, setCandidateCategoryRef] = useState<Uuid>();
  const [candidateOpen, setCandidateOpen] = useState(false);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const channelSelectionScope = `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}`;
  const previousChannelSelectionScope = useRef<string | undefined>(undefined);

  const channelCursor = useCursorStack({resetKey: salesMenuQueryIdentity({scopeRef: storeRef, collection: 'CHANNEL'})});
  const selectorCursor = useCursorStack({
    resetKey: salesMenuQueryIdentity({
      scopeRef: storeRef,
      channelRef: selectedChannelRef,
      query: selectorQuery,
      collection: 'SELECTOR',
    }),
  });
  const managerCursor = useCursorStack({
    resetKey: salesMenuQueryIdentity({
      scopeRef: storeRef,
      channelRef: selectedChannelRef,
      query: managerQuery,
      collection: 'MANAGER',
    }),
  });
  const candidateCursor = useCursorStack({
    resetKey: salesMenuQueryIdentity({
      scopeRef: storeRef,
      channelRef: selectedChannelRef,
      menuRef: selectedMenuRef,
      query: candidateQuery,
      categoryRef: candidateCategoryRef,
      collection: 'CANDIDATE',
    }),
  });
  const draftCursor = useCursorStack({
    resetKey: salesMenuQueryIdentity({
      scopeRef: storeRef,
      channelRef: selectedChannelRef,
      menuRef: selectedMenuRef,
      sectionRef: selectedSectionRef,
      mode: 'DRAFT',
      collection: 'DRAFT',
    }),
  });
  const publishedCursor = useCursorStack({
    resetKey: salesMenuQueryIdentity({
      scopeRef: storeRef,
      channelRef: selectedChannelRef,
      menuRef: selectedMenuRef,
      sectionRef: selectedSectionRef,
      mode: 'PUBLISHED',
      publication: 'LATEST_PUBLISHED',
      collection: 'PUBLISHED',
    }),
  });
  const logCursor = useCursorStack({
    resetKey: salesMenuQueryIdentity({
      scopeRef: storeRef,
      channelRef: selectedChannelRef,
      menuRef: selectedMenuRef,
      mode: 'OPERATIONS',
      collection: 'LOG',
    }),
  });

  const channelRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreBusinessChannels(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeRef ?? emptyUuid},
        {
          query: {
            usage: 'SALES_MENU',
            ...(channelCursor.cursor ? {cursor: channelCursor.cursor} : {}),
            pageSize: SALES_MENU_PAGE_SIZE,
          },
        },
      ),
    [channelCursor.cursor, queryContext.groupWorkspaceKey, storeRef],
  );
  const channelsQuery = operationsRtk.useGetOperationsStoreBusinessChannelsQuery(channelRequest, {
    skip: !scopeReady,
  });

  const selectorRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenus(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
        },
        {
          query: {
            channelRef: selectedChannelRef ?? emptyUuid,
            ...(selectorQuery.trim() ? {query: selectorQuery.trim()} : {}),
            ...(selectorCursor.cursor ? {cursor: selectorCursor.cursor} : {}),
            pageSize: SALES_MENU_PAGE_SIZE,
          },
        },
      ),
    [queryContext.groupWorkspaceKey, selectedChannelRef, selectorCursor.cursor, selectorQuery, storeRef],
  );
  const selectorQueryState = operationsRtk.useGetOperationsSalesMenusQuery(selectorRequest, {
    skip: !scopeReady || !selectedChannelRef,
  });

  const managerRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenus(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
        },
        {
          query: {
            channelRef: selectedChannelRef ?? emptyUuid,
            ...(managerQuery.trim() ? {query: managerQuery.trim()} : {}),
            ...(managerCursor.cursor ? {cursor: managerCursor.cursor} : {}),
            pageSize: SALES_MENU_PAGE_SIZE,
          },
        },
      ),
    [managerCursor.cursor, managerQuery, queryContext.groupWorkspaceKey, selectedChannelRef, storeRef],
  );
  const managerQueryState = operationsRtk.useGetOperationsSalesMenusQuery(managerRequest, {
    skip: !scopeReady || !selectedChannelRef,
  });

  const menuRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenu(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
        },
        {query: {channelRef: selectedChannelRef ?? emptyUuid}},
      ),
    [queryContext.groupWorkspaceKey, selectedChannelRef, selectedMenuRef, storeRef],
  );
  const menuQuery = operationsRtk.useGetOperationsSalesMenuQuery(menuRequest, {
    skip: !scopeReady || !selectedChannelRef || !selectedMenuRef,
  });

  const sectionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuDraftSections(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
        },
        {},
      ),
    [queryContext.groupWorkspaceKey, selectedMenuRef, storeRef],
  );
  const draftSectionsQuery = operationsRtk.useGetOperationsSalesMenuDraftSectionsQuery(sectionRequest, {
    skip: !scopeReady || !selectedMenuRef || mode !== 'DRAFT',
  });

  const publishedSectionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuPublishedSections(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
        },
        {},
      ),
    [queryContext.groupWorkspaceKey, selectedMenuRef, storeRef],
  );
  const publishedSectionsQuery = operationsRtk.useGetOperationsSalesMenuPublishedSectionsQuery(
    publishedSectionRequest,
    {skip: !scopeReady || !selectedMenuRef || mode !== 'PUBLISHED'},
  );

  const draftItemRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuDraftItems(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
          salesSectionRef: selectedSectionRef ?? emptyUuid,
        },
        {
          query: {
            ...(draftCursor.cursor ? {cursor: draftCursor.cursor} : {}),
            pageSize: SALES_MENU_PAGE_SIZE,
          },
        },
      ),
    [draftCursor.cursor, queryContext.groupWorkspaceKey, selectedMenuRef, selectedSectionRef, storeRef],
  );
  const draftItemsQuery = operationsRtk.useGetOperationsSalesMenuDraftItemsQuery(draftItemRequest, {
    skip: !scopeReady || !selectedMenuRef || !selectedSectionRef || mode !== 'DRAFT',
  });

  const publishedItemRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuPublishedItems(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
          salesSectionRef: selectedSectionRef ?? emptyUuid,
        },
        {
          query: {
            channelRef: selectedChannelRef ?? emptyUuid,
            ...(publishedCursor.cursor ? {cursor: publishedCursor.cursor} : {}),
            pageSize: SALES_MENU_PAGE_SIZE,
          },
        },
      ),
    [
      publishedCursor.cursor,
      queryContext.groupWorkspaceKey,
      selectedChannelRef,
      selectedMenuRef,
      selectedSectionRef,
      storeRef,
    ],
  );
  const publishedItemsQuery = operationsRtk.useGetOperationsSalesMenuPublishedItemsQuery(publishedItemRequest, {
    skip: !scopeReady || !selectedChannelRef || !selectedMenuRef || !selectedSectionRef || mode !== 'PUBLISHED',
  });

  const operationRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuOperationRecords(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
        },
        {
          query: {
            channelRef: selectedChannelRef ?? emptyUuid,
            ...(logCursor.cursor ? {cursor: logCursor.cursor} : {}),
            pageSize: SALES_MENU_PAGE_SIZE,
          },
        },
      ),
    [logCursor.cursor, queryContext.groupWorkspaceKey, selectedChannelRef, selectedMenuRef, storeRef],
  );
  const operationQuery = operationsRtk.useGetOperationsSalesMenuOperationRecordsQuery(operationRequest, {
    skip: !scopeReady || !selectedChannelRef || !selectedMenuRef || mode !== 'OPERATIONS',
  });

  const publicationPreviewRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuPublicationPreview(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
        },
        {query: {channelRef: selectedChannelRef ?? emptyUuid}},
      ),
    [queryContext.groupWorkspaceKey, selectedChannelRef, selectedMenuRef, storeRef],
  );
  const publicationPreviewQuery = operationsRtk.useGetOperationsSalesMenuPublicationPreviewQuery(
    publicationPreviewRequest,
    {skip: !scopeReady || !selectedChannelRef || !selectedMenuRef},
  );

  const candidateRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsSalesMenuItemCandidates(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeRef ?? emptyUuid,
          salesMenuRef: selectedMenuRef ?? emptyUuid,
        },
        {
          query: {
            ...(candidateCategoryRef ? {categoryRef: candidateCategoryRef} : {}),
            ...(candidateQuery.trim() ? {query: candidateQuery.trim()} : {}),
            ...(candidateCursor.cursor ? {cursor: candidateCursor.cursor} : {}),
            pageSize: SALES_MENU_PAGE_SIZE,
          },
        },
      ),
    [
      candidateCategoryRef,
      candidateCursor.cursor,
      candidateQuery,
      queryContext.groupWorkspaceKey,
      selectedMenuRef,
      storeRef,
    ],
  );
  const candidateQueryState = operationsRtk.useGetOperationsSalesMenuItemCandidatesQuery(candidateRequest, {
    skip: !scopeReady || !selectedMenuRef || !candidateOpen,
  });

  const refetchChannels = channelsQuery.refetch;
  const refetchSelector = selectorQueryState.refetch;
  const refetchManager = managerQueryState.refetch;
  const refetchMenu = menuQuery.refetch;
  const refetchDraftSections = draftSectionsQuery.refetch;
  const refetchPublishedSections = publishedSectionsQuery.refetch;
  const refetchDraftItems = draftItemsQuery.refetch;
  const refetchPublishedItems = publishedItemsQuery.refetch;
  const refetchOperationRecords = operationQuery.refetch;
  const refetchCandidates = candidateQueryState.refetch;
  const refetchPublicationPreview = publicationPreviewQuery.refetch;

  useEffect(() => {
    if (previousChannelSelectionScope.current === channelSelectionScope) return;
    previousChannelSelectionScope.current = channelSelectionScope;
    setSelectedChannelRef(undefined);
    setSelectedMenuRef(undefined);
    setSelectedSectionRef(undefined);
  }, [channelSelectionScope]);

  useEffect(() => {
    if (!scopeReady) return;
    // The SALES_MENU owner query already returns only maintainable STORE/INTERNAL/DINE_IN/TAKEAWAY channels.
    // Keep the selected ref while the user pages through that owner-issued collection.
    setSelectedChannelRef(current => current ?? channelsQuery.currentData?.items[0]?.channelRef);
  }, [channelsQuery.currentData, scopeReady]);

  useEffect(() => {
    if (!selectedChannelRef || selectedMenuRef || !selectorQueryState.currentData) return;
    setSelectedMenuRef(selectorQueryState.currentData.items[0]?.salesMenuRef);
  }, [selectedChannelRef, selectedMenuRef, selectorQueryState.currentData]);

  useEffect(() => {
    if (!selectedMenuRef) {
      setSelectedSectionRef(undefined);
      return;
    }
    const sections =
      mode === 'PUBLISHED' ? publishedSectionsQuery.currentData?.items : draftSectionsQuery.currentData?.items;
    if (!sections) return;
    setSelectedSectionRef(current => {
      if (current && sections.some(section => section.salesSectionRef === current)) return current;
      return sections[0]?.salesSectionRef;
    });
  }, [draftSectionsQuery.currentData, mode, publishedSectionsQuery.currentData, selectedMenuRef]);

  const selectChannel = useCallback((next: Uuid) => {
    operationsLogger.info({
      event: 'sales-menu.read-model.selection',
      phase: 'SELECTION',
      outcome: 'CHANNEL_SELECTED',
      operationId: 'sales-menu-read-model',
    });
    setSelectedChannelRef(next);
    setSelectedMenuRef(undefined);
    setSelectedSectionRef(undefined);
    setCandidateOpen(false);
  }, []);
  const selectMenu = useCallback((next: Uuid | undefined) => {
    operationsLogger.info({
      event: 'sales-menu.read-model.selection',
      phase: 'SELECTION',
      outcome: next ? 'MENU_SELECTED' : 'MENU_CLEARED',
      operationId: 'sales-menu-read-model',
    });
    setSelectedMenuRef(next);
    setSelectedSectionRef(undefined);
    setCandidateOpen(false);
  }, []);
  const changeMode = useCallback((next: SalesMenuMode) => {
    operationsLogger.info({
      event: 'sales-menu.read-model.mode',
      phase: 'MODE_CHANGE',
      outcome: next,
      operationId: 'sales-menu-read-model',
    });
    setMode(next);
    setSelectedSectionRef(undefined);
    setCandidateOpen(false);
  }, []);
  const openCandidates = useCallback(() => {
    operationsLogger.info({
      event: 'sales-menu.candidates.drawer',
      phase: 'CANDIDATE_DRAWER',
      outcome: 'OPEN_REQUESTED',
      operationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsSalesMenuItemCandidates,
    });
    setCandidateOpen(true);
    setCandidateCategoryRef(undefined);
    setCandidateQuery('');
    candidateCursor.reset();
  }, [candidateCursor]);
  const closeCandidates = useCallback(() => setCandidateOpen(false), []);

  useEffect(() => {
    if (contentTabRefreshVersion === 0) return;
    void refetchChannels();
    if (selectedChannelRef) {
      void refetchSelector();
      void refetchManager();
    }
    if (selectedMenuRef) {
      void refetchMenu();
      void refetchPublicationPreview();
      if (mode === 'DRAFT') void refetchDraftSections();
      if (mode === 'PUBLISHED') void refetchPublishedSections();
      if (mode === 'OPERATIONS') void refetchOperationRecords();
    }
    if (selectedSectionRef && mode === 'DRAFT') void refetchDraftItems();
    if (selectedSectionRef && mode === 'PUBLISHED') void refetchPublishedItems();
    if (candidateOpen) void refetchCandidates();
  }, [
    contentTabRefreshVersion,
    mode,
    candidateOpen,
    refetchCandidates,
    refetchChannels,
    refetchDraftItems,
    refetchDraftSections,
    refetchManager,
    refetchMenu,
    refetchOperationRecords,
    refetchPublicationPreview,
    refetchPublishedItems,
    refetchPublishedSections,
    refetchSelector,
    selectedChannelRef,
    selectedMenuRef,
    selectedSectionRef,
  ]);

  const refresh = useCallback(async () => {
    if (!scopeReady) {
      operationsLogger.debug({
        event: 'sales-menu.read-model.refresh',
        phase: 'READ_MODEL_REFRESH',
        outcome: 'SKIPPED_SCOPE_NOT_READY',
        operationId: 'sales-menu-read-model',
      });
      return;
    }

    const startedAt = performance.now();
    operationsLogger.info({
      event: 'sales-menu.read-model.refresh',
      phase: 'READ_MODEL_REFRESH',
      outcome: 'STARTED',
      operationId: 'sales-menu-read-model',
    });
    try {
      const refetches: Array<Promise<unknown>> = [refetchChannels()];
      if (selectedChannelRef) {
        refetches.push(refetchSelector(), refetchManager());
      }
      if (selectedMenuRef) {
        refetches.push(refetchMenu(), refetchPublicationPreview());
        if (mode === 'DRAFT') refetches.push(refetchDraftSections());
        if (mode === 'PUBLISHED') refetches.push(refetchPublishedSections());
        if (mode === 'OPERATIONS') refetches.push(refetchOperationRecords());
      }
      if (selectedSectionRef && mode === 'DRAFT') refetches.push(refetchDraftItems());
      if (selectedSectionRef && mode === 'PUBLISHED') refetches.push(refetchPublishedItems());
      if (candidateOpen) refetches.push(refetchCandidates());

      const results = await Promise.all(refetches);
      if (results.some(queryRefetchFailed)) throw new Error('SALES_MENU_REFRESH_FAILED');
      operationsLogger.info({
        event: 'sales-menu.read-model.refresh',
        phase: 'READ_MODEL_REFRESH',
        outcome: 'SUCCEEDED',
        operationId: 'sales-menu-read-model',
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      operationsLogger.error({
        event: 'sales-menu.read-model.refresh',
        phase: 'READ_MODEL_REFRESH',
        outcome: 'FAILED',
        operationId: 'sales-menu-read-model',
        errorCode: error instanceof Error ? error.message : 'SALES_MENU_REFRESH_FAILED',
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  }, [
    candidateOpen,
    mode,
    refetchCandidates,
    refetchChannels,
    refetchDraftItems,
    refetchDraftSections,
    refetchManager,
    refetchMenu,
    refetchOperationRecords,
    refetchPublicationPreview,
    refetchPublishedItems,
    refetchPublishedSections,
    refetchSelector,
    scopeReady,
    selectedChannelRef,
    selectedMenuRef,
    selectedSectionRef,
  ]);

  return {
    scopeReady,
    storeRef,
    mode,
    setMode: changeMode,
    selectedChannelRef,
    selectChannel,
    selectedMenuRef,
    selectedMenu: menuQuery.currentData as SalesMenuDetail | undefined,
    selectMenu,
    selectedSectionRef,
    setSelectedSectionRef,
    selectorQuery,
    setSelectorQuery,
    managerQuery,
    setManagerQuery,
    candidateQuery,
    setCandidateQuery,
    candidateCategoryRef,
    setCandidateCategoryRef,
    candidateOpen,
    openCandidates,
    closeCandidates,
    channels: {
      query: channelsQuery,
      page: channelsQuery.currentData as BusinessChannelPage | undefined,
      cursor: channelCursor,
    },
    selector: {
      query: selectorQueryState,
      page: selectorQueryState.currentData as SalesMenuPage | undefined,
      cursor: selectorCursor,
    },
    manager: {
      query: managerQueryState,
      page: managerQueryState.currentData as SalesMenuPage | undefined,
      cursor: managerCursor,
    },
    draftSections: {
      query: draftSectionsQuery,
      page: draftSectionsQuery.currentData as SalesMenuSectionList | undefined,
    },
    publishedSections: {
      query: publishedSectionsQuery,
      page: publishedSectionsQuery.currentData as SalesMenuPublishedSectionList | undefined,
    },
    draftItems: {
      query: draftItemsQuery,
      page: draftItemsQuery.currentData as SalesMenuItemPage | undefined,
      cursor: draftCursor,
    },
    publishedItems: {
      query: publishedItemsQuery,
      page: publishedItemsQuery.currentData as SalesMenuPublishedItemPage | undefined,
      cursor: publishedCursor,
    },
    operationRecords: {
      query: operationQuery,
      page: operationQuery.currentData as SalesMenuOperationRecordPage | undefined,
      cursor: logCursor,
    },
    publicationPreview: {
      query: publicationPreviewQuery,
      page: publicationPreviewQuery.currentData as SalesMenuPublicationPreview | undefined,
    },
    candidates: {
      query: candidateQueryState,
      page: candidateQueryState.currentData as SalesMenuCandidatePage | undefined,
      cursor: candidateCursor,
    },
    refresh,
  };
}
