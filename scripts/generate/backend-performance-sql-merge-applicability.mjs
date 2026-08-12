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
const commandProfilesPath = "contracts/registry/backend-performance-command-enforcement-profiles.json";
const commandTopologyPath = "contracts/registry/backend-performance-command-topology-matrix.json";
const m1ExecutionMatrixPath = "contracts/registry/backend-performance-m1-command-execution-matrix.json";
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

const m1CommandArchitectureControls = [
  {
    sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java",
    method: "commandAuthorizationFacts",
    required: ["activeAuthorizationRow(rawToken)", "commandScopeContext(row)", "new WorkspaceCommandAuthorizationFacts("],
    forbidden: ["sessionCache.", "visibility."],
  },
  {
    sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsSessionResolver.java",
    method: "requireWorkspaceCommandFacts",
    required: ["sessions.commandAuthorizationFacts(token(request))", "facts.sessionReadback().groupWorkspaceKey()"],
    forbidden: ["sessions.session(token(request))"],
  },
  {
    sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolver.java",
    method: "resolveWithCapability",
    required: ["taskPaths.commandTaskPathFacts(", "pathFacts.assignmentScopeAllowed()"],
    forbidden: ["taskPaths.requireTaskPath(", "taskPaths.isScopeAllowed("],
  },
  {
    sourcePath: "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java",
    method: "commandTaskPathFacts",
    required: ["TaskPath taskPath", "scopeAllowed(assignmentType, assignmentId, taskPath)"],
    forbidden: ["isScopeAllowed("],
  },
  {
    sourcePath: "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java",
    method: "resolveCommandTarget",
    required: ["commandTaskPathFacts(session, assignment, expectedTargetType, requestedTargetRef)", "facts.assignmentScopeAllowed()"],
    forbidden: ["taskPaths.requireTaskPath(", "taskPaths.isScopeAllowed("],
  },
  {
    sourcePath: "apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java",
    method: "catalogWorkspaceCommandHandlers",
    required: ["@Transactional public JsonNode createCatalogItem", "@Transactional public JsonNode releaseCatalogAsset"],
    forbidden: [],
    requiredOccurrences: {"@Transactional public JsonNode": 25},
  },
];

