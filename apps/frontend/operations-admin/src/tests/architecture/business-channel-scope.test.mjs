import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(
  new URL('../../features/business-channel/ui/StoreBusinessChannelPage.tsx', import.meta.url),
  'utf8',
);
const createDrawer = fs.readFileSync(
  new URL('../../features/business-channel/ui/BusinessChannelCreateDrawer.tsx', import.meta.url),
  'utf8',
);
const controller = fs.readFileSync(
  new URL(
    '../../../../../backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java',
    import.meta.url,
  ),
  'utf8',
);
const routeRegistry = fs.readFileSync(new URL('../../app/routing/pageRegistry.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');

function assertStableBusinessChannelBrowserRoutes(registry, operationsApp) {
  assert.match(registry, /stableBusinessChannelRoute\('projects', 'business-channels\/project'\)/);
  assert.match(registry, /stableBusinessChannelRoute\('stores', 'business-channels\/store'\)/);
  assert.doesNotMatch(registry, /routeSegment: `projects\/:scopeRef\/business-channels`/);
  assert.doesNotMatch(registry, /routeSegment: `stores\/:scopeRef\/business-channels`/);
  assert.doesNotMatch(registry, /routeForScope|matchRoute/);
  assert.match(registry, /legacyRouteMatcher/);
  assert.match(operationsApp, /const selectedScopeRef = selected \? scopeRefForPage\(selected\) : undefined;/);
  assert.doesNotMatch(operationsApp, /routeMatch\?\.scopeRef/);
  assert.doesNotMatch(operationsApp, /routeForOperationsPage\(pageKey, scopeRefForPage/);
  assert.match(operationsApp, /needsCanonicalRedirect/);
}

test('business-channel browser pages use stable routes and session-derived data scope', () => {
  assertStableBusinessChannelBrowserRoutes(routeRegistry, app);
});

test('red mutation that restores a data-node browser route is rejected', () => {
  const unsafeRegistry = routeRegistry.replace(
    "stableBusinessChannelRoute('projects', 'business-channels/project')",
    "stableBusinessChannelRoute('projects', `projects/:scopeRef/business-channels`)",
  );
  assert.throws(() => assertStableBusinessChannelBrowserRoutes(unsafeRegistry, app), {name: 'AssertionError'});
});

test('store business-channel deep links read the URL store before deriving its project scope', () => {
  assert.match(
    page,
    /getOperationsOrganizationStore\(\s*\{groupWorkspaceKey: readQueryContext\.groupWorkspaceKey, storeId: scopeRef\}/,
  );
  assert.match(page, /expectedContextVersion: queryContext\.expectedContextVersion/);
  assert.match(
    page,
    /\.then\(store =>\s*readStoreBusinessChannelTemplateCandidates\(readQueryContext, store\.project\.id, scopeRef, templateSort\)/,
  );
  assert.doesNotMatch(page, /getOperationsStoreProfile/);
});

test('store channel creation only offers effective store-owned templates', () => {
  assert.match(
    createDrawer,
    /ownerNodeType === 'STORE'[\s\S]*?template\.operatorKind === 'STORE' && template\.status === 'ENABLED'/,
  );
  assert.match(createDrawer, /disabled=\{!availableTemplates\.length/);
});

test('business-channel candidate reads validate the real organization store/project pair at the edge', () => {
  const candidateEndpoint = controller.slice(
    controller.indexOf('BusinessChannelTemplateCandidatePage storeTemplateCandidates'),
    controller.indexOf('@GetMapping("/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels")'),
  );
  assert.match(candidateEndpoint, /requireStoreProjectPair\(session, projectRef, storeRef\);/);
  assert.match(candidateEndpoint, /businessChannels\.pageStoreTemplateCandidates/);
  assert.match(controller, /OperationsOrganizationTaskReadService organizationReads/);
  assert.match(controller, /WorkspaceUserService organizationAuthorization/);
  assert.match(controller, /private OrganizationOverviewTaskReadService\.Item requireScopedStore\(/);
  assert.match(
    controller.slice(
      controller.indexOf('private OrganizationOverviewTaskReadService.Item requireScopedStore('),
      controller.indexOf('private void requireStoreProjectPair('),
    ),
    /if \(session\.scopeContext\(\) != null && session\.scopeContext\(\)\.store\(\) != null\)[\s\S]*?requireStore\(session\)[\s\S]*?else \{[\s\S]*?organizationAuthorization\.resolveSelectedProjectScope\(\s*session,\s*store\.project\(\)\.id\(\)\);/,
  );
  assert.match(controller, /var store = requireScopedStore\(session, session\.groupWorkspaceKey\(\), storeRef\);/);
  assert.match(controller, /if \(!projectRef\.equals\(store\.project\(\)\.id\(\)\)\)/);
});
