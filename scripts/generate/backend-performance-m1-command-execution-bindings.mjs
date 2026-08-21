#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bindingsPath = "contracts/registry/operation-handler-bindings.json";
const generatedSourcePath = "apps/backend/catering-business-server/build/generated/sources/backend-performance-m1-command-execution/main/java/com/catering/v2s/app/edge/generated/backendperformancem1/BackendPerformanceM1CommandExecutionBindings.java";
const catalogP1TaskName = "generateCatalogInventoryP1BackendWire";
const selectedTuple = Object.freeze({
  face: "operations-admin",
  mode: "COMMAND",
  commandBoundary: "OWNER_COMMAND",
  transactionMode: "REQUIRED",
  contextKind: "WORKSPACE_EXECUTION_CONTEXT",
});

function fail(code) { throw new Error(code); }
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }
function bindingMethodName(operationId) {
  return `bind${operationId.slice(0, 1).toUpperCase()}${operationId.slice(1)}`;
}

function selectedRows(bindings) {
  return bindings.operations
    .filter((row) => Object.entries(selectedTuple).every(([key, value]) => row[key] === value))
    .map((row) => ({...row, adapterFqcn: row.adapter, edge: {methodName: bindingMethodName(row.operationId)}}));
}

function validate(bindings) {
  if (bindings?.schemaVersion !== 1 || bindings?.kind !== "operation-handler-bindings" || !Array.isArray(bindings.operations)) fail("OPERATION_COMMAND_BINDINGS_SOURCE_INVALID");
  const rows = selectedRows(bindings);
  if (rows.length === 0) fail("OPERATION_COMMAND_BINDINGS_SOURCE_EMPTY");
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.operationId)) fail("OPERATION_COMMAND_BINDINGS_DUPLICATE:" + row.operationId);
    seen.add(row.operationId);
    if (typeof row.adapter !== "string" || row.adapter.length === 0 || typeof row.owner !== "string" || row.owner.length === 0 || !emitters.has(row.operationId)) {
      fail("OPERATION_COMMAND_BINDING_EMITTER_MISSING:" + row.operationId);
    }
  }
  return rows;
}

function emitCountOperationsInventoryTarget(row) {
  if (row.adapterFqcn !== "com.catering.v2s.inventory.application.operations.CountOperationsInventoryTargetOperation") {
    fail("BP_M1_COUNT_BINDING_SOURCE_DRIFT");
  }
  return `    public InventoryWriteReadback ${row.edge.methodName}(InventoryCountRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String targetRef, String idempotencyKey) {\n        return countOperationsInventoryTarget.execute(new CountOperationsInventoryTargetOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, targetRef, idempotencyKey));\n    }`;
}

function emitInventoryMutation(row, requestType, adapterType, field) {
  return `    public InventoryWriteReadback ${row.edge.methodName}(${requestType} request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String targetRef, String idempotencyKey) {\n        return ${field}.execute(new ${adapterType}.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, targetRef, idempotencyKey));\n    }`;
}

function emitProductionTag(row, requestType, adapterType, field, hasPath) {
  const path = hasPath ? ", String tagCode" : "";
  const invocation = hasPath ? ", tagCode, idempotencyKey" : ", idempotencyKey";
  return `    public ProductionTagReadback ${row.edge.methodName}(${requestType} request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId${path}, String idempotencyKey) {\n        return ${field}.execute(new ${adapterType}.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId${invocation}));\n    }`;
}

function emitIncreaseOperationsInventoryTarget(row) {
  return emitInventoryMutation(row, "InventoryIncreaseRequest", "IncreaseOperationsInventoryTargetOperation", "increaseOperationsInventoryTarget");
}

function emitAdjustOperationsInventoryTarget(row) {
  return emitInventoryMutation(row, "InventoryAdjustmentRequest", "AdjustOperationsInventoryTargetOperation", "adjustOperationsInventoryTarget");
}

function emitUpdateOperationsInventoryTargetConfiguration(row) {
  return `    public InventoryTargetCurrentView ${row.edge.methodName}(InventoryTargetConfigurationRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String targetRef, String idempotencyKey) {\n        return updateOperationsInventoryTargetConfiguration.execute(new UpdateOperationsInventoryTargetConfigurationOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, targetRef, idempotencyKey));\n    }`;
}

function emitCreateOperationsProductionTag(row) {
  return emitProductionTag(row, "ProductionTagCreateRequest", "CreateOperationsProductionTagOperation", "createOperationsProductionTag", false);
}

function emitUpdateOperationsProductionTag(row) {
  return emitProductionTag(row, "ProductionTagUpdateRequest", "UpdateOperationsProductionTagOperation", "updateOperationsProductionTag", true);
}

function emitTransitionOperationsProductionTagStatus(row) {
  return emitProductionTag(row, "ProductionTagTransitionRequest", "TransitionOperationsProductionTagStatusOperation", "transitionOperationsProductionTagStatus", true);
}

function emitStageOperationsCatalogAsset(row) {
  return `    public StagedCatalogAsset ${row.edge.methodName}(CatalogAssetStageRequest request, long contentLength, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String testFailurePoint, String idempotencyKey) {\n        return stageOperationsCatalogAsset.execute(new StageOperationsCatalogAssetMultipartOperation.Invocation(request, contentLength, sessionCredential, requestedBrandRef, correlationId, requestId, testFailurePoint, idempotencyKey));\n    }`;
}

function emitReleaseOperationsCatalogStagedAsset(row) {
  return `    public CatalogAssetReleaseReadback ${row.edge.methodName}(CatalogAssetReleaseRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String assetRef, String idempotencyKey) {\n        return releaseOperationsCatalogStagedAsset.execute(new ReleaseOperationsCatalogStagedAssetOperation.Invocation(request, assetRef, sessionCredential, requestedBrandRef, correlationId, requestId, idempotencyKey));\n    }`;
}

function emitStoreCommand(row, commandType, adapterType, field) {
  return `    public ${adapterType}.Result ${row.edge.methodName}(${commandType} command) {\n        return ${field}.execute(command);\n    }`;
}

function emitContractCommand(row, commandType, adapterType, field) {
  return `    public OperationsStoreContractCommandApi.StoreContractTaskReadback ${row.edge.methodName}(${commandType} command) {\n        return ${field}.execute(command);\n    }`;
}

function emitOrganizationCommand(row, commandType, readbackType, adapterType, field) {
  return `    public ${readbackType} ${row.edge.methodName}(${commandType} command) {\n        return ${field}.execute(command);\n    }`;
}

function emitOperationsOwnerBindingCommand(row, commandType, field) {
  return `    public com.catering.v2s.collaboration.api.CollaborationReadback.OwnerBinding ${row.edge.methodName}(${commandType} command) {\n        return ${field}.execute(command);\n    }`;
}

function emitCatalogCategory(row, requestType, readbackType, adapterType, field, hasCategoryRef) {
  const categoryRef = hasCategoryRef ? ", String categoryRef" : "";
  const invocation = hasCategoryRef ? ", categoryRef, idempotencyKey" : ", idempotencyKey";
  return `    public ${readbackType} ${row.edge.methodName}(${requestType} request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId${categoryRef}, String idempotencyKey) {\n        return ${field}.execute(new ${adapterType}.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId${invocation}));\n    }`;
}

function emitCatalogDictionary(row, requestType, readbackType, adapterType, field, hasEntryCode) {
  const entryCode = hasEntryCode ? ", String entryCode" : "";
  const invocation = hasEntryCode ? ", dictionaryKind, entryCode, idempotencyKey" : ", dictionaryKind, idempotencyKey";
  return `    public ${readbackType} ${row.edge.methodName}(${requestType} request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String dictionaryKind${entryCode}, String idempotencyKey) {\n        return ${field}.execute(new ${adapterType}.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId${invocation}));\n    }`;
}

