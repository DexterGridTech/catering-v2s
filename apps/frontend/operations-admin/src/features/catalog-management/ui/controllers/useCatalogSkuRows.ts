import {useCallback, useEffect, useMemo, useRef, useState, type Key} from 'react';
import {operationsRtk} from '../../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../../app/routing/model';
import {decodeSkuListPage} from '../../model/catalogModel';
import {catalogUiProblemFeedback} from '../../model/catalogUiProblemFeedback';
import {catalogSkuCacheKey, type CatalogSkuChildrenState, type CatalogTableRow} from '../CatalogItemListTable';

type Input = {
  queryContext: OperationsPageProps['queryContext'];
  headers?: Record<string, string>;
  brandRef?: string;
  queryGeneration: string;
  listGeneration: number;
  pageSize: number;
};

export type CatalogSkuRowsController = {
  childrenByItem: Record<string, CatalogSkuChildrenState>;
  cacheIdentity: string;
  expandedRows: Key[];
  clear: () => void;
  collapseAll: () => void;
  onExpand: (expanded: boolean, row: CatalogTableRow) => void;
  loadPage: (itemCode: string, cursor?: string | null) => Promise<void>;
};

/** Owns only the transient SKU child projection bound to the current list generation. */
export function useCatalogSkuRows({
  queryContext,
  headers,
  brandRef,
  queryGeneration,
  listGeneration,
  pageSize,
}: Input): CatalogSkuRowsController {
  const [childrenByItem, setChildrenByItem] = useState<Record<string, CatalogSkuChildrenState>>({});
  const [expandedRows, setExpandedRows] = useState<Key[]>([]);
  const [fetchSkuPage] = operationsRtk.useLazyGetOperationsCatalogItemSkusQuery();
  const cacheIdentity = useMemo(
    () =>
      JSON.stringify({
        scopeRef: queryContext.scopeRef ?? '',
        brandRef: brandRef ?? '',
        queryGeneration,
        listGeneration,
      }),
    [brandRef, listGeneration, queryContext.scopeRef, queryGeneration],
  );
  const currentIdentity = useRef(cacheIdentity);
  currentIdentity.current = cacheIdentity;
  const clear = useCallback(() => setChildrenByItem({}), []);
  const collapseAll = useCallback(() => setExpandedRows([]), []);
  const previousIdentity = useRef(cacheIdentity);
  useEffect(() => {
    if (previousIdentity.current === cacheIdentity) return;
    previousIdentity.current = cacheIdentity;
    clear();
    collapseAll();
  }, [cacheIdentity, clear, collapseAll]);

  const loadPage = useCallback(
    async (itemCode: string, cursor?: string | null) => {
      if (!queryContext.scopeRef) return;
      const requestIdentity = cacheIdentity;
      const cacheKey = catalogSkuCacheKey(requestIdentity, itemCode);
      setChildrenByItem(current => ({
        ...current,
        [cacheKey]: {
          rows: cursor ? (current[cacheKey]?.rows ?? []) : [],
          nextCursor: current[cacheKey]?.nextCursor ?? null,
          loading: true,
          loaded: current[cacheKey]?.loaded ?? false,
          error: undefined,
        },
      }));
      try {
        const response = await fetchSkuPage(
          catalogInventoryRtkRequest.getOperationsCatalogItemSkus(
            {itemCode},
            {
              query: {dataNodeRef: wireUuid(queryContext.scopeRef), pageSize, ...(cursor ? {cursor} : {})},
              headers,
            },
          ),
        ).unwrap();
        const nextPage = decodeSkuListPage(response);
        setChildrenByItem(current => {
          if (currentIdentity.current !== requestIdentity) return current;
          const previous = current[cacheKey];
          return {
            ...current,
            [cacheKey]: {
              rows: cursor ? [...(previous?.rows ?? []), ...nextPage.items] : nextPage.items,
              nextCursor: nextPage.nextCursor,
              loading: false,
              loaded: true,
              error: undefined,
            },
          };
        });
      } catch (error) {
        setChildrenByItem(current =>
          currentIdentity.current !== requestIdentity
            ? current
            : {
                ...current,
                [cacheKey]: {
                  rows: current[cacheKey]?.rows ?? [],
                  nextCursor: current[cacheKey]?.nextCursor ?? null,
                  loading: false,
                  loaded: current[cacheKey]?.loaded ?? false,
                  error: catalogUiProblemFeedback(error, '规格明细加载失败，请重试。').message,
                },
              },
        );
      }
    },
    [cacheIdentity, fetchSkuPage, headers, pageSize, queryContext.scopeRef],
  );

  const onExpand = useCallback(
    (expanded: boolean, row: CatalogTableRow) => {
      if (row.rowType !== 'ITEM') return;
      setExpandedRows(current =>
        expanded
          ? current.includes(row.rowKey)
            ? current
            : [...current, row.rowKey]
          : current.filter(key => key !== row.rowKey),
      );
      if (expanded) {
        const state = childrenByItem[catalogSkuCacheKey(cacheIdentity, row.item.code)];
        if (!state || (!state.loaded && !state.loading)) void loadPage(row.item.code);
      }
    },
    [cacheIdentity, childrenByItem, loadPage],
  );

  return {childrenByItem, cacheIdentity, expandedRows, clear, collapseAll, onExpand, loadPage};
}
