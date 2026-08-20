import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const platformQueries = read('features/external-collaboration/application/queries.ts');
const ownerBindingList = read('features/external-collaboration/ui/OwnerBindingList.tsx');
const ownerBindingDetail = read('features/external-collaboration/ui/OwnerBindingDetailDrawer.tsx');
const providerProfileDetail = read('features/external-collaboration/ui/ProviderProfileDetail.tsx');
const externalSystemDetail = read('features/external-collaboration/ui/ExternalSystemDetail.tsx');
const externalCollaborationPage = read('features/external-collaboration/ui/ExternalCollaborationPage.tsx');

test('owner bindings are a server-side Page with query identity and service total', () => {
  assert.doesNotMatch(platformQueries, /collectCursorPages/);
  assert.match(platformQueries, /nodeQueryText: query\.nodeQueryText/);
  assert.match(platformQueries, /bindingName: query\.bindingName/);
  assert.match(platformQueries, /sortKey: query\.sortKey/);
  assert.match(platformQueries, /sortDirection: query\.sortDirection/);
  assert.match(platformQueries, /page: query\.page/);
  assert.match(platformQueries, /pageSize: query\.pageSize/);
  assert.match(
    ownerBindingList,
    /readPlatformOwnerBindings\(groupWorkspaceKey, providerCode, \{[\s\S]*?\.\.\.filters,[\s\S]*?\.\.\.sort,[\s\S]*?page,[\s\S]*?pageSize,/,
  );
  assert.doesNotMatch(ownerBindingList, /filtered|\.slice\(/);
  assert.match(ownerBindingList, /total,/);
});

test('platform refresh guards use the foundation lifecycle', () => {
  for (const [path, source] of [
    ['features/external-collaboration/ui/OwnerBindingList.tsx', ownerBindingList],
    ['features/external-collaboration/ui/OwnerBindingDetailDrawer.tsx', ownerBindingDetail],
  ]) {
    assert.doesNotMatch(source, /let active\s*=\s*true/, path);
    assert.doesNotMatch(source, /refreshToken/, path);
  }
  assert.match(ownerBindingList, /createRefreshSignal/);
  assert.match(ownerBindingList, /refreshSignal\.publish\(\)/);
  assert.match(ownerBindingDetail, /useAsyncGenerationGuard/);
});

test('external collaboration status controls use versioned generated commands and separate readback retry', () => {
  assert.match(providerProfileDetail, /transitionPlatformProviderProfileStatus/);
  assert.match(providerProfileDetail, /expectedVersion: profile\.version/);
  assert.match(providerProfileDetail, /platform-provider-profile-enable/);
  assert.match(providerProfileDetail, /platform-provider-profile-disable/);
  assert.match(providerProfileDetail, /readbackProblem/);
  assert.match(providerProfileDetail, /retryStatus/);
  assert.match(externalSystemDetail, /const refreshReadback = async \(\) =>/);
  assert.match(externalSystemDetail, /await refreshReadback\(\)/);
  assert.doesNotMatch(externalSystemDetail, /await query\.refetch\(\);\s*\n\s*\} catch \(error\)/);
});

test('external collaboration uses the shared master/detail surface without owner implementation copy', () => {
  assert.doesNotMatch(externalCollaborationPage, /collaboration owner/);
  assert.doesNotMatch(externalCollaborationPage, /Layout\.(Sider|Content)/);
  assert.match(externalCollaborationPage, /platform-master-detail-layout/);
  assert.match(externalCollaborationPage, /platform-master-detail-tree-panel/);
  assert.match(externalCollaborationPage, /platform-master-detail-detail-host/);
});
