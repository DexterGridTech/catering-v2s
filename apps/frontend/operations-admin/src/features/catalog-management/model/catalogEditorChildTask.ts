import type {CatalogLibraryKind} from './catalogWorkspaceTask';

/**
 * Transient editor-child state only.  It deliberately has no item draft,
 * return token or persisted value: the still-open editor remains their owner.
 */
export type CatalogEditorChildTask =
  {kind: 'NONE'} | {kind: 'CONFIG'; library: CatalogLibraryKind; triggerTestId: string};

export type CatalogEditorChildTaskAction =
  {type: 'OPEN_CONFIG'; library: CatalogLibraryKind; triggerTestId: string} | {type: 'CLOSE'};

export const initialCatalogEditorChildTask: CatalogEditorChildTask = {kind: 'NONE'};

/** A parent editor may close only when its sole child task has ended. */
export function catalogEditorCanClose(task: CatalogEditorChildTask) {
  return task.kind === 'NONE';
}

/**
 * Closing the child never changes the item draft.  It only exposes the
 * originating control for deterministic focus restoration in the parent.
 */
export function catalogEditorChildCloseResult(task: CatalogEditorChildTask): {
  nextTask: CatalogEditorChildTask;
  focusTestId?: string;
} {
  return {
    nextTask: initialCatalogEditorChildTask,
    focusTestId: task.kind === 'CONFIG' ? task.triggerTestId : undefined,
  };
}

export function catalogEditorChildTaskReducer(
  state: CatalogEditorChildTask,
  action: CatalogEditorChildTaskAction,
): CatalogEditorChildTask {
  if (action.type === 'CLOSE') return initialCatalogEditorChildTask;
  if (state.kind !== 'NONE') throw new Error(`CATALOG_EDITOR_CHILD_TASK_CLOSE_REQUIRED:${state.kind}`);
  return {kind: 'CONFIG', library: action.library, triggerTestId: action.triggerTestId};
}