const m1CommandBoundaryControls = [
  {sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java", commandCount: 15, commandSessionMinimum: 1, edgeTransactionForbidden: true},
  {sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/context/OperationsWorkspaceUserController.java", commandCount: 5, commandSessionMinimum: 1, edgeTransactionForbidden: true},
  {sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java", commandCount: 3, commandSessionMinimum: 3, edgeTransactionForbidden: true},
  {sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java", commandCount: 9, commandSessionMinimum: 9, edgeTransactionForbidden: true},
  {sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java", commandCount: 5, commandSessionMinimum: 5, edgeTransactionForbidden: true},
  {sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsHeadCompanyAuthorizationController.java", commandCount: 2, commandSessionMinimum: 2, edgeTransactionForbidden: true},
  {sourcePath: "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/contract/OperationsContractController.java", commandCount: 3, commandSessionMinimum: 1, edgeTransactionForbidden: true},
  {sourcePath: "apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java", commandCount: 26, catalogCoordinator: true},
];

const gateDiagnosticCatalog = {
  BP_U07_COMMAND_PROFILE_INPUT_INVALID: ["the profile registry is missing, malformed, or bound to stale handler bytes", "the 113-command denominator is the contract for operations, platform, and public mutations", "regenerate or correct the five closed profiles from operation-handler-bindings before editing runtime sources"],
  BP_U07_COMMAND_PROFILE_COVERAGE_DRIFT: ["a command tuple has no unique declared profile or a profile covers no command", "a known tuple is not a substitute for an explicit endpoint-to-owner topology", "make the five profile tuples exactly equal to the current COMMAND tuple set"],
  BP_U07_COMMAND_PROFILE_UNRESOLVED: ["a command cannot be classified by the closed profile registry", "face, context, boundary and REQUIRED transaction determine whether workspace grant rules apply", "add the reviewed profile/topology admission for the command; never infer it from a name"],
  BP_U07_COMMAND_TOPOLOGY_INPUT_INVALID: ["the 113-row topology matrix is missing, malformed, or has a wrong denominator", "every command must retain a real edge, context and owner/protocol chain", "restore a source-hash-bound topology row for every current command before runtime implementation"],
  BP_U07_COMMAND_TOPOLOGY_COVERAGE_DRIFT: ["topology operation IDs no longer equal the COMMAND registry denominator", "future commands must not inherit safety merely from an existing profile", "add or remove the exact topology row so the two sets are equal"],
  BP_U07_COMMAND_TOPOLOGY_DRIFT: ["a topology row disagrees with its authoritative binding or route registry", "HTTP face, owner, route and adapter are an end-to-end command contract", "repair the row from the authoritative registry; do not patch controller behavior to match stale metadata"],
  BP_U07_M1_EXECUTION_INPUT_INVALID: ["the 68-row M1 execution matrix is missing, malformed, or has a wrong denominator", "the shared operations-admin command context requires one explicit typed boundary per selected operation", "restore all 68 source-bound rows before editing an M1 runtime chain"],
  BP_U07_M1_EXECUTION_COVERAGE_DRIFT: ["execution matrix operation IDs no longer equal the selected M1 set", "all WORKSPACE_OWNER_COMMAND operations must receive the same admission discipline", "make matrix IDs exactly equal to the derived M1 IDs"],
  BP_U07_M1_EXECUTION_BINDING_DRIFT: ["an M1 row disagrees with its topology, registry adapter, route, or transaction entry", "a typed one-operation handler prevents generic dispatch and wrong-owner routing", "derive the row from the matching topology/binding entry and keep the adapter one-to-one"],
  BP_U07_M1_UNRESOLVED_SOURCE: ["a required source anchor is unresolved or unsafe", "authorization, DTO, owner and readback facts cannot be guessed from operation names", "replace the placeholder with a real reviewed source anchor; do not use a naming-based substitute"],
  BP_U07_M1_RUNTIME_CLOSURE_PENDING: ["static runtime admission still has pending adapters, catalog owner migrations, or P1 DTOs", "declared pending is allowed only during incremental implementation and is never completion", "finish the typed sources and generated DTO/owner migration, then update statuses before closure"],
  BP_U07_M1_HANDLER_DUPLICATE: ["two M1 operations share an adapter FQCN or source path", "each operation needs a unique transaction boundary so context and owner invocation cannot dispatch generically", "give every operation its own declared adapter source"],
  BP_U07_M1_OPERATION_ID_LITERAL_DRIFT: ["an existing adapter does not declare its exact operation literal", "the literal binds generated edge routing to one concrete transaction handler", "restore the exact OPERATION_ID matching the matrix row"],
  BP_U07_M1_TRANSACTION_REQUIRED: ["an existing adapter lacks a REQUIRED transaction boundary", "one command must resolve context and call owners inside its single command transaction", "place REQUIRED on the declared adapter entry, never on the edge"],
  BP_U07_M1_TRANSACTION_ENTRY_MISSING: ["the declared adapter entry method is absent", "the generated binding must enter one explicit typed command boundary", "restore the exact matrix entry method or correct the reviewed matrix/source together"],
  BP_U07_M1_GENERIC_OR_DATA_ESCAPE: ["an adapter uses generic dispatch, JDBC/repository/entity access, or another data-owner escape", "composition adapters orchestrate typed public owner APIs and hold no facts or data access", "remove the escape and call only the declared typed owner API"],
  BP_U07_NON_M1_TOPOLOGY_SOURCE_ANCHOR_INVALID: ["a non-M1 protocol/platform/public anchor is missing or does not name an existing source method", "the 45 non-M1 commands are not exempt from topology verification; only M1 workspace-grant assertions are N/A", "bind context, transaction owner and public API to real source methods"],
  BP_U07_NON_M1_TOPOLOGY_KIND_INVALID: ["a non-M1 topology uses an incompatible context/transaction/API kind", "public protocol has no authenticated owner context while platform and workspace protocol retain their own origins", "use the profile-specific declared topology kind; do not recast it as a workspace command"],
  BP_U07_M1_EDGE_TRANSACTION_FORBIDDEN: ["an edge controller owns a transaction", "edge code only decodes/maps; the named application adapter owns REQUIRED", "remove the edge annotation and enter through the declared adapter"],
};
const genericGateDiagnostic = ["a mechanical command-topology invariant failed", "command safety preserves owner sovereignty, typed REQUIRED boundaries, authorization context and readback; static checks never prove JDBC savings", "repair the declared registry/source relationship and rerun this mandatory gate; do not bypass it or substitute a runtime test"];
function fail(code, detail = "") {
  const [why, background, pattern] = gateDiagnosticCatalog[code] ?? genericGateDiagnostic;
  const suffix = detail ? `; DETAIL=${detail}` : "";
  throw new Error(`${code}: WHY=${why}; BACKGROUND=${background}; PATTERN=${pattern}${suffix}`);
}
function diagnosticComplete(error) { return ["WHY=", "BACKGROUND=", "PATTERN="].every((marker) => error.message.includes(marker)); }
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
    m1CommandArchitectureControls,
    m1CommandBoundaryControls,
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
function sourceForControl(control, sourceOverrides) {
  return sourceOverrides?.get(control.sourcePath) ?? fs.readFileSync(path.join(root, control.sourcePath), "utf8");
}
function validateM1CommandArchitecture(sourceOverrides = new Map()) {
  for (const control of m1CommandArchitectureControls) {
    const source = sourceForControl(control, sourceOverrides);
    const body = control.method === "catalogWorkspaceCommandHandlers"
      ? source
      : javaMethodBodies(source, control.method).at(0);
    if (!body) fail("BP_U07_M1_COMMAND_SOURCE_MISSING", `${control.sourcePath}#${control.method}`);
    for (const required of control.required) {
      if (!body.includes(required)) fail("BP_U07_M1_COMMAND_PATTERN_MISSING", `${control.sourcePath}#${control.method}:${required}`);
    }
    for (const forbidden of control.forbidden) {
      if (body.includes(forbidden)) fail("BP_U07_M1_COMMAND_LEGACY_PATH_PRESENT", `${control.sourcePath}#${control.method}:${forbidden}`);
    }
    for (const [needle, count] of Object.entries(control.requiredOccurrences ?? {})) {
      if (body.split(needle).length - 1 !== count) fail("BP_U07_M1_COMMAND_TRANSACTION_BOUNDARY_DRIFT", `${control.sourcePath}:${needle}`);
    }
  }
}
function count(source, needle) { return source.split(needle).length - 1; }
function validateM1CommandBoundaries(sourceOverrides = new Map()) {
  let total = 0;
  for (const control of m1CommandBoundaryControls) {
    const source = sourceOverrides.get(control.sourcePath) ?? fs.readFileSync(path.join(root, control.sourcePath), "utf8");
    if (control.catalogCoordinator) {
      const handlerCount = count(source, "@Transactional public JsonNode");
      if (handlerCount !== 25 || !source.includes("@Transactional\n    public JsonNode stageWorkspaceAsset")) {
        fail("BP_U07_M1_COMMAND_TRANSACTION_BOUNDARY_DRIFT", control.sourcePath);
      }
    } else {
      if (control.edgeTransactionForbidden && source.includes("@Transactional")) fail("BP_U07_M1_EDGE_TRANSACTION_FORBIDDEN", control.sourcePath);
      const commandBoundaryCount = count(source, "requireWorkspaceCommand(") + count(source, "requireWorkspaceCommandFacts(");
      if (commandBoundaryCount < control.commandSessionMinimum) fail("BP_U07_M1_COMMAND_SESSION_BOUNDARY_DRIFT", control.sourcePath);
      if (source.includes("sessions.requireWorkspace(")) fail("BP_U07_M1_COMMAND_LEGACY_SESSION_PRESENT", control.sourcePath);
    }
    total += control.commandCount;
  }
  if (total !== 68) fail("BP_U07_M1_COMMAND_BOUNDARY_DENOMINATOR_DRIFT", String(total));
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
function exactSet(actual, expectedValue, code) {
  if (actual.size !== expectedValue.size || [...actual].some((value) => !expectedValue.has(value))) fail(code);
}
function safeAnchor(anchor, code) {
  if (typeof anchor !== "string" || !anchor || anchor.includes("UNRESOLVED_REQUIRES_SOURCE") || anchor.includes("..") || path.isAbsolute(anchor)) fail(code, String(anchor));
}
function existingJavaAnchor(anchor, code) {
  safeAnchor(anchor, code);
  const separator = anchor.lastIndexOf("#"), relative = anchor.slice(0, separator), method = anchor.slice(separator + 1);
  if (separator < 1 || !relative.endsWith(".java") || !/^[A-Za-z_$][\w$]*$/.test(method) || !fs.existsSync(path.join(root, relative))) fail(code, anchor);
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  if (!javaMethodBodies(source, method).length && !new RegExp(`\\b${escapeRegex(method)}\\s*\\(`).test(source)) fail(code, anchor);
}
function profileTuple(row) { return [row.face, row.contextKind, row.commandBoundary, row.transactionMode].join("\u0000"); }
function profileDefinitionTuple(row) { return [row.consumerFace, row.contextKind, row.commandBoundary, row.transactionMode].join("\u0000"); }
function topologyInputs(overrides = {}) {
  const input = (relative) => overrides[relative] ?? json(relative).value;
  const {bytes, value: binding} = json(bindingPath);
  const commands = binding?.operations?.filter((row) => row.mode === "COMMAND");
  if (!Array.isArray(binding?.operations) || binding.operations.length !== 196 || !Array.isArray(commands) || commands.length !== 113) fail("BP_U07_COMMAND_DENOMINATOR_DRIFT");
  return {
    bindingSha256: digest(bytes),
    commands,
    profiles: input(commandProfilesPath),
    topology: input(commandTopologyPath),
    execution: input(m1ExecutionMatrixPath),
  };
}
function commandRouteIndex() {
  const index = new Map();
  for (const registry of sourceRegistries()) {
    for (const operation of registry.operations) {
      if (index.has(operation.operationId)) fail("BP_U07_COMMAND_ROUTE_DUPLICATE", operation.operationId);
      index.set(operation.operationId, {...operation, registryPath: registry.path});
    }
  }
  return index;
}
function validatePresentM1Adapter(row) {
  const source = fs.readFileSync(path.join(root, row.adapterSourcePath), "utf8");
  if (!source.includes(`OPERATION_ID = "${row.operationId}"`)) fail("BP_U07_M1_OPERATION_ID_LITERAL_DRIFT", row.operationId);
  if (!/@Transactional[\s\S]{0,160}Propagation\.REQUIRED/.test(source)) fail("BP_U07_M1_TRANSACTION_REQUIRED", row.operationId);
  if (!javaMethodBodies(source, row.transactionEntry.methodName).length) fail("BP_U07_M1_TRANSACTION_ENTRY_MISSING", row.operationId);
  if (/\b(?:Map|ObjectNode|Function|JdbcTemplate|NamedParameterJdbcTemplate|DataSource|Connection|DriverManager|EntityManager)\b|\.repository\.|\.domain\./.test(source)) fail("BP_U07_M1_GENERIC_OR_DATA_ESCAPE", row.operationId);
}
const requiredNamedOrganizationOwnerMethods = new Map([
  ["transitionOperationsOrganizationBrandStatus", "transitionBrandStatus"],
  ["transitionOperationsOrganizationTenantStatus", "transitionTenantStatus"],
  ["transitionOperationsOrganizationNodeStatus", "transitionNodeStatus"],
]);
function validateCommandTopology({closure = false, overrides = {}} = {}) {
  const {bindingSha256, commands, profiles, topology, execution} = topologyInputs(overrides);
  if (profiles?.schemaVersion !== 1 || profiles.kind !== "backend-performance-command-enforcement-profiles" || profiles.source?.path !== bindingPath || profiles.source.sha256 !== bindingSha256 || !Array.isArray(profiles.profiles) || profiles.profiles.length !== 5) fail("BP_U07_COMMAND_PROFILE_INPUT_INVALID");
  if (topology?.schemaVersion !== 1 || topology.kind !== "backend-performance-command-topology-matrix" || topology.admissionPhase !== "STATIC_RUNTIME_ADMISSION" || topology.source?.operationHandlerBindings?.path !== bindingPath || topology.source.operationHandlerBindings.sha256 !== bindingSha256 || !Array.isArray(topology.rows) || topology.rows.length !== 113) fail("BP_U07_COMMAND_TOPOLOGY_INPUT_INVALID");
  if (execution?.schemaVersion !== 1 || execution.kind !== "backend-performance-m1-command-execution-matrix" || execution.source?.path !== bindingPath || execution.source.sha256 !== bindingSha256 || execution.admissionPhase !== "STATIC_RUNTIME_ADMISSION" || !Array.isArray(execution.rows) || execution.rows.length !== 68) fail("BP_U07_M1_EXECUTION_INPUT_INVALID");
  const profilesById = new Map(), profilesByTuple = new Map();
  for (const profile of profiles.profiles) {
    const tuple = profileDefinitionTuple(profile);
    if (!profile?.profileId || profilesById.has(profile.profileId) || profilesByTuple.has(tuple) || !["APPLICABLE", "NOT_APPLICABLE_WITH_REASON"].includes(profile.workspaceGrantAssertion)) fail("BP_U07_COMMAND_PROFILE_INVALID", profile?.profileId);
    profilesById.set(profile.profileId, profile); profilesByTuple.set(tuple, profile);
  }
  const commandIds = new Set(commands.map((row) => row.operationId));
  exactSet(new Set(profilesByTuple.keys()), new Set(commands.map(profileTuple)), "BP_U07_COMMAND_PROFILE_COVERAGE_DRIFT");
  const profileByOperation = new Map(), m1Ids = new Set();
  for (const command of commands) {
    const profile = profilesByTuple.get(profileTuple(command));
    if (!profile || command.transactionMode !== "REQUIRED") fail("BP_U07_COMMAND_PROFILE_UNRESOLVED", command.operationId);
    profileByOperation.set(command.operationId, profile);
    if (profile.enforcementMode === "M1_EXECUTION_MATRIX_REQUIRED") m1Ids.add(command.operationId);
  }
  if (m1Ids.size !== 68) fail("BP_U07_M1_PROFILE_DENOMINATOR_DRIFT", String(m1Ids.size));
  const routes = commandRouteIndex(), topologyById = new Map();
  for (const row of topology.rows) {
    const command = commands.find((candidate) => candidate.operationId === row?.operationId), route = routes.get(row?.operationId), profile = profileByOperation.get(row?.operationId);
    if (!command || !route || !profile || topologyById.has(row.operationId)) fail("BP_U07_COMMAND_TOPOLOGY_OPERATION_INVALID", row?.operationId);
    if (row.profileId !== profile.profileId || row.owner !== command.owner || row.declaredRegistryAdapter?.fqcn !== command.adapter || row.route?.method !== route.method || row.route.path !== route.path || !row.route.routeRegistry?.endsWith(route.registryPath.split("/").at(-1))) fail("BP_U07_COMMAND_TOPOLOGY_DRIFT", row.operationId);
    safeAnchor(row.edge?.sourceAnchor, "BP_U07_COMMAND_TOPOLOGY_SOURCE_ANCHOR_INVALID");
    if (m1Ids.has(row.operationId)) {
      if (!row.m1Runtime || !["DECLARED_RUNTIME_SOURCE_PENDING", "IMPLEMENTED_SOURCE_ANCHORED"].includes(row.implementationStatus) || row.m1Runtime.executionMatrixOperationId !== row.operationId || row.m1Runtime.entryMethod !== "execute" || row.workspaceGrantAssertion?.status !== "APPLICABLE_IN_M1_EXECUTION_MATRIX") fail("BP_U07_M1_TOPOLOGY_INVALID", row.operationId);
    } else {
      if (row.implementationStatus !== "SOURCE_IMPLEMENTED_NON_M1" || row.m1Runtime !== null || row.workspaceGrantAssertion?.status !== "NOT_APPLICABLE_WITH_REASON" || !row.workspaceGrantAssertion.reason) fail("BP_U07_NON_M1_TOPOLOGY_INVALID", row.operationId);
      const expectedContextKind = profile.profileId === "PUBLIC_PROTOCOL" ? "PUBLIC_PROTOCOL_NO_AUTHENTICATED_OWNER_CONTEXT" : "CURRENT_EDGE_CONTEXT_ORIGIN";
      if (row.contextOrigin?.kind !== expectedContextKind || row.transactionOwner?.kind !== "CURRENT_OWNER_OR_PROTOCOL_ENTRY" || row.ownerOrProtocolApi?.kind !== "CURRENT_PUBLIC_OWNER_OR_PROTOCOL_API") fail("BP_U07_NON_M1_TOPOLOGY_KIND_INVALID", row.operationId);
      for (const anchor of [row.edge.sourceAnchor, row.contextOrigin.sourceAnchor, row.transactionOwner.sourceAnchor, row.ownerOrProtocolApi.sourceAnchor]) existingJavaAnchor(anchor, "BP_U07_NON_M1_TOPOLOGY_SOURCE_ANCHOR_INVALID");
    }
    topologyById.set(row.operationId, row);
  }
  exactSet(new Set(topologyById.keys()), commandIds, "BP_U07_COMMAND_TOPOLOGY_COVERAGE_DRIFT");
  const executionById = new Map(); let pending = 0, catalogMigration = 0, p1WirePending = 0;
  for (const row of execution.rows) {
    const command = commands.find((candidate) => candidate.operationId === row?.operationId), route = routes.get(row?.operationId), topologyRow = topologyById.get(row?.operationId);
    if (!m1Ids.has(row?.operationId) || !command || !route || !topologyRow || executionById.has(row.operationId)) fail("BP_U07_M1_EXECUTION_OPERATION_INVALID", row?.operationId);
    if (row.owner !== command.owner || row.face !== command.face || row.routeRegistry !== command.routeRegistry || row.method !== route.method || row.path !== route.path || row.topologyOperationId !== row.operationId || row.adapterFqcn !== command.adapter || row.adapterFqcn !== topologyRow.declaredRegistryAdapter.fqcn || row.adapterSourcePath !== topologyRow.m1Runtime.sourcePath || row.implementationStatus !== topologyRow.implementationStatus || row.transactionEntry?.className !== row.adapterFqcn || row.transactionEntry.methodName !== "execute" || row.transactionEntry.propagation !== "REQUIRED") fail("BP_U07_M1_EXECUTION_BINDING_DRIFT", row.operationId);
    for (const anchor of [row.transactionEntry.sourceAnchor, row.edge?.sourceAnchor, row.context?.sourceAnchor, row.ownerInvocation?.sourceAnchor, ...(row.sourceAnchors ?? [])]) safeAnchor(anchor, "BP_U07_M1_UNRESOLVED_SOURCE");
    if (!row.context?.resolverFqcn || !row.context.resolverVariant || row.context.contextKind !== "WORKSPACE_EXECUTION_CONTEXT" || row.context.tokenPolicy !== "WORKSPACE_COMMAND_OPERATION_TOKEN" || !row.edge?.className || !row.edge.methodName || !row.edge.sourcePath || !row.edge.requestDto?.fqcn || !row.edge.responseDto?.fqcn || !Array.isArray(row.edge.serverOnlyArguments) || !Array.isArray(row.sourceAnchors) || row.sourceAnchors.length === 0 || !["OWNER_READBACK", "NO_CONTENT"].includes(row.responseMode)) fail("BP_U07_M1_EXECUTION_FIELDS_INVALID", row.operationId);
    const ownerInvocationValid = row.ownerInvocation?.kind === "CURRENT_NAMED_OWNER_API"
      ? Boolean(row.ownerInvocation.fqcn && row.ownerInvocation.methodName)
      : row.ownerInvocation?.kind === "TYPED_OWNER_API"
        ? Boolean(row.ownerInvocation.apiFqcn && row.ownerInvocation.apiSourcePath && row.ownerInvocation.implementationFqcn
          && row.ownerInvocation.implementationSourcePath && row.ownerInvocation.methodName
          && row.ownerInvocation.commandType && row.ownerInvocation.readbackType)
        : row.ownerInvocation?.kind === "MIGRATION_SOURCE_GENERIC_COORDINATOR" && row.ownerInvocation.declaredTypedTargetRequired === true;
    if (!["PRESENT_EDGE_JAVA_WIRE", "GENERATED_P1_DTO_PENDING", "GENERATED_P1_DTO_SOURCE_ANCHORED"].includes(row.edge.requestDto.kind) || !["PRESENT_EDGE_JAVA_WIRE", "GENERATED_P1_DTO_PENDING", "GENERATED_P1_DTO_SOURCE_ANCHORED"].includes(row.edge.responseDto.kind) || !ownerInvocationValid) fail("BP_U07_M1_EXECUTION_ADMISSION_INVALID", row.operationId);
    const exists = fs.existsSync(path.join(root, row.adapterSourcePath));
    if (row.implementationStatus === "DECLARED_RUNTIME_SOURCE_PENDING") { if (exists) fail("BP_U07_M1_PENDING_SOURCE_PRESENT", row.operationId); pending += 1; }
    else if (row.implementationStatus === "IMPLEMENTED_SOURCE_ANCHORED") { if (!exists) fail("BP_U07_M1_IMPLEMENTED_SOURCE_MISSING", row.operationId); validatePresentM1Adapter(row); }
    else fail("BP_U07_M1_IMPLEMENTATION_STATUS_INVALID", row.operationId);
    if (row.ownerInvocation.kind === "MIGRATION_SOURCE_GENERIC_COORDINATOR") catalogMigration += 1;
    const requiredNamedOwnerMethod = requiredNamedOrganizationOwnerMethods.get(row.operationId);
    if (requiredNamedOwnerMethod && (row.ownerInvocation.methodName !== requiredNamedOwnerMethod
        || !row.ownerInvocation.sourceAnchor.endsWith(`#${requiredNamedOwnerMethod}`)
        || !row.context.targetResourceValueSource.endsWith(`#${requiredNamedOwnerMethod}`)
        || !row.context.readbackProducer.endsWith(`#${requiredNamedOwnerMethod}`))) {
      fail("BP_U07_M1_EXECUTION_ADMISSION_INVALID", row.operationId);
    }
    if (row.edge.requestDto.kind === "GENERATED_P1_DTO_PENDING" || row.edge.responseDto.kind === "GENERATED_P1_DTO_PENDING") p1WirePending += 1;
    executionById.set(row.operationId, row);
  }
  exactSet(new Set(executionById.keys()), m1Ids, "BP_U07_M1_EXECUTION_COVERAGE_DRIFT");
  if (new Set([...executionById.values()].map((row) => row.adapterFqcn)).size !== 68 || new Set([...executionById.values()].map((row) => row.adapterSourcePath)).size !== 68) fail("BP_U07_M1_HANDLER_DUPLICATE");
  if (closure && (pending || catalogMigration || p1WirePending)) fail("BP_U07_M1_RUNTIME_CLOSURE_PENDING", `${pending}:${catalogMigration}:${p1WirePending}`);
  return {pending, catalogMigration, p1WirePending};
}
function validate(value, topologyOptions = {}) {
  const wanted = expected();
  if (value?.schemaVersion !== 1 || value.kind !== wanted.kind) fail("BP_U07_APPLICABILITY_IDENTITY_INVALID");
  validateMappings(value);
  validateBindingAdapters();
  validateM1CommandArchitecture();
  validateM1CommandBoundaries();
  topologyOptions.summary = validateCommandTopology(topologyOptions);
  for (const key of ["sourceRegistries", "denominators", "m1BindingPartition", "m1ReadFactPartition", "m2SourceProvenPartition", "operationApplicability", "factImplementations", "m5Rows", "sourceRetirements", "legacyAllowedImplementations", "sourceRetirementAnchors", "m1CommandArchitectureControls", "m1CommandBoundaryControls"]) equal(value[key], wanted[key], `BP_U07_${key.toUpperCase()}_DRIFT`);
  if (value.operationApplicability.some((row) => row.coverageStatus !== "UNMEASURED_BLOCKS_OPTIMIZATION")) fail("BP_U07_UNMEASURED_STATUS_REQUIRED");
}

function write() { fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(expected(), null, 2)}\n`); }
function scratch(mutator, expectedCode) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-u07-applicability-"));
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, outputPath), "utf8")); mutator(value);
    try { validate(value); fail("BP_U07_RED_MUTATION_ACCEPTED", expectedCode); } catch (error) { if (error.message.split(":")[0] !== expectedCode || !diagnosticComplete(error)) throw error; }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function selfTest() {
  const value = JSON.parse(fs.readFileSync(path.join(root, outputPath), "utf8"));
  validate(value);
  const profiles = json(commandProfilesPath).value, topology = json(commandTopologyPath).value, execution = json(m1ExecutionMatrixPath).value;
  const topologyScratch = (mutator, expectedCode, closure = false) => {
    const overrides = {[commandProfilesPath]: structuredClone(profiles), [commandTopologyPath]: structuredClone(topology), [m1ExecutionMatrixPath]: structuredClone(execution)};
    mutator(overrides);
    try { validateCommandTopology({overrides, closure}); fail("BP_U07_RED_MUTATION_ACCEPTED", expectedCode); } catch (error) { if (error.message.split(":")[0] !== expectedCode || !diagnosticComplete(error)) throw error; }
  };
  topologyScratch((inputs) => inputs[commandProfilesPath].profiles[0].contextKind = "UNKNOWN_FUTURE_CONTEXT", "BP_U07_COMMAND_PROFILE_COVERAGE_DRIFT");
  topologyScratch((inputs) => inputs[commandTopologyPath].rows.pop(), "BP_U07_COMMAND_TOPOLOGY_INPUT_INVALID");
  topologyScratch((inputs) => inputs[m1ExecutionMatrixPath].rows.pop(), "BP_U07_M1_EXECUTION_INPUT_INVALID");
  topologyScratch((inputs) => inputs[m1ExecutionMatrixPath].rows[0].context.sourceAnchor = "UNRESOLVED_REQUIRES_SOURCE", "BP_U07_M1_UNRESOLVED_SOURCE");
  topologyScratch((inputs) => inputs[m1ExecutionMatrixPath].rows[1].adapterFqcn = inputs[m1ExecutionMatrixPath].rows[0].adapterFqcn, "BP_U07_M1_EXECUTION_BINDING_DRIFT");
  topologyScratch((inputs) => inputs[commandTopologyPath].rows.find((row) => row.implementationStatus === "SOURCE_IMPLEMENTED_NON_M1").contextOrigin.sourceAnchor = "missing/NonM1.java#missing", "BP_U07_NON_M1_TOPOLOGY_SOURCE_ANCHOR_INVALID");
  topologyScratch((inputs) => {
    const row = inputs[m1ExecutionMatrixPath].rows.find((candidate) => candidate.routeRegistry === "catalog-inventory");
    row.ownerInvocation = {...row.ownerInvocation, kind: "MIGRATION_SOURCE_GENERIC_COORDINATOR", declaredTypedTargetRequired: true};
  }, "BP_U07_M1_RUNTIME_CLOSURE_PENDING", true);
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
  {
    const control = m1CommandArchitectureControls[0];
    const source = sourceForControl(control, new Map());
    const needle = "ReadAuthorizationRow row = activeAuthorizationRow(rawToken);";
    const index = source.lastIndexOf(needle);
    if (index < 0) fail("BP_U07_SELF_TEST_FIXTURE_INVALID", needle);
    const mutated = `${source.slice(0, index)}ReadAuthorizationRow row = session(rawToken);${source.slice(index + needle.length)}`;
    try { validateM1CommandArchitecture(new Map([[control.sourcePath, mutated]])); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_M1_COMMAND_PATTERN_MISSING"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_M1_COMMAND_PATTERN_MISSING") throw error; }
  }
  {
    const control = m1CommandArchitectureControls[5];
    const source = sourceForControl(control, new Map());
    const mutated = source.replace("@Transactional public JsonNode createCatalogItem", "public JsonNode createCatalogItem");
    try { validateM1CommandArchitecture(new Map([[control.sourcePath, mutated]])); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_M1_COMMAND_PATTERN_MISSING"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_M1_COMMAND_PATTERN_MISSING") throw error; }
  }
  {
    const control = m1CommandArchitectureControls[2];
    const source = sourceForControl(control, new Map());
    const mutated = source.replace("pathFacts.assignmentScopeAllowed()", "true");
    try { validateM1CommandArchitecture(new Map([[control.sourcePath, mutated]])); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_M1_COMMAND_PATTERN_MISSING"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_M1_COMMAND_PATTERN_MISSING") throw error; }
  }
  {
    const control = m1CommandBoundaryControls[3];
    const source = sourceForControl(control, new Map());
    const mutated = source.replace("ResponseEntity<Brand> createBrand", "@Transactional\n    ResponseEntity<Brand> createBrand");
    try { validateM1CommandBoundaries(new Map([[control.sourcePath, mutated]])); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_M1_EDGE_TRANSACTION_FORBIDDEN"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_M1_EDGE_TRANSACTION_FORBIDDEN") throw error; }
  }
  try { validateBindingAdapterText("fixture.java", "JdbcTemplate jdbc"); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_BINDING_ADAPTER_DIRECT_JDBC"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_BINDING_ADAPTER_DIRECT_JDBC") throw error; }
  try { validateBindingAdapterText("fixture.java", "legacyAllowedImplementations"); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_BINDING_ADAPTER_LEGACY_REFERENCE"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_BINDING_ADAPTER_LEGACY_REFERENCE") throw error; }
  const snapshot = path.join(root, ".runtime", "r5", "snapshots", "650f35d79dbfcb7d3dac3ff9368e056e5edb5751590bf5877bf5c844a6f8d666");
  const fakeMeasured = structuredClone(value); fakeMeasured.operationApplicability[0].coverageStatus = "MEASURED_NEW_FIXTURE"; fakeMeasured.operationApplicability[0].measurementTuples = [{operationId: fakeMeasured.operationApplicability[0].operationId, requestId: "missing-request"}];
  try { validateMeasuredSnapshot(fakeMeasured, snapshot); fail("BP_U07_RED_MUTATION_ACCEPTED", "BP_U07_MEASURED_TUPLE_MISSING"); } catch (error) { if (error.message.split(":")[0] !== "BP_U07_MEASURED_TUPLE_MISSING") throw error; }
  try { validateSnapshot(path.join(root, ".runtime", "r5", "evidence", "db-operations.jsonl"), value); fail("BP_U07_RED_LIVE_INPUT_ACCEPTED"); } catch (error) { if (!error.message.startsWith("BP_U07_SNAPSHOT_ONLY_INPUT_REQUIRED:")) throw error; }
  console.log("BP_U07_APPLICABILITY_SELF_TEST=PASS"); console.log("BP_U07_COMMAND_TOPOLOGY_RED_MUTATIONS=PASS"); console.log("RED_FIXTURES=29");
}
try {
  const [argument, ...options] = process.argv.slice(2);
  const closure = options.includes("--closure");
  const snapshotIndex = options.indexOf("--snapshot");
  const snapshot = snapshotIndex >= 0 ? options[snapshotIndex + 1] : undefined;
  if (argument === "--write") { write(); console.log("BP_U07_APPLICABILITY_GENERATION=PASS"); }
  else if (argument === "--check") {
    const permitted = new Set(["--closure", "--snapshot", snapshot]);
    if (options.some((option) => !permitted.has(option)) || (snapshotIndex >= 0 && (!snapshot || snapshotIndex !== options.length - 2))) fail("BP_U07_SNAPSHOT_ARGUMENT_INVALID");
    const value = JSON.parse(fs.readFileSync(path.join(root, outputPath), "utf8")); const topologyOptions = {closure}; validate(value, topologyOptions); if (snapshot) validateSnapshot(path.resolve(snapshot), value);
    console.log("BP_U07_APPLICABILITY_CHECK=PASS"); console.log("ROUTES=196"); console.log("TASK_READ=78"); console.log("SQL_M1_COMMAND=68"); console.log("COMMAND_PROFILES=5"); console.log("COMMAND_TOPOLOGY=113"); console.log("M1_EXECUTION_MATRIX=68"); console.log(`M1_RUNTIME_SOURCES_PENDING=${topologyOptions.summary.pending}`); console.log(`M1_CATALOG_OWNER_MIGRATIONS_PENDING=${topologyOptions.summary.catalogMigration}`); console.log(`M1_CATALOG_P1_WIRES_PENDING=${topologyOptions.summary.p1WirePending}`); console.log(closure ? "BP_U07_M1_RUNTIME_CLOSURE=PASS" : "BP_U07_M1_RUNTIME_CLOSURE=NOT_REQUESTED"); console.log("SQL_M1_READ=58"); console.log("SQL_M1_APPLICABLE=126"); console.log("SQL_M2_C5_COMMAND=2"); console.log("SQL_M2_TASK_READ=58"); console.log("SQL_M2_APPLICABLE=60"); console.log("SQL_M3=25"); console.log("SQL_M6=11"); console.log(snapshot ? "BP_U07_SNAPSHOT=PASS" : "BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED");
  }
  else if (argument === "--self-test" && options.length === 0) selfTest();
  else fail("BP_U07_APPLICABILITY_ARGUMENT_INVALID");
} catch (error) { console.error(error.message); process.exitCode = 1; }
