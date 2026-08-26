import {describe, expect, it} from 'vitest';
import {
  catalogWorkspaceTaskReducer,
  catalogWorkspaceTaskIsOpen,
  catalogWorkspaceTaskItemCode,
  initialCatalogWorkspaceTask,
} from './catalogWorkspaceTask';
import {
  catalogEditorCanClose,
  catalogEditorChildCloseResult,
  catalogEditorChildTaskReducer,
  initialCatalogEditorChildTask,
} from './catalogEditorChildTask';

describe('catalog workspace task state machine', () => {
  it('opens one first-level task and requires an explicit close before another', () => {
    const view = catalogWorkspaceTaskReducer(initialCatalogWorkspaceTask, {
      type: 'OPEN_VIEW',
      itemCode: 'ITEM-001',
      triggerTestId: 'catalog-item-row-01',
    });
    expect(catalogWorkspaceTaskIsOpen(view)).toBe(true);
    expect(catalogWorkspaceTaskItemCode(view)).toBe('ITEM-001');
    expect(() => catalogWorkspaceTaskReducer(view, {type: 'OPEN_CONFIG', library: 'PRODUCTION_TAG'})).toThrow(
      'CATALOG_WORKSPACE_TASK_CLOSE_REQUIRED:VIEW',
    );
    expect(catalogWorkspaceTaskReducer(view, {type: 'CLOSE'})).toEqual(initialCatalogWorkspaceTask);
  });

  it('keeps stable business identity for edit, top-level configuration, and batch selection', () => {
    const edit = catalogWorkspaceTaskReducer(initialCatalogWorkspaceTask, {
      type: 'OPEN_EDIT',
      itemCode: 'LATTE-001',
      baselineVersion: 4,
    });
    expect(edit).toMatchObject({kind: 'EDIT', itemCode: 'LATTE-001', baselineVersion: 4});
    const config = catalogWorkspaceTaskReducer(edit, {type: 'CLOSE'});
    const openedConfig = catalogWorkspaceTaskReducer(config, {
      type: 'OPEN_CONFIG',
      library: 'PRODUCTION_TAG',
    });
    expect(openedConfig).toMatchObject({kind: 'CONFIG', library: 'PRODUCTION_TAG'});
    const batch = catalogWorkspaceTaskReducer(openedConfig, {type: 'CLOSE'});
    expect(
      catalogWorkspaceTaskReducer(batch, {
        type: 'OPEN_BATCH',
        action: 'STATUS',
        selectedItemCodes: ['A-001', 'B-002'],
      }),
    ).toMatchObject({kind: 'BATCH', selectedItemCodes: ['A-001', 'B-002']});
  });
});

describe('catalog editor child task state machine', () => {
  it('keeps configuration below the editor and has no return token or draft payload', () => {
    const opened = catalogEditorChildTaskReducer(initialCatalogEditorChildTask, {
      type: 'OPEN_CONFIG',
      library: 'PRODUCTION_TAG',
      triggerTestId: 'catalog-item-production-tag-manage',
    });
    expect(opened).toEqual({
      kind: 'CONFIG',
      library: 'PRODUCTION_TAG',
      triggerTestId: 'catalog-item-production-tag-manage',
    });
    expect(JSON.stringify(opened)).not.toContain('returnToEdit');
    expect(JSON.stringify(opened)).not.toContain('draft');
    expect(catalogEditorCanClose(opened)).toBe(false);
    expect(catalogEditorChildCloseResult(opened)).toEqual({
      nextTask: initialCatalogEditorChildTask,
      focusTestId: 'catalog-item-production-tag-manage',
    });
    expect(catalogEditorChildTaskReducer(opened, {type: 'CLOSE'})).toEqual(initialCatalogEditorChildTask);
    expect(catalogEditorCanClose(initialCatalogEditorChildTask)).toBe(true);
    expect(catalogEditorChildCloseResult(initialCatalogEditorChildTask)).toEqual({
      nextTask: initialCatalogEditorChildTask,
      focusTestId: undefined,
    });
  });
});
