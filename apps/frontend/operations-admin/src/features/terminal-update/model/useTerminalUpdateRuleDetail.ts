import {useAsyncGenerationGuard, useCursorStack} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useRef, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {TerminalUpdateRuleDetail, TerminalUpdateRuleStorePage} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';

type QueryContext = OperationsPageProps['queryContext'];

export function useTerminalUpdateRuleDetail({
  queryContext,
  projectRef,
}: {
  queryContext: QueryContext;
  projectRef: NonNullable<QueryContext['scopeRef']>;
}) {
  const contextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const currentContextKey = useRef(contextKey);
  currentContextKey.current = contextKey;
  const selectedRuleRef = useRef<string | undefined>(undefined);
  const selectedDetailGeneration = useRef(0);
  const detailGeneration = useAsyncGenerationGuard();
  const storePageGeneration = useAsyncGenerationGuard();
  const [ruleRef, setRuleRef] = useState<string>();
  const [detail, setDetail] = useState<TerminalUpdateRuleDetail>();
  const [stores, setStores] = useState<TerminalUpdateRuleStorePage['items']>([]);
  const [storesCursor, setStoresCursor] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const storesLoadingRef = useRef(false);
  const [problem, setProblem] = useState<string>();
  const storesPager = useCursorStack({resetKey: `${contextKey}:${ruleRef ?? ''}`});
  const latestStoreQueryIdentity = useRef('');

  const loadStoresPage = useCallback(async (
    requestedRuleRef: string,
    requestedDetailGeneration: number,
    requestedPage: number,
    suppliedCursor?: string,
  ) => {
    if (storesLoadingRef.current) return;
    const cursor = requestedPage < storesPager.page
      ? storesPager.cursorStack[requestedPage - 1]
      : suppliedCursor;
    if (requestedPage > 1 && !cursor) return;
    const requestContextKey = contextKey;
    const identity = `${requestContextKey}:${requestedRuleRef}:${requestedPage}:${cursor ?? ''}`;
    latestStoreQueryIdentity.current = identity;
    const requestGeneration = storePageGeneration.begin();
    storesLoadingRef.current = true;
    setStoresLoading(true);
    const isCurrent = () => detailGeneration.isCurrent(requestedDetailGeneration) &&
      storePageGeneration.isCurrent(requestGeneration) &&
      currentContextKey.current === requestContextKey &&
      selectedRuleRef.current === requestedRuleRef &&
      latestStoreQueryIdentity.current === identity;
    try {
      const page = await operationsClient.getOperationsProjectTerminalUpdateRuleStorePage(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef), ruleRef: wireUuid(requestedRuleRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, cursor, limit: 50}},
      );
      if (!isCurrent()) return;
      setStores(page.items);
      setStoresCursor(page.nextCursor);
      storesPager.goToPage(requestedPage, cursor);
    } catch (error) {
      if (isCurrent()) setProblem(operationsProblemOf(error).detail || '读取规则门店失败');
    } finally {
      if (isCurrent()) {
        storesLoadingRef.current = false;
        setStoresLoading(false);
      }
    }
  }, [contextKey, detailGeneration, projectRef, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, storePageGeneration, storesPager]);

  const open = useCallback(async (requestedRuleRef: string) => {
    selectedRuleRef.current = requestedRuleRef;
    setRuleRef(requestedRuleRef);
    const requestContextKey = contextKey;
    const requestGeneration = detailGeneration.begin();
    selectedDetailGeneration.current = requestGeneration;
    storePageGeneration.invalidate();
    storesLoadingRef.current = false;
    setStoresLoading(false);
    latestStoreQueryIdentity.current = '';
    storesPager.reset();
    setDetail(undefined);
    setStores([]);
    setStoresCursor(null);
    setProblem(undefined);
    setDetailLoading(true);
    const isCurrent = () => detailGeneration.isCurrent(requestGeneration) &&
      currentContextKey.current === requestContextKey && selectedRuleRef.current === requestedRuleRef;
    try {
      const loaded = await operationsClient.getOperationsProjectTerminalUpdateRuleDetail(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef), ruleRef: wireUuid(requestedRuleRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      );
      if (!isCurrent()) return undefined;
      setDetail(loaded);
      if (loaded.targetMode === 'STORE_REFS') {
        await loadStoresPage(requestedRuleRef, requestGeneration, 1);
        if (!isCurrent()) return undefined;
      }
      return loaded;
    } catch (error) {
      if (isCurrent()) setProblem(operationsProblemOf(error).detail || '读取规则详情失败');
      return undefined;
    } finally {
      if (isCurrent()) setDetailLoading(false);
    }
  }, [contextKey, detailGeneration, loadStoresPage, projectRef, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, storePageGeneration, storesPager]);

  const close = useCallback(() => {
    detailGeneration.invalidate();
    storePageGeneration.invalidate();
    selectedDetailGeneration.current = 0;
    selectedRuleRef.current = undefined;
    latestStoreQueryIdentity.current = '';
    storesLoadingRef.current = false;
    setRuleRef(undefined);
    setDetail(undefined);
    setStores([]);
    setStoresCursor(null);
    setDetailLoading(false);
    setStoresLoading(false);
    setProblem(undefined);
    storesPager.reset();
  }, [detailGeneration, storePageGeneration, storesPager]);

  const previousContextKey = useRef(contextKey);
  useEffect(() => {
    if (previousContextKey.current === contextKey) return;
    previousContextKey.current = contextKey;
    close();
  }, [close, contextKey]);

  const goToPage = useCallback((page: number, nextCursor?: string) => {
    const currentRuleRef = selectedRuleRef.current;
    const requestGeneration = selectedDetailGeneration.current;
    if (currentRuleRef && requestGeneration) void loadStoresPage(currentRuleRef, requestGeneration, page, nextCursor);
  }, [loadStoresPage]);

  return {
    ruleRef,
    detail,
    stores,
    storesCursor,
    detailLoading,
    storesLoading,
    problem,
    open,
    close,
    refresh: () => ruleRef ? open(ruleRef) : Promise.resolve(undefined),
    pagination: {
      page: storesPager.page,
      canPrevious: storesPager.canPrevious && !storesLoading,
      goToPage,
    },
  };
}
