#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyPath = "contracts/registry/task-read-surface-policy.json";
const bindingPath = "contracts/registry/operation-handler-bindings.json";
const routeRegistryPaths = ["apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json", "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json"];
const protocolReadExemptions = new Set(["getCurrentPlatformSession", "getOperationsWorkspaceLoginEntry", "getPublicAssetContent", "getPublicInvitationCompletion", "getPublicInvitationView"]);
const contextFactSets = new Map([
  ["OPERATIONS_SCOPED", ["WorkspaceReadAuthorizationFacts", "VisibleOrganizationFacts"]],
  ["PLATFORM_WORKSPACE", ["EnabledSelectedWorkspaceFact", "PlatformReadSessionFacts"]],
  ["PLATFORM_GLOBAL", ["PlatformReadSessionFacts"]],
  ["PLATFORM_AUDIT_BRANCHED", ["PlatformReadSessionFacts"]],
]);
const expectedKinds = new Map([["OPERATIONS_SCOPED", 58], ["PLATFORM_WORKSPACE", 15], ["PLATFORM_GLOBAL", 4], ["PLATFORM_AUDIT_BRANCHED", 1]]);
const componentVocabulary = ["CONTEXT_WORKSPACE_IAM", "CONTEXT_ORGANIZATION", "CONTEXT_PLATFORM_IAM", "CONTEXT_PLATFORM_WORKSPACE", "PRIMARY_QUERY", "OPTIONAL_COUNT", "UNCLASSIFIED"];
const auditEnabledTypes = ["EXTENSION_DEFINITION", "GROUP_WORKSPACE", "STORE_CONTRACT", "WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION", "WORKSPACE_ROLE"];
const catalogInventoryControllerPath = "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java";
const requiredWorkspaceTaskReadCommandAnchors = Object.freeze([
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/context/OperationsWorkspaceUserController.java#groupRevoke",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/context/OperationsWorkspaceUserController.java#regionRevoke",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/context/OperationsWorkspaceUserController.java#projectRevoke",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/context/OperationsWorkspaceUserController.java#headCompanyRevoke",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/context/OperationsWorkspaceUserController.java#storeRevoke",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#groupCreate",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#regionCreate",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#projectCreate",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#headCompanyCreate",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#storeCreate",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#groupCancel",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#regionCancel",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#projectCancel",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#headCompanyCancel",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#storeCancel",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#groupReissue",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#regionReissue",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#projectReissue",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#headCompanyReissue",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java#storeReissue",
]);
const workspaceTaskReadCommandAnchors = [
  ...requiredWorkspaceTaskReadCommandAnchors,
];
const sessionEntryFactSet = ["SessionEntryAuthenticationFacts", "VisibleOrganizationFacts"];
const sessionEntryPolicy = {
  operationId: "getOperationsWorkspaceSessionEntry",
  fact: "SessionEntryAuthenticationFacts",
  controllerSourceInvocation: "reads.sessionEntry(",
  ownerSourceAnchor: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java#sessionEntryAuthenticationFacts",
  requiredOutcomes: ["SELECT_IDENTITY", "PASSWORD_CHANGE_REQUIRED"],
  reason: "session entry is authenticated but may legitimately have no current assignment or require a password change; it must not use active-assignment WRA",
};
const twoOwnerPrimaryProjectionExceptions = new Map([
  ["getWorkspaceAccounts", {
    workspaceIam: "PlatformWorkspaceAccountTaskReadService#page",
    organization: "OrganizationTaskPathLookup#describePersistedTaskPaths",
    reason: "workspace-iam account/assignment/role page projection plus one organization display-path batch; two owner-local projections prevent cross-schema joins and per-account path reads",
  }],
  ["getWorkspaceAccount", {
    workspaceIam: "PlatformWorkspaceAccountTaskReadService#detail",
    organization: "OrganizationTaskPathLookup#describePersistedTaskPaths",
    reason: "workspace-iam account detail projection plus one organization display-path batch; two owner-local projections prevent cross-schema joins and per-assignment path reads",
  }],
  ["getWorkspaceInvitations", {
    workspaceIam: "PlatformWorkspaceInvitationTaskReadService#page",
    organization: "OrganizationTaskPathLookup#describePersistedTaskPaths",
    reason: "workspace-iam invitation/intents/issuer page projection plus one organization display-path batch; two owner-local projections prevent cross-schema joins and per-invitation path reads",
  }],
  ["getWorkspaceInvitation", {
    workspaceIam: "PlatformWorkspaceInvitationTaskReadService#detail",
    organization: "OrganizationTaskPathLookup#describePersistedTaskPaths",
    reason: "workspace-iam invitation detail/intents projection plus one organization display-path batch; two owner-local projections prevent cross-schema joins and per-intent path reads",
  }],
  ["getWorkspaceInvitationCandidates", {
    workspaceIam: "PlatformInvitationCandidatesTaskReadService#candidates",
    organizationAlternatives: [
      {when: "subjectType=ORGANIZATION", boundary: "OrganizationAssignmentCandidateLookup#platformInvitationCandidates", logicalStatementCap: 1},
      {when: "subjectType=ROLE", boundary: "OrganizationAssignmentCandidateLookup#requireEnabledInvitationTarget", logicalStatementCap: 1},
    ],
    reason: "workspace-iam candidate-reference projection plus one organization platform-invitation-candidate batch; two owner-local projections prevent cross-schema joins and per-candidate lookup",
  }],
]);
const twoOwnerSourceSpecs = new Map([
  ["getWorkspaceAccounts", {edgeField: "reads", legacyEdgeRead: /\buser\.(?:page|detail)\s*\(/, organizationImplementationAnchor: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java#describePersistedTaskPaths"}],
  ["getWorkspaceAccount", {edgeField: "reads", legacyEdgeRead: /\buser\.(?:page|detail)\s*\(/, organizationImplementationAnchor: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java#describePersistedTaskPaths"}],
  ["getWorkspaceInvitations", {edgeField: "reads", legacyEdgeRead: /\binvitations\.management(?:Page|Invitation)\s*\(/, organizationImplementationAnchor: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java#describePersistedTaskPaths"}],
  ["getWorkspaceInvitation", {edgeField: "reads", legacyEdgeRead: /\binvitations\.management(?:Page|Invitation)\s*\(/, organizationImplementationAnchor: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java#describePersistedTaskPaths"}],
  ["getWorkspaceInvitationCandidates", {edgeField: "candidates", legacyEdgeRead: /\busers\.candidates\s*\(/, organizationImplementationAnchor: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAssignmentCandidateService.java#invitationCandidateRows"}],
]);
const remainingOwnerProjectionExceptions = new Map([
  ["getPlatformContractOverviewDetail", {cap:2, optional:0, branches:[{when:"always", boundaries:[["store-contract","ContractTaskReadService#platformOverviewTaskDetail"],["extension","ExtensionDefinitionService#platformContractManagementDefinition"]]}]}],
  ["getPlatformOrganizationOverviewDetail", {cap:2, optional:0, branches:[{when:"always", boundaries:[["organization","OrganizationOverviewTaskReadService#platformManagementBaseDetail"],["extension","ExtensionDefinitionService#platformManagementDefinition"]]}]}],
  ["getPlatformEntityAuditHistory", {cap:2, optional:0, branches:[{when:"entityType=GROUP_WORKSPACE", boundaries:[["platform-workspace","PlatformWorkspaceAuditHistoryService#readGroupWorkspace"],["organization","OrganizationAuditHistoryService#readInitializationForGroupWorkspace"]]},{when:"entityType=PLATFORM_ADMIN", boundaries:[["platform-iam","PlatformIamAuditHistoryService#readPlatformAdmin"]]},{when:"entityType=WORKSPACE_ROLE|WORKSPACE_ACCOUNT|WORKSPACE_INVITATION", boundaries:[["workspace-iam","WorkspaceIamAuditHistoryService#readPlatformAuditProjection"]]},{when:"entityType=EXTENSION_DEFINITION", boundaries:[["extension","ExtensionAuditHistoryService#readExtensionDefinition"]]},{when:"entityType=STORE_CONTRACT", boundaries:[["store-contract","ContractAuditHistoryService#readStoreContract"]]}]}],
  ["listPlatformGroupWorkspaces", {cap:3, optional:1, branches:[{when:"always", boundaries:[["platform-workspace","WorkspaceAdministrationService#list"],["organization","OrganizationGroupWorkspaceInitializationLookup#listInitializationFacts"],["asset","PlatformAssetService#requireActivePublicReferences"]]}]}],
  ["getPlatformGroupWorkspaceDetail", {cap:4, optional:0, branches:[{when:"always", boundaries:[["platform-workspace","WorkspaceAdministrationService#require"],["organization","OrganizationGroupWorkspaceInitializationLookup#initializationFact"],["asset","PlatformAssetService#requireActivePublicReference"],["workspace-iam","WorkspaceIamSummaryReadService#accountAndRoleSummary"]]}]}],
]);
const remainingExceptionSourceRequirements = new Map([
  ["getPlatformContractOverviewDetail", {readerPath:"apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java", readerMethod:"platformOverviewTaskDetail", typedInput:"UUID workspaceUuid,String groupWorkspaceKey,UUID contractId", typedOutput:"StoreContractView", edgeCall:"reads.platformOverviewTaskDetail(", forbiddenEdgeReads:[{pattern:"\\breads\\s*\\.\\s*view\\s*\\("}], status:"SOURCE_IMPLEMENTED_UNMEASURED"}],
  ["getPlatformOrganizationOverviewDetail", {readerPath:"apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationOverviewTaskReadService.java", readerMethod:"platformManagementBaseDetail", typedInput:"UUID workspaceUuid,String groupWorkspaceKey,String category,UUID itemId", typedOutput:"PlatformManagementBaseDetail", edgeCall:"overview.platformManagementBaseDetail(", forbiddenEdgeReads:[{pattern:"\\boverview\\s*\\.\\s*detail\\s*\\("}], status:"SOURCE_IMPLEMENTED_UNMEASURED"}],
  ["getPlatformEntityAuditHistory", {readerPath:"apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/PlatformAuditHistoryTaskReadService.java", readerMethod:"read", typedInput:"PlatformSessionReadback,PlatformAuditHistoryQuery", typedOutput:"AuditHistoryPage", edgeCall:"reads.read(", forbiddenEdgeReads:[{pattern:"\\bgroupWorkspaceAudit\\s*\\.\\s*readGroupWorkspace\\s*\\("},{pattern:"\\bplatformIamAudit\\s*\\.\\s*read\\s*\\("},{pattern:"\\bworkspaceIamAudit\\s*\\.\\s*read\\s*\\("},{pattern:"\\bextensionAudit\\s*\\.\\s*read\\s*\\("},{pattern:"\\bcontractAudit\\s*\\.\\s*read\\s*\\("}], status:"SOURCE_IMPLEMENTED_UNMEASURED"}],
  ["listPlatformGroupWorkspaces", {readerPath:"apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceAdministrationTaskReadService.java", readerMethod:"page", typedInput:"WorkspaceAdministrationPageRequest", typedOutput:"WorkspaceAdministrationPage", edgeCall:"taskReads.page(", forbiddenEdgeReads:[{pattern:"\\bworkspaces\\s*\\.\\s*list\\s*\\("},{pattern:"\\binitializationFacts\\s*\\.\\s*list\\s*\\(",prospective:true},{pattern:"\\bassets\\s*\\.\\s*requireActivePublicReferences\\s*\\("}], ownerSourceAssertions:[{kind:"FORBID_PATTERNS",anchor:"apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java#list",forbiddenPatterns:[{pattern:"\\borganization\\s*\\.",errorCode:"BP_U05_R5_LIST_ORGANIZATION_SCHEMA_LEAK"},{pattern:"\\bEXISTS\\s*\\(",errorCode:"BP_U05_R5_LIST_EXISTS_DRIFT"}]},{kind:"FORBID_PATTERNS",anchor:"apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationGroupWorkspaceInitializationTaskReadService.java#listInitializationFacts",forbiddenPatterns:[{pattern:"\\bplatform_workspace\\s*\\.",errorCode:"BP_U05_R5_INITIALIZATION_PLATFORM_SCHEMA_LEAK"}]},{kind:"OUTPUT_CONTRACT",sourcePath:"apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationGroupWorkspaceInitializationLookup.java",requiredPattern:"\\b(?:record\\s+InitializationState|Optional\\s*<\\s*CommercialGroupReadback\\s*>)",forbiddenPatterns:[{pattern:"\\b(?:workspaceUuid|workspaceId|groupWorkspaceId|workspaceName|workspaceStatus)\\b",errorCode:"BP_U05_R5_INITIALIZATION_OUTPUT_DRIFT"}]}], status:"SOURCE_IMPLEMENTED_UNMEASURED"}],
  ["getPlatformGroupWorkspaceDetail", {readerPath:"apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceAdministrationTaskReadService.java", readerMethod:"detail", typedInput:"String groupWorkspaceKey", typedOutput:"WorkspaceAdministrationDetail", edgeCall:"taskReads.detail(", forbiddenEdgeReads:[{pattern:"\\bworkspaces\\s*\\.\\s*require\\s*\\("},{pattern:"\\binitializationFacts\\s*\\.\\s*detail\\s*\\("},{pattern:"\\bassets\\s*\\.\\s*requireActivePublicReference\\s*\\("},{pattern:"\\bworkspaces\\s*\\.\\s*accountCount\\s*\\("},{pattern:"\\bworkspaces\\s*\\.\\s*roleCount\\s*\\("}], ownerSourceAssertions:[{kind:"JDBC_STATEMENT_COUNT",anchor:"apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadService.java#accountAndRoleSummary",jdbcPattern:"\\bjdbc\\.(?:query|queryForObject|queryForList|queryForMap|queryForRowSet|queryForStream)\\s*\\(",expectedCount:1,errorCode:"BP_U05_R5_SUMMARY_LOGICAL_CAP_DRIFT",forbiddenPatterns:[{pattern:"\\b(?:this\\s*\\.)?accountCount\\s*\\(",errorCode:"BP_U05_R5_SUMMARY_LEGACY_COUNT_DELEGATION"},{pattern:"\\b(?:this\\s*\\.)?roleCount\\s*\\(",errorCode:"BP_U05_R5_SUMMARY_LEGACY_COUNT_DELEGATION"}]}], status:"SOURCE_IMPLEMENTED_UNMEASURED"}],
]);
const multiOwnerReviewFields = ["userTask", "whyNotMergeable", "cardinalityBound", "reviewDue"];
const operationsAuditTargetTypeSet = [
  '"WORKSPACE_ACCOUNT"',
  '"WORKSPACE_INVITATION"',
  '"COMMERCIAL_GROUP"',
  '"ORGANIZATION_NODE"',
  '"BRAND"',
  '"TENANT"',
  "AuditEntityTypes.HEAD_COMPANY",
  "AuditEntityTypes.STORE",
  '"STORE_CONTRACT"',
];
const operationsAuditSourceRequirement = {
  readerPath: "apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/OperationsAuditTaskReadService.java",
  readerMethod: "read",
  edgeCall: "reads.read(",
  forbiddenEdgeReads: [
    {pattern: "\\bauthorization\\s*\\."},
    {pattern: "\\borganizationOverview\\s*\\.\\s*detail\\s*\\("},
    {pattern: "\\bcontractReads\\s*\\.\\s*view\\s*\\("},
    {pattern: "\\bworkspaceIamAudit\\s*\\."},
    {pattern: "\\borganizationAudit\\s*\\."},
    {pattern: "\\bcontractAudit\\s*\\."},
  ],
  status: "SOURCE_IMPLEMENTED_UNMEASURED",
};

function fail(code, detail = "") { throw new Error(detail ? `${code}:${detail}` : code); }
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }
function sorted(values) { return [...values].sort(); }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function exactSet(actual, expected, code) { if (!equal(sorted(actual), sorted(expected))) fail(code); }

function routeOperations() {
  const seen = new Set();
  const operations = routeRegistryPaths.flatMap((relative) => {
    const value = readJson(relative);
    if (!Array.isArray(value.operations)) fail("BP_U05_READ_BUDGET_ROUTE_REGISTRY_INVALID", relative);
    return value.operations;
  });
  for (const operation of operations) {
    if (!operation.operationId || !operation.method) fail("BP_U05_READ_BUDGET_ROUTE_INVALID");
    if (seen.has(operation.operationId)) fail("BP_U05_READ_BUDGET_OPERATION_DUPLICATE", operation.operationId);
    seen.add(operation.operationId);
  }
  if (operations.length !== 196) fail("BP_U05_READ_BUDGET_ROUTE_DENOMINATOR_DRIFT", String(operations.length));
  return operations;
}

function bindingReadIds() {
  const binding = readJson(bindingPath);
  if (!Array.isArray(binding.operations) || binding.operations.length !== 196) fail("BP_U05_READ_BUDGET_BINDING_DENOMINATOR_DRIFT");
  const reads = binding.operations.filter((row) => row.mode === "READ" && row.contextKind === "READ_CONTEXT");
  if (reads.length !== 83) fail("BP_U05_READ_BUDGET_BINDING_READ_DRIFT", String(reads.length));
  return reads.map((row) => row.operationId);
}

function validateAnchor(anchor) {
  if (typeof anchor !== "string" || !/^[^*{}]+#[A-Za-z_$][\w$]*$/.test(anchor)) fail("BP_U05_READ_BUDGET_SOURCE_ANCHOR_INVALID", String(anchor));
  const [sourcePath, method] = anchor.split("#");
  const absolute = path.join(root, sourcePath);
  if (!fs.existsSync(absolute)) fail("BP_U05_READ_BUDGET_SOURCE_ANCHOR_MISSING", sourcePath);
  if (!new RegExp(`\\b${method}\\s*\\(`).test(fs.readFileSync(absolute, "utf8"))) fail("BP_U05_READ_BUDGET_SOURCE_METHOD_MISSING", anchor);
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function javaMethodBodies(source, method) {
  const declaration = new RegExp(`\\b${escapeRegex(method)}\\s*\\(`, "g");
  const bodies = [];
  for (const match of source.matchAll(declaration)) {
    const prefix = source.slice(Math.max(0, match.index - 12), match.index).trimEnd();
    if (/[.(,=]$/.test(prefix)) continue;
    let cursor = source.indexOf("(", match.index), parentheses = 0, quote = null;
    for (; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (quote) { if (character === "\\") { cursor += 1; continue; } if (character === quote) quote = null; continue; }
      if (character === "\"" || character === "'") { quote = character; continue; }
      if (character === "(") parentheses += 1;
      else if (character === ")" && --parentheses === 0) { cursor += 1; break; }
    }
    const open = source.indexOf("{", cursor);
    if (open >= 0 && /;|->/.test(source.slice(cursor, open))) continue;
    if (open < 0) continue;
    let depth = 0, stringQuote = null, lineComment = false, blockComment = false;
    for (let index = open; index < source.length; index += 1) {
      const character = source[index], next = source[index + 1];
      if (lineComment) { if (character === "\n") lineComment = false; continue; }
      if (blockComment) { if (character === "*" && next === "/") { blockComment = false; index += 1; } continue; }
      if (stringQuote) { if (character === "\\") { index += 1; continue; } if (character === stringQuote) stringQuote = null; continue; }
      if (character === "/" && next === "/") { lineComment = true; index += 1; continue; }
      if (character === "/" && next === "*") { blockComment = true; index += 1; continue; }
      if (character === "\"" || character === "'") { stringQuote = character; continue; }
      if (character === "{") depth += 1;
      if (character === "}" && --depth === 0) { bodies.push(source.slice(match.index, index + 1)); break; }
    }
  }
  return bodies;
}

function sourceFor(relativePath, overrides) { return overrides.get(relativePath) ?? fs.readFileSync(path.join(root, relativePath), "utf8"); }
function anchorSource(anchor, overrides) {
  const [relativePath, method] = anchor.split("#");
  const source = sourceFor(relativePath, overrides);
  const bodies = javaMethodBodies(source, method);
  if (bodies.length === 0) fail("BP_U05_READ_SOURCE_ANCHOR_MISSING", anchor);
  return {relativePath, source, method, bodies};
}
function privateMethodBodies(source, method) {
  const privateDeclaration = new RegExp(`\\bprivate[^\\n;{]*\\b${escapeRegex(method)}\\s*\\(`);
  return privateDeclaration.test(source) ? javaMethodBodies(source, method) : [];
}
function methodClosure(source, method) {
  const seen = new Set(), pending = [{method, anchor: true}], bodies = [];
  while (pending.length > 0) {
    const current = pending.pop();
    if (seen.has(current.method)) continue;
    seen.add(current.method);
    const currentBodies = current.anchor ? javaMethodBodies(source, current.method) : privateMethodBodies(source, current.method);
    for (const body of currentBodies) {
      bodies.push(body);
      for (const call of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
        const called = call[1];
        if (!seen.has(called) && privateMethodBodies(source, called).length > 0) pending.push({method: called, anchor: false});
      }
    }
  }
  return bodies.join("\n");
}
function legacySessionRead(closure) { return /\bsessions\.require(?:Workspace(?:AtContextVersion)?)?\s*\(/.test(closure); }
function readSessionFact(closure) { return /\b(?:sessions\.)?require(?:Workspace)?Read(?:Facts)?(?:AtContextVersion)?\s*\(/.test(closure); }
function count(source, expression) { return [...source.matchAll(expression)].length; }
function validateOperationsSource(row, source, method) {
  const anchoredBody = javaMethodBodies(source, method).join("\n");
  const closure = methodClosure(source, method);
  if (row.sourceAnchor.startsWith(`${catalogInventoryControllerPath}#`) && /\boperationRegistry\.resolve\s*\(|\boperationId\b/.test(anchoredBody)) fail("BP_U05_READ_SOURCE_OPERATION_DISPATCH", row.operationId);
  if (legacySessionRead(closure)) fail("BP_U05_READ_SOURCE_LEGACY_SESSION", row.operationId);
  if (!readSessionFact(closure)) fail("BP_U05_READ_SOURCE_FACT_MISSING", row.operationId);
}
function validatePlatformSource(row, source, method) {
  const closure = methodClosure(source, method);
  if (legacySessionRead(closure)) fail("BP_U05_READ_SOURCE_LEGACY_SESSION", row.operationId);
  if (!/\b(?:sessions\.)?requireRead\s*\(/.test(closure)) fail("BP_U05_READ_SOURCE_FACT_MISSING", row.operationId);
  const selected = /requireEnabledSelectedWorkspace\s*\(/.test(closure);
  if (row.readContextKind === "PLATFORM_WORKSPACE" && !selected) fail("BP_U05_READ_SOURCE_SELECTED_WORKSPACE_MISSING", row.operationId);
  if (row.readContextKind === "PLATFORM_GLOBAL" && selected) fail("BP_U05_READ_SOURCE_SELECTED_WORKSPACE_FORBIDDEN", row.operationId);
}
function validateSessionEntrySource(policy, row, source, method, overrides) {
  if (!equal(sorted(row.requiredFactSet), sorted(sessionEntryFactSet))) fail("BP_U05_SESSION_ENTRY_AUTHENTICATION_POLICY_DRIFT");
  const body = javaMethodBodies(source, method).join("\n");
  if (!body.includes(policy.sessionEntryAuthentication.controllerSourceInvocation)) fail("BP_U05_SESSION_ENTRY_CONTROLLER_SOURCE_MISSING", row.operationId);
  const owner = anchorSource(policy.sessionEntryAuthentication.ownerSourceAnchor, overrides);
  const ownerBody = methodClosure(owner.source, owner.method);
  if (!/\bprivate\s+(?:static\s+)?(?:record\s+)?SessionEntryAuthenticationFacts\b/.test(owner.source)
    || !ownerBody.includes("passwordChangeRequired")
    || !policy.sessionEntryAuthentication.requiredOutcomes.every((outcome) => owner.source.includes(`WorkspaceSessionEntryReadback.Outcome.${outcome}`))) fail("BP_U05_SESSION_ENTRY_OWNER_FACT_SOURCE_MISSING");
}
function validateReadSources(policy, taskRows, overrides = new Map(), commandAnchors = workspaceTaskReadCommandAnchors) {
  for (const row of taskRows) {
    const {source, method} = anchorSource(row.sourceAnchor, overrides);
    if (row.operationId === sessionEntryPolicy.operationId) validateSessionEntrySource(policy, row, source, method, overrides);
    else if (row.readContextKind === "OPERATIONS_SCOPED") validateOperationsSource(row, source, method);
    else if (row.readContextKind === "PLATFORM_AUDIT_BRANCHED") {
      validatePlatformSource(row, source, method);
      validateAudit(row);
    } else validatePlatformSource(row, source, method);
  }
  exactSet(commandAnchors, workspaceTaskReadCommandAnchors, "BP_U05_READ_COMMAND_ANCHOR_SET_DRIFT");
  for (const anchor of commandAnchors) {
    const command = anchorSource(anchor, overrides);
    if (/\breads\.[A-Za-z_$][\w$]*\s*\(/.test(command.bodies.join("\n"))) fail("BP_U05_TASK_READER_COMMAND_USAGE", anchor);
  }
}

function validateTwoOwnerProjectionSources(policy, taskRows, overrides = new Map()) {
  for (const row of taskRows) {
    const expected = twoOwnerPrimaryProjectionExceptions.get(row.operationId);
    if (!expected) continue;
    const spec = twoOwnerSourceSpecs.get(row.operationId);
    if (!spec) fail("BP_U05_TWO_OWNER_SOURCE_SPEC_MISSING", row.operationId);
    const edge = anchorSource(row.sourceAnchor, overrides);
    const workspaceMethod = expected.workspaceIam.slice(expected.workspaceIam.indexOf("#") + 1);
    const edgeClosure = methodClosure(edge.source, edge.method);
    if (!edgeClosure.includes(`${spec.edgeField}.${workspaceMethod}(`) || spec.legacyEdgeRead.test(edgeClosure)) fail("BP_U05_TWO_OWNER_EDGE_TYPED_READER_BYPASS", row.operationId);
    const workspace = anchorSource(row.primaryBoundary, overrides);
    const workspaceBody = workspace.bodies.join("\n");
    const workspaceClosure = methodClosure(workspace.source, workspace.method);
    if (row.operationId === "getWorkspaceInvitationCandidates") {
      if (!/case\s+"ORGANIZATION"\s*->\s*organizations\s*\(/.test(workspaceBody)
        || !/case\s+"ROLE"\s*->\s*roles\s*\(/.test(workspaceBody)) fail("BP_U05_TWO_OWNER_BRANCH_SWITCH_SOURCE_DRIFT", row.operationId);
      if (count(workspaceClosure, /\broles\.platformTaskPage\s*\(/g) !== 1) fail("BP_U05_TWO_OWNER_WORKSPACE_LOGICAL_CAP_DRIFT", row.operationId);
      for (const alternative of expected.organizationAlternatives) {
        const method = alternative.boundary.slice(alternative.boundary.indexOf("#") + 1);
        if (count(workspaceClosure, new RegExp(`\\borganizations\\.${escapeRegex(method)}\\s*\\(`, "g")) !== 1) fail("BP_U05_TWO_OWNER_BRANCH_SWITCH_SOURCE_DRIFT", row.operationId);
      }
      const organization = anchorSource(spec.organizationImplementationAnchor, overrides);
      const organizationBody = organization.bodies.join("\n");
      if (count(organizationBody, /\bcase\b/g) !== 4 || count(organizationBody, /\bjdbc\.query\s*\(/g) !== 4) fail("BP_U05_TWO_OWNER_ORGANIZATION_LOGICAL_CAP_DRIFT", row.operationId);
      continue;
    }
    if (count(workspaceBody, /\bprimary\s*\(\s*\(\s*\)\s*->\s*jdbc\.query\s*\(/g) !== 1) fail("BP_U05_TWO_OWNER_WORKSPACE_LOGICAL_CAP_DRIFT", row.operationId);
    if (count(workspaceClosure, /\bpaths\.describePersistedTaskPaths\s*\(/g) !== 1) fail("BP_U05_TWO_OWNER_ORGANIZATION_LOGICAL_CAP_DRIFT", row.operationId);
    const organization = anchorSource(spec.organizationImplementationAnchor, overrides);
    if (count(organization.bodies.join("\n"), /\bjdbc\.query\s*\(/g) !== 1) fail("BP_U05_TWO_OWNER_ORGANIZATION_LOGICAL_CAP_DRIFT", row.operationId);
  }
}

function validateSchema(policy) {
  const schema = policy.readBudgetComponentSchema;
  if (!schema || !equal(schema.closedVocabulary, componentVocabulary) || schema.requestTotalRule !== "component totals equal request databaseOperationCount" || schema.unclassifiedMustEqual !== 0 || schema.capBasis !== "LOGICAL_STATEMENT") fail("BP_U05_READ_BUDGET_COMPONENT_SCHEMA_DRIFT");
}

function validateAudit(row) {
  const value = row.conditionalFact;
  if (row.optionalCountCap !== 0 || row.optionalCountCapBasis !== "BRANCH_CAPS" || !value || value.fact !== "EnabledSelectedWorkspaceFact" || !equal(sorted(value.requiredWhenEntityType ?? []), auditEnabledTypes) || !equal(value.absentWhenEntityType, ["PLATFORM_ADMIN"]) || !Array.isArray(value.branchCaps) || value.branchCaps.length !== 2) fail("BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT");
  const enabled = value.branchCaps.find((branch) => equal(sorted(branch.entityTypes ?? []), auditEnabledTypes));
  const platformAdmin = value.branchCaps.find((branch) => equal(branch.entityTypes, ["PLATFORM_ADMIN"]));
  if (!enabled || !platformAdmin || enabled.optionalCountCap !== 0 || platformAdmin.optionalCountCap !== 1) fail("BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT");
}

function validateSessionEntryPolicy(policy) {
  if (!equal(policy.sessionEntryAuthentication, sessionEntryPolicy)) fail("BP_U05_SESSION_ENTRY_AUTHENTICATION_POLICY_DRIFT");
}

function validateTwoOwnerPrimaryProjectionExceptions(policy, taskRows) {
  const exception = policy.twoOwnerPrimaryProjectionExceptions;
  const expectedIds = [...twoOwnerPrimaryProjectionExceptions.keys()];
  if (!exception
    || exception.decisionPath !== "doc/decisions/2026-08-09-v2s-backend-performance-phase4-read-budget-rebaseline.md"
    || !equal(sorted(exception.operationIds ?? []), sorted(expectedIds))
    || exception.maxPrimaryQueryCap !== 2
    || exception.nonExceptionPrimaryQueryCap !== 1
    || exception.implementationStatus !== "SOURCE_IMPLEMENTED_UNMEASURED") fail("BP_U05_TWO_OWNER_EXCEPTION_SCHEMA_DRIFT");
  for (const row of taskRows) {
    const expected = twoOwnerPrimaryProjectionExceptions.get(row.operationId);
    if (!expected) {
      if (remainingOwnerProjectionExceptions.has(row.operationId)) continue;
      if (row.primaryQueryCap !== exception.nonExceptionPrimaryQueryCap || Object.hasOwn(row, "primaryOwnerBoundaries") || Object.hasOwn(row, "primaryQueryCapReason") || Object.hasOwn(row, "twoOwnerProjectionStatus")) fail("BP_U05_TWO_OWNER_CAP_EXCEPTION_DRIFT", row.operationId);
      continue;
    }
    const organizationBoundary = expected.organizationAlternatives
      ? {owner: "organization", alternativeBoundaries: expected.organizationAlternatives, selectionInvariant: "exactly one organization boundary is selected by subjectType"}
      : {owner: "organization", boundary: expected.organization, logicalStatementCap: 1};
    const boundaries = [{owner: "workspace-iam", boundary: expected.workspaceIam, logicalStatementCap: 1}, organizationBoundary];
    if (row.primaryQueryCap !== exception.maxPrimaryQueryCap || row.optionalCountCap !== 0 || row.declaredExtrasCap !== 0) fail("BP_U05_TWO_OWNER_CAP_EXCEPTION_DRIFT", row.operationId);
    if (!equal(row.primaryOwnerBoundaries, boundaries)) {
      if (!Array.isArray(row.primaryOwnerBoundaries) || row.primaryOwnerBoundaries.length !== 2) fail("BP_U05_TWO_OWNER_BOUNDARY_MISSING", row.operationId);
      const [workspaceBoundary, organizationBoundary] = row.primaryOwnerBoundaries;
      if (workspaceBoundary?.logicalStatementCap !== 1) fail("BP_U05_TWO_OWNER_BOUNDARY_LOGICAL_CAP_DRIFT", row.operationId);
      if (expected.organizationAlternatives) {
        if (!equal(organizationBoundary?.alternativeBoundaries, expected.organizationAlternatives)
          || organizationBoundary?.selectionInvariant !== "exactly one organization boundary is selected by subjectType") fail("BP_U05_TWO_OWNER_BRANCH_SWITCH_DRIFT", row.operationId);
      } else if (organizationBoundary?.logicalStatementCap !== 1) fail("BP_U05_TWO_OWNER_BOUNDARY_LOGICAL_CAP_DRIFT", row.operationId);
      fail("BP_U05_TWO_OWNER_BOUNDARY_MISSING", row.operationId);
    }
    if (row.primaryQueryCapReason !== expected.reason || row.twoOwnerProjectionStatus !== exception.implementationStatus) fail("BP_U05_TWO_OWNER_EXCEPTION_SCHEMA_DRIFT", row.operationId);
  }
}

function expectedRemainingBranches(value) {
  return value.branches.map((branch) => ({when: branch.when, boundaries: branch.boundaries.map(([owner, boundary]) => ({owner, boundary, logicalStatementCap: 1}))}));
}

function validateRemainingOwnerProjectionExceptions(policy, taskRows) {
  const schema = policy.remainingOwnerProjectionExceptions;
  const expectedIds = [...remainingOwnerProjectionExceptions.keys()];
  if (!schema || schema.decisionPath !== "doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md"
    || schema.maxMultiOwnerExceptionCount !== 10
    || schema.implementationStatus !== "SOURCE_IMPLEMENTED_UNMEASURED"
    || !Array.isArray(schema.exceptions) || !equal(sorted(schema.exceptions.map((value) => value.operationId)), sorted(expectedIds))) fail("BP_U05_REMAINING_EXCEPTION_SCHEMA_DRIFT");
  for (const row of taskRows) {
    const expected = remainingOwnerProjectionExceptions.get(row.operationId);
    if (!expected) {
      if (row.operationId === "getOperationsEntityAuditHistory") {
        if (row.primaryQueryCap !== 1 || row.futureAuthorizationProjection !== "AuditTargetAuthorizationProjection") fail("BP_U05_OPERATIONS_AUDIT_AUTHORIZATION_PROJECTION_DRIFT");
      } else if (Object.hasOwn(row, "remainingOwnerProjectionException") || Object.hasOwn(row, "remainingOwnerProjectionStatus") || Object.hasOwn(row, "futureAuthorizationProjection")) fail("BP_U05_REMAINING_EXCEPTION_CAP_DRIFT", row.operationId);
      continue;
    }
    const entry = schema.exceptions.find((value) => value.operationId === row.operationId);
    if (row.primaryQueryCap !== expected.cap || row.optionalCountCap !== expected.optional) fail("BP_U05_REMAINING_EXCEPTION_CAP_DRIFT", row.operationId);
    if (row.remainingOwnerProjectionException !== row.operationId || row.remainingOwnerProjectionStatus !== schema.implementationStatus) fail("BP_U05_REMAINING_EXCEPTION_SCHEMA_DRIFT", row.operationId);
    if (!entry || entry.primaryQueryCap !== expected.cap || entry.optionalCountCap !== expected.optional) fail("BP_U05_REMAINING_EXCEPTION_CAP_DRIFT", row.operationId);
    const expectedSourceRequirement = remainingExceptionSourceRequirements.get(row.operationId);
    if (entry.sourceRequirement?.readerPath !== expectedSourceRequirement.readerPath) fail("BP_U05_FUTURE_READER_PATH_DRIFT", row.operationId);
    if (!equal(entry.sourceRequirement?.forbiddenEdgeReads, expectedSourceRequirement.forbiddenEdgeReads)) fail("BP_U05_FUTURE_READER_FORBIDDEN_EDGE_SCHEMA_DRIFT", row.operationId);
    if (!equal(entry.sourceRequirement, expectedSourceRequirement)) fail("BP_U05_REMAINING_EXCEPTION_SOURCE_REQUIREMENT_DRIFT", row.operationId);
    for (const branch of entry.branches) {
      if (!branch.boundaries.length || branch.boundaries.length > expected.cap || branch.boundaries.some((boundary) => boundary.logicalStatementCap !== 1)) fail("BP_U05_REMAINING_EXCEPTION_LOGICAL_CAP_DRIFT", row.operationId);
    }
    if (!equal(entry.branches, expectedRemainingBranches(expected))) fail("BP_U05_REMAINING_EXCEPTION_BOUNDARY_OR_BRANCH_DRIFT", row.operationId);
  }
  const multiOwnerRows = taskRows.filter((row) => row.primaryQueryCap > 1);
  if (multiOwnerRows.length > schema.maxMultiOwnerExceptionCount) fail("BP_U05_MULTI_OWNER_EXCEPTION_LIMIT_EXCEEDED");
  if (multiOwnerRows.length !== schema.maxMultiOwnerExceptionCount) fail("BP_U05_MULTI_OWNER_EXCEPTION_EXACT_SET_DRIFT");
  if (multiOwnerRows.some((row) => multiOwnerReviewFields.some((field) => typeof row[field] !== "string" || row[field].trim().length === 0))) fail("BP_U05_MULTI_OWNER_REVIEW_METADATA_MISSING");
}

function validateOperationsAuditTargetTypeSet(policy, overrides = new Map()) {
  const row = policy.rows.find((value) => value.operationId === "getOperationsEntityAuditHistory");
  if (!row) fail("BP_U05_OPERATIONS_AUDIT_TARGET_TYPE_SET_DRIFT");
  const audit = anchorSource(row.sourceAnchor, overrides);
  const labels = [];
  for (const match of audit.bodies.join("\n").matchAll(/\bcase\s+([^\n]+?)\s*->/g)) {
    labels.push(...match[1].split(",").map((value) => value.trim()));
  }
  if (labels.length !== operationsAuditTargetTypeSet.length || !equal(sorted(labels), sorted(operationsAuditTargetTypeSet))) fail("BP_U05_OPERATIONS_AUDIT_TARGET_TYPE_SET_DRIFT");
}

function validateOperationsAuditReaderAdmission(policy, overrides = new Map()) {
  const row = policy.rows.find((value) => value.operationId === "getOperationsEntityAuditHistory");
  if (!row || !equal(row.operationsAuditSourceRequirement, operationsAuditSourceRequirement)
    || row.primaryReader !== "TASK_READER"
    || row.primaryBoundary !== `${operationsAuditSourceRequirement.readerPath}#${operationsAuditSourceRequirement.readerMethod}`) {
    fail("BP_U05_OPERATIONS_AUDIT_READER_ADMISSION_DRIFT");
  }
  const reader = sourceFor(operationsAuditSourceRequirement.readerPath, overrides);
  if (javaMethodBodies(reader, operationsAuditSourceRequirement.readerMethod).length === 0) fail("BP_U05_OPERATIONS_AUDIT_READER_SOURCE_MISSING");
  const edge = anchorSource(row.sourceAnchor, overrides);
  const closure = methodClosure(edge.source, edge.method);
  if (!closure.includes(operationsAuditSourceRequirement.edgeCall)) fail("BP_U05_OPERATIONS_AUDIT_EDGE_CALL_MISSING");
  if (operationsAuditSourceRequirement.forbiddenEdgeReads.some((rule) => new RegExp(rule.pattern).test(closure))) fail("BP_U05_OPERATIONS_AUDIT_EDGE_TYPED_READER_BYPASS");
}

function validateCompletedRemainingSources(policy, overrides = new Map()) {
  const row = policy.rows.find((value) => value.operationId === "getPlatformContractOverviewDetail");
  const edge = anchorSource(row.sourceAnchor, overrides);
  const closure = methodClosure(edge.source, edge.method);
  if (!closure.includes("reads.platformOverviewTaskDetail(")
    || !closure.includes("definitions.platformContractManagementDefinition(")
    || closure.includes("definitions.requireDefinition(")) fail("BP_U05_CONTRACT_DEFINITION_SOURCE_DRIFT");
}

function validateFutureReaderAdmission(policy, overrides = new Map()) {
  for (const entry of policy.remainingOwnerProjectionExceptions.exceptions) {
    const requirement = entry.sourceRequirement;
    if (requirement.status !== "SOURCE_IMPLEMENTED_UNMEASURED") continue;
    if (!overrides.has(requirement.readerPath) && !fs.existsSync(path.join(root, requirement.readerPath))) fail("BP_U05_FUTURE_READER_SOURCE_MISSING", entry.operationId);
    const readerSource = sourceFor(requirement.readerPath, overrides);
    if (javaMethodBodies(readerSource, requirement.readerMethod).length === 0) fail("BP_U05_FUTURE_READER_SOURCE_METHOD_MISSING", entry.operationId);
    const row = policy.rows.find((value) => value.operationId === entry.operationId);
    const edge = anchorSource(row.sourceAnchor, overrides);
    if (!methodClosure(edge.source, edge.method).includes(requirement.edgeCall)) fail("BP_U05_FUTURE_READER_EDGE_CALL_MISSING", entry.operationId);
    if (requirement.forbiddenEdgeReads.some((rule) => new RegExp(rule.pattern).test(methodClosure(edge.source, edge.method))) ) fail("BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ", entry.operationId);
    if (row.primaryReader !== "TASK_READER" || row.primaryBoundary !== `${requirement.readerPath}#${requirement.readerMethod}`) fail("BP_U05_FUTURE_READER_ADMISSION_STATE_DRIFT", entry.operationId);
  }
}

function validateFutureReaderForbiddenEdgeLiveness(policy, overrides = new Map()) {
  for (const entry of policy.remainingOwnerProjectionExceptions.exceptions) {
    const requirement = entry.sourceRequirement;
    if (requirement.status !== "SOURCE_NOT_IMPLEMENTED_BLOCKED") continue;
    const row = policy.rows.find((value) => value.operationId === entry.operationId);
    const edge = anchorSource(row.sourceAnchor, overrides);
    const closure = methodClosure(edge.source, edge.method);
    if (requirement.forbiddenEdgeReads.filter((rule) => rule.prospective !== true).some((rule) => !new RegExp(rule.pattern).test(closure))) fail("BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ_NOT_LIVE", entry.operationId);
  }
}

function validateFutureReaderOwnerSourceAssertions(policy, overrides = new Map()) {
  for (const entry of policy.remainingOwnerProjectionExceptions.exceptions) {
    const requirement = entry.sourceRequirement;
    if (requirement.status !== "SOURCE_IMPLEMENTED_UNMEASURED") continue;
    for (const assertion of requirement.ownerSourceAssertions ?? []) {
      if (assertion.kind === "FORBID_PATTERNS") {
        const source = anchorSource(assertion.anchor, overrides);
        const closure = methodClosure(source.source, source.method);
        for (const rule of assertion.forbiddenPatterns) if (new RegExp(rule.pattern).test(closure)) fail(rule.errorCode, entry.operationId);
        continue;
      }
      if (assertion.kind === "JDBC_STATEMENT_COUNT") {
        const source = anchorSource(assertion.anchor, overrides);
        const closure = methodClosure(source.source, source.method);
        for (const rule of assertion.forbiddenPatterns) if (new RegExp(rule.pattern).test(closure)) fail(rule.errorCode, entry.operationId);
        if (count(closure, new RegExp(assertion.jdbcPattern, "g")) !== assertion.expectedCount) fail(assertion.errorCode, entry.operationId);
        continue;
      }
      if (assertion.kind === "OUTPUT_CONTRACT") {
        const source = sourceFor(assertion.sourcePath, overrides);
        if (!new RegExp(assertion.requiredPattern).test(source)) fail("BP_U05_R5_INITIALIZATION_OUTPUT_DRIFT", entry.operationId);
        for (const rule of assertion.forbiddenPatterns) if (new RegExp(rule.pattern).test(source)) fail(rule.errorCode, entry.operationId);
        continue;
      }
      fail("BP_U05_R5_OWNER_ASSERTION_SCHEMA_DRIFT", entry.operationId);
    }
  }
}

function validatePrimaryReaders(policy, taskRows, overrides = new Map()) {
  const schema = policy.primaryReaderSchema;
  if (!schema
    || !equal(schema.closedPrimaryReaderKinds, ["TASK_READER", "NOT_YET_TASK_READER"])
    || !equal(schema.taskReaderApis, [
      {api: "CatalogInventoryCoordinator", sourcePath: "apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java", edgeFields: ["application"]},
      {api: "WorkspaceTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceTaskReadService.java", edgeFields: ["reads"]},
      {api: "OperationsOrganizationTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OperationsOrganizationTaskReadService.java", edgeFields: ["reads"]},
      {api: "StoreCandidateTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java", edgeFields: ["candidates", "storeCandidates"]},
      {api: "ContractTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java", edgeFields: ["contracts", "reads"]},
      {api: "ExtensionDefinitionService", sourcePath: "apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java", edgeFields: ["definitions"]},
      {api: "WorkspaceRoleService", sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java", edgeFields: ["roles"]},
      {api: "PlatformAuthenticationService", sourcePath: "apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application/PlatformAuthenticationService.java", edgeFields: ["service"]},
      {api: "PlatformWorkspaceAccountTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformWorkspaceAccountTaskReadService.java", edgeFields: ["reads"]},
      {api: "PlatformWorkspaceInvitationTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformWorkspaceInvitationTaskReadService.java", edgeFields: ["reads"]},
      {api: "PlatformInvitationCandidatesTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformInvitationCandidatesTaskReadService.java", edgeFields: ["candidates"]},
      {api: "PlatformWorkspaceAdministrationTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceAdministrationTaskReadService.java", edgeFields: ["taskReads"]},
      {api: "OrganizationOverviewTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationOverviewTaskReadService.java", edgeFields: ["overview"]},
      {api: "OperationsAuditTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/OperationsAuditTaskReadService.java", edgeFields: ["reads"]},
      {api: "PlatformAuditHistoryTaskReadService", sourcePath: "apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/PlatformAuditHistoryTaskReadService.java", edgeFields: ["reads"]},
    ])
    || schema.blockedBoundary !== "UNCLASSIFIED_BLOCKED"
    || schema.completionStatus !== "BLOCKED_UNMEASURED"
    || schema.completedOperationCount !== 78
    || schema.blockedOperationCount !== 0) fail("BP_U05_PRIMARY_READER_SCHEMA_DRIFT");
  const completed = [], blocked = [];
  for (const row of taskRows) {
    if (!Object.hasOwn(row, "primaryReader") || !Object.hasOwn(row, "primaryBoundary") || typeof row.primaryBoundary !== "string") fail("BP_U05_PRIMARY_READER_BOUNDARY_MISSING", row.operationId);
    if (!schema.closedPrimaryReaderKinds.includes(row.primaryReader)) fail("BP_U05_PRIMARY_READER_KIND_INVALID", row.operationId);
    if (row.primaryReader === "NOT_YET_TASK_READER") {
      if (row.primaryBoundary !== schema.blockedBoundary) fail("BP_U05_PRIMARY_READER_BOUNDARY_INVALID", row.operationId);
      blocked.push(row);
      continue;
    }
    const readerApi = schema.taskReaderApis.find((candidate) => row.primaryBoundary.startsWith(`${candidate.sourcePath}#`));
    if (!readerApi) fail("BP_U05_PRIMARY_READER_BOUNDARY_INVALID", row.operationId);
    validateAnchor(row.primaryBoundary);
    const readerMethod = row.primaryBoundary.slice(`${readerApi.sourcePath}#`.length);
    const edge = anchorSource(row.sourceAnchor, overrides);
    if (!readerApi.edgeFields.some((field) => methodClosure(edge.source, edge.method).includes(`${field}.${readerMethod}(`))) fail("BP_U05_PRIMARY_READER_SOURCE_MISMATCH", row.operationId);
    completed.push(row);
  }
  if (completed.length !== schema.completedOperationCount || blocked.length !== schema.blockedOperationCount || completed.length + blocked.length !== taskRows.length) fail("BP_U05_PRIMARY_READER_PARTITION_DRIFT", `${completed.length}/${blocked.length}`);
  const catalogReaderPath = schema.taskReaderApis[0].sourcePath;
  const catalogCompleted = completed.filter((row) => row.primaryBoundary.startsWith(`${catalogReaderPath}#`));
  if (catalogCompleted.length !== 16 || new Set(catalogCompleted.map((row) => row.sourceAnchor)).size !== 16) fail("BP_U05_PRIMARY_READER_SOURCE_ANCHOR_DRIFT");
}

function validate(policy, overrides = new Map()) {
  if (policy?.schemaVersion !== 1 || policy.kind !== "task-read-surface-policy") fail("BP_U05_READ_BUDGET_POLICY_IDENTITY_INVALID");
  if (!equal(policy.exactSet, {getOperations: 83, taskReads: 78, protocolReadExemptions: 5})) fail("BP_U05_READ_BUDGET_EXACT_SET_DECLARATION_DRIFT");
  validateSchema(policy);
  validateSessionEntryPolicy(policy);
  if (!Array.isArray(policy.rows) || policy.rows.length !== 83) fail("BP_U05_READ_BUDGET_ROW_DENOMINATOR_DRIFT");
  const getIds = routeOperations().filter((operation) => operation.method === "GET").map((operation) => operation.operationId);
  if (getIds.length !== 83) fail("BP_U05_READ_BUDGET_GET_DENOMINATOR_DRIFT", String(getIds.length));
  exactSet(bindingReadIds(), getIds, "BP_U05_READ_BUDGET_BINDING_ROUTE_SET_DRIFT");
  const rowById = new Map();
  for (const row of policy.rows) {
    if (!row?.operationId || rowById.has(row.operationId)) fail("BP_U05_READ_BUDGET_OPERATION_DUPLICATE", row?.operationId ?? "missing");
    rowById.set(row.operationId, row);
  }
  exactSet([...rowById.keys()], getIds, "BP_U05_READ_BUDGET_ROUTE_POLICY_SET_DRIFT");
  const taskRows = policy.rows.filter((row) => row.disposition === "TASK_READ");
  const exemptRows = policy.rows.filter((row) => row.disposition === "PROTOCOL_READ_EXEMPT");
  if (taskRows.length !== 78 || exemptRows.length !== 5 || taskRows.length + exemptRows.length !== policy.rows.length) fail("BP_U05_READ_BUDGET_DISPOSITION_DRIFT");
  exactSet(exemptRows.map((row) => row.operationId), protocolReadExemptions, "BP_U05_READ_BUDGET_PROTOCOL_EXEMPT_SET_DRIFT");
  exactSet(taskRows.map((row) => row.operationId), getIds.filter((id) => !protocolReadExemptions.has(id)), "BP_U05_READ_BUDGET_TASK_READ_SET_DRIFT");
  for (const row of exemptRows) {
    if (typeof row.reason !== "string" || row.reason.length === 0 || row.completionDatabaseEvidence !== "REQUIRED_NO_BUDGET") fail("BP_U05_READ_BUDGET_PROTOCOL_ROW_INVALID", row.operationId);
    for (const field of ["readContextKind", "requiredFactSet", "primaryQueryCap", "optionalCountCap", "declaredExtrasCap", "sourceAnchor", "normalFixture"]) if (Object.hasOwn(row, field)) fail("BP_U05_READ_BUDGET_PROTOCOL_CONTAMINATION", `${row.operationId}:${field}`);
  }
  const kindCounts = new Map();
  for (const row of taskRows) {
    if (!contextFactSets.has(row.readContextKind)) fail("BP_U05_READ_BUDGET_CONTEXT_KIND_INVALID", row.operationId);
    kindCounts.set(row.readContextKind, (kindCounts.get(row.readContextKind) ?? 0) + 1);
    const requiredFacts = row.operationId === sessionEntryPolicy.operationId ? sessionEntryFactSet : contextFactSets.get(row.readContextKind);
    if (!equal(sorted(row.requiredFactSet), sorted(requiredFacts)) || row.declaredExtrasCap !== 0) fail("BP_U05_READ_BUDGET_CONTEXT_CONTRACT_DRIFT", row.operationId);
    if (!Number.isInteger(row.optionalCountCap) || row.optionalCountCap < 0 || row.optionalCountCap > 1) fail("BP_U05_READ_BUDGET_CAP_OVERFLOW", row.operationId);
    if (typeof row.normalFixture !== "string" || row.normalFixture !== `PERF-READ-V1:${row.operationId}:NORMAL_SUCCESS` || typeof row.fixtureInvariant !== "string" || row.fixtureInvariant.length === 0) fail("BP_U05_READ_BUDGET_FIXTURE_DRIFT", row.operationId);
    validateAnchor(row.sourceAnchor);
    if (row.readContextKind === "PLATFORM_AUDIT_BRANCHED") validateAudit(row);
    else if (Object.hasOwn(row, "conditionalFact") || Object.hasOwn(row, "optionalCountCapBasis")) fail("BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT", row.operationId);
  }
  for (const [kind, count] of expectedKinds) if ((kindCounts.get(kind) ?? 0) !== count) fail("BP_U05_READ_BUDGET_CONTEXT_PARTITION_DRIFT", `${kind}:${kindCounts.get(kind) ?? 0}`);
  if (kindCounts.size !== expectedKinds.size) fail("BP_U05_READ_BUDGET_CONTEXT_PARTITION_DRIFT");
  validateRemainingOwnerProjectionExceptions(policy, taskRows);
  validateTwoOwnerPrimaryProjectionExceptions(policy, taskRows);
  validateTwoOwnerProjectionSources(policy, taskRows, overrides);
  validatePrimaryReaders(policy, taskRows, overrides);
  validateReadSources(policy, taskRows, overrides);
  validateCompletedRemainingSources(policy, overrides);
  validateFutureReaderAdmission(policy, overrides);
  validateFutureReaderForbiddenEdgeLiveness(policy, overrides);
  validateFutureReaderOwnerSourceAssertions(policy, overrides);
  validateOperationsAuditTargetTypeSet(policy, overrides);
  validateOperationsAuditReaderAdmission(policy, overrides);
}

function withScratch(mutator, expectedCode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-u05-read-budget-"));
  const temp = path.join(dir, "policy.json");
  try {
    const value = structuredClone(readJson(policyPath)); mutator(value); fs.writeFileSync(temp, JSON.stringify(value));
    try { validate(JSON.parse(fs.readFileSync(temp, "utf8"))); fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode); }
    catch (error) { if (String(error.message).split(":", 1)[0] !== expectedCode) throw error; }
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}

function sourceMutation(policy, operationId, mutator, expectedCode) {
  const row = policy.rows.find((candidate) => candidate.operationId === operationId);
  if (!row) fail("BP_U05_READ_BUDGET_SELF_TEST_OPERATION_MISSING", operationId);
  const [relativePath] = row.sourceAnchor.split("#");
  const original = sourceFor(relativePath, new Map());
  const mutated = mutator(original);
  if (mutated === original) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", operationId);
  try {
    validateReadSources(policy, policy.rows.filter((candidate) => candidate.disposition === "TASK_READ"), new Map([[relativePath, mutated]]));
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function twoOwnerSourceMutation(policy, relativePath, mutator, expectedCode) {
  const original = sourceFor(relativePath, new Map());
  const mutated = mutator(original);
  if (mutated === original) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", relativePath);
  try {
    validateTwoOwnerProjectionSources(policy, policy.rows.filter((row) => row.disposition === "TASK_READ"), new Map([[relativePath, mutated]]));
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function completedRemainingSourceMutation(policy, mutator, expectedCode) {
  const row = policy.rows.find((value) => value.operationId === "getPlatformContractOverviewDetail");
  const [relativePath] = row.sourceAnchor.split("#");
  const original = sourceFor(relativePath, new Map());
  const mutated = mutator(original);
  if (mutated === original) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", row.operationId);
  try {
    validateCompletedRemainingSources(policy, new Map([[relativePath, mutated]]));
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function operationsAuditSourceMutation(policy, mutator, expectedCode) {
  const row = policy.rows.find((value) => value.operationId === "getOperationsEntityAuditHistory");
  const [relativePath] = row.sourceAnchor.split("#");
  const original = sourceFor(relativePath, new Map());
  const mutated = mutator(original);
  if (mutated === original) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", row.operationId);
  try {
    validateOperationsAuditTargetTypeSet(policy, new Map([[relativePath, mutated]]));
    validateOperationsAuditReaderAdmission(policy, new Map([[relativePath, mutated]]));
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function futureReaderAdmissionMutation(policy, operationId, requirementMutator, sourceOverrides, expectedCode) {
  const value = structuredClone(policy);
  const entry = value.remainingOwnerProjectionExceptions.exceptions.find((candidate) => candidate.operationId === operationId);
  if (!entry) fail("BP_U05_READ_BUDGET_SELF_TEST_OPERATION_MISSING", operationId);
  requirementMutator(entry.sourceRequirement, value.rows.find((candidate) => candidate.operationId === operationId));
  try {
    validateFutureReaderAdmission(value, sourceOverrides);
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function futureReaderEdgeSourceMutation(policy, operationId, mutator, expectedCode) {
  const row = policy.rows.find((candidate) => candidate.operationId === operationId);
  if (!row) fail("BP_U05_READ_BUDGET_SELF_TEST_OPERATION_MISSING", operationId);
  const [relativePath] = row.sourceAnchor.split("#");
  const original = sourceFor(relativePath, new Map());
  const mutated = mutator(original);
  if (mutated === original) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", operationId);
  try {
    validateFutureReaderAdmission(policy, new Map([[relativePath, mutated]]));
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function futureReaderForbiddenLivenessSourceMutation(policy, operationId, mutator, expectedCode) {
  const row = policy.rows.find((candidate) => candidate.operationId === operationId);
  if (!row) fail("BP_U05_READ_BUDGET_SELF_TEST_OPERATION_MISSING", operationId);
  const [relativePath] = row.sourceAnchor.split("#");
  const original = sourceFor(relativePath, new Map());
  const mutated = mutator(original);
  if (mutated === original) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", operationId);
  try {
    validateFutureReaderForbiddenEdgeLiveness(policy, new Map([[relativePath, mutated]]));
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function futureReaderOwnerSourceAssertionMutation(policy, operationId, relativePath, mutator, expectedCode) {
  const value = structuredClone(policy);
  const entry = value.remainingOwnerProjectionExceptions.exceptions.find((candidate) => candidate.operationId === operationId);
  if (!entry) fail("BP_U05_READ_BUDGET_SELF_TEST_OPERATION_MISSING", operationId);
  entry.sourceRequirement.status = "SOURCE_IMPLEMENTED_UNMEASURED";
  const sources = new Map([
    ["apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java", "final class WorkspaceAdministrationService { Object list() { return jdbc.query(\"SELECT 1 FROM platform_workspace.group_workspace\"); } }"],
    ["apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationGroupWorkspaceInitializationTaskReadService.java", "final class OrganizationGroupWorkspaceInitializationTaskReadService { Object listInitializationFacts() { return jdbc.query(\"SELECT 1 FROM organization.commercial_group\"); } }"],
    ["apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationGroupWorkspaceInitializationLookup.java", "interface OrganizationGroupWorkspaceInitializationLookup { record InitializationState(String groupWorkspaceKey, boolean commercialGroupInitialized) {} Optional<CommercialGroupReadback> initializationFact(String key) { return Optional.empty(); } }"],
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadService.java", "final class WorkspaceIamSummaryReadService { Object accountAndRoleSummary() { return jdbc.query(\"SELECT 1\"); } }"],
  ]);
  const original = sources.get(relativePath);
  const mutated = mutator(original);
  if (!original || mutated === original) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", relativePath);
  sources.set(relativePath, mutated);
  try {
    validateFutureReaderOwnerSourceAssertions(value, sources);
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", expectedCode);
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== expectedCode) throw error;
  }
}

function selfTest() {
  validate(readJson(policyPath));
  withScratch((value) => value.rows.pop(), "BP_U05_READ_BUDGET_ROW_DENOMINATOR_DRIFT");
  withScratch((value) => value.rows.push(structuredClone(value.rows[0])), "BP_U05_READ_BUDGET_ROW_DENOMINATOR_DRIFT");
  withScratch((value) => { const row = value.rows.find((candidate) => candidate.operationId === "getOperationsWorkspaceLoginEntry"); Object.assign(row, {disposition: "TASK_READ", readContextKind: "OPERATIONS_SCOPED", requiredFactSet: ["WorkspaceReadAuthorizationFacts", "VisibleOrganizationFacts"], primaryQueryCap: 1, optionalCountCap: 0, declaredExtrasCap: 0, sourceAnchor: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsCatalogAuthenticationController.java#entry", normalFixture: "PERF-READ-V1:getOperationsWorkspaceLoginEntry:NORMAL_SUCCESS", fixtureInvariant: "normal detail/context/list fixture must satisfy one-primary-query policy"}); }, "BP_U05_READ_BUDGET_DISPOSITION_DRIFT");
  withScratch((value) => value.rows.find((row) => row.readContextKind === "PLATFORM_GLOBAL").readContextKind = "PLATFORM_WORKSPACE", "BP_U05_READ_BUDGET_CONTEXT_CONTRACT_DRIFT");
  withScratch((value) => value.readBudgetComponentSchema.closedVocabulary.push("ESCAPED_COMPONENT"), "BP_U05_READ_BUDGET_COMPONENT_SCHEMA_DRIFT");
  withScratch((value) => value.readBudgetComponentSchema.capBasis = "DATABASE_OPERATION", "BP_U05_READ_BUDGET_COMPONENT_SCHEMA_DRIFT");
  withScratch((value) => value.rows.find((row) => row.readContextKind === "OPERATIONS_SCOPED").primaryQueryCap = 2, "BP_U05_MULTI_OWNER_EXCEPTION_LIMIT_EXCEEDED");
  withScratch((value) => value.rows.find((row) => row.operationId === "getWorkspaceRole").primaryQueryCap = 2, "BP_U05_MULTI_OWNER_EXCEPTION_LIMIT_EXCEEDED");
  withScratch((value) => value.rows.find((row) => row.operationId === "getWorkspaceAccounts").primaryOwnerBoundaries.pop(), "BP_U05_TWO_OWNER_BOUNDARY_MISSING");
  withScratch((value) => value.rows.find((row) => row.operationId === "getWorkspaceAccounts").primaryOwnerBoundaries[1].logicalStatementCap = 2, "BP_U05_TWO_OWNER_BOUNDARY_LOGICAL_CAP_DRIFT");
  withScratch((value) => value.rows.find((row) => row.operationId === "getWorkspaceInvitationCandidates").primaryOwnerBoundaries[1].alternativeBoundaries.reverse(), "BP_U05_TWO_OWNER_BRANCH_SWITCH_DRIFT");
  withScratch((value) => value.rows.find((row) => row.operationId === "getWorkspaceInvitation").primaryQueryCap = 3, "BP_U05_TWO_OWNER_CAP_EXCEPTION_DRIFT");
  withScratch((value) => value.rows.find((row) => row.operationId === "getPlatformContractOverviewDetail").primaryQueryCap = 1, "BP_U05_REMAINING_EXCEPTION_CAP_DRIFT");
  withScratch((value) => value.rows.find((row) => row.operationId === "getOperationsContract").primaryQueryCap = 2, "BP_U05_MULTI_OWNER_EXCEPTION_LIMIT_EXCEEDED");
  withScratch((value) => value.rows.find((row) => row.operationId === "getWorkspaceAccounts").whyNotMergeable = "", "BP_U05_MULTI_OWNER_REVIEW_METADATA_MISSING");
  withScratch((value) => value.remainingOwnerProjectionExceptions.maxMultiOwnerExceptionCount = 9, "BP_U05_REMAINING_EXCEPTION_SCHEMA_DRIFT");
  withScratch((value) => value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "getPlatformEntityAuditHistory").sourceRequirement.readerPath = "apps/backend/catering-business-server/modules/audit/src/main/java/com/catering/v2s/audit/application/PlatformAuditHistoryTaskReadService.java", "BP_U05_FUTURE_READER_PATH_DRIFT");
  withScratch((value) => delete value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "getPlatformContractOverviewDetail").sourceRequirement.forbiddenEdgeReads, "BP_U05_FUTURE_READER_FORBIDDEN_EDGE_SCHEMA_DRIFT");
  withScratch((value) => value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "listPlatformGroupWorkspaces").sourceRequirement.forbiddenEdgeReads[1].prospective = false, "BP_U05_FUTURE_READER_FORBIDDEN_EDGE_SCHEMA_DRIFT");
  withScratch((value) => delete value.rows.find((row) => row.operationId === "getOperationsEntityAuditHistory").futureAuthorizationProjection, "BP_U05_OPERATIONS_AUDIT_AUTHORIZATION_PROJECTION_DRIFT");
  withScratch((value) => value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "getPlatformContractOverviewDetail").branches[0].boundaries.pop(), "BP_U05_REMAINING_EXCEPTION_BOUNDARY_OR_BRANCH_DRIFT");
  withScratch((value) => value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "listPlatformGroupWorkspaces").branches[0].boundaries.push({owner:"asset", boundary:"PlatformAssetService#requireActivePublicReferences", logicalStatementCap:1}), "BP_U05_REMAINING_EXCEPTION_LOGICAL_CAP_DRIFT");
  withScratch((value) => value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "getPlatformEntityAuditHistory").branches[0].when = "entityType=PLATFORM_ADMIN", "BP_U05_REMAINING_EXCEPTION_BOUNDARY_OR_BRANCH_DRIFT");
  withScratch((value) => value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "getPlatformContractOverviewDetail").branches[0].boundaries[1].boundary = "ExtensionDefinitionService#requireDefinition", "BP_U05_REMAINING_EXCEPTION_BOUNDARY_OR_BRANCH_DRIFT");
  withScratch((value) => value.remainingOwnerProjectionExceptions.exceptions.find((row) => row.operationId === "getPlatformGroupWorkspaceDetail").branches[0].boundaries[3].logicalStatementCap = 2, "BP_U05_REMAINING_EXCEPTION_LOGICAL_CAP_DRIFT");
  withScratch((value) => value.rows.find((row) => row.readContextKind === "PLATFORM_AUDIT_BRANCHED").conditionalFact.absentWhenEntityType = [], "BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT");
  withScratch((value) => delete value.rows.find((row) => row.readContextKind === "PLATFORM_AUDIT_BRANCHED").optionalCountCapBasis, "BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT");
  withScratch((value) => value.rows.find((row) => row.operationId === "getPlatformContractOverviewDetail").optionalCountCapBasis = "BRANCH_CAPS", "BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT");
  withScratch((value) => value.rows.find((row) => row.readContextKind === "PLATFORM_AUDIT_BRANCHED").optionalCountCap = 1, "BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT");
  withScratch((value) => value.rows.find((row) => row.readContextKind === "OPERATIONS_SCOPED").sourceAnchor = "missing#route", "BP_U05_READ_BUDGET_SOURCE_ANCHOR_MISSING");
  for (const lostAnchor of requiredWorkspaceTaskReadCommandAnchors) {
    const remainingAnchors = workspaceTaskReadCommandAnchors.filter((anchor) => anchor !== lostAnchor);
    try {
      validateReadSources(readJson(policyPath), readJson(policyPath).rows.filter((row) => row.disposition === "TASK_READ"), new Map(), remainingAnchors);
      fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", "BP_U05_READ_COMMAND_ANCHOR_SET_DRIFT");
    } catch (error) {
      if (String(error.message).split(":", 1)[0] !== "BP_U05_READ_COMMAND_ANCHOR_SET_DRIFT") throw error;
    }
  }
  withScratch((value) => value.rows.find((row) => row.operationId === sessionEntryPolicy.operationId).requiredFactSet = ["WorkspaceReadAuthorizationFacts", "VisibleOrganizationFacts"], "BP_U05_READ_BUDGET_CONTEXT_CONTRACT_DRIFT");
  withScratch((value) => value.sessionEntryAuthentication.requiredOutcomes.pop(), "BP_U05_SESSION_ENTRY_AUTHENTICATION_POLICY_DRIFT");
  withScratch((value) => value.rows.find((row) => row.primaryReader === "TASK_READER").primaryBoundary = `${value.primaryReaderSchema.taskReaderApis[0].sourcePath}#readCatalogItems`, "BP_U05_PRIMARY_READER_SOURCE_MISMATCH");
  withScratch((value) => { const reader = value.primaryReaderSchema.taskReaderApis.find((candidate) => candidate.api === "OperationsOrganizationTaskReadService"); value.rows.find((row) => row.operationId === "getOperationsOrganizationBrand").primaryBoundary = `${reader.sourcePath}#tenant`; }, "BP_U05_PRIMARY_READER_SOURCE_MISMATCH");
  withScratch((value) => { const reader = value.primaryReaderSchema.taskReaderApis.find((candidate) => candidate.api === "WorkspaceRoleService"); value.rows.find((row) => row.operationId === "getWorkspaceRole").primaryBoundary = `${reader.sourcePath}#page`; }, "BP_U05_PRIMARY_READER_SOURCE_MISMATCH");
  withScratch((value) => { const reader = value.primaryReaderSchema.taskReaderApis.find((candidate) => candidate.api === "WorkspaceRoleService"); value.rows.find((row) => row.operationId === "getWorkspaceRoles").primaryBoundary = `${reader.sourcePath}#platformTaskDetail`; }, "BP_U05_PRIMARY_READER_SOURCE_MISMATCH");
  withScratch((value) => { const reader = value.primaryReaderSchema.taskReaderApis.find((candidate) => candidate.api === "PlatformAuthenticationService"); value.rows.find((row) => row.operationId === "getPlatformAdminDetail").primaryBoundary = `${reader.sourcePath}#platformAdministratorPage`; }, "BP_U05_PRIMARY_READER_SOURCE_MISMATCH");
  withScratch((value) => value.rows.find((row) => row.operationId === "getOperationsEntityAuditHistory").primaryBoundary = "UNCLASSIFIED_BLOCKED", "BP_U05_PRIMARY_READER_BOUNDARY_INVALID");
  sourceMutation(readJson(policyPath), "getOperationsCatalogWorkbenchContext", (source) => source.replace("ReadRequest read = readRequest(", "operationRegistry.resolve(\"GET\", http.getRequestURI()); ReadRequest read = readRequest("), "BP_U05_READ_SOURCE_OPERATION_DISPATCH");
  sourceMutation(readJson(policyPath), "getOperationsWorkspaceGroupUser", (source) => source.replace("return revokeResult(m1Bindings.bindRevokeOperationsWorkspaceGroupUserAssignment(", "reads.userDetail(null); return revokeResult(m1Bindings.bindRevokeOperationsWorkspaceGroupUserAssignment("), "BP_U05_TASK_READER_COMMAND_USAGE");
  sourceMutation(readJson(policyPath), "getOperationsContractCandidates", (source) => source.replace("sessions.requireWorkspaceReadAtContextVersion(", "sessions.requireWorkspaceAtContextVersion("), "BP_U05_READ_SOURCE_LEGACY_SESSION");
  sourceMutation(readJson(policyPath), "getExtensionDefinition", (source) => source.replace("sessions.requireRead(", "sessions.require("), "BP_U05_READ_SOURCE_LEGACY_SESSION");
  sourceMutation(readJson(policyPath), sessionEntryPolicy.operationId, (source) => source.replace("reads.sessionEntry(", "reads.session("), "BP_U05_SESSION_ENTRY_CONTROLLER_SOURCE_MISSING");
  const [ownerPath] = sessionEntryPolicy.ownerSourceAnchor.split("#");
  const ownerSource = sourceFor(ownerPath, new Map());
  const ownerMutated = ownerSource.replace("WorkspaceSessionEntryReadback.Outcome.SELECT_IDENTITY", "WorkspaceSessionEntryReadback.Outcome.MISSING");
  if (ownerMutated === ownerSource) fail("BP_U05_READ_BUDGET_SELF_TEST_MUTATION_MISSING", "session-entry-owner");
  try {
    validateReadSources(readJson(policyPath), readJson(policyPath).rows.filter((row) => row.disposition === "TASK_READ"), new Map([[ownerPath, ownerMutated]]));
    fail("BP_U05_READ_BUDGET_RED_MUTATION_ACCEPTED", "BP_U05_SESSION_ENTRY_OWNER_FACT_SOURCE_MISSING");
  } catch (error) {
    if (String(error.message).split(":", 1)[0] !== "BP_U05_SESSION_ENTRY_OWNER_FACT_SOURCE_MISSING") throw error;
  }
  twoOwnerSourceMutation(readJson(policyPath), "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceAccountController.java", (source) => source.replace("reads.page(", "user.page("), "BP_U05_TWO_OWNER_EDGE_TYPED_READER_BYPASS");
  twoOwnerSourceMutation(readJson(policyPath), "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformWorkspaceAccountTaskReadService.java", (source) => source.replace("primary(() -> jdbc.query", "primary(() -> jdbc.batchUpdate"), "BP_U05_TWO_OWNER_WORKSPACE_LOGICAL_CAP_DRIFT");
  twoOwnerSourceMutation(readJson(policyPath), "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java", (source) => source.replace("Map<TaskPathRef, TaskPath> result = jdbc.query(", "Map<TaskPathRef, TaskPath> result = jdbc.batchUpdate("), "BP_U05_TWO_OWNER_ORGANIZATION_LOGICAL_CAP_DRIFT");
  twoOwnerSourceMutation(readJson(policyPath), "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformInvitationCandidatesTaskReadService.java", (source) => source.replace("case \"ROLE\" -> roles(", "case \"ROLE\" -> organizations("), "BP_U05_TWO_OWNER_BRANCH_SWITCH_SOURCE_DRIFT");
  completedRemainingSourceMutation(readJson(policyPath), (source) => source.replace("definitions.platformContractManagementDefinition(", "definitions.requireDefinition("), "BP_U05_CONTRACT_DEFINITION_SOURCE_DRIFT");
  operationsAuditSourceMutation(readJson(policyPath), (source) => source.replace("AuditEntityTypes.STORE", "\"STORE\""), "BP_U05_OPERATIONS_AUDIT_TARGET_TYPE_SET_DRIFT");
  operationsAuditSourceMutation(readJson(policyPath), (source) => source.replace("var result = reads.read(", "authorization.requireGroupHost(null); var result = reads.read("), "BP_U05_OPERATIONS_AUDIT_EDGE_TYPED_READER_BYPASS");
  futureReaderAdmissionMutation(readJson(policyPath), "getPlatformEntityAuditHistory", (requirement) => { requirement.readerPath = "apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/MissingPlatformAuditHistoryTaskReadService.java"; }, new Map(), "BP_U05_FUTURE_READER_SOURCE_MISSING");
  futureReaderAdmissionMutation(readJson(policyPath), "getPlatformEntityAuditHistory", (requirement) => { requirement.readerMethod = "missing"; }, new Map(), "BP_U05_FUTURE_READER_SOURCE_METHOD_MISSING");
  futureReaderEdgeSourceMutation(readJson(policyPath), "getPlatformContractOverviewDetail", (source) => source.replace("var value = reads.platformOverviewTaskDetail(", "reads.view(workspaceUuid, groupWorkspaceKey, contractId); var value = reads.platformOverviewTaskDetail("), "BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ");
  futureReaderEdgeSourceMutation(readJson(policyPath), "listPlatformGroupWorkspaces", (source) => source.replace("taskReads.page(", "workspaces.list("), "BP_U05_FUTURE_READER_EDGE_CALL_MISSING");
  futureReaderEdgeSourceMutation(readJson(policyPath), "getPlatformEntityAuditHistory", (source) => source.replace("var result = reads.read(", "platformIamAudit.read(null, 1, 1); var result = reads.read("), "BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ");
  futureReaderOwnerSourceAssertionMutation(readJson(policyPath), "listPlatformGroupWorkspaces", "apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java", (source) => source.replace("platform_workspace.group_workspace", "organization.commercial_group"), "BP_U05_R5_LIST_ORGANIZATION_SCHEMA_LEAK");
  futureReaderOwnerSourceAssertionMutation(readJson(policyPath), "listPlatformGroupWorkspaces", "apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java", (source) => source.replace("SELECT 1 FROM", "EXISTS (SELECT 1 FROM"), "BP_U05_R5_LIST_EXISTS_DRIFT");
  futureReaderOwnerSourceAssertionMutation(readJson(policyPath), "getPlatformGroupWorkspaceDetail", "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadService.java", (source) => source.replace("return jdbc.query(\"SELECT 1\");", "jdbc.query(\"SELECT 1\"); return jdbc.query(\"SELECT 2\");"), "BP_U05_R5_SUMMARY_LOGICAL_CAP_DRIFT");
  futureReaderOwnerSourceAssertionMutation(readJson(policyPath), "getPlatformGroupWorkspaceDetail", "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadService.java", (source) => source.replace("return jdbc.query(\"SELECT 1\");", "return accountCount() + roleCount();"), "BP_U05_R5_SUMMARY_LEGACY_COUNT_DELEGATION");
  futureReaderOwnerSourceAssertionMutation(readJson(policyPath), "listPlatformGroupWorkspaces", "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationGroupWorkspaceInitializationLookup.java", (source) => source.replace("boolean commercialGroupInitialized", "boolean commercialGroupInitialized, String workspaceName"), "BP_U05_R5_INITIALIZATION_OUTPUT_DRIFT");
  console.log(`BP_U05_READ_BUDGET_SELF_TEST=PASS\nRED_FIXTURES=79\nWORKSPACE_HTTP_COMMAND_ANCHORS=${workspaceTaskReadCommandAnchors.length}\nREVOKE_HTTP_ANCHOR_MEMBER_RED_MUTATIONS=${requiredWorkspaceTaskReadCommandAnchors.filter((anchor) => anchor.includes("OperationsWorkspaceUserController.java#")).length}\nREAD_BUDGET_CAP_BASIS=LOGICAL_STATEMENT\nOPTIONAL_COUNT_CAP_BASIS=BRANCH_CAPS\nTWO_OWNER_PRIMARY_PROJECTION_EXCEPTIONS=5\nTWO_OWNER_REMAINING_EXCEPTIONS=5\nMULTI_OWNER_EXCEPTION_EXACT_SET=10\nMULTI_OWNER_EXCEPTION_LIMIT=10\nFUTURE_READER_FORBIDDEN_EDGE_SETS=5\nFUTURE_READER_FORBIDDEN_EDGE_RULES=15\nFUTURE_READER_FORBIDDEN_EDGE_PROSPECTIVE=1\nOPERATIONS_AUDIT_TARGET_TYPES=9\nTWO_OWNER_BOUNDARY_LOGICAL_STATEMENT_CAP=1\nTWO_OWNER_CANDIDATE_ORGANIZATION_BRANCHES=2\nTWO_OWNER_PRIMARY_PROJECTION_STATUS=SOURCE_IMPLEMENTED_UNMEASURED\nTWO_OWNER_REMAINING_STATUS=SOURCE_IMPLEMENTED_UNMEASURED\nBP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`);
}

try {
  const argument = process.argv[2];
  if (argument === "--check") { validate(readJson(policyPath)); console.log("BP_U05_READ_BUDGET_CHECK=PASS\nGET_OPERATIONS=83\nTASK_READ=78\nPROTOCOL_READ_EXEMPT=5\nREAD_CONTEXT_PARTITION=58/15/4/1\nREAD_BUDGET_COMPONENT_VOCABULARY=7\nREAD_BUDGET_CAP_BASIS=LOGICAL_STATEMENT\nOPTIONAL_COUNT_CAP_BASIS=BRANCH_CAPS\nTWO_OWNER_PRIMARY_PROJECTION_EXCEPTIONS=5\nTWO_OWNER_REMAINING_EXCEPTIONS=5\nMULTI_OWNER_EXCEPTION_EXACT_SET=10\nMULTI_OWNER_EXCEPTION_LIMIT=10\nFUTURE_READER_FORBIDDEN_EDGE_SETS=5\nFUTURE_READER_FORBIDDEN_EDGE_RULES=15\nFUTURE_READER_FORBIDDEN_EDGE_PROSPECTIVE=1\nOPERATIONS_AUDIT_TARGET_TYPES=9\nTWO_OWNER_BOUNDARY_LOGICAL_STATEMENT_CAP=1\nTWO_OWNER_CANDIDATE_ORGANIZATION_BRANCHES=2\nTWO_OWNER_PRIMARY_PROJECTION_STATUS=SOURCE_IMPLEMENTED_UNMEASURED\nTWO_OWNER_REMAINING_STATUS=SOURCE_IMPLEMENTED_UNMEASURED\nBP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED"); }
  else if (argument === "--self-test") selfTest();
  else fail("BP_U05_READ_BUDGET_ARGUMENT_INVALID");
} catch (error) { console.error(error.message); process.exitCode = 1; }
