export type CatalogLibraryKind =
  'TAG' | 'UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG' | 'ATTRIBUTES' | 'ORDER_OPTIONS';

export type CatalogCategoryAction = 'CREATE' | 'RENAME' | 'REPARENT' | 'MOVE_UP' | 'MOVE_DOWN' | 'DELETE';
export type CatalogBatchAction = 'CATEGORY' | 'TAG' | 'STATUS' | 'ARCHIVE';
export type CatalogCreatePrefill = {code?: string; name?: string; shapeKey?: string; categoryRef?: string};

export type CatalogWorkspaceTask =
  | {kind: 'NONE'}
  | {kind: 'VIEW'; itemCode: string; triggerTestId: string; focus?: string}
  | {kind: 'EDIT'; itemCode: string; triggerTestId?: string; baselineVersion?: number}
  | {kind: 'CONFIG'; library: CatalogLibraryKind}
  | {kind: 'COPY'; flow: 'BRAND_TO_STORE' | 'LOCAL_SETTINGS'; targetItemCode?: string; targetShapeKey?: string}
  | {kind: 'CREATE_ITEM'; prefill?: CatalogCreatePrefill}
  | {kind: 'CATEGORY_ATOM'; action: CatalogCategoryAction; categoryRef?: string; node?: unknown}
  | {kind: 'BATCH'; action: CatalogBatchAction; selectedItemCodes: string[]};

export type CatalogWorkspaceTaskAction =
  | {type: 'OPEN_VIEW'; itemCode: string; triggerTestId: string; focus?: string}
  | {type: 'OPEN_EDIT'; itemCode: string; triggerTestId?: string; baselineVersion?: number}
  | {type: 'OPEN_CONFIG'; library: CatalogLibraryKind}
  | {type: 'OPEN_COPY'; flow: 'BRAND_TO_STORE' | 'LOCAL_SETTINGS'; targetItemCode?: string; targetShapeKey?: string}
  | {type: 'OPEN_CREATE'; prefill?: CatalogCreatePrefill}
  | {type: 'OPEN_CATEGORY'; action: CatalogCategoryAction; categoryRef?: string; node?: unknown}
  | {type: 'OPEN_BATCH'; action: CatalogBatchAction; selectedItemCodes: string[]}
  | {type: 'CLOSE'};

export const initialCatalogWorkspaceTask: CatalogWorkspaceTask = {kind: 'NONE'};

/**
 * The workbench owns one first-level task.  Opening another first-level task
 * without closing the current one is a programmer error; UI transitions must
 * persist/close the current surface before dispatching the next open action.
 */
export function catalogWorkspaceTaskReducer(
  state: CatalogWorkspaceTask,
  action: CatalogWorkspaceTaskAction,
): CatalogWorkspaceTask {
  if (action.type === 'CLOSE') return initialCatalogWorkspaceTask;
  if (state.kind !== 'NONE') throw new Error(`CATALOG_WORKSPACE_TASK_CLOSE_REQUIRED:${state.kind}`);
  switch (action.type) {
    case 'OPEN_VIEW':
      return {kind: 'VIEW', itemCode: action.itemCode, triggerTestId: action.triggerTestId, focus: action.focus};
    case 'OPEN_EDIT':
      return {
        kind: 'EDIT',
        itemCode: action.itemCode,
        triggerTestId: action.triggerTestId,
        baselineVersion: action.baselineVersion,
      };
    case 'OPEN_CONFIG':
      return {kind: 'CONFIG', library: action.library};
    case 'OPEN_COPY':
      return {
        kind: 'COPY',
        flow: action.flow,
        targetItemCode: action.targetItemCode,
        targetShapeKey: action.targetShapeKey,
      };
    case 'OPEN_CREATE':
      return {kind: 'CREATE_ITEM', prefill: action.prefill};
    case 'OPEN_CATEGORY':
      return {kind: 'CATEGORY_ATOM', action: action.action, categoryRef: action.categoryRef, node: action.node};
    case 'OPEN_BATCH':
      return {kind: 'BATCH', action: action.action, selectedItemCodes: [...action.selectedItemCodes]};
    default:
      return state;
  }
}

export function catalogWorkspaceTaskIsOpen(task: CatalogWorkspaceTask): boolean {
  return task.kind !== 'NONE';
}

export function catalogWorkspaceTaskItemCode(task: CatalogWorkspaceTask): string | undefined {
  return task.kind === 'VIEW' || task.kind === 'EDIT' ? task.itemCode : undefined;
}
