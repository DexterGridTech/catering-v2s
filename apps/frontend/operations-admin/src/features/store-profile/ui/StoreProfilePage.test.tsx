import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const pageSource = await readFile(new URL('./StoreProfilePage.tsx', import.meta.url), 'utf8');
const detailSource = await readFile(new URL('./FixedStoreContractDetailDrawer.tsx', import.meta.url), 'utf8');

describe('store profile focused contract', () => {
  it('keeps profile and four owner-provided contract states read-only and context-scoped', () => {
    expect(pageSource).toContain('contextScopedQueryArgs');
    expect(pageSource).toContain("key: 'PENDING_EFFECTIVE'");
    expect(pageSource).toContain('operationsAdminRtkRequest.getOperationsFixedStoreContracts');
    expect(pageSource).toContain('operations-store-profile-contract-state-tabs');
    expect(pageSource).toContain('operations-store-profile-retry');
    expect(pageSource).toContain('profile.error');
    expect(pageSource).toContain('if (!scopeReady) return null;');
    expect(pageSource).not.toContain('operations-store-profile-scope-required');
    expect(pageSource).not.toContain('请选择可查看范围。');
    expect(pageSource).not.toMatch(/createOperations|updateOperations|invalidateOperations|transitionOperations/);
  });

  it('opens an independent fixed-store contract detail without mutation controls', () => {
    expect(detailSource).toContain('useDetailDrawer');
    expect(detailSource).toContain('useOverlayLock(Boolean(contract))');
    expect(detailSource).toContain('operations-store-profile-contract-detail');
    expect(detailSource).not.toMatch(/<Button|createOperations|updateOperations|invalidateOperations/);
  });

  it('keeps the fixed-store contract detail field set aligned with the contract detail IA', () => {
    for (const label of ['门店', '项目', '项目分期', '经营租户', '货号', '起止日期', '状态', '备注', '更新时间']) {
      expect(detailSource).toContain(`label: '${label}'`);
    }
    expect(detailSource).toContain(['getOperations', 'ContractExtensionDefinition'].join(''));
    expect(detailSource).toContain('extensionItems');
  });
});
