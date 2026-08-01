import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./ContractManagementPage.tsx', import.meta.url), 'utf8');
const createSource = await readFile(new URL('./ContractCreateDrawer.tsx', import.meta.url), 'utf8');
const editSource = await readFile(new URL('./ContractEditDrawer.tsx', import.meta.url), 'utf8');
const detailSource = await readFile(new URL('./ContractDetailDrawer.tsx', import.meta.url), 'utf8');
const invalidateSource = await readFile(new URL('./ContractInvalidateModal.tsx', import.meta.url), 'utf8');

describe('contract management focused contract', () => {
  it('keeps the catalog page read-only except for approved overlay entry points', () => {
    expect(source).toContain('contractPageTitle');
    expect(source).toContain('contextScopedQueryArgs');
    expect(source).toContain('operationsAdminRtkRequest.getOperationsContracts');
    expect(source).toContain('operationsRtk.useGetOperationsContractsQuery');
    expect(source).toContain('showOwnerReadback');
    expect(source).not.toContain('refetch(');
    expect(source).not.toMatch(/title:\s*['"]操作['"]/);
  });

  it('keeps contract mutations in independent foundation-managed overlays', () => {
    expect(createSource).toContain('useDrawerFormLifecycle');
    expect(createSource).toContain('selectedStoreTenant');
    expect(createSource).toContain('placeholder="随门店确定"');
    expect(createSource).toContain('operations-contract-create-project');
    expect(createSource).toContain('onSearch={setStoreSearch}');
    expect(createSource).toContain('Form.List name="items"');
    expect(createSource).toContain('货号编码不能重复');
    expect(createSource).toContain('operationsClient.createOperationsContract');
    expect(editSource).toContain('useDrawerFormLifecycle');
    expect(editSource).toContain('operationsClient.updateOperationsContract');
    expect(editSource).toContain('items: contract.items');
    expect(editSource).toContain('Form.List name="items"');
    expect(editSource).toContain('货号编码不能重复');
    expect(editSource).toContain('onConflict(contract)');
    expect(detailSource).toContain('closeThen(onEdit)');
    expect(detailSource).toContain('closeThen(onInvalidate)');
    expect(detailSource).toContain('useOverlayLock(Boolean(contract))');
    expect(detailSource).toContain("operations-contract-detail-loading");
    expect(detailSource).toContain("operations-contract-detail-error");
    expect(detailSource).toContain("operations-contract-detail-extension-error");
    expect(detailSource).toContain('operationsAdminRtkRequest.getOperationsContract');
    expect(invalidateSource).toContain('useSubmissionLifecycle');
    expect(invalidateSource).toContain('operationsClient.invalidateOperationsContract');
    expect(invalidateSource).toContain('作废后保留历史记录。');
  });
});
