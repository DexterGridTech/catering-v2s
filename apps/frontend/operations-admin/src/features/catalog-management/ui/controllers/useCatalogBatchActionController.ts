import {createContentIdempotencyKey} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useState, type Dispatch} from 'react';
import {catalogInventoryClient, operationsProblemOf} from '../../../../app/api/OperationsTransport';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../../app/api/generated/catalog-inventory-edge';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../../app/routing/model';
import {
  buildCatalogBatchSaveRequest,
  buildCatalogBatchStatusRequest,
  decodeCatalogBatchResults,
  type CatalogBatchResult,
  type CatalogBatchStatus,
  type CatalogBatchUpdateKind,
  type CatalogItemSummary,
} from '../../model/catalogModel';
import {catalogUiProblemFeedback} from '../../model/catalogUiProblemFeedback';
import type {
  CatalogBatchAction,
  CatalogWorkspaceTask,
  CatalogWorkspaceTaskAction,
} from '../../model/catalogWorkspaceTask';

type Input = {
  workspaceTask: CatalogWorkspaceTask;
  dispatchWorkspaceTask: Dispatch<CatalogWorkspaceTaskAction>;
  selectedRows: CatalogItemSummary[];
  queryContext: OperationsPageProps['queryContext'];
  headers?: Record<string, string>;
  refreshAfterBatch: () => Promise<void>;
  onCompleted: () => void;
};

export type CatalogBatchActionController = {
  action: CatalogBatchAction | undefined;
  status: CatalogBatchStatus;
  categoryRef?: string;
  tagRefs: string[];
  results: CatalogBatchResult[];
  problem?: string;
  refreshProblem?: string;
  submitting: boolean;
  open: (action: CatalogBatchAction) => void;
  close: () => void;
  execute: () => Promise<void>;
  setStatus: (status: CatalogBatchStatus) => void;
  setCategoryRef: (categoryRef?: string) => void;
  setTagRefs: (tagRefs: string[]) => void;
};

/** Keeps best-effort batch state and result reporting out of the workbench shell. */
export function useCatalogBatchActionController({
  workspaceTask,
  dispatchWorkspaceTask,
  selectedRows,
  queryContext,
  headers,
  refreshAfterBatch,
  onCompleted,
}: Input): CatalogBatchActionController {
  const action = workspaceTask.kind === 'BATCH' ? workspaceTask.action : undefined;
  const [status, setStatus] = useState<CatalogBatchStatus>('ENABLED');
  const [categoryRef, setCategoryRef] = useState<string>();
  const [tagRefs, setTagRefs] = useState<string[]>([]);
  const [results, setResults] = useState<CatalogBatchResult[]>([]);
  const [problem, setProblem] = useState<string>();
  const [refreshProblem, setRefreshProblem] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const clearFeedback = useCallback(() => {
    setResults([]);
    setProblem(undefined);
    setRefreshProblem(undefined);
  }, []);

  const open = useCallback(
    (nextAction: CatalogBatchAction) => {
      dispatchWorkspaceTask({
        type: 'OPEN_BATCH',
        action: nextAction,
        selectedItemCodes: selectedRows.map(row => row.code),
      });
      clearFeedback();
      if (nextAction === 'CATEGORY') setCategoryRef(undefined);
      if (nextAction === 'TAG') setTagRefs([]);
      if (nextAction === 'STATUS') setStatus('ENABLED');
    },
    [clearFeedback, dispatchWorkspaceTask, selectedRows],
  );

  const close = useCallback(() => {
    if (submitting) return;
    dispatchWorkspaceTask({type: 'CLOSE'});
    clearFeedback();
  }, [clearFeedback, dispatchWorkspaceTask, submitting]);

  const execute = useCallback(async () => {
    if (!action || selectedRows.length === 0) return;
    setSubmitting(true);
    setProblem(undefined);
    setRefreshProblem(undefined);
    const dataNodeRef = requireOperationsScopeRef(queryContext);
    try {
      if (action === 'STATUS') {
        const targetStatus: CatalogBatchStatus = status;
        const body = buildCatalogBatchStatusRequest(dataNodeRef, targetStatus, selectedRows);
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.batchTransitionOperationsCatalogItemStatus,
          body,
        );
        const response = await catalogInventoryClient.batchTransitionOperationsCatalogItemStatus(
          {},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        );
        setResults(
          decodeCatalogBatchResults(
            response,
            body.items.map(item => item.itemRef),
          ),
        );
      } else {
        const updateKind: CatalogBatchUpdateKind = action;
        const refs = (action === 'CATEGORY' ? [categoryRef].filter(Boolean) : tagRefs) as CatalogItemSummary['tagRefs'];
        const nextResults = await Promise.all(
          selectedRows.map(async (row): Promise<CatalogBatchResult> => {
            try {
              const body = buildCatalogBatchSaveRequest(row, dataNodeRef, updateKind, refs);
              const idempotencyKey = await createContentIdempotencyKey(
                CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
                body,
              );
              await catalogInventoryClient.saveOperationsCatalogItem(
                {itemCode: row.code},
                {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
              );
              return {
                itemRef: row.itemRef,
                itemCode: row.code,
                outcome: 'SUCCEEDED',
                problemCode: null,
                reason: null,
                version: null,
              };
            } catch (error) {
              const ownerProblem = operationsProblemOf(error);
              return {
                itemRef: row.itemRef,
                itemCode: row.code,
                outcome: 'FAILED',
                problemCode: ownerProblem.errorCode,
                reason: catalogUiProblemFeedback(error, '批量操作项执行失败。').message,
                version: null,
              };
            }
          }),
        );
        setResults(nextResults);
      }
      try {
        await refreshAfterBatch();
      } catch {
        setRefreshProblem('列表刷新失败，请手动刷新');
      }
      onCompleted();
    } catch (error) {
      setProblem(catalogUiProblemFeedback(error, '批量操作未完成，请检查当前选择后重试。').message);
    } finally {
      setSubmitting(false);
    }
  }, [action, categoryRef, headers, onCompleted, queryContext, refreshAfterBatch, selectedRows, status, tagRefs]);

  return {
    action,
    status,
    categoryRef,
    tagRefs,
    results,
    problem,
    refreshProblem,
    submitting,
    open,
    close,
    execute,
    setStatus,
    setCategoryRef,
    setTagRefs,
  };
}
