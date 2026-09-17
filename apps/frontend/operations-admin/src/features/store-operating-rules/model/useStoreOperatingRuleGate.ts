import {useRefreshVersion} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo} from 'react';
import {operationsContentTabRefreshSignal, operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {
  storeOperatingRuleEffective,
  type StoreOperatingRuleValues,
} from '../../../app/api/generated/storeOperatingRuleCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';

export type StoreOperatingRuleGateState = 'BYPASSED' | 'SCOPE_MISSING' | 'LOADING' | 'FAILED' | 'DISABLED' | 'ENABLED';

type Options = {
  queryContext: OperationsPageProps['queryContext'];
  enabled?: boolean;
};

/**
 * Reads the current Store-target operating rule exactly once per host. The
 * selected Store id is part of the request path, not merely a cache key.
 */
export function useStoreOperatingRuleGate({queryContext, enabled = true}: Options) {
  const storeId = queryContext.scopeRef;
  const request = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationStoreOperatingRule(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeId: storeId ?? ''},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, storeId],
  );
  const query = operationsRtk.useGetOperationsOrganizationStoreOperatingRuleQuery(request, {
    skip: !enabled || !storeId,
  });
  const {refetch} = query;
  const retry = useCallback(() => refetch(), [refetch]);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  useEffect(() => {
    if (!enabled || !storeId || contentTabRefreshVersion === 0) return;
    void refetch();
  }, [contentTabRefreshVersion, enabled, refetch, storeId]);
  const state = useMemo<StoreOperatingRuleGateState>(() => {
    if (!enabled) return 'BYPASSED';
    if (!storeId) return 'SCOPE_MISSING';
    if (query.isFetching) return 'LOADING';
    if (query.error) return 'FAILED';
    if (!query.currentData) return 'LOADING';
    const values = query.currentData.operatingRuleSwitches;
    return values &&
      storeOperatingRuleEffective(values as StoreOperatingRuleValues, 'catalogManagementEnabled') === true
      ? 'ENABLED'
      : values
        ? 'DISABLED'
        : 'FAILED';
  }, [enabled, query.currentData, query.error, query.isFetching, storeId]);
  const values = query.currentData?.operatingRuleSwitches as StoreOperatingRuleValues | undefined;
  return {
    state,
    values,
    isEnabled: state === 'ENABLED',
    retry,
    query,
  };
}
