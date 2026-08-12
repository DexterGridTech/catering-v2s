import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../../app/PlatformApp.tsx", import.meta.url), "utf8");
const authenticationSource = fs.readFileSync(new URL("../../features/authentication/ui/PlatformLoginPage.tsx", import.meta.url), "utf8");
const workspaceSource = fs.readFileSync(new URL("../../features/workspace-management/ui/WorkspaceManagementPage.tsx", import.meta.url), "utf8");
const workspaceDetailSource = fs.readFileSync(new URL("../../features/workspace-management/ui/WorkspaceDetailDrawer.tsx", import.meta.url), "utf8");
const workspaceCreateSource = fs.readFileSync(new URL("../../features/workspace-management/ui/WorkspaceCreateDrawer.tsx", import.meta.url), "utf8");
const workspaceInitializationSource = fs.readFileSync(new URL("../../features/workspace-management/ui/CommercialGroupInitializationDrawer.tsx", import.meta.url), "utf8");
const workspaceEditSource = fs.readFileSync(new URL("../../features/workspace-management/ui/WorkspaceEditDrawer.tsx", import.meta.url), "utf8");
const workspaceStatusSource = fs.readFileSync(new URL("../../features/workspace-management/ui/WorkspaceStatusModal.tsx", import.meta.url), "utf8");
const workspaceAdministrationSource = fs.readFileSync(new URL("../../features/workspace-administration/ui/WorkspaceAdministrationPage.tsx", import.meta.url), "utf8");
const generatedCatalog = fs.readFileSync(new URL("../../app/api/generated/platform-edge.ts", import.meta.url), "utf8");
const extensionSource = fs.readFileSync(new URL("../../features/extension-management/ui/ExtensionsPage.tsx", import.meta.url), "utf8");
const extensionEditSource = fs.readFileSync(new URL("../../features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx", import.meta.url), "utf8");
const workspaceManagement = fs.readFileSync(new URL("../../features/workspace-management/ui/WorkspaceManagementPage.tsx", import.meta.url), "utf8");
const transportSource = fs.readFileSync(new URL("../../app/api/PlatformTransport.ts", import.meta.url), "utf8");
const apiSource = fs.readFileSync(new URL("../../app/api/PlatformApi.ts", import.meta.url), "utf8");

test("platform-admin owns a separate platform login and group-workspace readback", () => {
  assert.match(authenticationSource, /platformClient\.platformPasswordLogin/);
  assert.match(workspaceSource, /platformRtk\.useListPlatformGroupWorkspacesQuery/);
  assert.match(workspaceSource, /platformAdminRtkRequest\.listPlatformGroupWorkspaces/);
  assert.match(generatedCatalog, /"operationId": "platformPasswordLogin"[\s\S]*"path": "\/api\/platform\/auth\/password-login"/);
  assert.match(generatedCatalog, /"operationId": "listPlatformGroupWorkspaces"[\s\S]*"path": "\/api\/platform\/group-workspaces"/);
  assert.doesNotMatch(authenticationSource + workspaceSource, /['"`]\s*\/api\//);
  assert.doesNotMatch(appSource + authenticationSource + workspaceSource + workspaceAdministrationSource, /operations-admin|localStorage|sessionStorage/);
});

test("platform typed write paths include extension replacement and opaque asset staging", () => {
  assert.match(extensionEditSource, /platformClient\.replaceExtensionDefinition/);
  assert.match(extensionEditSource, /expectedVersion: definition\.revision/);
  assert.match(extensionEditSource, /useDrawerFormLifecycle/);
  assert.match(extensionSource, /useOverlayLock/);
  assert.match(extensionEditSource, /PLATFORM_ADMIN_OPERATION_IDS\.replaceExtensionDefinition/);
  assert.match(extensionEditSource, /field\.type === 'SELECT' \? field\.optionsText/);
  assert.doesNotMatch(extensionSource + extensionEditSource, /field_\$\{Date\.now\(\)\}|onRow=|entityType\/key\/revision/);
  assert.match(extensionEditSource, /EXTENSION_DEFINITION_VERSION_CONFLICT/);
  assert.match(workspaceCreateSource + workspaceEditSource, /platformClient\.stagePlatformAsset/);
  assert.match(workspaceCreateSource + workspaceEditSource, /platformClient\.releasePlatformStagedAsset/);
  assert.match(workspaceCreateSource + workspaceEditSource, /'X-Asset-Bind-Grant': staged\.bindGrant/);
  assert.match(workspaceCreateSource, /closeAfterRelease/);
  assert.match(workspaceCreateSource + workspaceInitializationSource + workspaceEditSource, /useOverlayLock/);
  assert.match(workspaceStatusSource, /useOverlayLock/);
  assert.match(workspaceStatusSource, /\{getIdempotencyKey, reset\} = useSubmissionLifecycle/);
  assert.match(workspaceEditSource, /platformProblemOf\(error\).*PLATFORM_COMMON_VERSION_CONFLICT/s);
  assert.match(workspaceStatusSource, /platformProblemOf\(error\).*PLATFORM_COMMON_VERSION_CONFLICT/s);
  assert.match(workspaceSource, /getPlatformGroupWorkspaceDetail/);
  assert.match(workspaceSource, /WorkspaceMutationConflictModal/);
  assert.match(workspaceEditSource, /logoIntent[\s\S]*releaseStagedLogo/);
  assert.match(workspaceCreateSource + workspaceEditSource, /logoBindGrant: stagedLogo\??\.bindGrant|logoBindGrant: stagedLogo\.bindGrant/);
  assert.doesNotMatch(workspaceManagement + workspaceCreateSource + workspaceEditSource, /name="logoBindGrant"|name="logoAssetRef"/);
  assert.match(transportSource, /platformRtk = platformApi/);
  assert.match(apiSource, /serializeJsonOrMultipartBody/);
  assert.doesNotMatch(apiSource, /new FormData\(\)|isMultipartBody/);
  assert.match(generatedCatalog, /"operationId": "replaceExtensionDefinition"/);
  assert.match(generatedCatalog, /"operationId": "stagePlatformAsset"/);
});

test("workspace management is owner-filtered, detail-first, and keeps the selected-workspace overview read-only", () => {
  assert.match(workspaceSource, /query: \{\.\.\.filters, page, pageSize/);
  assert.match(workspaceSource, /useLazyGetPlatformGroupWorkspaceDetailQuery/);
  assert.match(workspaceSource, /detail\.close\(\);/);
  assert.match(workspaceSource, /title: '集团空间名称'.*Button type="link"/s);
  assert.doesNotMatch(workspaceSource, /onRow=|title:\s*['"]操作['"]/);
  assert.match(workspaceAdministrationSource, /useGetPlatformGroupWorkspaceDetailQuery/);
  assert.match(workspaceAdministrationSource, /contextScopedQueryArgs\(\{\}, \{groupWorkspaceKey\}\)/);
  assert.match(workspaceAdministrationSource, /onClick=\{\(\) => void refetch\(\)\}/);
  assert.doesNotMatch(workspaceAdministrationSource, /platformClient\.|createPlatformGroupWorkspace|updatePlatformGroupWorkspaceDisplay|transitionPlatformGroupWorkspaceStatus/);
});
