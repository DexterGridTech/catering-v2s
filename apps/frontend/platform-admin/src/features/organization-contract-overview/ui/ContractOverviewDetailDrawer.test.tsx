import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./ContractOverviewDetailDrawer.tsx', import.meta.url), 'utf8');
describe('contract overview detail focused contract', () => it('shows owner contract facts and extension values without mutation controls', () => {
  expect(source).toContain('item.contractRef.code'); expect(source).toContain('item.projectRef.name'); expect(source).toContain('item.storeRef.code'); expect(source).toContain('item.items.map'); expect(source).toContain('item?.extensionFields?.map'); expect(source).toContain('useOverlayLock(open)'); expect(source).toContain('loading={loading}'); expect(source).not.toMatch(/invalidate|onEdit|作废/);
}));
