import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const operationsQueries = read('features/business-channel/application/queries.ts');
const operationsList = read('features/business-channel/ui/BusinessChannelList.tsx');
const projectPage = read('features/business-channel/ui/ProjectBusinessChannelPage.tsx');
const storePage = read('features/business-channel/ui/StoreBusinessChannelPage.tsx');

test('business-channel bounded collections use one fixed-bound read', () => {
  assert.match(operationsQueries, /collectCursorPages/);
  assert.match(operationsQueries, /BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE/);
  assert.equal((operationsQueries.match(/pageSize: BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE/g) ?? []).length, 2);
  assert.doesNotMatch(operationsQueries, /BUSINESS_CHANNEL_BOUNDED_READ_SIZE/);
  assert.equal((operationsQueries.match(/sortKey: sort\.sortKey/g) ?? []).length, 4);
  assert.equal((operationsQueries.match(/sortDirection: sort\.sortDirection/g) ?? []).length, 4);
  assert.match(operationsQueries, /getOperationsProjectBusinessChannels\([\s\S]*?sortKey: sort\.sortKey/);
  assert.match(operationsQueries, /getOperationsStoreBusinessChannels\([\s\S]*?sortKey: sort\.sortKey/);
  assert.match(operationsList, /useAsyncGenerationGuard/);
  assert.match(operationsList, /useRefreshVersion/);
});

test('operations refresh guards use the foundation lifecycle', () => {
  for (const [path, source] of [
    ['business-channel/ui/BusinessChannelList.tsx', operationsList],
    ['business-channel/ui/ProjectBusinessChannelPage.tsx', projectPage],
    ['business-channel/ui/StoreBusinessChannelPage.tsx', storePage],
  ]) {
    assert.doesNotMatch(source, /let active\s*=\s*true/, path);
    assert.doesNotMatch(source, /refreshToken/, path);
  }
  assert.match(projectPage, /createRefreshSignal/);
  assert.match(projectPage, /channelRefreshSignal\.publish\(\)/);
  assert.match(storePage, /createRefreshSignal/);
  assert.match(storePage, /channelRefreshSignal\.publish\(\)/);
});
