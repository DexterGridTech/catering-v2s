import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./OrganizationOverviewDetailDrawer.tsx', import.meta.url), 'utf8');
describe('organization overview detail focused contract', () => it('only renders owner readback and enabled extension values in a controlled drawer', () => {
  expect(source).toContain('useOverlayLock(open)'); expect(source).toContain('item?.extensionFields?.map'); expect(source).toContain('adminDrawerSurfaceProps'); expect(source).toContain('loading={loading}'); expect(source).toContain('styles={{label: {width: 164}}}'); expect(source).toContain("item?.type === 'TENANT' || item?.type === 'HEAD_COMPANY'"); expect(source).toContain("label: '统一代码'"); expect(source).toContain("label: '别名'"); expect(source).toContain("label: '项目'"); expect(source).toContain("label: '总公司'"); expect(source).not.toContain("label: '所属机构'"); expect(source).not.toMatch(/onEdit|onStatus|授权/);
}));
