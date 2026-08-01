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
    expect(pageSource).not.toMatch(/createOperations|updateOperations|invalidateOperations|transitionOperations/);
  });

  it('opens an independent fixed-store contract detail without mutation controls', () => {
    expect(detailSource).toContain('useDetailDrawer');
    expect(detailSource).toContain('useOverlayLock(Boolean(contract))');
    expect(detailSource).toContain('operations-store-profile-contract-detail');
    expect(detailSource).not.toMatch(/<Button|createOperations|updateOperations|invalidateOperations/);
  });
});