function emitCatalogDefinition(row, requestType, readbackType, adapterType, field, hasDefinitionRef) {
  const definitionRef = hasDefinitionRef ? ", String definitionRef" : "";
  const invocation = hasDefinitionRef ? ", definitionRef, idempotencyKey" : ", idempotencyKey";
  return `    public ${readbackType} ${row.edge.methodName}(${requestType} request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId${definitionRef}, String idempotencyKey) {\n        return ${field}.execute(new ${adapterType}.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId${invocation}));\n    }`;
}

function emitCatalogUnit(row, requestType, readbackType, adapterType, field, hasUnitRef) {
  const unitRef = hasUnitRef ? ", String unitRef" : "";
  const invocation = hasUnitRef ? ", unitRef, idempotencyKey" : ", idempotencyKey";
  return `    public ${readbackType} ${row.edge.methodName}(${requestType} request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId${unitRef}, String idempotencyKey) {\n        return ${field}.execute(new ${adapterType}.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId${invocation}));\n    }`;
}

function emitCatalogItemCreate(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.CatalogItemCommandReadback ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.CatalogItemCreateRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String idempotencyKey) {\n        return createOperationsCatalogItem.execute(new com.catering.v2s.catalog.application.operations.CreateOperationsCatalogItemOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, idempotencyKey));\n    }`;
}

function emitCatalogItemTransition(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.CatalogItemCommandReadback ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.CatalogItemTransitionRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String itemCode, String testFailurePoint, String idempotencyKey) {\n        return transitionOperationsCatalogItemStatus.execute(new com.catering.v2s.catalog.application.operations.TransitionOperationsCatalogItemStatusOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, itemCode, testFailurePoint, idempotencyKey));\n    }`;
}

function emitCatalogItemBatch(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.CatalogItemBatchStatusTransitionReadback ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.CatalogItemBatchStatusTransitionRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String idempotencyKey) {\n        return batchTransitionOperationsCatalogItemStatus.execute(new com.catering.v2s.catalog.application.operations.BatchTransitionOperationsCatalogItemStatusOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, idempotencyKey));\n    }`;
}

function emitCatalogItemSave(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.CatalogItemSaveReadback ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.CatalogItemSaveRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String itemCode, String idempotencyKey, java.util.List<com.catering.v2s.platform.asset.api.CatalogAssetCommandApi.AssetBinding> assetBindings) {\n        return saveOperationsCatalogItem.execute(new com.catering.v2s.catalog.application.operations.SaveOperationsCatalogItemOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, itemCode, idempotencyKey, assetBindings));\n    }`;
}

function emitTemporaryPromotionPreflight(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflight ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflightRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String itemCode, String idempotencyKey) {\n        return preflightOperationsTemporaryCatalogItemPromotion.execute(new com.catering.v2s.catalog.application.operations.PreflightOperationsTemporaryCatalogItemPromotionOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, itemCode, idempotencyKey));\n    }`;
}

function emitTemporaryPromotionExecute(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.CatalogItemCommandReadback ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.TemporaryPromotionExecuteRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String itemCode, String idempotencyKey) {\n        return executeOperationsTemporaryCatalogItemPromotion.execute(new com.catering.v2s.catalog.application.operations.ExecuteOperationsTemporaryCatalogItemPromotionOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, itemCode, idempotencyKey));\n    }`;
}

function emitLocalCopyPreflight(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.LocalCopyPreflight ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.LocalCopyPreflightRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String idempotencyKey) {\n        return preflightOperationsLocalCatalogCopy.execute(new com.catering.v2s.catalog.application.operations.PreflightOperationsLocalCatalogCopyOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, idempotencyKey));\n    }`;
}

function emitLocalCopyExecute(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.LocalCopyReadback ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.LocalCopyExecuteRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String idempotencyKey) {\n        return executeOperationsLocalCatalogCopy.execute(new com.catering.v2s.catalog.application.operations.ExecuteOperationsLocalCatalogCopyOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, idempotencyKey));\n    }`;
}

