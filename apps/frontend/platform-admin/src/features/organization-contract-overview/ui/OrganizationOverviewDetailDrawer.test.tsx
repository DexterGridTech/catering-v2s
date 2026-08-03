import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./OrganizationOverviewDetailDrawer.tsx', import.meta.url), 'utf8');
describe('organization overview detail focused contract', () => it('only renders owner readback and enabled extension values in a controlled drawer', () => {
  expect(source).toContain('useOverlayLock(open)'); expect(source).toContain('item?.extensionFields?.map'); expect(source).toContain('adminDrawerSurfaceProps'); expect(source).toContain('loading={loading}'); expect(source).toContain('styles={{label: {width: 164}}}'); expect(source).not.toMatch(/onEdit|onStatus|授权/);
}));
