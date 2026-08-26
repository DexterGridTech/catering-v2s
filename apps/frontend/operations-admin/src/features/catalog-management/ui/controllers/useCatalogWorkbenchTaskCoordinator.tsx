import {useCallback, useReducer, useRef, useState} from 'react';
import {catalogItemRowTestId} from '../../catalogTestIds';
import type {CatalogItemSummary, CatalogNavigation} from '../../model/catalogModel';
import {
  catalogWorkspaceTaskItemCode,
  catalogWorkspaceTaskReducer,
  initialCatalogWorkspaceTask,
} from '../../model/catalogWorkspaceTask';
import type {CatalogCategoryAction} from '../../model/catalogWorkspaceTask';
import type {OperationsPageProps} from '../../../../app/routing/model';
import {useCatalogBatchActionController} from './useCatalogBatchActionController';
import {useCatalogCategoryActionController} from './useCatalogCategoryActionController';

type Args = {
  queryContext: OperationsPageProps['queryContext'];
  surface: 'store' | 'brand';
  brandRef?: string;
  headers?: Record<string, string>;
  scopeReady: boolean;
  navigation?: CatalogNavigation;
  selectedItemRows: CatalogItemSummary[];
  refreshAfterBatch: () => Promise<void>;
  clearSelectedRows: () => void;
};

/**
 * The sole home for first-level task state and task transitions. It composes
 * category and batch command controllers but never owns server read-models or
 * editor drafts.
 */
export function useCatalogWorkbenchTaskCoordinator({
  queryContext,
  surface,
  brandRef,
  headers,
  scopeReady,
  navigation,
  selectedItemRows,
  refreshAfterBatch,
  clearSelectedRows,
}: Args) {
  const [workspaceTask, dispatchWorkspaceTask] = useReducer(catalogWorkspaceTaskReducer, initialCatalogWorkspaceTask);
  const [rebuildPrefill, setRebuildPrefill] = useState<{code?: string; name?: string; shapeKey?: string}>();
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const categoryController = useCatalogCategoryActionController({
    workspaceTask,
    dispatchWorkspaceTask,
    queryContext,
    headers,
    scopeReady,
    brandRef,
    navigation,
  });
  const batchController = useCatalogBatchActionController({
    workspaceTask,
    dispatchWorkspaceTask,
    selectedRows: selectedItemRows,
    queryContext,
    headers,
    refreshAfterBatch,
    onCompleted: clearSelectedRows,
  });
  const openDetail = useCallback((itemCode: string, trigger: HTMLElement, initialViewTab?: string) => {
    detailTriggerRef.current = trigger;
    dispatchWorkspaceTask({
      type: 'OPEN_VIEW',
      itemCode,
      triggerTestId: trigger.getAttribute('data-testid') ?? catalogItemRowTestId(itemCode),
      focus: initialViewTab,
    });
  }, []);
  const openDetailEdit = useCallback(() => {
    if (workspaceTask.kind !== 'VIEW') return;
    const {itemCode, triggerTestId} = workspaceTask;
    dispatchWorkspaceTask({type: 'CLOSE'});
    dispatchWorkspaceTask({type: 'OPEN_EDIT', itemCode, triggerTestId});
  }, [workspaceTask]);
  const openLocalCopy = useCallback((source: {itemCode: string; targetShapeKey?: string}) => {
    dispatchWorkspaceTask({type: 'CLOSE'});
    dispatchWorkspaceTask({
      type: 'OPEN_COPY',
      flow: 'LOCAL_SETTINGS',
      targetItemCode: source.itemCode,
      targetShapeKey: source.targetShapeKey,
    });
  }, []);
  const closeDetail = useCallback((restoreFocus = true) => {
    dispatchWorkspaceTask({type: 'CLOSE'});
    if (restoreFocus) window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }, []);
  const openCategory = useCallback((action: CatalogCategoryAction, node?: CatalogNavigation['tree'][number]) => {
    if (node) {
      dispatchWorkspaceTask({
        type: 'OPEN_CATEGORY',
        action,
        categoryRef: node.categoryRef,
        node,
      });
      return;
    }
    dispatchWorkspaceTask({type: 'OPEN_CATEGORY', action});
  }, []);
  return {
    workspaceTask,
    detailTarget: catalogWorkspaceTaskItemCode(workspaceTask),
    rebuildPrefill,
    categoryController,
    batchController,
    openDetail,
    openDetailEdit,
    openLocalCopy,
    closeDetail,
    openCategory,
    openConfig: () => dispatchWorkspaceTask({type: 'OPEN_CONFIG', library: 'TAG'}),
    openBrandCopy: () => dispatchWorkspaceTask({type: 'OPEN_COPY', flow: 'BRAND_TO_STORE'}),
    openCreate: () => dispatchWorkspaceTask({type: 'OPEN_CREATE'}),
    onDetailSaved: () => {
      if (workspaceTask.kind !== 'EDIT') return;
      const {itemCode, triggerTestId} = workspaceTask;
      dispatchWorkspaceTask({type: 'CLOSE'});
      dispatchWorkspaceTask({
        type: 'OPEN_VIEW',
        itemCode,
        triggerTestId: triggerTestId ?? catalogItemRowTestId(itemCode),
      });
    },
    onVoidAndRebuild: (source: {code?: string; name?: string; shapeKey?: string}) => {
      closeDetail(false);
      detailTriggerRef.current = null;
      setRebuildPrefill(source);
      dispatchWorkspaceTask({type: 'OPEN_CREATE', prefill: source});
    },
    onCreateClose: () => {
      dispatchWorkspaceTask({type: 'CLOSE'});
      setRebuildPrefill(undefined);
    },
    onCreated: (createdCode: string) => {
      dispatchWorkspaceTask({type: 'CLOSE'});
      setRebuildPrefill(undefined);
      detailTriggerRef.current = null;
      dispatchWorkspaceTask({type: 'OPEN_EDIT', itemCode: createdCode});
    },
    onConfigClose: () => dispatchWorkspaceTask({type: 'CLOSE'}),
    onCopyClose: () => dispatchWorkspaceTask({type: 'CLOSE'}),
  };
}
