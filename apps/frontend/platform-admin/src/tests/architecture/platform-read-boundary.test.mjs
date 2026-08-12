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
  assert.doesNotMatch(source, /platformClient\.|\bfetch\(|createApi\(|createSlice\(|useDispatch\(|useSelector\(/);
  assert.doesNotMatch(source, /onRow=/);
});