function emitBrandCopyPreflight(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyPreflight ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.BrandCopyPreflightRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String idempotencyKey) {\n        return preflightOperationsBrandCatalogCopy.execute(new com.catering.v2s.catalog.application.operations.PreflightOperationsBrandCatalogCopyOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, idempotencyKey));\n    }`;
}

function emitBrandCopyExecute(row) {
  return `    public com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyReadback ${row.edge.methodName}(com.catering.v2s.app.edge.generated.wire.BrandCopyExecuteRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String testFailurePoint, String idempotencyKey) {\n        return executeOperationsBrandCatalogCopy.execute(new com.catering.v2s.catalog.application.operations.ExecuteOperationsBrandCatalogCopyOperation.Invocation(request, sessionCredential, requestedBrandRef, correlationId, requestId, testFailurePoint, idempotencyKey));\n    }`;
}

const workspaceInvitationTargetTypes = Object.freeze({
  cancelOperationsWorkspaceGroupInvitation: "GROUP",
  cancelOperationsWorkspaceHeadCompanyInvitation: "HEAD_COMPANY",
  cancelOperationsWorkspaceProjectInvitation: "PROJECT",
  cancelOperationsWorkspaceRegionInvitation: "REGION",
  cancelOperationsWorkspaceStoreInvitation: "STORE",
  createOperationsWorkspaceGroupInvitation: "GROUP",
  createOperationsWorkspaceHeadCompanyInvitation: "HEAD_COMPANY",
  createOperationsWorkspaceProjectInvitation: "PROJECT",
  createOperationsWorkspaceRegionInvitation: "REGION",
  createOperationsWorkspaceStoreInvitation: "STORE",
  reissueOperationsWorkspaceGroupInvitation: "GROUP",
  reissueOperationsWorkspaceHeadCompanyInvitation: "HEAD_COMPANY",
  reissueOperationsWorkspaceProjectInvitation: "PROJECT",
  reissueOperationsWorkspaceRegionInvitation: "REGION",
  reissueOperationsWorkspaceStoreInvitation: "STORE",
});

function workspaceInvitationTargetType(row) {
  const targetType = workspaceInvitationTargetTypes[row.operationId];
  if (!targetType) fail(`BP_M1_WORKSPACE_INVITATION_TARGET_MISSING:${row.operationId}`);
  return targetType;
}

function emitWorkspaceInvitationCreate(row, field) {
  return `    public com.catering.v2s.workspace.iam.application.WorkspaceInvitationService.ManagementInvitationView ${row.edge.methodName}(com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts facts, com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationCreateRequest request, com.catering.v2s.audit.contract.AuditActor actor) {\n        return ${field}.execute(facts, com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.${workspaceInvitationTargetType(row)}, request, actor);\n    }`;
}
function emitWorkspaceInvitationCancel(row, field) {
  return `    public com.catering.v2s.workspace.iam.application.WorkspaceInvitationService.ManagementInvitationView ${row.edge.methodName}(com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts facts, java.util.UUID invitationId, com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest request, com.catering.v2s.audit.contract.AuditActor actor) {\n        return ${field}.execute(facts, com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.${workspaceInvitationTargetType(row)}, invitationId, request, actor);\n    }`;
}
function emitWorkspaceInvitationReissue(row, field) {
  return `    public com.catering.v2s.workspace.iam.application.WorkspaceInvitationService.ManagementInvitationView ${row.edge.methodName}(com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts facts, java.util.UUID invitationId, com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest request, com.catering.v2s.audit.contract.AuditActor actor) {\n        return ${field}.execute(facts, com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.${workspaceInvitationTargetType(row)}, invitationId, request, actor);\n    }`;
}
function emitWorkspaceUserAssignmentRevoke(row, adapterType, field) {
  return `    public com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi.OperationsAssignmentRevokeReadback ${row.edge.methodName}(com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts facts, java.util.UUID assignmentId, com.catering.v2s.app.edge.generated.wire.WorkspaceUserRevokeRequest request, String idempotencyKey, com.catering.v2s.audit.contract.AuditActor actor) {\n        return ${field}.execute(facts, assignmentId, request, idempotencyKey, actor);\n    }`;
}

const workspaceInvitationFamilies = Object.freeze({
  cancel: {type: "CancelOperationsWorkspaceInvitationOperation", field: "cancelOperationsWorkspaceInvitation", importPath: "com.catering.v2s.workspace.iam.application.operations.CancelOperationsWorkspaceInvitationOperation", emitter: emitWorkspaceInvitationCancel},
  create: {type: "CreateOperationsWorkspaceInvitationOperation", field: "createOperationsWorkspaceInvitation", importPath: "com.catering.v2s.workspace.iam.application.operations.CreateOperationsWorkspaceInvitationOperation", emitter: emitWorkspaceInvitationCreate},
  reissue: {type: "ReissueOperationsWorkspaceInvitationOperation", field: "reissueOperationsWorkspaceInvitation", importPath: "com.catering.v2s.workspace.iam.application.operations.ReissueOperationsWorkspaceInvitationOperation", emitter: emitWorkspaceInvitationReissue},
});

function workspaceInvitationDependency(operationId) {
  const family = operationId.startsWith("cancelOperationsWorkspace")
    ? workspaceInvitationFamilies.cancel
    : operationId.startsWith("createOperationsWorkspace")
      ? workspaceInvitationFamilies.create
      : operationId.startsWith("reissueOperationsWorkspace")
        ? workspaceInvitationFamilies.reissue
        : fail(`BP_M1_WORKSPACE_INVITATION_FAMILY_MISSING:${operationId}`);
  return {
    type: family.type,
    field: family.field,
    importPath: family.importPath,
    emitter: (row) => family.emitter(row, family.field),
  };
}

const workspaceInvitationBindingDependencies = new Map(
  Object.keys(workspaceInvitationTargetTypes).map((operationId) => [operationId, workspaceInvitationDependency(operationId)]),
);

const additionalBindingDependencies = new Map([
  ...workspaceInvitationBindingDependencies,
  ["revokeOperationsWorkspaceGroupUserAssignment", {type: "RevokeOperationsWorkspaceGroupUserAssignmentOperation", field: "revokeOperationsWorkspaceGroupUserAssignment", importPath: "com.catering.v2s.workspace.iam.application.operations.RevokeOperationsWorkspaceGroupUserAssignmentOperation", emitter: (row) => emitWorkspaceUserAssignmentRevoke(row, "RevokeOperationsWorkspaceGroupUserAssignmentOperation", "revokeOperationsWorkspaceGroupUserAssignment")}],
  ["revokeOperationsWorkspaceRegionUserAssignment", {type: "RevokeOperationsWorkspaceRegionUserAssignmentOperation", field: "revokeOperationsWorkspaceRegionUserAssignment", importPath: "com.catering.v2s.workspace.iam.application.operations.RevokeOperationsWorkspaceRegionUserAssignmentOperation", emitter: (row) => emitWorkspaceUserAssignmentRevoke(row, "RevokeOperationsWorkspaceRegionUserAssignmentOperation", "revokeOperationsWorkspaceRegionUserAssignment")}],
  ["revokeOperationsWorkspaceProjectUserAssignment", {type: "RevokeOperationsWorkspaceProjectUserAssignmentOperation", field: "revokeOperationsWorkspaceProjectUserAssignment", importPath: "com.catering.v2s.workspace.iam.application.operations.RevokeOperationsWorkspaceProjectUserAssignmentOperation", emitter: (row) => emitWorkspaceUserAssignmentRevoke(row, "RevokeOperationsWorkspaceProjectUserAssignmentOperation", "revokeOperationsWorkspaceProjectUserAssignment")}],
  ["revokeOperationsWorkspaceHeadCompanyUserAssignment", {type: "RevokeOperationsWorkspaceHeadCompanyUserAssignmentOperation", field: "revokeOperationsWorkspaceHeadCompanyUserAssignment", importPath: "com.catering.v2s.workspace.iam.application.operations.RevokeOperationsWorkspaceHeadCompanyUserAssignmentOperation", emitter: (row) => emitWorkspaceUserAssignmentRevoke(row, "RevokeOperationsWorkspaceHeadCompanyUserAssignmentOperation", "revokeOperationsWorkspaceHeadCompanyUserAssignment")}],
  ["revokeOperationsWorkspaceStoreUserAssignment", {type: "RevokeOperationsWorkspaceStoreUserAssignmentOperation", field: "revokeOperationsWorkspaceStoreUserAssignment", importPath: "com.catering.v2s.workspace.iam.application.operations.RevokeOperationsWorkspaceStoreUserAssignmentOperation", emitter: (row) => emitWorkspaceUserAssignmentRevoke(row, "RevokeOperationsWorkspaceStoreUserAssignmentOperation", "revokeOperationsWorkspaceStoreUserAssignment")}],
  ["createOperationsCatalogItem", {type: "CreateOperationsCatalogItemOperation", field: "createOperationsCatalogItem", importPath: "com.catering.v2s.catalog.application.operations.CreateOperationsCatalogItemOperation", emitter: emitCatalogItemCreate}],
  ["saveOperationsCatalogItem", {type: "SaveOperationsCatalogItemOperation", field: "saveOperationsCatalogItem", importPath: "com.catering.v2s.catalog.application.operations.SaveOperationsCatalogItemOperation", emitter: emitCatalogItemSave}],
 ["transitionOperationsCatalogItemStatus", {type: "TransitionOperationsCatalogItemStatusOperation", field: "transitionOperationsCatalogItemStatus", importPath: "com.catering.v2s.catalog.application.operations.TransitionOperationsCatalogItemStatusOperation", emitter: emitCatalogItemTransition}],
  ["batchTransitionOperationsCatalogItemStatus", {type: "BatchTransitionOperationsCatalogItemStatusOperation", field: "batchTransitionOperationsCatalogItemStatus", importPath: "com.catering.v2s.catalog.application.operations.BatchTransitionOperationsCatalogItemStatusOperation", emitter: emitCatalogItemBatch}],
  ["preflightOperationsTemporaryCatalogItemPromotion", {type: "PreflightOperationsTemporaryCatalogItemPromotionOperation", field: "preflightOperationsTemporaryCatalogItemPromotion", importPath: "com.catering.v2s.catalog.application.operations.PreflightOperationsTemporaryCatalogItemPromotionOperation", emitter: emitTemporaryPromotionPreflight}],
  ["executeOperationsTemporaryCatalogItemPromotion", {type: "ExecuteOperationsTemporaryCatalogItemPromotionOperation", field: "executeOperationsTemporaryCatalogItemPromotion", importPath: "com.catering.v2s.catalog.application.operations.ExecuteOperationsTemporaryCatalogItemPromotionOperation", emitter: emitTemporaryPromotionExecute}],
  ["preflightOperationsLocalCatalogCopy", {type: "PreflightOperationsLocalCatalogCopyOperation", field: "preflightOperationsLocalCatalogCopy", importPath: "com.catering.v2s.catalog.application.operations.PreflightOperationsLocalCatalogCopyOperation", emitter: emitLocalCopyPreflight}],
  ["executeOperationsLocalCatalogCopy", {type: "ExecuteOperationsLocalCatalogCopyOperation", field: "executeOperationsLocalCatalogCopy", importPath: "com.catering.v2s.catalog.application.operations.ExecuteOperationsLocalCatalogCopyOperation", emitter: emitLocalCopyExecute}],
  ["preflightOperationsBrandCatalogCopy", {type: "PreflightOperationsBrandCatalogCopyOperation", field: "preflightOperationsBrandCatalogCopy", importPath: "com.catering.v2s.catalog.application.operations.PreflightOperationsBrandCatalogCopyOperation", emitter: emitBrandCopyPreflight}],
  ["executeOperationsBrandCatalogCopy", {type: "ExecuteOperationsBrandCatalogCopyOperation", field: "executeOperationsBrandCatalogCopy", importPath: "com.catering.v2s.catalog.application.operations.ExecuteOperationsBrandCatalogCopyOperation", emitter: emitBrandCopyExecute}],
  ["stageOperationsCatalogAsset", {type: "StageOperationsCatalogAssetMultipartOperation", field: "stageOperationsCatalogAsset", importPath: "com.catering.v2s.platform.asset.application.operations.StageOperationsCatalogAssetMultipartOperation", emitter: emitStageOperationsCatalogAsset}],
  ["releaseOperationsCatalogStagedAsset", {type: "ReleaseOperationsCatalogStagedAssetOperation", field: "releaseOperationsCatalogStagedAsset", importPath: "com.catering.v2s.platform.asset.application.operations.ReleaseOperationsCatalogStagedAssetOperation", emitter: emitReleaseOperationsCatalogStagedAsset}],
  ["createOperationsCatalogCategory", {type: "CreateOperationsCatalogCategoryOperation", field: "createOperationsCatalogCategory", importPath: "com.catering.v2s.catalog.application.operations.CreateOperationsCatalogCategoryOperation", emitter: (row) => emitCatalogCategory(row, "CatalogCategoryCreateRequest", "CatalogCategoryReadback", "CreateOperationsCatalogCategoryOperation", "createOperationsCatalogCategory", false)}],
  ["updateOperationsCatalogCategory", {type: "UpdateOperationsCatalogCategoryOperation", field: "updateOperationsCatalogCategory", importPath: "com.catering.v2s.catalog.application.operations.UpdateOperationsCatalogCategoryOperation", emitter: (row) => emitCatalogCategory(row, "CatalogCategoryUpdateRequest", "CatalogCategoryReadback", "UpdateOperationsCatalogCategoryOperation", "updateOperationsCatalogCategory", true)}],
  ["moveOperationsCatalogCategory", {type: "MoveOperationsCatalogCategoryOperation", field: "moveOperationsCatalogCategory", importPath: "com.catering.v2s.catalog.application.operations.MoveOperationsCatalogCategoryOperation", emitter: (row) => emitCatalogCategory(row, "CatalogCategoryMoveRequest", "CatalogCategoryReadback", "MoveOperationsCatalogCategoryOperation", "moveOperationsCatalogCategory", true)}],
  ["deleteOperationsCatalogCategory", {type: "DeleteOperationsCatalogCategoryOperation", field: "deleteOperationsCatalogCategory", importPath: "com.catering.v2s.catalog.application.operations.DeleteOperationsCatalogCategoryOperation", emitter: (row) => emitCatalogCategory(row, "CatalogCategoryDeleteRequest", "CatalogCategoryDeleteReadback", "DeleteOperationsCatalogCategoryOperation", "deleteOperationsCatalogCategory", true)}],
  ["createOperationsCatalogDictionaryEntry", {type: "CreateOperationsCatalogDictionaryEntryOperation", field: "createOperationsCatalogDictionaryEntry", importPath: "com.catering.v2s.catalog.application.operations.CreateOperationsCatalogDictionaryEntryOperation", emitter: (row) => emitCatalogDictionary(row, "CatalogDictionaryEntryCreateRequest", "CatalogDictionaryEntryReadback", "CreateOperationsCatalogDictionaryEntryOperation", "createOperationsCatalogDictionaryEntry", false)}],
  ["updateOperationsCatalogDictionaryEntry", {type: "UpdateOperationsCatalogDictionaryEntryOperation", field: "updateOperationsCatalogDictionaryEntry", importPath: "com.catering.v2s.catalog.application.operations.UpdateOperationsCatalogDictionaryEntryOperation", emitter: (row) => emitCatalogDictionary(row, "CatalogDictionaryEntryUpdateRequest", "CatalogDictionaryEntryReadback", "UpdateOperationsCatalogDictionaryEntryOperation", "updateOperationsCatalogDictionaryEntry", true)}],
  ["reorderOperationsCatalogDictionaryEntry", {type: "ReorderOperationsCatalogDictionaryEntryOperation", field: "reorderOperationsCatalogDictionaryEntry", importPath: "com.catering.v2s.catalog.application.operations.ReorderOperationsCatalogDictionaryEntryOperation", emitter: (row) => emitCatalogDictionary(row, "CatalogDictionaryEntryReorderRequest", "CatalogDictionaryView", "ReorderOperationsCatalogDictionaryEntryOperation", "reorderOperationsCatalogDictionaryEntry", false)}],
  ["transitionOperationsCatalogDictionaryEntryStatus", {type: "TransitionOperationsCatalogDictionaryEntryStatusOperation", field: "transitionOperationsCatalogDictionaryEntryStatus", importPath: "com.catering.v2s.catalog.application.operations.TransitionOperationsCatalogDictionaryEntryStatusOperation", emitter: (row) => emitCatalogDictionary(row, "CatalogDictionaryEntryTransitionRequest", "CatalogDictionaryEntryReadback", "TransitionOperationsCatalogDictionaryEntryStatusOperation", "transitionOperationsCatalogDictionaryEntryStatus", true)}],
  ["createOperationsCatalogAttributeDefinition", {type: "CreateOperationsCatalogAttributeDefinitionOperation", field: "createOperationsCatalogAttributeDefinition", importPath: "com.catering.v2s.catalog.application.operations.CreateOperationsCatalogAttributeDefinitionOperation", emitter: (row) => emitCatalogDefinition(row, "com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionCreateRequest", "com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionReadback", "CreateOperationsCatalogAttributeDefinitionOperation", "createOperationsCatalogAttributeDefinition", false)}],
  ["updateOperationsCatalogAttributeDefinition", {type: "UpdateOperationsCatalogAttributeDefinitionOperation", field: "updateOperationsCatalogAttributeDefinition", importPath: "com.catering.v2s.catalog.application.operations.UpdateOperationsCatalogAttributeDefinitionOperation", emitter: (row) => emitCatalogDefinition(row, "com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionUpdateRequest", "com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionReadback", "UpdateOperationsCatalogAttributeDefinitionOperation", "updateOperationsCatalogAttributeDefinition", true)}],
  ["deleteOperationsCatalogAttributeDefinition", {type: "DeleteOperationsCatalogAttributeDefinitionOperation", field: "deleteOperationsCatalogAttributeDefinition", importPath: "com.catering.v2s.catalog.application.operations.DeleteOperationsCatalogAttributeDefinitionOperation", emitter: (row) => emitCatalogDefinition(row, "com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionDeleteRequest", "com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionDeleteReadback", "DeleteOperationsCatalogAttributeDefinitionOperation", "deleteOperationsCatalogAttributeDefinition", true)}],
  ["createOperationsCatalogOrderOptionDefinition", {type: "CreateOperationsCatalogOrderOptionDefinitionOperation", field: "createOperationsCatalogOrderOptionDefinition", importPath: "com.catering.v2s.catalog.application.operations.CreateOperationsCatalogOrderOptionDefinitionOperation", emitter: (row) => emitCatalogDefinition(row, "com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionCreateRequest", "com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionReadback", "CreateOperationsCatalogOrderOptionDefinitionOperation", "createOperationsCatalogOrderOptionDefinition", false)}],
  ["updateOperationsCatalogOrderOptionDefinition", {type: "UpdateOperationsCatalogOrderOptionDefinitionOperation", field: "updateOperationsCatalogOrderOptionDefinition", importPath: "com.catering.v2s.catalog.application.operations.UpdateOperationsCatalogOrderOptionDefinitionOperation", emitter: (row) => emitCatalogDefinition(row, "com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionUpdateRequest", "com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionReadback", "UpdateOperationsCatalogOrderOptionDefinitionOperation", "updateOperationsCatalogOrderOptionDefinition", true)}],
  ["deleteOperationsCatalogOrderOptionDefinition", {type: "DeleteOperationsCatalogOrderOptionDefinitionOperation", field: "deleteOperationsCatalogOrderOptionDefinition", importPath: "com.catering.v2s.catalog.application.operations.DeleteOperationsCatalogOrderOptionDefinitionOperation", emitter: (row) => emitCatalogDefinition(row, "com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionDeleteRequest", "com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionDeleteReadback", "DeleteOperationsCatalogOrderOptionDefinitionOperation", "deleteOperationsCatalogOrderOptionDefinition", true)}],
  ["createOperationsCatalogUnit", {type: "CreateOperationsCatalogUnitOperation", field: "createOperationsCatalogUnit", importPath: "com.catering.v2s.catalog.application.operations.CreateOperationsCatalogUnitOperation", emitter: (row) => emitCatalogUnit(row, "com.catering.v2s.app.edge.generated.wire.CatalogUnitCreateRequest", "com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback", "CreateOperationsCatalogUnitOperation", "createOperationsCatalogUnit", false)}],
  ["updateOperationsCatalogUnit", {type: "UpdateOperationsCatalogUnitOperation", field: "updateOperationsCatalogUnit", importPath: "com.catering.v2s.catalog.application.operations.UpdateOperationsCatalogUnitOperation", emitter: (row) => emitCatalogUnit(row, "com.catering.v2s.app.edge.generated.wire.CatalogUnitUpdateRequest", "com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback", "UpdateOperationsCatalogUnitOperation", "updateOperationsCatalogUnit", true)}],
  ["disableOperationsCatalogUnit", {type: "DisableOperationsCatalogUnitOperation", field: "disableOperationsCatalogUnit", importPath: "com.catering.v2s.catalog.application.operations.DisableOperationsCatalogUnitOperation", emitter: (row) => emitCatalogUnit(row, "com.catering.v2s.app.edge.generated.wire.CatalogUnitDisableRequest", "com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback", "DisableOperationsCatalogUnitOperation", "disableOperationsCatalogUnit", true)}],
  ["deleteOperationsCatalogUnit", {type: "DeleteOperationsCatalogUnitOperation", field: "deleteOperationsCatalogUnit", importPath: "com.catering.v2s.catalog.application.operations.DeleteOperationsCatalogUnitOperation", emitter: (row) => emitCatalogUnit(row, "com.catering.v2s.app.edge.generated.wire.CatalogUnitDeleteRequest", "com.catering.v2s.app.edge.generated.wire.CatalogUnitDeleteReadback", "DeleteOperationsCatalogUnitOperation", "deleteOperationsCatalogUnit", true)}],
  ["createOperationsOrganizationStore", {type: "CreateOperationsOrganizationStoreOperation", field: "createOperationsOrganizationStore", importPath: "com.catering.v2s.organization.application.operations.CreateOperationsOrganizationStoreOperation", emitter: (row) => emitStoreCommand(row, "OperationsStoreCommandApi.CreateStoreCommand", "CreateOperationsOrganizationStoreOperation", "createOperationsOrganizationStore")}],
  ["updateOperationsOrganizationStore", {type: "UpdateOperationsOrganizationStoreOperation", field: "updateOperationsOrganizationStore", importPath: "com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationStoreOperation", emitter: (row) => emitStoreCommand(row, "OperationsStoreCommandApi.UpdateStoreCommand", "UpdateOperationsOrganizationStoreOperation", "updateOperationsOrganizationStore")}],
  ["transitionOperationsOrganizationStoreStatus", {type: "TransitionOperationsOrganizationStoreStatusOperation", field: "transitionOperationsOrganizationStoreStatus", importPath: "com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationStoreStatusOperation", emitter: (row) => emitStoreCommand(row, "OperationsStoreCommandApi.StoreStatusCommand", "TransitionOperationsOrganizationStoreStatusOperation", "transitionOperationsOrganizationStoreStatus")}],
  ["createOperationsContract", {type: "CreateOperationsContractOperation", field: "createOperationsContract", importPath: "com.catering.v2s.store.contract.application.CreateOperationsContractOperation", emitter: (row) => emitContractCommand(row, "OperationsStoreContractCommandApi.CreateCommand", "CreateOperationsContractOperation", "createOperationsContract")}],
  ["updateOperationsContract", {type: "UpdateOperationsContractOperation", field: "updateOperationsContract", importPath: "com.catering.v2s.store.contract.application.UpdateOperationsContractOperation", emitter: (row) => emitContractCommand(row, "OperationsStoreContractCommandApi.UpdateCommand", "UpdateOperationsContractOperation", "updateOperationsContract")}],
  ["invalidateOperationsContract", {type: "InvalidateOperationsContractOperation", field: "invalidateOperationsContract", importPath: "com.catering.v2s.store.contract.application.InvalidateOperationsContractOperation", emitter: (row) => emitContractCommand(row, "OperationsStoreContractCommandApi.InvalidateCommand", "InvalidateOperationsContractOperation", "invalidateOperationsContract")}],
  ["createOperationsOrganizationBrand", {type: "CreateOperationsOrganizationBrandOperation", field: "createOperationsOrganizationBrand", importPath: "com.catering.v2s.organization.application.operations.CreateOperationsOrganizationBrandOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.BrandCreateCommand", "OrganizationEntityReadback", "CreateOperationsOrganizationBrandOperation", "createOperationsOrganizationBrand")}],
  ["updateOperationsOrganizationBrand", {type: "UpdateOperationsOrganizationBrandOperation", field: "updateOperationsOrganizationBrand", importPath: "com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationBrandOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.BrandUpdateCommand", "OrganizationEntityReadback", "UpdateOperationsOrganizationBrandOperation", "updateOperationsOrganizationBrand")}],
  ["createOperationsOrganizationTenant", {type: "CreateOperationsOrganizationTenantOperation", field: "createOperationsOrganizationTenant", importPath: "com.catering.v2s.organization.application.operations.CreateOperationsOrganizationTenantOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.TenantCreateCommand", "OrganizationEntityReadback", "CreateOperationsOrganizationTenantOperation", "createOperationsOrganizationTenant")}],
  ["updateOperationsOrganizationTenant", {type: "UpdateOperationsOrganizationTenantOperation", field: "updateOperationsOrganizationTenant", importPath: "com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationTenantOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.TenantUpdateCommand", "OrganizationEntityReadback", "UpdateOperationsOrganizationTenantOperation", "updateOperationsOrganizationTenant")}],
  ["createOperationsOrganizationHeadCompany", {type: "CreateOperationsOrganizationHeadCompanyOperation", field: "createOperationsOrganizationHeadCompany", importPath: "com.catering.v2s.organization.application.operations.CreateOperationsOrganizationHeadCompanyOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.HeadCompanyCreateCommand", "OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback", "CreateOperationsOrganizationHeadCompanyOperation", "createOperationsOrganizationHeadCompany")}],
  ["updateOperationsOrganizationHeadCompany", {type: "UpdateOperationsOrganizationHeadCompanyOperation", field: "updateOperationsOrganizationHeadCompany", importPath: "com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationHeadCompanyOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.HeadCompanyUpdateCommand", "OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback", "UpdateOperationsOrganizationHeadCompanyOperation", "updateOperationsOrganizationHeadCompany")}],
  ["transitionOperationsOrganizationHeadCompanyStatus", {type: "TransitionOperationsOrganizationHeadCompanyStatusOperation", field: "transitionOperationsOrganizationHeadCompanyStatus", importPath: "com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationHeadCompanyStatusOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.HeadCompanyStatusCommand", "OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback", "TransitionOperationsOrganizationHeadCompanyStatusOperation", "transitionOperationsOrganizationHeadCompanyStatus")}],
  ["createOperationsOrganizationRegion", {type: "CreateOperationsOrganizationRegionOperation", field: "createOperationsOrganizationRegion", importPath: "com.catering.v2s.organization.application.operations.CreateOperationsOrganizationRegionOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsOrganizationHierarchyCommandApi.CreateRegionCommand", "OrganizationNodeReadback", "CreateOperationsOrganizationRegionOperation", "createOperationsOrganizationRegion")}],
  ["createOperationsOrganizationProject", {type: "CreateOperationsOrganizationProjectOperation", field: "createOperationsOrganizationProject", importPath: "com.catering.v2s.organization.application.operations.CreateOperationsOrganizationProjectOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsOrganizationHierarchyCommandApi.CreateProjectCommand", "OrganizationNodeReadback", "CreateOperationsOrganizationProjectOperation", "createOperationsOrganizationProject")}],
  ["updateOperationsOrganizationNode", {type: "UpdateOperationsOrganizationNodeOperation", field: "updateOperationsOrganizationNode", importPath: "com.catering.v2s.organization.application.operations.UpdateOperationsOrganizationNodeOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsOrganizationHierarchyCommandApi.UpdateNodeCommand", "OrganizationNodeReadback", "UpdateOperationsOrganizationNodeOperation", "updateOperationsOrganizationNode")}],
  ["updateOperationsCommercialGroup", {type: "UpdateOperationsCommercialGroupOperation", field: "updateOperationsCommercialGroup", importPath: "com.catering.v2s.organization.application.operations.UpdateOperationsCommercialGroupOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsCommercialGroupCommandApi.UpdateCommand", "CommercialGroupReadback", "UpdateOperationsCommercialGroupOperation", "updateOperationsCommercialGroup")}],
  ["addOperationsOrganizationHeadCompanyBrandAuthorization", {type: "AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation", field: "addOperationsOrganizationHeadCompanyBrandAuthorization", importPath: "com.catering.v2s.organization.application.operations.AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand", "OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationReadback", "AddOperationsOrganizationHeadCompanyBrandAuthorizationOperation", "addOperationsOrganizationHeadCompanyBrandAuthorization")}],
  ["removeOperationsOrganizationHeadCompanyBrandAuthorization", {type: "RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation", field: "removeOperationsOrganizationHeadCompanyBrandAuthorization", importPath: "com.catering.v2s.organization.application.operations.RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand", "OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationReadback", "RemoveOperationsOrganizationHeadCompanyBrandAuthorizationOperation", "removeOperationsOrganizationHeadCompanyBrandAuthorization")}],
  ["transitionOperationsOrganizationBrandStatus", {type: "TransitionOperationsOrganizationBrandStatusOperation", field: "transitionOperationsOrganizationBrandStatus", importPath: "com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationBrandStatusOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.BrandStatusCommand", "OrganizationEntityReadback", "TransitionOperationsOrganizationBrandStatusOperation", "transitionOperationsOrganizationBrandStatus")}],
  ["transitionOperationsOrganizationTenantStatus", {type: "TransitionOperationsOrganizationTenantStatusOperation", field: "transitionOperationsOrganizationTenantStatus", importPath: "com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationTenantStatusOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsBusinessEntityCommandApi.TenantStatusCommand", "OrganizationEntityReadback", "TransitionOperationsOrganizationTenantStatusOperation", "transitionOperationsOrganizationTenantStatus")}],
  ["transitionOperationsOrganizationNodeStatus", {type: "TransitionOperationsOrganizationNodeStatusOperation", field: "transitionOperationsOrganizationNodeStatus", importPath: "com.catering.v2s.organization.application.operations.TransitionOperationsOrganizationNodeStatusOperation", emitter: (row) => emitOrganizationCommand(row, "OperationsOrganizationHierarchyCommandApi.TransitionNodeStatusCommand", "OrganizationNodeReadback", "TransitionOperationsOrganizationNodeStatusOperation", "transitionOperationsOrganizationNodeStatus")}],
  ["createOperationsBusinessChannel", {type: "CreateOperationsBusinessChannelOperation", field: "createOperationsBusinessChannel", importPath: "com.catering.v2s.business.channel.application.operations.CreateOperationsBusinessChannelOperation", emitter: (row) => emitOrganizationCommand(row, "com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.CreateChannelCommand", "com.catering.v2s.businesschannel.api.BusinessChannelReadback.Channel", "CreateOperationsBusinessChannelOperation", "createOperationsBusinessChannel")}],
  ["createOperationsBusinessChannelTemplate", {type: "CreateOperationsBusinessChannelTemplateOperation", field: "createOperationsBusinessChannelTemplate", importPath: "com.catering.v2s.business.channel.application.operations.CreateOperationsBusinessChannelTemplateOperation", emitter: (row) => emitOrganizationCommand(row, "com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.CreateTemplateCommand", "com.catering.v2s.businesschannel.api.BusinessChannelReadback.Template", "CreateOperationsBusinessChannelTemplateOperation", "createOperationsBusinessChannelTemplate")}],
  ["transitionOperationsBusinessChannelStatus", {type: "TransitionOperationsBusinessChannelStatusOperation", field: "transitionOperationsBusinessChannelStatus", importPath: "com.catering.v2s.business.channel.application.operations.TransitionOperationsBusinessChannelStatusOperation", emitter: (row) => emitOrganizationCommand(row, "com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.TransitionChannelStatusCommand", "com.catering.v2s.businesschannel.api.BusinessChannelReadback.Channel", "TransitionOperationsBusinessChannelStatusOperation", "transitionOperationsBusinessChannelStatus")}],
  ["transitionOperationsBusinessChannelTemplateStatus", {type: "TransitionOperationsBusinessChannelTemplateStatusOperation", field: "transitionOperationsBusinessChannelTemplateStatus", importPath: "com.catering.v2s.business.channel.application.operations.TransitionOperationsBusinessChannelTemplateStatusOperation", emitter: (row) => emitOrganizationCommand(row, "com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.TransitionTemplateStatusCommand", "com.catering.v2s.businesschannel.api.BusinessChannelReadback.Template", "TransitionOperationsBusinessChannelTemplateStatusOperation", "transitionOperationsBusinessChannelTemplateStatus")}],
  ["updateOperationsBusinessChannel", {type: "UpdateOperationsBusinessChannelOperation", field: "updateOperationsBusinessChannel", importPath: "com.catering.v2s.business.channel.application.operations.UpdateOperationsBusinessChannelOperation", emitter: (row) => emitOrganizationCommand(row, "com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.UpdateChannelCommand", "com.catering.v2s.businesschannel.api.BusinessChannelReadback.Channel", "UpdateOperationsBusinessChannelOperation", "updateOperationsBusinessChannel")}],
  ["updateOperationsBusinessChannelTemplate", {type: "UpdateOperationsBusinessChannelTemplateOperation", field: "updateOperationsBusinessChannelTemplate", importPath: "com.catering.v2s.business.channel.application.operations.UpdateOperationsBusinessChannelTemplateOperation", emitter: (row) => emitOrganizationCommand(row, "com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.UpdateTemplateCommand", "com.catering.v2s.businesschannel.api.BusinessChannelReadback.Template", "UpdateOperationsBusinessChannelTemplateOperation", "updateOperationsBusinessChannelTemplate")}],
  ["createOperationsOwnerBinding", {type: "CreateOperationsOwnerBindingOperation", field: "createOperationsOwnerBinding", importPath: "com.catering.v2s.collaboration.application.operations.CreateOperationsOwnerBindingOperation", emitter: (row) => emitOperationsOwnerBindingCommand(row, "com.catering.v2s.collaboration.api.CollaborationCommandApi.CreateOperationsBindingCommand", "createOperationsOwnerBinding")}],
  ["updateOperationsOwnerBinding", {type: "UpdateOperationsOwnerBindingOperation", field: "updateOperationsOwnerBinding", importPath: "com.catering.v2s.collaboration.application.operations.UpdateOperationsOwnerBindingOperation", emitter: (row) => emitOperationsOwnerBindingCommand(row, "com.catering.v2s.collaboration.api.CollaborationCommandApi.UpdateOperationsBindingCommand", "updateOperationsOwnerBinding")}],
  ["deleteOperationsOwnerBinding", {type: "DeleteOperationsOwnerBindingOperation", field: "deleteOperationsOwnerBinding", importPath: "com.catering.v2s.collaboration.application.operations.DeleteOperationsOwnerBindingOperation", emitter: (row) => emitOperationsOwnerBindingCommand(row, "com.catering.v2s.collaboration.api.CollaborationCommandApi.DeleteOperationsBindingCommand", "deleteOperationsOwnerBinding")}],
]);

const emitters = new Map([
  ["stageOperationsCatalogAsset", emitStageOperationsCatalogAsset],
  ["releaseOperationsCatalogStagedAsset", emitReleaseOperationsCatalogStagedAsset],
  ["countOperationsInventoryTarget", emitCountOperationsInventoryTarget],
  ["increaseOperationsInventoryTarget", emitIncreaseOperationsInventoryTarget],
  ["adjustOperationsInventoryTarget", emitAdjustOperationsInventoryTarget],
  ["updateOperationsInventoryTargetConfiguration", emitUpdateOperationsInventoryTargetConfiguration],
  ["createOperationsProductionTag", emitCreateOperationsProductionTag],
  ["updateOperationsProductionTag", emitUpdateOperationsProductionTag],
  ["transitionOperationsProductionTagStatus", emitTransitionOperationsProductionTagStatus],
  ...[...additionalBindingDependencies.entries()].map(([operationId, dependency]) => [operationId, dependency.emitter]),
]);

const baseBindingDependencies = Object.freeze([
  {type: "CountOperationsInventoryTargetOperation", field: "countOperationsInventoryTarget"},
  {type: "IncreaseOperationsInventoryTargetOperation", field: "increaseOperationsInventoryTarget"},
  {type: "AdjustOperationsInventoryTargetOperation", field: "adjustOperationsInventoryTarget"},
  {type: "UpdateOperationsInventoryTargetConfigurationOperation", field: "updateOperationsInventoryTargetConfiguration"},
  {type: "CreateOperationsProductionTagOperation", field: "createOperationsProductionTag"},
  {type: "UpdateOperationsProductionTagOperation", field: "updateOperationsProductionTag"},
  {type: "TransitionOperationsProductionTagStatusOperation", field: "transitionOperationsProductionTagStatus"},
]);

const focusedBindingFactories = Object.freeze([
  {name: "forHeadCompanyAuthorization", fields: ["addOperationsOrganizationHeadCompanyBrandAuthorization", "removeOperationsOrganizationHeadCompanyBrandAuthorization"]},
  {name: "forWorkspaceInvitation", fields: [
    "cancelOperationsWorkspaceInvitation", "createOperationsWorkspaceInvitation", "reissueOperationsWorkspaceInvitation",
  ]},
  {name: "forContract", fields: ["createOperationsContract", "updateOperationsContract", "invalidateOperationsContract"]},
  {name: "forBusinessEntity", fields: [
    "createOperationsOrganizationBrand", "updateOperationsOrganizationBrand", "createOperationsOrganizationTenant", "updateOperationsOrganizationTenant",
    "createOperationsOrganizationHeadCompany", "updateOperationsOrganizationHeadCompany", "transitionOperationsOrganizationHeadCompanyStatus", "transitionOperationsOrganizationBrandStatus", "transitionOperationsOrganizationTenantStatus",
  ]},
  {name: "forOrganizationHierarchy", fields: ["createOperationsOrganizationProject", "createOperationsOrganizationRegion", "transitionOperationsOrganizationNodeStatus", "updateOperationsCommercialGroup", "updateOperationsOrganizationNode"]},
  {name: "forStoreManagement", fields: ["createOperationsOrganizationStore", "transitionOperationsOrganizationStoreStatus", "updateOperationsOrganizationStore"]},
  {name: "forWorkspaceUser", fields: ["revokeOperationsWorkspaceGroupUserAssignment", "revokeOperationsWorkspaceHeadCompanyUserAssignment", "revokeOperationsWorkspaceProjectUserAssignment", "revokeOperationsWorkspaceRegionUserAssignment", "revokeOperationsWorkspaceStoreUserAssignment"]},
]);

function renderFocusedBindingFactories(className, allDependencies, factoryDefinitions = focusedBindingFactories) {
  const dependencyByField = new Map(allDependencies.map((dependency) => [dependency.field, dependency]));
  return factoryDefinitions.map(({name, fields}) => {
    const selected = new Set(fields);
    const orderedParameters = fields.map((field) => {
      const dependency = dependencyByField.get(field);
      if (!dependency) fail(`BP_M1_FOCUSED_FACTORY_DEPENDENCY_MISSING:${name}:${field}`);
      return dependency;
    });
    const parameters = orderedParameters.map((dependency) => `${dependency.type} ${dependency.field}`).join(", ");
    const argumentsList = allDependencies.map((dependency) => selected.has(dependency.field) ? dependency.field : "null").join(", ");
    return `    /** Test-fixture compatibility factory; production injects the complete generated binding. */\n    public static ${className} ${name}(${parameters}) {\n        return new ${className}(${argumentsList});\n    }`;
  }).join("\n\n");
}

function selfTest(rows) {
  const catalog = rows.find((row) => row.routeRegistry === "catalog-inventory");
  if (!catalog || catalog.edge.methodName !== bindingMethodName(catalog.operationId)) fail("OPERATION_COMMAND_BINDING_METHOD_NAME_DRIFT");
  if (bindingMethodName(catalog.operationId) === catalog.operationId) fail("OPERATION_COMMAND_BINDING_METHOD_RED_MUTATION_ACCEPTED");
  const factoryDependencies = [
    {type: "CreateFixtureOperation", field: "createFixture"},
    {type: "InvalidateFixtureOperation", field: "invalidateFixture"},
    {type: "UpdateFixtureOperation", field: "updateFixture"},
  ];
  const factoryDefinition = [{name: "forFixture", fields: ["createFixture", "updateFixture", "invalidateFixture"]}];
  const orderedFactory = renderFocusedBindingFactories("FixtureBindings", factoryDependencies, factoryDefinition);
  const expectedSignature = "forFixture(CreateFixtureOperation createFixture, UpdateFixtureOperation updateFixture, InvalidateFixtureOperation invalidateFixture)";
  if (!orderedFactory.includes(expectedSignature)) fail("BP_M1_FOCUSED_FACTORY_PARAMETER_ORDER_INVALID");
  const redFactory = renderFocusedBindingFactories("FixtureBindings", factoryDependencies, [{name: "forFixture", fields: ["createFixture", "invalidateFixture", "updateFixture"]}]);
  if (redFactory.includes(expectedSignature)) fail("BP_M1_FOCUSED_FACTORY_ORDER_RED_MUTATION_ACCEPTED");
  process.stdout.write("OPERATION_COMMAND_BINDING_RED_MUTATIONS=PASS\n");
}

function emit(rows) {
  const className = "BackendPerformanceM1CommandExecutionBindings";
  const additional = [];
  const seenAdditional = new Set();
  for (const row of rows) {
    const dependency = additionalBindingDependencies.get(row.operationId);
    if (!dependency || seenAdditional.has(dependency.field)) continue;
    seenAdditional.add(dependency.field);
    additional.push(dependency);
  }
  const allDependencies = [...baseBindingDependencies, ...additional];
  const methods = `${renderFocusedBindingFactories(className, allDependencies)}\n\n${rows.map((row) => emitters.get(row.operationId)(row)).join("\n\n")}`;
  const additionalImports = additional.length === 0 ? "" : `import com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseReadback;\nimport com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogAssetStageRequest;\nimport com.catering.v2s.app.edge.generated.wire.StagedCatalogAsset;\nimport com.catering.v2s.app.edge.generated.wire.CatalogCategoryCreateRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteReadback;\nimport com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogCategoryMoveRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogCategoryReadback;\nimport com.catering.v2s.app.edge.generated.wire.CatalogCategoryUpdateRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryCreateRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryReadback;\nimport com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryReorderRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryTransitionRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogDictionaryEntryUpdateRequest;\nimport com.catering.v2s.app.edge.generated.wire.CatalogDictionaryView;\nimport com.catering.v2s.contract.api.OperationsStoreContractCommandApi;\nimport com.catering.v2s.organization.api.CommercialGroupReadback;\nimport com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;\nimport com.catering.v2s.organization.api.OperationsCommercialGroupCommandApi;\nimport com.catering.v2s.organization.api.OperationsOrganizationHierarchyCommandApi;\nimport com.catering.v2s.organization.api.OperationsStoreCommandApi;\nimport com.catering.v2s.organization.api.OrganizationEntityReadback;\nimport com.catering.v2s.organization.api.OrganizationNodeReadback;\n${additional.map((dependency) => `import ${dependency.importPath};`).join("\n")}\n`;
  const additionalFields = additional.map((dependency) => `    private final ${dependency.type} ${dependency.field};`).join("\n");
  const additionalParameters = additional.map((dependency) => `${dependency.type} ${dependency.field}`).join(", ");
  const additionalAssignments = additional.map((dependency) => `        this.${dependency.field} = ${dependency.field};`).join("\n");
  const constructorTail = additionalParameters.length === 0 ? "" : `, ${additionalParameters}`;
  const output = `package com.catering.v2s.app.edge.generated.backendperformancem1;\n\nimport com.catering.v2s.app.edge.generated.wire.InventoryAdjustmentRequest;\nimport com.catering.v2s.app.edge.generated.wire.InventoryCountRequest;\nimport com.catering.v2s.app.edge.generated.wire.InventoryIncreaseRequest;\nimport com.catering.v2s.app.edge.generated.wire.InventoryTargetConfigurationRequest;\nimport com.catering.v2s.app.edge.generated.wire.InventoryTargetCurrentView;\nimport com.catering.v2s.app.edge.generated.wire.InventoryWriteReadback;\nimport com.catering.v2s.app.edge.generated.wire.ProductionTagCreateRequest;\nimport com.catering.v2s.app.edge.generated.wire.ProductionTagReadback;\nimport com.catering.v2s.app.edge.generated.wire.ProductionTagTransitionRequest;\nimport com.catering.v2s.app.edge.generated.wire.ProductionTagUpdateRequest;\nimport com.catering.v2s.fulfillment.production.application.operations.CreateOperationsProductionTagOperation;\nimport com.catering.v2s.fulfillment.production.application.operations.TransitionOperationsProductionTagStatusOperation;\nimport com.catering.v2s.fulfillment.production.application.operations.UpdateOperationsProductionTagOperation;\nimport com.catering.v2s.inventory.application.operations.AdjustOperationsInventoryTargetOperation;\nimport com.catering.v2s.inventory.application.operations.CountOperationsInventoryTargetOperation;\nimport com.catering.v2s.inventory.application.operations.IncreaseOperationsInventoryTargetOperation;\nimport com.catering.v2s.inventory.application.operations.UpdateOperationsInventoryTargetConfigurationOperation;\n${additionalImports}import org.springframework.stereotype.Component;\n\n/** Generated typed edge bindings for source-anchored M1 rows only. */\n@Component\npublic final class ${className} {\n    private final CountOperationsInventoryTargetOperation countOperationsInventoryTarget;\n    private final IncreaseOperationsInventoryTargetOperation increaseOperationsInventoryTarget;\n    private final AdjustOperationsInventoryTargetOperation adjustOperationsInventoryTarget;\n    private final UpdateOperationsInventoryTargetConfigurationOperation updateOperationsInventoryTargetConfiguration;\n    private final CreateOperationsProductionTagOperation createOperationsProductionTag;\n    private final UpdateOperationsProductionTagOperation updateOperationsProductionTag;\n    private final TransitionOperationsProductionTagStatusOperation transitionOperationsProductionTagStatus;\n${additionalFields ? `${additionalFields}\n` : ""}\n    public ${className}(CountOperationsInventoryTargetOperation countOperationsInventoryTarget, IncreaseOperationsInventoryTargetOperation increaseOperationsInventoryTarget, AdjustOperationsInventoryTargetOperation adjustOperationsInventoryTarget, UpdateOperationsInventoryTargetConfigurationOperation updateOperationsInventoryTargetConfiguration, CreateOperationsProductionTagOperation createOperationsProductionTag, UpdateOperationsProductionTagOperation updateOperationsProductionTag, TransitionOperationsProductionTagStatusOperation transitionOperationsProductionTagStatus${constructorTail}) {\n        this.countOperationsInventoryTarget = countOperationsInventoryTarget;\n        this.increaseOperationsInventoryTarget = increaseOperationsInventoryTarget;\n        this.adjustOperationsInventoryTarget = adjustOperationsInventoryTarget;\n        this.updateOperationsInventoryTargetConfiguration = updateOperationsInventoryTargetConfiguration;\n        this.createOperationsProductionTag = createOperationsProductionTag;\n        this.updateOperationsProductionTag = updateOperationsProductionTag;\n        this.transitionOperationsProductionTagStatus = transitionOperationsProductionTagStatus;\n${additionalAssignments ? `${additionalAssignments}\n` : ""}    }\n\n${methods}\n}\n`;
  const absolute = path.join(root, generatedSourcePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, output);
}

try {
  const argumentsAfterScript = process.argv.slice(2);
  const emitRequested = argumentsAfterScript.includes("--emit");
  const selfTestRequested = argumentsAfterScript.includes("--self-test");
  if (argumentsAfterScript.some((argument) => !["--emit", "--check", "--self-test"].includes(argument)) || (selfTestRequested && argumentsAfterScript.length !== 1)) fail("USAGE: backend-performance-m1-command-execution-bindings [--check|--emit|--self-test]");
  const bindings = readJson(bindingsPath);
  const commandRows = validate(bindings);
  if (selfTestRequested) selfTest(commandRows);
  if (emitRequested) emit(commandRows);
  process.stdout.write(`OPERATION_COMMAND_BINDINGS=${emitRequested ? "EMITTED" : "VALIDATED"}\nROWS=${commandRows.length}\nEMITTED=${commandRows.length}\nCATALOG_P1_TASK=${catalogP1TaskName}\nOUTPUT=${generatedSourcePath}\n`);
} catch (error) {
  process.stderr.write(`M1_EXECUTION_BINDINGS=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
