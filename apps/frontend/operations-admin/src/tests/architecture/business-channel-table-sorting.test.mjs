import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const readRoot = path => readFileSync(new URL(`../../../../../../${path}`, import.meta.url), 'utf8');
const appSource = (app, path) => readRoot(['apps', 'frontend', app, 'src', ...path.split('/')].join('/'));

const projectPage = read('features/business-channel/ui/ProjectBusinessChannelPage.tsx');
const storePage = read('features/business-channel/ui/StoreBusinessChannelPage.tsx');
const channelList = read('features/business-channel/ui/BusinessChannelList.tsx');
const queries = read('features/business-channel/application/queries.ts');
const businessChannelPaths = JSON.parse(
  readRoot('contracts/openapi/paths/operations-admin/business-channel.paths.json'),
);
const platformReadPage = appSource('platform-admin', 'features/organization-contract-overview/ui/PlatformReadPage.tsx');
const operationsContractPage = appSource(
  'operations-admin',
  'features/contract-management/ui/ContractManagementPage.tsx',
);
const operationsContractDetail = appSource(
  'operations-admin',
  'features/contract-management/ui/ContractDetailDrawer.tsx',
);
const storeProfilePage = appSource('operations-admin', 'features/store-profile/ui/StoreProfilePage.tsx');
const storeContractDetail = appSource(
  'operations-admin',
  'features/store-profile/ui/FixedStoreContractDetailDrawer.tsx',
);
const platformContractDetail = appSource(
  'platform-admin',
  'features/organization-contract-overview/ui/ContractOverviewDetailDrawer.tsx',
);
const businessChannelTemplateSql = readRoot(
  'apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTemplateServiceSql.java',
);

const getParameters = path => businessChannelPaths.paths[path].get.parameters.map(parameter => parameter.name);

test('business-channel management tables use ProTable without search or pagination', () => {
  for (const [source, component] of [
    [projectPage, 'project template table'],
    [storePage, 'store template table'],
    [channelList, 'business channel table'],
  ]) {
    assert.match(source, /from '@ant-design\/pro-components'/, component);
    assert.match(source, /<ProTable</, component);
    assert.match(source, /search=\{false\}/, component);
    assert.match(source, /pagination=\{false\}/, component);
    assert.match(source, /sorter: true/, component);
    assert.doesNotMatch(source, /<Table</, component);
    assert.doesNotMatch(source, /Input\.Search|usePageQuery|pageRows|filtered/, component);
  }
});

test('business-channel list reads carry explicit bounded sort parameters', () => {
  assert.match(queries, /sortKey/);
  assert.match(queries, /sortDirection/);
  assert.match(queries, /readStoreBusinessChannelTemplateCandidates[\s\S]*sort/);
  for (const path of [
    '/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates',
    '/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels',
    '/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels',
  ]) {
    const parameters = getParameters(path);
    assert.ok(parameters.includes('sortKey'), `${path} must declare sortKey`);
    assert.ok(parameters.includes('sortDirection'), `${path} must declare sortDirection`);
  }
  const candidateParameters = getParameters(
    '/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-template-candidates',
  );
  assert.ok(candidateParameters.includes('sortKey'), 'store template candidates must declare sortKey');
  assert.ok(candidateParameters.includes('sortDirection'), 'store template candidates must declare sortDirection');
  assert.match(
    businessChannelTemplateSql,
    /(?:t\.)?operator_kind='STORE' AND (?:t\.)?status='ENABLED'/,
    'store template candidates must be filtered to effective store templates by the owner',
  );
});

test('business-channel sections use standard cards and store candidates do not expose a redundant status column', () => {
  for (const [source, label] of [
    [projectPage, 'project template section'],
    [storePage, 'store candidate section'],
    [channelList, 'business channel section'],
  ]) {
    assert.match(
      source,
      /<Card[\s\S]*?(经营渠道模板|门店可接入经营渠道模板|新建渠道)/,
      `${label} must use a card shell`,
    );
    assert.doesNotMatch(source, /<Card\b[^>]*\bsize="small"/, `${label} must use the default Card container`);
    assert.doesNotMatch(
      source,
      /styles=\{\{body: \{padding: 0\}\}\}/,
      `${label} must preserve the default Card body surface`,
    );
  }
  assert.doesNotMatch(storePage, /title: '状态'/, 'store candidate templates must not show status');
  assert.doesNotMatch(
    storePage,
    /title: '门店可见范围'/,
    'store candidate templates must not expose the project template visibility rule',
  );
  assert.doesNotMatch(storePage, /sortKey: 'STATUS'/, 'store candidate templates must not offer status sorting');
});

test('contract validity rows and details use the shared validity presentation', () => {
  for (const [source, label] of [
    [operationsContractPage, 'operations contract table'],
    [operationsContractDetail, 'operations contract detail'],
    [storeProfilePage, 'store profile contract table'],
    [storeContractDetail, 'store profile contract detail'],
    [platformReadPage, 'platform contract table'],
    [platformContractDetail, 'platform contract detail'],
  ]) {
    assert.match(source, /ValidityStatus/, `${label} must use shared validity presentation`);
  }
  assert.doesNotMatch(platformReadPage, /VALID: \{text: '生效中'\}/, 'contract validity must be labeled 有效');
  assert.doesNotMatch(
    storeProfilePage,
    /value === 'VALID' \? '有效' : '已作废'/,
    'store contract rows must use the shared dot/text status',
  );
  assert.doesNotMatch(
    storeContractDetail,
    /selected\.status === 'VALID' \? '有效' : '已作废'/,
    'store contract details must use the shared dot/text status',
  );
});
