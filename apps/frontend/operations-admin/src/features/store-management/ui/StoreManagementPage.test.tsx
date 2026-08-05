import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./StoreManagementPage.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('./StoreDetailDrawer.tsx', import.meta.url), 'utf8');
const create = await readFile(new URL('./StoreCreateDrawer.tsx', import.meta.url), 'utf8');
const edit = await readFile(new URL('./StoreEditDrawer.tsx', import.meta.url), 'utf8');
const status = await readFile(new URL('./StoreStatusModal.tsx', import.meta.url), 'utf8');

describe('store management focused contract', () => {
  it('keeps generated page reads, independent detail owner reads, and no row operation column', () => {
    expect(source).toContain("from './StoreCreateDrawer'");
    expect(source).toContain("from './StoreEditDrawer'");
    expect(source).toContain("from './StoreStatusModal'");
    expect(source).toContain('contextScopedQueryArgs');
    expect(source).toContain('queryContext={queryContext}');
    expect(source).toContain('operations-store-page');
    expect(source).toContain('operations-store-filter-name');
    expect(source).not.toContain('operations-store-filter-project');
    expect(source).toContain("const scopeReady = Boolean(queryContext.scopeRef)");
    expect(source).not.toContain('请在左下角选择要管理的项目。');
    expect(source).toContain('operations-store-filter-code');
    expect(source).toContain('operations-store-filter-status');
    expect(source).toContain('operations-store-filter-submit');
    expect(source).toContain('operations-store-open-detail-${row.id}');
    expect(source).toContain('operations-store-create-open');
    expect(source).toContain('operations-store-table');
    expect(source).toContain("useState<OrganizationStoreSortKey>('UPDATED_AT')");
    expect(source).toContain("useState<OrganizationStoreSortDirection>('DESC')");
    expect(source).toContain('sort, direction, page: current, pageSize');
    expect(source).toContain("key: 'name'");
    expect(source).toContain("key: 'code'");
    expect(source).toContain("key: 'notes', title: '备注'");
    expect(source).not.toContain("title: '项目', search: false");
    expect(source).not.toContain('row.project');
    expect(source).toContain("'NAME'");
    expect(source).toContain("'CODE'");
    expect(source).toContain("'UPDATED_AT'");
    expect(source).not.toContain('LegacyStore');
    expect(source).not.toMatch(/title:\s*['"]操作['"]/);
    expect(detail).toContain('useGetOperationsOrganizationStoreQuery');
    expect(detail).toContain('useGetOperationsOrganizationStoreExtensionDefinitionQuery');
    expect(detail).toContain('operations-store-detail-loading');
    expect(detail).toContain('operations-store-detail-problem');
    expect(detail).toContain('adminDetailDescriptionsProps');
  });

  it('keeps definition-driven, safe-to-submit create and edit forms', () => {
    for (const drawer of [create, edit]) {
      expect(drawer).toContain('useGetOperationsOrganizationStoreExtensionDefinitionQuery');
      expect(drawer).toContain("field.type === 'DATE'");
      expect(drawer).toContain('<DatePicker');
      expect(drawer).toContain('definitionReady');
      expect(drawer).toContain('disabled={!ready}');
      expect(drawer).toContain('扩展字段加载失败，请关闭后重新进入。');
      expect(drawer).toContain('extensionValues: serializedExtensionValues');
    }
    expect(create).toContain('operations-store-create-project');
    expect(create).toContain('const projectId = queryContext.scopeRef');
    expect(create).not.toContain('name="projectId"');
    expect(create).not.toContain('body: {projectId');
    expect(create).toContain('operations-store-create-head-company');
    expect(edit).toContain('operations-store-edit-code');
    expect(edit).toContain('operations-store-edit-head-company');
  });

  it('keeps the store status change detail-gated, CAS-bound and lifecycle-locked', () => {
    expect(status).toContain('useOverlayLock(Boolean(store))');
    expect(status).toContain('useSubmissionLifecycle');
    expect(status).toContain('expectedVersion: store.revision');
    expect(status).toContain('onUpdated(updated)');
    expect(status).toContain('operations-store-status-confirm');
    expect(status).toContain('operationsProblemOf(error)?.detail');
    expect(status).toContain('门店状态操作未完成，请重试。');
  });
});
