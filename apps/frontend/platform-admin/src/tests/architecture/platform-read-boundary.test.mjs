import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../features/organization-contract-overview/ui/PlatformReadPage.tsx', import.meta.url), 'utf8');

test('platform organization and contract overview use generated RTK reads and owner detail readback', () => {
  assert.match(source, /platformRtk\.useGetPlatformOrganizationOverviewPageQuery/);
  assert.match(source, /platformRtk\.useGetPlatformOrganizationHierarchyTreeQuery/);
  assert.match(source, /platformRtk\.useGetPlatformContractOverviewPageQuery/);
  assert.match(source, /platformRtk\.useLazyGetPlatformOrganizationOverviewDetailQuery/);
  assert.match(source, /platformRtk\.useLazyGetPlatformContractOverviewDetailQuery/);
  assert.match(source, /platformAdminRtkRequest\.getPlatformOrganizationOverviewPage/);
  assert.match(source, /platformAdminRtkRequest\.getPlatformOrganizationHierarchyTree/);
  assert.match(source, /platformAdminRtkRequest\.getPlatformContractOverviewPage/);
  assert.match(source, /contextScopedQueryArgs/);
  assert.match(source, /'组织架构'.*'品牌'.*'经营租户'.*'总公司'.*'门店'/s);
  assert.match(source, /gridTemplateColumns/);
  assert.match(source, /请选择左侧组织查看详情/);
  assert.match(source, /<Button type="link" onClick=\{\(\) => openOrganizationDetail\(row\.id\)\}>/);
  assert.match(source, /<Button type="link" onClick=\{\(\) => openContractDetail\(row\.contractRef\.id\)\}>/);
  assert.doesNotMatch(source, /platformClient\.|\bfetch\(|createApi\(|createSlice\(|useDispatch\(|useSelector\(/);
  assert.doesNotMatch(source, /onRow=/);
});
