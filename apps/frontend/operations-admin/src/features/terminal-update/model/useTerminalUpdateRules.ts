import {useAsyncGenerationGuard} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useRef, useState} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {TerminalUpdateRulePage} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import type {TerminalUpdateRuleFilters} from './terminalUpdateRuleFilters';

type QueryContext = OperationsPageProps['queryContext'];

export function useTerminalUpdateRules({
  queryContext,
  projectRef,
  filters,
  cursor,
}: {
  queryContext: QueryContext;
  projectRef: NonNullable<QueryContext['scopeRef']>;
  filters: TerminalUpdateRuleFilters;
  cursor?: string;
}) {
  const contextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const queryIdentity = `${contextKey}:${JSON.stringify(filters)}:${cursor ?? ''}`;
  const currentQueryIdentity = useRef(queryIdentity);
  currentQueryIdentity.current = queryIdentity;
  const generation = useAsyncGenerationGuard();
  const [items, setItems] = useState<TerminalUpdateRulePage['items']>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string>();

  const load = useCallback(async () => {
    const identity = queryIdentity;
    const requestGeneration = generation.begin();
    setLoading(true);
    setProblem(undefined);
    try {
      const page = await operationsClient.getOperationsProjectTerminalUpdateRulePage(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef)},
        {
          query: {
            expectedContextVersion: queryContext.expectedContextVersion,
            ...filters,
            cursor,
            limit: 50,
          },
        },
      );
      if (!generation.isCurrent(requestGeneration) || currentQueryIdentity.current !== identity) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (generation.isCurrent(requestGeneration) && currentQueryIdentity.current === identity)
        setProblem(operationsProblemOf(error).detail || '读取更新规则失败');
    } finally {
      if (generation.isCurrent(requestGeneration) && currentQueryIdentity.current === identity)
        setLoading(false);
    }
  }, [cursor, filters, generation, projectRef, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryIdentity]);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    void load();
    return () => generation.invalidate();
  }, [generation, load]);

  return {items, nextCursor, loading, problem, load};
}
