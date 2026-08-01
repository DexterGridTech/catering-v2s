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
    expect(source).toContain('operationsAdminRtkRequest.getOperationsOrganizationStoreCandidates');
    expect(source).toContain('useGetOperationsOrganizationStoreCandidatesQuery');
    expect(source).toContain('contextScopedQueryArgs');
    expect(source).toContain('queryContext={queryContext}');
    expect(source).toContain('operations-store-page');
    expect(source).toContain('operations-store-filter-name');
    expect(source).toContain('operations-store-filter-project');
    expect(source).toContain('operations-store-filter-code');
    expect(source).toContain('operations-store-filter-status');
    expect(source).toContain('operations-store-filter-submit');
    expect(source).toContain('operations-store-open-detail-${row.id}');
    expect(source).toContain('operations-store-create-open');
    expect(source).toContain('operations-store-table');
    expect(source).not.toContain('LegacyStore');
    expect(source).not.toMatch(/title:\s*['"]操作['"]/);
    expect(detail).toContain('useGetOperationsOrganizationStoreQuery');
    expect(detail).toContain('useGetOperationsOrganizationStoreExtensionDefinitionQuery');
    expect(detail).toContain('operations-store-detail-loading');
    expect(detail).toContain('operations-store-detail-problem');
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
    expect(status).toContain('门店状态操作未完成，请重试。');
  });
});
