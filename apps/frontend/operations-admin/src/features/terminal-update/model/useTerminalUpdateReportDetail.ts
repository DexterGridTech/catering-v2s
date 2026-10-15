import {useAsyncGenerationGuard, useCursorStack} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useRef, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {TerminalUpdateReportHistoryPage, TerminalUpdateVersionDetail} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';

type QueryContext = OperationsPageProps['queryContext'];

export function useTerminalUpdateReportDetail({
  queryContext,
  projectRef,
}: {
  queryContext: QueryContext;
  projectRef: NonNullable<QueryContext['scopeRef']>;
}) {
  const contextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const currentContextKey = useRef(contextKey);
  currentContextKey.current = contextKey;
  const selectedTerminalRef = useRef<string | undefined>(undefined);
  const selectedDetailGeneration = useRef(0);
  const detailGeneration = useAsyncGenerationGuard();
  const historyPageGeneration = useAsyncGenerationGuard();
  const [terminalRef, setTerminalRef] = useState<string>();
  const [detail, setDetail] = useState<TerminalUpdateVersionDetail>();
  const [history, setHistory] = useState<TerminalUpdateReportHistoryPage['items']>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyLoadingRef = useRef(false);
  const [problem, setProblem] = useState<string>();
  const historyPager = useCursorStack({resetKey: `${contextKey}:${terminalRef ?? ''}`});
  const latestHistoryQueryIdentity = useRef('');

  const loadHistoryPage = useCallback(async (
    requestedTerminalRef: string,
    requestedDetailGeneration: number,
    requestedPage: number,
    suppliedCursor?: string,
  ) => {
    if (historyLoadingRef.current) return;
    const cursor = requestedPage < historyPager.page
      ? historyPager.cursorStack[requestedPage - 1]
      : suppliedCursor;
    if (requestedPage > 1 && !cursor) return;
    const requestContextKey = contextKey;
    const identity = `${requestContextKey}:${requestedTerminalRef}:${requestedPage}:${cursor ?? ''}`;
    latestHistoryQueryIdentity.current = identity;
    const requestGeneration = historyPageGeneration.begin();
    historyLoadingRef.current = true;
    setHistoryLoading(true);
    const isCurrent = () => detailGeneration.isCurrent(requestedDetailGeneration) &&
      historyPageGeneration.isCurrent(requestGeneration) &&
      currentContextKey.current === requestContextKey &&
      selectedTerminalRef.current === requestedTerminalRef &&
      latestHistoryQueryIdentity.current === identity;
    try {
      const page = await operationsClient.getOperationsProjectTerminalUpdateReportHistoryPage(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef), terminalRef: wireUuid(requestedTerminalRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, cursor, limit: 20}},
      );
      if (!isCurrent()) return;
      setHistory(page.items);
      setHistoryCursor(page.nextCursor);
      historyPager.goToPage(requestedPage, cursor);
    } catch (error) {
      if (isCurrent()) setProblem(operationsProblemOf(error).detail || '读取终端报告历史失败');
    } finally {
      if (isCurrent()) {
        historyLoadingRef.current = false;
        setHistoryLoading(false);
      }
    }
  }, [contextKey, detailGeneration, historyPageGeneration, historyPager, projectRef, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);

  const open = useCallback(async (requestedTerminalRef: string) => {
    selectedTerminalRef.current = requestedTerminalRef;
    setTerminalRef(requestedTerminalRef);
    const requestContextKey = contextKey;
    const requestGeneration = detailGeneration.begin();
    selectedDetailGeneration.current = requestGeneration;
    historyPageGeneration.invalidate();
    historyLoadingRef.current = false;
    setHistoryLoading(false);
    latestHistoryQueryIdentity.current = '';
    historyPager.reset();
    setDetail(undefined);
    setHistory([]);
    setHistoryCursor(null);
    setProblem(undefined);
    setDetailLoading(true);
    const isCurrent = () => detailGeneration.isCurrent(requestGeneration) &&
      currentContextKey.current === requestContextKey && selectedTerminalRef.current === requestedTerminalRef;
    try {
      const loaded = await operationsClient.getOperationsProjectTerminalVersionDetail(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef), terminalRef: wireUuid(requestedTerminalRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      );
      if (!isCurrent()) return undefined;
      setDetail(loaded);
      await loadHistoryPage(requestedTerminalRef, requestGeneration, 1);
      if (!isCurrent()) return undefined;
      return loaded;
    } catch (error) {
      if (isCurrent()) setProblem(operationsProblemOf(error).detail || '读取终端报告详情失败');
      return undefined;
    } finally {
      if (isCurrent()) setDetailLoading(false);
    }
  }, [contextKey, detailGeneration, historyPageGeneration, historyPager, loadHistoryPage, projectRef, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);

  const close = useCallback(() => {
    detailGeneration.invalidate();
    historyPageGeneration.invalidate();
    selectedDetailGeneration.current = 0;
    selectedTerminalRef.current = undefined;
    latestHistoryQueryIdentity.current = '';
    historyLoadingRef.current = false;
    setTerminalRef(undefined);
    setDetail(undefined);
    setHistory([]);
    setHistoryCursor(null);
    setDetailLoading(false);
    setHistoryLoading(false);
    setProblem(undefined);
    historyPager.reset();
  }, [detailGeneration, historyPageGeneration, historyPager]);

  const previousContextKey = useRef(contextKey);
  useEffect(() => {
    if (previousContextKey.current === contextKey) return;
    previousContextKey.current = contextKey;
    close();
  }, [close, contextKey]);

  const goToPage = useCallback((page: number, nextCursor?: string) => {
    const currentTerminalRef = selectedTerminalRef.current;
    const requestGeneration = selectedDetailGeneration.current;
    if (currentTerminalRef && requestGeneration) void loadHistoryPage(currentTerminalRef, requestGeneration, page, nextCursor);
  }, [loadHistoryPage]);

  return {
    terminalRef,
    detail,
    history,
    historyCursor,
    detailLoading,
    historyLoading,
    problem,
    open,
    close,
    refresh: () => terminalRef ? open(terminalRef) : Promise.resolve(undefined),
    pagination: {
      page: historyPager.page,
      canPrevious: historyPager.canPrevious && !historyLoading,
      goToPage,
    },
  };
}
