#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRegistryPaths = [
  "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
  "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json",
];
const outputPath = "contracts/registry/backend-performance-sql-merge-applicability.json";
const snapshotCheckPath = "scripts/check/backend-performance-evidence-snapshot";
const finalAcceptancePath = "scripts/test/backend-performance-final-acceptance.mjs";
const bindingPath = "contracts/registry/operation-handler-bindings.json";
const protocolReadExemptions = new Set([
  "getCurrentPlatformSession",
  "getOperationsWorkspaceLoginEntry",
  "getPublicInvitationView",
  "getPublicInvitationCompletion",
  "getPublicAssetContent",
]);
const c5CommandOperationIds = [
  "selectOperationsWorkspaceSessionContext",
  "selectOperationsWorkspaceSessionDataNode",
].sort();
const enabledSelectedWorkspaceOperationIds = [
  "getExtensionDefinition",
  "getExtensionEntityCatalog",
  "getPlatformContractOverviewPage",
  "getPlatformContractOverviewDetail",
  "getPlatformOrganizationOverviewPage",
  "getPlatformOrganizationCandidates",
  "getPlatformOrganizationHierarchyTree",
  "getPlatformOrganizationOverviewDetail",
  "getWorkspaceAccounts",
  "getWorkspaceAccount",
  "getWorkspaceInvitations",
  "getWorkspaceInvitationCandidates",
  "getWorkspaceInvitation",
  "getWorkspaceRoles",
  "getWorkspaceRole",
].sort();
const enabledSelectedWorkspaceDeferredOperationIds = [
  ...enabledSelectedWorkspaceOperationIds,
  "getPlatformEntityAuditHistory",
].sort();
const platformAuditBranchPolicy = {
  sourcePathMethod: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java#history",
  enabledBranchExpressions: [
    "case \"GROUP_WORKSPACE\" -> new PlatformAuditHistoryQuery.GroupWorkspace(target, page, pageSize)",
    "case \"WORKSPACE_ROLE\" -> new PlatformAuditHistoryQuery.WorkspaceRole(target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize)",
    "case \"WORKSPACE_ACCOUNT\" -> new PlatformAuditHistoryQuery.WorkspaceAccount(target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize)",
    "case \"WORKSPACE_INVITATION\" -> new PlatformAuditHistoryQuery.WorkspaceInvitation(target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize)",
    "case \"EXTENSION_DEFINITION\" -> new PlatformAuditHistoryQuery.ExtensionDefinition(target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize)",
    "case \"STORE_CONTRACT\" -> new PlatformAuditHistoryQuery.StoreContract(target, requiredWorkspaceKey(groupWorkspaceKey), page, pageSize)",
  ],
  platformAdminExpression: "case \"PLATFORM_ADMIN\" -> new PlatformAuditHistoryQuery.PlatformAdmin(target, page, pageSize)",
};
const factImplementationControls = [
  // These are the only source-anchored implementations currently present. A
  // consumer face never grants an operation an M1/M2 applicability status.
  { factLoaderId: "CommercialGroupPreState", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java#requireCommercialGroup", statementTemplateAnchor: "SELECT commercial_group_uuid, commercial_group_code", securityPredicateId: "ORG_COMMERCIAL_GROUP_OWNER_SCOPE", predicateMarker: "WHERE group_workspace_key=?" },
  { factLoaderId: "ExtensionDefinitionPreState", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java#loadExtensionDefinitionPreState", statementTemplateAnchor: "SELECT definitions::text, revision FROM extension.extension_definition", securityPredicateId: "EXTENSION_WORKSPACE_HOST_SCOPE", predicateMarker: "WHERE workspace_uuid=? AND group_workspace_key=?" },
  { factLoaderId: "InvitationAssignmentIntentFacts", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java#loadInvitationAssignmentIntentFacts", statementTemplateAnchor: "SELECT intent.invitation_id, intent.role_id", securityPredicateId: "INVITATION_ID_SET_OWNER_SCOPE", predicateMarker: "WHERE intent.invitation_id IN (" },
  { factLoaderId: "DerivedStoreStatusFacts", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java#load", statementTemplateAnchor: "SELECT store_id, CASE", securityPredicateId: "CONTRACT_WORKSPACE_STORE_SCOPE", predicateMarker: "WHERE workspace_uuid=? AND group_workspace_key=?" },
  { factLoaderId: "ResolvedBomTargets", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/ResolvedBomTargets.java#load", statementTemplateAnchor: "STATEMENT_TEMPLATE", securityPredicateId: "INVENTORY_SCOPE_BRAND_TARGET_SET", predicateMarker: "statement.setString(1, scope)" },
  { factLoaderId: "WorkspaceCommandAuthorizationFacts", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolver.java#loadWorkspaceCommandAuthorizationFacts", statementTemplateAnchor: "SELECT assignment.service_node_type, assignment.service_node_id", securityPredicateId: "WORKSPACE_ASSIGNMENT_ENABLED_ROLE_CAPABILITY", predicateMarker: "assignment.status='ACTIVE'" },
  { factLoaderId: "WorkspaceReadAuthorizationFacts", implementationStatus: "DEFERRED_TO_BP_U05_READ_CONTEXT", blockedOperationCount: 57 },
  { factLoaderId: "SessionEntryAuthenticationFacts", implementationStatus: "DEFERRED_TO_BP_U05_SESSION_ENTRY_AUTHENTICATION", blockedOperationCount: 1 },
  { factLoaderId: "VisibleOrganizationSessionEntryFacts", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationVisibilityService.java#resolveSessionEntryFacts", statementTemplateAnchor: "SELECT id, node_type, code, name, parent_id, status FROM organization.organization_node", securityPredicateId: "ORGANIZATION_SESSION_ENTRY_WORKSPACE_SCOPE", predicateMarker: "WHERE workspace_uuid=? AND group_workspace_key=?" },
  { factLoaderId: "VisibleOrganizationFactsC5Command", implementationStatus: "DEFERRED_TO_BP_U07_C5_COMMAND_RECONCILIATION", blockedOperationCount: 2 },
  { factLoaderId: "VisibleOrganizationFactsTaskRead", implementationStatus: "DEFERRED_TO_BP_U05_TASK_READ", blockedOperationCount: 57 },
  { factLoaderId: "EnabledSelectedWorkspaceFact", implementationStatus: "DEFERRED_TO_BP_U05_SOURCE_BOUND_POLICY", blockedOperationCount: 16, sourcePathMethod: platformAuditBranchPolicy.sourcePathMethod, statementTemplateAnchor: "case \"GROUP_WORKSPACE\" -> new PlatformAuditHistoryQuery.GroupWorkspace(target, page, pageSize)", securityPredicateId: "PLATFORM_AUDIT_SELECTED_WORKSPACE_BRANCH", predicateMarker: "case \"PLATFORM_ADMIN\" -> new PlatformAuditHistoryQuery.PlatformAdmin", branchPolicy: platformAuditBranchPolicy },
  { factLoaderId: "CatalogCoordinationSnapshot", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java#recheckWriteFactsBeforeReceipt", statementTemplateAnchor: "SELECT version FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=?", securityPredicateId: "CATALOG_OWNER_SCOPE_GRANT", predicateMarker: "VERSION_CONFLICT" },
  { factLoaderId: "DictionaryReferenceSnapshot", implementationStatus: "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED", sourcePathMethod: "apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java#dictionaryReferenceSnapshot", statementTemplateAnchor: "SELECT sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'", securityPredicateId: "CATALOG_OWNER_SCOPE_GRANT", predicateMarker: "canonicalDictionaryKind(kind)" },
];
const sourceRetirementAnchors = {
  implementationStatus: "IMPLEMENTED_SOURCE_ABSENCE_UNMEASURED",
  retiredPostAuth: [
    ["apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java", "requireCommercialGroup"],
    ["apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java", "isEnterableStore"],
    ["apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java", "isEnterableCommercialGroup"],
    ["apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java", "describeCommercialGroup"],
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAccountService.java", "revokeAssignmentForOperations"],
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java", "require"],
  ],
  retainedPreAuth: [
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java", "authenticatePassword"],
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java", "accountByMobile"],
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryService.java", "start"],
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryService.java", "enabledAccount"],
    ["apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordResetService.java", "reset"],
  ],
};
const m5Rows = [
  {
    table: "organization.commercial_group", owner: "organization", disposition: "IMPLEMENT",
    factLoaderId: "CommercialGroupPreState", operationIds: ["updateOperationsCommercialGroup"],
    sourcePathMethod: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java#updateOnce",
    typedInput: "workspaceUuid,groupWorkspaceKey,code,expectedVersion,ownerGrant",
    typedOutput: "current,revision,auditFields",
    preservedChecks: ["grant target before receipt", "CAS", "audit old-vs-new", "post-write readback"],
  },
  {
    table: "organization.project_phase_name", owner: "organization", disposition: "SQL_MERGE_REJECTED",
    operationIds: ["createOperationsOrganizationProject", "updateOperationsOrganizationNode", "transitionOperationsOrganizationNodeStatus", "getOperationsOrganizationHierarchy", "getOperationsContractCandidates", "createOperationsContract", "updateOperationsContract"],
    reason: "phase facts are separated by writes or are a single legitimate read",
    correctnessCost: "an old snapshot would weaken phase validation or post-status readback",
    negativeFixture: "phase-change-illegal-phase-status-readback",
  },
  {
    table: "extension.extension_definition", owner: "extension", disposition: "IMPLEMENT",
    factLoaderId: "ExtensionDefinitionPreState", operationIds: ["replaceExtensionDefinition"],
    sourcePathMethod: "apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java#replace",
    typedInput: "workspaceUuid,key,hostType,expectedVersion,fields",
    typedOutput: "revision,fields",
    preservedChecks: ["missing conflict", "field type rejection", "receipt replay", "post-write readback"],
  },
  {
    table: "catalog.catalog_category", owner: "catalog", disposition: "SQL_MERGE_REJECTED",
    operationIds: ["createOperationsCatalogCategory", "updateOperationsCatalogCategory", "moveOperationsCatalogCategory", "deleteOperationsCatalogCategory"],
    reason: "lock, hierarchy/reference validation and post-write projection have different semantics or a write interval",
    correctnessCost: "a pre-write snapshot cannot replace locking or the updated projection",
    negativeFixture: "category-cas-cycle-depth-reference-readback",
  },
  {
    table: "workspace_iam.invitation_assignment_intent", owner: "workspace-iam", disposition: "IMPLEMENT",
    factLoaderId: "InvitationAssignmentIntentFacts",
    operationIds: ["getWorkspaceInvitations", "getWorkspaceInvitation", "getOperationsWorkspaceGroupInvitations", "getOperationsWorkspaceHeadCompanyInvitations", "getOperationsWorkspaceProjectInvitations", "getOperationsWorkspaceRegionInvitations", "getOperationsWorkspaceStoreInvitations", "createWorkspaceInvitation", "cancelWorkspaceInvitation", "reissueWorkspaceInvitation"],
    sourcePathMethod: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java#managementViews",
    typedInput: "invitationIds",
    typedOutput: "intentsByInvitation,roleNamesByInvitation",
    preservedChecks: ["role-name ordering", "target path", "invitation state", "cancel/reissue replay"],
  },
  {
    table: "contract.store_contract", owner: "contract", disposition: "IMPLEMENT",
    factLoaderId: "DerivedStoreStatusFacts",
    operationIds: ["getOperationsOrganizationStore", "createOperationsOrganizationStore", "updateOperationsOrganizationStore", "transitionOperationsOrganizationStoreStatus", "getOperationsStoreProfile"],
    sourcePathMethod: "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java#derivedStoreStatus",
    typedInput: "workspaceUuid,key,storeId,today",
    typedOutput: "derivedStatus",
    preservedChecks: ["current contract", "future contract", "no contract", "effectiveTo null"],
  },
];
const sourceRetirements = {
  retiredPostAuthCallSiteGroups: [
    "OrganizationHierarchyService#requireCommercialGroup",
    "BusinessEntityService#isEnterableStore",
    "OrganizationCommandService#isEnterableCommercialGroup",
    "OrganizationCommandService#describeCommercialGroup",
    "WorkspaceAccountService#revokeAssignmentForOperations",
    "WorkspaceRoleService#require",
  ],
  retainedPreAuthExpressions: [
    "WorkspaceAuthenticationService#authenticatePassword",
    "WorkspaceAuthenticationService#accountByMobile",
    "WorkspacePasswordRecoveryService#start",
    "WorkspacePasswordRecoveryService#enabledAccount",
    "WorkspacePasswordResetService#reset",
  ],
};

function fail(code, detail = "") { throw new Error(detail ? `${code}:${detail}` : code); }
function digest(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function json(relative) { const bytes = fs.readFileSync(path.join(root, relative)); return { bytes, value: JSON.parse(bytes) }; }
function normalizedPath(operation) { return operation.path.startsWith("/api/") ? operation.path : `/api${operation.path}`; }
function mappingWithHashes(mapping) { return mapping.statementTemplateAnchor ? {...mapping, statementTemplateHash: digest(mapping.statementTemplateAnchor)} : mapping; }
function factImplementation(row) {
  const control = factImplementationControls.find((candidate) => candidate.factLoaderId === row.factLoaderId);
  if (!control) fail("BP_U07_FACT_IMPLEMENTATION_CONTROL_MISSING", row.factLoaderId);
  const fields = mappingWithHashes(control);
  const canonicalRow = fields.implementationStatus.startsWith("DEFERRED_")
    ? (() => {
      const {applicableOperationIds, deferredOperationIds, ...rest} = row;
      return {...rest, applicableOperationIds: [], deferredOperationIds: [...(deferredOperationIds ?? applicableOperationIds)].sort()};
    })()
    : row;
  if (fields.implementationStatus.startsWith("DEFERRED_") && !fields.sourcePathMethod) {
    return {...canonicalRow, sourcePathMethod: "N/A_DEFERRED", statementTemplateAnchor: "N/A_DEFERRED", statementTemplateHash: "N/A_DEFERRED", securityPredicateId: "N/A_DEFERRED", predicateMarker: "N/A_DEFERRED", implementationStatus: fields.implementationStatus, blockedOperationCount: fields.blockedOperationCount};
  }
  return {...canonicalRow, sourcePathMethod: fields.sourcePathMethod, statementTemplateAnchor: fields.statementTemplateAnchor, statementTemplateHash: fields.statementTemplateHash, securityPredicateId: fields.securityPredicateId, predicateMarker: fields.predicateMarker, implementationStatus: fields.implementationStatus, ...(fields.blockedOperationCount ? {blockedOperationCount: fields.blockedOperationCount} : {}), ...(fields.branchPolicy ? {branchPolicy: fields.branchPolicy} : {})};
}

function sourceRegistries() {
  return sourceRegistryPaths.map((sourcePath) => {
    const { bytes, value } = json(sourcePath);
    if (!Array.isArray(value.operations) || value.operations.length === 0) fail("BP_U07_SOURCE_REGISTRY_INVALID", sourcePath);
    return { path: sourcePath, sha256: digest(bytes), operationCount: value.operations.length, operations: value.operations };
  });
}

function m1Partitions(operations) {
  const {bytes, value} = json(bindingPath);
  if (!Array.isArray(value?.operations) || value.operations.length !== 196) fail("BP_U07_BINDING_DENOMINATOR_INVALID");
  const known = new Set(operations.map((operation) => operation.operationId));
  const admin = value.operations.filter((binding) => binding.face === "operations-admin");
  const command = admin.filter((binding) => binding.mode === "COMMAND" && binding.contextKind === "WORKSPACE_EXECUTION_CONTEXT");
  const read = admin.filter((binding) => binding.mode === "READ" && binding.contextKind === "READ_CONTEXT" && !protocolReadExemptions.has(binding.operationId));
  const protocol = admin.filter((binding) => binding.mode === "COMMAND" && binding.contextKind === "WORKSPACE_PROTOCOL_CONTEXT");
  const ids = (rows) => rows.map((row) => row.operationId).sort();
  const commandIds = ids(command), readIds = ids(read), protocolIds = ids(protocol);
  if (commandIds.length !== 68 || readIds.length !== 58 || protocolIds.length !== 7 || !protocolIds.includes("changeCurrentWorkspacePassword")) fail("BP_U07_M1_BINDING_PARTITION_DRIFT", `${commandIds.length}:${readIds.length}:${protocolIds.length}`);
  if ([...commandIds, ...readIds, ...protocolIds].some((id) => !known.has(id)) || new Set([...commandIds, ...readIds]).size !== 126 || readIds.includes("getOperationsWorkspaceLoginEntry")) fail("BP_U07_M1_BINDING_OPERATION_INVALID");
  return {sourcePath: bindingPath, sha256: digest(bytes), commandIds, readIds, protocolIds};
}

function allOperations() {
  const operations = sourceRegistries().flatMap((registry) => registry.operations.map((operation) => ({ ...operation, routeRegistry: registry.path })));
  const ids = new Set();
  for (const operation of operations) {
    if (!operation.operationId || !operation.owner || !operation.method || !operation.path || !Array.isArray(operation.consumerFaces)) fail("BP_U07_OPERATION_INVALID", JSON.stringify(operation));
    if (ids.has(operation.operationId)) fail("BP_U07_OPERATION_ID_DUPLICATE", operation.operationId);
    ids.add(operation.operationId);
  }
  if (operations.length !== 196) fail("BP_U07_ROUTE_DENOMINATOR_DRIFT", String(operations.length));
  return operations;
}

function sqlMergeIds(operation, m1, m2) {
  const ids = [];
  if (m1.commandIds.includes(operation.operationId) || m1.readIds.includes(operation.operationId)) ids.push("SQL-M1");
  if (m2.commandIds.includes(operation.operationId) || m2.readIds.includes(operation.operationId)) ids.push("SQL-M2");
  if (operation.owner === "catalog") ids.push("SQL-M3");
  if (operation.owner === "inventory") ids.push("SQL-M6");
  for (const row of m5Rows) if (row.operationIds.includes(operation.operationId)) ids.push("SQL-M5");
  return ids;
}

function routeRow(operation, m1, m2) {
  return {
    operationId: operation.operationId,
    owner: operation.owner,
    method: operation.method,
    consumerFace: operation.consumerFaces[0],
    routeTemplate: normalizedPath(operation),
    routeRegistry: operation.routeRegistry,
    sqlMergeIds: sqlMergeIds(operation, m1, m2),
    coverageStatus: "UNMEASURED_BLOCKS_OPTIMIZATION",
  };
}

function expected() {
  const operations = allOperations();
  const m1 = m1Partitions(operations);
  const m2 = { commandIds: c5CommandOperationIds, readIds: m1.readIds };
  const m3 = operations.filter((operation) => operation.owner === "catalog").map((operation) => operation.operationId).sort();
  const m6 = operations.filter((operation) => operation.owner === "inventory").map((operation) => operation.operationId).sort();
  const m2SessionEntry = ["getOperationsWorkspaceSessionEntry"];
  const m2TaskReadDeferred = m2.readIds.filter((id) => !m2SessionEntry.includes(id));
  const m1WorkspaceReadAuthorization = m1.readIds.filter((id) => !m2SessionEntry.includes(id));
  if (new Set([...m2.commandIds, ...m2.readIds]).size !== 60 || m2TaskReadDeferred.length !== 57 || m3.length !== 25 || m6.length !== 11 || m2.commandIds.some((id) => !operations.some((operation) => operation.operationId === id && operation.method !== "GET"))) fail("BP_U07_APPLICABILITY_DENOMINATOR_DRIFT", `${m2.commandIds.length}:${m2.readIds.length}:${m2TaskReadDeferred.length}:${m3.length}:${m6.length}`);
  return {
    schemaVersion: 1,
    kind: "backend-performance-sql-merge-applicability",
    sourceRegistries: sourceRegistries().map(({ path: sourcePath, sha256, operationCount }) => ({ path: sourcePath, sha256, operationCount })),
    denominators: { routeOperations: 196, getOperations: 83, taskReadOperations: 78, protocolContentReadExemptions: 5, sqlM1CommandOperations: 68, sqlM1ReadOperations: 58, sqlM1ApplicableOperations: 126, sqlM2C5CommandOperations: 2, sqlM2TaskReadOperations: 58, sqlM2ApplicableOperations: 60, sqlM3CatalogOperations: 25, sqlM6InventoryOperations: 11, sqlM4RetiredExpressions: 6, sqlM4RetainedExpressions: 5, sqlM5Rows: 6 },
    m1BindingPartition: {sourcePath: m1.sourcePath, sourceSha256: m1.sha256, commandOperationIds: m1.commandIds, readOperationIds: m1.readIds, protocolOperationIds: m1.protocolIds, protocolReadExemptions: [...protocolReadExemptions].sort()},
    m1ReadFactPartition: {workspaceReadAuthorizationOperationIds: m1WorkspaceReadAuthorization, sessionEntryAuthenticationOperationIds: m2SessionEntry},
    m2SourceProvenPartition: {commandOperationIds: m2.commandIds, taskReadOperationIds: m2.readIds, sessionEntryOperationIds: m2SessionEntry, deferredTaskReadOperationIds: m2TaskReadDeferred, nonApplicableReason: "NO_SAME_INVOCATION_ORGANIZATION_FACT_PROOF"},
    operationApplicability: operations.map((operation) => routeRow(operation, m1, m2)).sort((a, b) => a.operationId.localeCompare(b.operationId)),
    factImplementations: [
      factImplementation({ factLoaderId: "WorkspaceCommandAuthorizationFacts", mode: "COMMAND", applicableOperationIds: m1.commandIds, typedInput: "command invocation", typedOutput: "session,assignment,enabled role,permission projection", sameInvocationValidity: "same REQUIRED command transaction", preservedChecks: ["active assignment", "ENABLED role", "password priority", "capability recheck"] }),
      factImplementation({ factLoaderId: "WorkspaceReadAuthorizationFacts", mode: "READ", deferredOperationIds: m1WorkspaceReadAuthorization, typedInput: "read request", typedOutput: "session,assignment,enabled role,permission projection", sameInvocationValidity: "one request-local read context", preservedChecks: ["active assignment", "ENABLED role", "read does not mint owner grant", "session entry excluded"] }),
      factImplementation({ factLoaderId: "SessionEntryAuthenticationFacts", mode: "READ", deferredOperationIds: m2SessionEntry, typedInput: "session-entry request", typedOutput: "authenticated session identity and password-change state", sameInvocationValidity: "one session-entry request", preservedChecks: ["workspace enabled", "SELECT_IDENTITY allowed without current assignment", "PASSWORD_CHANGE_REQUIRED allowed", "does not require active assignment or ENABLED role"] }),
      factImplementation({ factLoaderId: "VisibleOrganizationSessionEntryFacts", mode: "TASK_READ", applicableOperationIds: m2SessionEntry, typedInput: "workspace session entry", typedOutput: "candidates,node/store/head-company,scope context", sameInvocationValidity: "one session-entry invocation", preservedChecks: ["candidate order", "status/workspace/group predicates", "typed failures", "catalog brand judgment"] }),
      factImplementation({ factLoaderId: "VisibleOrganizationFactsC5Command", mode: "C5_COMMAND", deferredOperationIds: m2.commandIds, typedInput: "workspace selection command", typedOutput: "candidates,node/store/head-company,scope context", sameInvocationValidity: "one command invocation after selection validation", preservedChecks: ["candidate order", "status/workspace/group predicates", "typed failures", "no task reader from command"] }),
      factImplementation({ factLoaderId: "VisibleOrganizationFactsTaskRead", mode: "TASK_READ", applicableOperationIds: [], deferredOperationIds: m2TaskReadDeferred, typedInput: "N/A_DEFERRED", typedOutput: "N/A_DEFERRED", sameInvocationValidity: "N/A_DEFERRED", preservedChecks: ["deferred to BP-U05", "protocol read excluded"] }),
      factImplementation({ factLoaderId: "EnabledSelectedWorkspaceFact", mode: "PLATFORM_READ_BRANCH", deferredOperationIds: enabledSelectedWorkspaceDeferredOperationIds, conditionalOperationIds: ["getPlatformEntityAuditHistory"], typedInput: "platform session plus conditional selected workspace key", typedOutput: "workspaceUuid,groupWorkspaceKey,status=ENABLED", sameInvocationValidity: "one platform read request and branch only", preservedChecks: ["GROUP_WORKSPACE plus five workspace target branches retain typed disabled-workspace failure", "PLATFORM_ADMIN branch stays ungated", "no operations-session status gate"] }),
      factImplementation({ factLoaderId: "CatalogCoordinationSnapshot", mode: "CATALOG", applicableOperationIds: m3, typedInput: "catalog operation", typedOutput: "pre-write coordination facts", sameInvocationValidity: "one branch with no write interval", preservedChecks: ["CAS", "asset settlement", "post-write readback"] }),
      factImplementation({ factLoaderId: "DictionaryReferenceSnapshot", mode: "CATALOG", applicableOperationIds: m3, typedInput: "dictionary invocation", typedOutput: "referenced dictionary entries", sameInvocationValidity: "one list or command readback invocation", preservedChecks: ["kind", "status", "scope", "blocking reason"] }),
      factImplementation({ factLoaderId: "ResolvedBomTargets", mode: "INVENTORY", applicableOperationIds: m6, typedInput: "distinct BOM target refs", typedOutput: "target facts keyed by reference", sameInvocationValidity: "one REQUIRED BOM command", preservedChecks: ["input row order", "first failure", "scope", "version", "CAS"] }),
      ...m5Rows.filter((row) => row.disposition === "IMPLEMENT").map((row) => factImplementation({ factLoaderId: row.factLoaderId, mode: "M5", applicableOperationIds: row.operationIds, typedInput: row.typedInput, typedOutput: row.typedOutput, sameInvocationValidity: "same owner and same key with no write interval", preservedChecks: row.preservedChecks })),
    ],
    m5Rows,
    sourceRetirements,
    legacyAllowedImplementations: [],
    sourceRetirementAnchors,
  };
}

function equal(actual, expectedValue, code) { if (JSON.stringify(actual) !== JSON.stringify(expectedValue)) fail(code); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function javaMethodBodies(source, method) {
  const declaration = new RegExp(`\\b${escapeRegex(method)}\\s*\\(`, "g");
  const bodies = [];
  for (let match; (match = declaration.exec(source)) != null;) {
    const linePrefix = source.slice(source.lastIndexOf("\n", match.index) + 1, match.index).trimEnd();
    if (/[.(,=]$/.test(linePrefix)) continue;
    let cursor = source.indexOf("(", match.index), parentheses = 0, parameterQuote = null;
    for (; cursor < source.length; cursor += 1) {
      const current = source[cursor];
      if (parameterQuote) { if (current === "\\") { cursor += 1; continue; } if (current === parameterQuote) parameterQuote = null; continue; }
      if (current === "\"" || current === "'") { parameterQuote = current; continue; }
      if (current === "(") parentheses += 1;
      else if (current === ")" && --parentheses === 0) { cursor += 1; break; }
    }
    const open = source.indexOf("{", cursor);
    if (open < 0) continue;
    let depth = 0, quote = null, lineComment = false, blockComment = false;
    for (let index = open; index < source.length; index += 1) {
      const current = source[index], next = source[index + 1];
      if (lineComment) { if (current === "\n") lineComment = false; continue; }
      if (blockComment) { if (current === "*" && next === "/") { blockComment = false; index += 1; } continue; }
      if (quote) { if (current === "\\") { index += 1; continue; } if (current === quote) quote = null; continue; }
      if (current === "/" && next === "/") { lineComment = true; index += 1; continue; }
      if (current === "/" && next === "*") { blockComment = true; index += 1; continue; }
      if (current === "\"" || current === "'") { quote = current; continue; }
      if (current === "{") depth += 1;
      if (current === "}" && --depth === 0) { bodies.push(source.slice(match.index, index + 1)); break; }
    }
  }
  return bodies;
}
function sourceAnchor(pathMethod, templateAnchor, securityPredicateId, predicateMarker) {
  if (typeof pathMethod !== "string" || !/^[^#]+#[A-Za-z_$][\w$]*$/.test(pathMethod)) fail("BP_U07_SOURCE_ANCHOR_INVALID", String(pathMethod));
  if (pathMethod.includes("..") || path.isAbsolute(pathMethod)) fail("BP_U07_SOURCE_PATH_INVALID", pathMethod);
  if (typeof templateAnchor !== "string" || !templateAnchor || typeof predicateMarker !== "string" || !predicateMarker || !/^[A-Z][A-Z0-9_]+$/.test(securityPredicateId ?? "")) fail("BP_U07_IMPLEMENTATION_MAPPING_INVALID", pathMethod);
  const [relative, method] = pathMethod.split("#");
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  if (!javaMethodBodies(source, method).some((body) => body.includes(templateAnchor) && body.includes(predicateMarker))) fail("BP_U07_SOURCE_ANCHOR_MISSING", pathMethod);
}
function platformAuditHistoryBody() {
  const [relative, method] = platformAuditBranchPolicy.sourcePathMethod.split("#");
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const body = javaMethodBodies(source, method).at(0);
  if (!body) fail("BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING", platformAuditBranchPolicy.sourcePathMethod);
  return body;
}
function validatePlatformAuditBranchBody(body) {
  for (const expression of platformAuditBranchPolicy.enabledBranchExpressions) {
    if (!body.includes(expression)) fail("BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING", expression);
  }
  if (!body.includes(platformAuditBranchPolicy.platformAdminExpression)) fail("BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING", "PLATFORM_ADMIN");
  const platformAdmin = body.slice(body.indexOf(platformAuditBranchPolicy.platformAdminExpression), body.indexOf(";", body.indexOf(platformAuditBranchPolicy.platformAdminExpression)) + 1);
  if (/scope\s*\(/.test(platformAdmin)) fail("BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING", "PLATFORM_ADMIN");
}
function validatePlatformAuditBranchPolicy(row) {
  const policy = row.branchPolicy;
  if (JSON.stringify(policy) !== JSON.stringify(platformAuditBranchPolicy)) fail("BP_U07_PLATFORM_AUDIT_BRANCH_POLICY_DRIFT");
  validatePlatformAuditBranchBody(platformAuditHistoryBody());
}
function directWorkspaceEnabled(body) { return /\bworkspaces\.isEnabled\s*\(/.test(body.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")); }
function validateMappings(value) {
  if ("implementationMappings" in value || !Array.isArray(value.factImplementations)) fail("BP_U07_IMPLEMENTATION_MAPPINGS_INVALID");
  for (const row of value.factImplementations) {
    if (row.implementationStatus?.startsWith("DEFERRED_")
      && (!Array.isArray(row.applicableOperationIds) || row.applicableOperationIds.length !== 0
        || !Array.isArray(row.deferredOperationIds) || row.deferredOperationIds.length !== row.blockedOperationCount)) {
      fail("BP_U07_DEFERRED_OPERATION_ENCODING_INVALID", row.factLoaderId);
    }
    const control = factImplementationControls.find((candidate) => candidate.factLoaderId === row.factLoaderId);
    if (!control) fail("BP_U07_FACT_IMPLEMENTATION_CONTROL_MISSING", row.factLoaderId);
    if (control.implementationStatus === "IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED" || control.sourcePathMethod) {
      sourceAnchor(row.sourcePathMethod, row.statementTemplateAnchor, row.securityPredicateId, row.predicateMarker);
      if (row.statementTemplateHash !== mappingWithHashes(control).statementTemplateHash) fail("BP_U07_TEMPLATE_HASH_DRIFT", row.factLoaderId);
      if (control.branchPolicy) {
        if (row.blockedOperationCount !== control.blockedOperationCount) fail("BP_U07_DEFERRED_IMPLEMENTATION_STATUS_REQUIRED", row.factLoaderId);
        validatePlatformAuditBranchPolicy(row);
      }
    } else if (!row.implementationStatus.startsWith("DEFERRED_") || row.sourcePathMethod !== "N/A_DEFERRED" || row.statementTemplateAnchor !== "N/A_DEFERRED" || row.statementTemplateHash !== "N/A_DEFERRED" || row.securityPredicateId !== "N/A_DEFERRED" || row.predicateMarker !== "N/A_DEFERRED" || row.blockedOperationCount !== control.blockedOperationCount) {
      fail("BP_U07_DEFERRED_IMPLEMENTATION_STATUS_REQUIRED", row.factLoaderId);
    }
  }
  const anchors = value.sourceRetirementAnchors;
  if (anchors?.implementationStatus !== "IMPLEMENTED_SOURCE_ABSENCE_UNMEASURED") fail("BP_U07_M4_RETIREMENT_STATUS_REQUIRED");
  if (anchors.retiredPostAuth?.length !== 6 || anchors.retainedPreAuth?.length !== 5) fail("BP_U07_M4_SOURCE_ANCHOR_MISSING", "exact-set");
  for (const [relative, method] of anchors.retiredPostAuth) {
    if (typeof relative !== "string" || relative.includes("..") || path.isAbsolute(relative)) fail("BP_U07_M4_SOURCE_PATH_INVALID", String(relative));
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    const bodies = javaMethodBodies(source, method);
    if (bodies.length === 0 || bodies.some(directWorkspaceEnabled)) fail("BP_U07_M4_SOURCE_ANCHOR_MISSING", `${relative}#${method}`);
  }
  for (const [relative, method] of anchors.retainedPreAuth) {
    if (typeof relative !== "string" || relative.includes("..") || path.isAbsolute(relative)) fail("BP_U07_M4_SOURCE_PATH_INVALID", String(relative));
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    const bodies = javaMethodBodies(source, method);
    if (bodies.length === 0 || bodies.some((body) => !directWorkspaceEnabled(body))) fail("BP_U07_M4_SOURCE_ANCHOR_MISSING", `${relative}#${method}`);
  }
  if (!Array.isArray(value.legacyAllowedImplementations) || value.legacyAllowedImplementations.length !== 0) fail("BP_U07_LEGACY_ALLOWLIST_DRIFT");
}
function bindingAdapterSourcePaths() {
  const { value } = json(bindingPath);
  if (!Array.isArray(value?.operations) || value.operations.length !== 196) fail("BP_U07_BINDING_DENOMINATOR_INVALID");
  const adapters = new Set(value.operations.map((binding) => binding.adapter).filter(Boolean));
  const sourceRoot = "apps/backend/catering-business-server";
  return fs.readdirSync(path.join(root, sourceRoot), { recursive: true })
    .filter((relative) => typeof relative === "string" && relative.endsWith(".java"))
    .map((relative) => `${sourceRoot}/${relative}`)
    .filter((relative) => adapters.has(relative.slice(relative.indexOf("/java/") + 6, -5).replaceAll("/", ".")))
    .sort();
}
function validateBindingAdapterText(sourcePath, source) {
  if (/\b(?:JdbcTemplate|NamedParameterJdbcTemplate|DataSource|Connection|DriverManager)\b|\bjava\.sql\b/.test(source)) fail("BP_U07_BINDING_ADAPTER_DIRECT_JDBC", sourcePath);
  if (source.includes("legacyAllowedImplementations")) fail("BP_U07_BINDING_ADAPTER_LEGACY_REFERENCE", sourcePath);
}
function validateBindingAdapters() {
  for (const relative of bindingAdapterSourcePaths()) {
    const absolute = path.join(root, relative);
    if (fs.existsSync(absolute)) validateBindingAdapterText(relative, fs.readFileSync(absolute, "utf8"));
  }
}
function jsonlTuples(absolute) {
  const tuples = new Set();
  for (const line of fs.readFileSync(absolute, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (typeof row.operationId === "string" && typeof row.requestId === "string") tuples.add(`${row.operationId}\u0000${row.requestId}`);
  }
  return tuples;
}
function snapshotObservedTuples(snapshot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, "snapshot-manifest.json"), "utf8"));
  const inputs = Array.isArray(manifest.inputs) ? manifest.inputs : [];
  const named = (kind) => inputs.find((input) => input.kind === kind)?.snapshotPath;
  const db = named("DATABASE_OPERATIONS"), events = named("REQUEST_EVENTS");
  if (typeof db !== "string" || typeof events !== "string" || db.includes("..") || events.includes("..")) fail("BP_U07_SNAPSHOT_TUPLE_INPUT_INVALID");
  const dbTuples = jsonlTuples(path.join(snapshot, db)), eventTuples = jsonlTuples(path.join(snapshot, events));
  return new Set([...dbTuples].filter((tuple) => eventTuples.has(tuple)));
}
function validateMeasuredSnapshot(value, snapshot) {
  const observed = snapshotObservedTuples(snapshot);
  for (const row of value.operationApplicability.filter((candidate) => candidate.coverageStatus === "MEASURED_NEW_FIXTURE")) {
    if (!Array.isArray(row.measurementTuples) || !row.measurementTuples.some((tuple) => tuple?.operationId === row.operationId && typeof tuple.requestId === "string" && observed.has(`${tuple.operationId}\u0000${tuple.requestId}`))) fail("BP_U07_MEASURED_TUPLE_MISSING", row.operationId);
  }
}
function validateSnapshot(snapshot, value) {
  if (!snapshot || snapshot.endsWith("db-operations.jsonl") || !path.isAbsolute(snapshot) || !/[/\\]snapshots[/\\][a-f0-9]{64}$/.test(snapshot)) fail("BP_U07_SNAPSHOT_ONLY_INPUT_REQUIRED", snapshot ?? "");
  const result = spawnSync(process.execPath, [path.join(root, snapshotCheckPath), "--check", snapshot], {encoding: "utf8"});
  if (result.status !== 0) fail("BP_U07_SNAPSHOT_INVALID", (result.stderr || result.stdout).trim());
  const finalAdmission = spawnSync(process.execPath, [path.join(root, finalAcceptancePath), "--check", snapshot], {encoding: "utf8"});
  if (finalAdmission.status !== 0) fail("BP_U07_FINAL_SNAPSHOT_ADMISSION_INVALID", (finalAdmission.stderr || finalAdmission.stdout).trim());
  validateMeasuredSnapshot(value, snapshot);
}
function validate(value) {
  const wanted = expected();
  if (value?.schemaVersion !== 1 || value.kind !== wanted.kind) fail("BP_U07_APPLICABILITY_IDENTITY_INVALID");
  validateMappings(value);
  validateBindingAdapters();
  for (const key of ["sourceRegistries", "denominators", "m1BindingPartition", "m1ReadFactPartition", "m2SourceProvenPartition", "operationApplicability", "factImplementations", "m5Rows", "sourceRetirements", "legacyAllowedImplementations", "sourceRetirementAnchors"]) equal(value[key], wanted[key], `BP_U07_${key.toUpperCase()}_DRIFT`);
  if (value.operationApplicability.some((row) => row.coverageStatus !== "UNMEASURED_BLOCKS_OPTIMIZATION")) fail("BP_U07_UNMEASURED_STATUS_REQUIRED");
}

function write() { fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(expected(), null, 2)}\n`); }
function scratch(mutator, expectedCode) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-u07-applicability-"));
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, outputPath), "utf8")); mutator(value);
    try { validate(value); fail("BP_U07_RED_MUTATION_ACCEPTED", expectedCode); } catch (error) { if (error.message.split(":")[0] !== expectedCode) throw error; }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function selfTest() {
  const value = JSON.parse(fs.readFileSync(path.join(root, outputPath), "utf8"));
  validate(value);
  scratch((value) => value.operationApplicability.pop(), "BP_U07_OPERATIONAPPLICABILITY_DRIFT");
  scratch((value) => value.operationApplicability[0].owner = "wrong-owner", "BP_U07_OPERATIONAPPLICABILITY_DRIFT");
  scratch((value) => value.m1BindingPartition.protocolReadExemptions.pop(), "BP_U07_M1BINDINGPARTITION_DRIFT");
  scratch((value) => value.m1BindingPartition.commandOperationIds.pop(), "BP_U07_M1BINDINGPARTITION_DRIFT");
  scratch((value) => value.m1BindingPartition.readOperationIds.push(value.m1BindingPartition.commandOperationIds.pop()), "BP_U07_M1BINDINGPARTITION_DRIFT");
  scratch((value) => value.m1ReadFactPartition.workspaceReadAuthorizationOperationIds.push("getOperationsWorkspaceSessionEntry"), "BP_U07_M1READFACTPARTITION_DRIFT");
  scratch((value) => value.m2SourceProvenPartition.commandOperationIds.pop(), "BP_U07_M2SOURCEPROVENPARTITION_DRIFT");
  scratch((value) => value.m5Rows[0].operationIds = [], "BP_U07_M5ROWS_DRIFT");
  scratch((value) => value.sourceRetirements.retainedPreAuthExpressions.pop(), "BP_U07_SOURCERETIREMENTS_DRIFT");
  scratch((value) => value.operationApplicability[0].coverageStatus = "MEASURED_NEW_FIXTURE", "BP_U07_OPERATIONAPPLICABILITY_DRIFT");
  scratch((value) => value.factImplementations.find((row) => row.factLoaderId === "CommercialGroupPreState").statementTemplateAnchor = "missing anchor", "BP_U07_SOURCE_ANCHOR_MISSING");
  scratch((value) => value.factImplementations.find((row) => row.factLoaderId === "WorkspaceReadAuthorizationFacts").applicableOperationIds.push("unexpected-operation"), "BP_U07_DEFERRED_OPERATION_ENCODING_INVALID");
  scratch((value) => value.factImplementations.find((row) => row.factLoaderId === "WorkspaceReadAuthorizationFacts").deferredOperationIds.pop(), "BP_U07_DEFERRED_OPERATION_ENCODING_INVALID");
  scratch((value) => value.factImplementations.find((row) => row.factLoaderId === "EnabledSelectedWorkspaceFact").branchPolicy.enabledBranchExpressions.pop(), "BP_U07_PLATFORM_AUDIT_BRANCH_POLICY_DRIFT");
  try { validatePlatformAuditBranchBody(platformAuditHistoryBody().replace("new PlatformAuditHistoryQuery.WorkspaceRole", "new PlatformAuditHistoryQuery.PlatformAdmin")); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING") throw error; }
  scratch((value) => value.sourceRetirementAnchors.retainedPreAuth.pop(), "BP_U07_M4_SOURCE_ANCHOR_MISSING");
  try { validateBindingAdapterText("fixture.java", "JdbcTemplate jdbc"); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_BINDING_ADAPTER_DIRECT_JDBC"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_BINDING_ADAPTER_DIRECT_JDBC") throw error; }
  try { validateBindingAdapterText("fixture.java", "legacyAllowedImplementations"); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_BINDING_ADAPTER_LEGACY_REFERENCE"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_BINDING_ADAPTER_LEGACY_REFERENCE") throw error; }
  const snapshot = path.join(root, ".runtime", "r5", "snapshots", "650f35d79dbfcb7d3dac3ff9368e056e5edb5751590bf5877bf5c844a6f8d666");
  const fakeMeasured = structuredClone(value); fakeMeasured.operationApplicability[0].coverageStatus = "MEASURED_NEW_FIXTURE"; fakeMeasured.operationApplicability[0].measurementTuples = [{operationId: fakeMeasured.operationApplicability[0].operationId, requestId: "missing-request"}];
  try { validateMeasuredSnapshot(fakeMeasured, snapshot); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_MEASURED_TUPLE_MISSING"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_MEASURED_TUPLE_MISSING") throw error; }
  try { validateSnapshot(path.join(root, ".runtime", "r5", "evidence", "db-operations.jsonl"), value); fail("BP_U07_RED_LIVE_INPUT_ACCEPTED"); } catch (error) { if (!error.message.startsWith("BP_U07_SNAPSHOT_ONLY_INPUT_REQUIRED:")) throw error; }
  console.log("BP_U07_APPLICABILITY_SELF_TEST=PASS"); console.log("RED_FIXTURES=19");
}
try {
  const [argument, snapshotFlag, snapshot] = process.argv.slice(2);
  if (argument === "--write") { write(); console.log("BP_U07_APPLICABILITY_GENERATION=PASS"); }
  else if (argument === "--check") { if (snapshotFlag != null && (snapshotFlag !== "--snapshot" || !snapshot)) fail("BP_U07_SNAPSHOT_ARGUMENT_INVALID"); const value = JSON.parse(fs.readFileSync(path.join(root, outputPath), "utf8")); validate(value); if (snapshot) validateSnapshot(path.resolve(snapshot), value); console.log("BP_U07_APPLICABILITY_CHECK=PASS"); console.log("ROUTES=196"); console.log("TASK_READ=78"); console.log("SQL_M1_COMMAND=68"); console.log("SQL_M1_READ=58"); console.log("SQL_M1_APPLICABLE=126"); console.log("SQL_M2_C5_COMMAND=2"); console.log("SQL_M2_TASK_READ=58"); console.log("SQL_M2_APPLICABLE=60"); console.log("SQL_M3=25"); console.log("SQL_M6=11"); console.log(snapshot ? "BP_U07_SNAPSHOT=PASS" : "BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED"); }
  else if (argument === "--self-test" && snapshotFlag == null) selfTest();
  else fail("BP_U07_APPLICABILITY_ARGUMENT_INVALID");
} catch (error) { console.error(error.message); process.exitCode = 1; }
