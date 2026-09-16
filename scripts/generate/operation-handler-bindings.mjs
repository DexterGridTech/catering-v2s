#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  OPERATION_COUNT_SOURCE_PATH,
  readBackendPerformanceOperationCounts,
} from "../policy/backend-performance-operation-counts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BINDINGS_PATH = "contracts/registry/operation-handler-bindings.json";
const ROUTE_REGISTRIES = Object.freeze({
  "catalog-inventory": "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json",
  "edge-face": "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
});
const OUTPUT_ROOT = "contracts/registry/generated/operation-handler-bindings";
const JAVA_OUTPUT_ROOT = `${OUTPUT_ROOT}/java`;
const JAVA_PACKAGE_ROOT = "com.catering.v2s.generated.operationbindings";
function expectedCounts(root = ROOT) {
  const operationCounts = readBackendPerformanceOperationCounts({root});
  return Object.freeze({
    operations: operationCounts.operations,
    reads: operationCounts.reads,
    commands: operationCounts.commands,
    operationsAdminCommands: operationCounts.commandsByFace.operationsAdmin,
    platformAdminCommands: operationCounts.commandsByFace.platformAdmin,
    publicCommands: operationCounts.commandsByFace.public,
  });
}
const CONTEXT_KINDS = new Set([
  "READ_CONTEXT",
  "WORKSPACE_EXECUTION_CONTEXT",
  "WORKSPACE_PROTOCOL_CONTEXT",
  "PLATFORM_COMMAND_CONTEXT",
  "PUBLIC_PROTOCOL_CONTEXT",
]);
const COPY_ROLES = new Set(["NONE", "COPY_SOURCE", "COPY_TARGET"]);
const MODES = new Set(["READ", "COMMAND"]);
const TRANSACTION_MODES = new Set(["OUTSIDE_TRANSACTION", "REQUIRED"]);
const COMMAND_BOUNDARIES = new Set(["NOT_APPLICABLE", "OWNER_COMMAND", "PROTOCOL"]);
const COMMAND_CONTEXTS = new Set([
  "WORKSPACE_EXECUTION_CONTEXT",
  "WORKSPACE_PROTOCOL_CONTEXT",
  "PLATFORM_COMMAND_CONTEXT",
  "PUBLIC_PROTOCOL_CONTEXT",
]);
const OWNER_NAMESPACES = Object.freeze({
  "workspace-iam": "workspace.iam",
  organization: "organization",
  catalog: "catalog",
  "platform-iam": "platform.admin.iam",
  contract: "store.contract",
  "platform-workspace": "platform.workspace",
  "fulfillment-production": "fulfillment.production",
  extension: "extension",
  "platform-asset": "platform.asset",
  asset: "platform.asset",
  inventory: "inventory",
  collaboration: "collaboration",
  "business-channel": "business.channel",
  "sales-menu": "salesmenu",
});
// Only the app-owned operation adapters physically moved during the split-package
// repair use application.operations.  Owner reads/protocols in the same namespace
// intentionally remain in application; namespace-wide inference would silently
// rewrite those adapters to classes that do not exist.
const OPERATIONS_ADAPTER_OPERATION_IDS = new Set([
  "batchTransitionOperationsCatalogItemStatus",
  "createOperationsCatalogAttributeDefinition",
  "createOperationsCatalogOrderOptionDefinition",
  "createOperationsCatalogCategory",
  "createOperationsCatalogDictionaryEntry",
  "createOperationsCatalogItem",
  "executeOperationsBrandCatalogCopy",
  "executeOperationsLocalCatalogCopy",
  "executeOperationsTemporaryCatalogItemPromotion",
  "moveOperationsCatalogCategory",
  "preflightOperationsBrandCatalogCopy",
  "preflightOperationsLocalCatalogCopy",
  "preflightOperationsTemporaryCatalogItemPromotion",
  "reorderOperationsCatalogDictionaryEntry",
  "saveOperationsCatalogItem",
  "transitionOperationsCatalogDictionaryEntryStatus",
  "transitionOperationsCatalogItemStatus",
  "updateOperationsCatalogCategory",
  "updateOperationsCatalogAttributeDefinition",
  "updateOperationsCatalogOrderOptionDefinition",
  "createOperationsCatalogUnit",
  "updateOperationsCatalogUnit",
  "transitionOperationsCatalogAttributeDefinitionStatus",
  "transitionOperationsCatalogOrderOptionDefinitionStatus",
  "transitionOperationsCatalogUnitStatus",
  "transitionOperationsCatalogCategoryStatus",
  "updateOperationsCatalogDictionaryEntry",
  "createOperationsProductionTag",
  "transitionOperationsProductionTagStatus",
  "updateOperationsProductionTag",
  "adjustOperationsInventoryTarget",
  "countOperationsInventoryTarget",
  "increaseOperationsInventoryTarget",
  "updateOperationsInventoryTargetConfiguration",
  "addOperationsOrganizationHeadCompanyBrandAuthorization",
  "createOperationsOrganizationBrand",
  "createOperationsOrganizationHeadCompany",
  "createOperationsOrganizationProject",
  "createOperationsOrganizationRegion",
  "createOperationsOrganizationStore",
  "createOperationsOrganizationTenant",
  "removeOperationsOrganizationHeadCompanyBrandAuthorization",
  "transitionOperationsOrganizationBrandStatus",
  "transitionOperationsOrganizationHeadCompanyStatus",
  "transitionOperationsOrganizationNodeStatus",
  "transitionOperationsOrganizationStoreStatus",
  "transitionOperationsOrganizationTenantStatus",
  "updateOperationsCommercialGroup",
  "updateOperationsOrganizationBrand",
  "updateOperationsOrganizationHeadCompany",
  "updateOperationsOrganizationNode",
  "updateOperationsOrganizationStore",
  "updateOperationsOrganizationTenant",
  "releaseOperationsCatalogStagedAsset",
  "stageOperationsCatalogAsset",
  "cancelOperationsWorkspaceInvitation",
  "createOperationsWorkspaceInvitation",
  "reissueOperationsWorkspaceInvitation",
  "revokeOperationsWorkspaceGroupUserAssignment",
  "revokeOperationsWorkspaceHeadCompanyUserAssignment",
  "revokeOperationsWorkspaceProjectUserAssignment",
  "revokeOperationsWorkspaceRegionUserAssignment",
  "revokeOperationsWorkspaceStoreUserAssignment",
  "createOperationsOwnerBinding",
  "deleteOperationsOwnerBinding",
  "createOperationsBusinessChannelTemplate",
  "updateOperationsBusinessChannelTemplate",
  "transitionOperationsBusinessChannelTemplateStatus",
  "createOperationsBusinessChannel",
  "updateOperationsBusinessChannel",
  "transitionOperationsBusinessChannelStatus",
  "createOperationsSalesMenu",
  "copyOperationsSalesMenu",
  "renameOperationsSalesMenu",
  "archiveOperationsSalesMenu",
  "setOperationsSalesMenuActivation",
  "updateOperationsSalesMenuSchedule",
  "createOperationsSalesMenuSection",
  "renameOperationsSalesMenuSection",
  "deleteOperationsSalesMenuSection",
  "moveOperationsSalesMenuSection",
  "addOperationsSalesMenuItems",
  "updateOperationsSalesMenuItem",
  "deleteOperationsSalesMenuItem",
  "moveOperationsSalesMenuItem",
  "stageOperationsSalesMenuAsset",
  "releaseOperationsSalesMenuStagedAsset",
  "publishOperationsSalesMenu",
  "setOperationsSalesMenuItemSoldOut",
  "restoreOperationsSalesMenuItemSale",
]);
const COPY_ROLE_BY_OPERATION = Object.freeze({
  getOperationsLocalCatalogCopyCandidates: "COPY_SOURCE",
  preflightOperationsLocalCatalogCopy: "COPY_TARGET",
  executeOperationsLocalCatalogCopy: "COPY_TARGET",
  preflightOperationsTemporaryCatalogItemPromotion: "COPY_TARGET",
  executeOperationsTemporaryCatalogItemPromotion: "COPY_TARGET",
  getOperationsBrandCatalogCopyCandidates: "COPY_SOURCE",
  preflightOperationsBrandCatalogCopy: "COPY_TARGET",
  executeOperationsBrandCatalogCopy: "COPY_TARGET",
});
// These are explicit, approved protocol classifications. They are not a
// heuristic over a route or consumer face: a workspace command can otherwise
// be syntactically valid in either context kind while still violating the
// credential/OwnerGrant boundary. Keep each approved exception keyed by its
// operationId so a future binding reorder cannot silently widen it.
const CONTEXT_KIND_BY_OPERATION = Object.freeze({
  changeCurrentWorkspacePassword: "WORKSPACE_PROTOCOL_CONTEXT",
});
// A command boundary is intentionally independent from context kind.  Platform
// credential/session protocols use PLATFORM_COMMAND_CONTEXT today, but they do
// not execute an owner receipt-backed business command.  This closed list is
// the only approved exception set; a new protocol must be classified here and
// in the binding contract rather than relying on a suffix or a snapshot-side
// special case.
const COMMAND_BOUNDARY_BY_OPERATION = Object.freeze({
  acceptPublicInvitation: "PROTOCOL",
  changeCurrentPlatformPassword: "PROTOCOL",
  changeCurrentWorkspacePassword: "PROTOCOL",
  completeOperationsPasswordRecovery: "PROTOCOL",
  completePlatformPasswordRecovery: "PROTOCOL",
  completePublicInvitation: "PROTOCOL",
  operationsWorkspaceLogout: "PROTOCOL",
  operationsWorkspacePasswordLogin: "PROTOCOL",
  platformLogout: "PROTOCOL",
  platformPasswordLogin: "PROTOCOL",
  savePublicInvitationCredentials: "PROTOCOL",
  selectOperationsWorkspaceSessionContext: "PROTOCOL",
  selectOperationsWorkspaceSessionDataNode: "PROTOCOL",
  sendOperationsPasswordRecoveryOtp: "PROTOCOL",
  sendOperationsWorkspaceOtp: "PROTOCOL",
  sendPlatformLoginOtp: "PROTOCOL",
  sendPlatformPasswordRecoveryOtp: "PROTOCOL",
  sendPublicInvitationOtp: "PROTOCOL",
  startOperationsPasswordRecovery: "PROTOCOL",
  startPlatformPasswordRecovery: "PROTOCOL",
  verifyOperationsPasswordRecoveryOtp: "PROTOCOL",
  verifyOperationsWorkspaceOtp: "PROTOCOL",
  verifyPlatformLoginOtp: "PROTOCOL",
  verifyPlatformPasswordRecoveryOtp: "PROTOCOL",
  verifyPublicInvitationOtp: "PROTOCOL",
});
const RUNTIME_INTEGRATION = Object.freeze({
  status: "IMPLEMENTED_BP_U06",
  legacyDispatcher: "NO_LEGACY_DISPATCH",
  reason: "BP-U06 completed the 51-route direct typed cutover and exact old-signature absence; bindings remain the generated owner-local source of truth.",
});

function fail(code, detail = "") {
  const error = new Error(`${code}${detail ? `:${detail}` : ""}`);
  error.code = code;
  throw error;
}

function readJson(root, relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) fail("BP_U02_SOURCE_MISSING", relative);
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    fail("BP_U02_SOURCE_INVALID_JSON", `${relative}:${error.message}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(value) {
  if (typeof value !== "string" || value.length === 0) fail("BP_U02_ROUTE_PATH_INVALID", value || "EMPTY");
  const normalized = value.replace(/\/+/g, "/").replace(/\/{2,}/g, "/");
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function readRouteRegistry(root, relative) {
  const registry = readJson(root, relative);
  const bytes = fs.readFileSync(path.join(root, relative));
  return {
    registry,
    metadata: {
      schemaVersion: registry.schemaVersion ?? null,
      revision: registry.revision ?? null,
      generatedFrom: registry.generatedFrom ?? null,
      contractDigest: registry.contractDigest ?? null,
      contentSha256: sha256(bytes),
    },
  };
}

function routeSourceMetadata(root) {
  return Object.fromEntries(Object.entries(ROUTE_REGISTRIES).map(([name, relative]) => [name, readRouteRegistry(root, relative).metadata]));
}

function loadWireTypes(root) {
  const sourceRoot = path.join(root, "contracts/openapi/components");
  const names = new Set(["NoBody", "NoContent"]);
  const visit = (directory) => {
    if (!fs.existsSync(directory)) fail("BP_U02_WIRE_SOURCE_MISSING", "contracts/openapi/components");
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (/\.json$/.test(entry.name)) {
        try {
          const value = JSON.parse(fs.readFileSync(absolute, "utf8"));
          if (value.schemas && typeof value.schemas === "object") Object.keys(value.schemas).forEach((name) => names.add(name));
          if (value.components?.schemas && typeof value.components.schemas === "object") Object.keys(value.components.schemas).forEach((name) => names.add(name));
        } catch (error) {
          fail("BP_U02_WIRE_SOURCE_INVALID", `${absolute}:${error.message}`);
        }
      }
    }
  };
  visit(sourceRoot);
  return names;
}

function writeJson(root, relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

function sameSet(left, right) {
  return left.length === right.length && new Set(left).size === left.length
    && new Set(right).size === right.length && left.every((value) => new Set(right).has(value));
}

function pascal(value) {
  const result = value.split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  return result || `${value[0].toUpperCase()}${value.slice(1)}`;
}

function routeOperations(root) {
  const operations = [];
  for (const [routeRegistry, relative] of Object.entries(ROUTE_REGISTRIES)) {
    const { registry } = readRouteRegistry(root, relative);
    if (!Array.isArray(registry.operations)) fail("BP_U02_ROUTE_REGISTRY_OPERATIONS_INVALID", relative);
    for (const operation of registry.operations) {
      if (!operation || typeof operation !== "object") fail("BP_U02_ROUTE_OPERATION_INVALID", relative);
      const { operationId, method, path: routePath, owner, consumerFaces } = operation;
      if (typeof operationId !== "string" || !operationId || typeof method !== "string" || !method
        || typeof routePath !== "string" || !routePath || typeof owner !== "string" || !owner || !Array.isArray(consumerFaces) || consumerFaces.length !== 1
        || typeof consumerFaces[0] !== "string" || !consumerFaces[0]) {
        fail("BP_U02_ROUTE_OPERATION_INVALID", `${relative}:${operationId || "UNKNOWN"}`);
      }
      operations.push({
        operationId,
        method: method.toUpperCase(),
        path: routePath,
        normalizedPath: normalizePath(routePath),
        owner,
        face: consumerFaces[0],
        routeRegistry,
      });
    }
  }
  const ids = operations.map(({ operationId }) => operationId);
  if (new Set(ids).size !== ids.length) fail("BP_U02_ROUTE_OPERATION_DUPLICATE", ids.find((id, index) => ids.indexOf(id) !== index));
  return operations;
}

function expectedAdapter(operation) {
  const namespace = OWNER_NAMESPACES[operation.owner];
  if (!namespace) fail("BP_U02_OWNER_UNKNOWN", operation.owner);
  if (operation.operationId === "stageOperationsCatalogAsset") {
    return "com.catering.v2s.platform.asset.application.operations.StageOperationsCatalogAssetMultipartOperation";
  }
  if (operation.operationId === "stageOperationsSalesMenuAsset") {
    return "com.catering.v2s.salesmenu.application.operations.StageOperationsSalesMenuAssetMultipartOperation";
  }
  const packageSegment = OPERATIONS_ADAPTER_OPERATION_IDS.has(operation.operationId) ? "application.operations" : "application";
  return `com.catering.v2s.${namespace}.${packageSegment}.${pascal(operation.operationId)}Operation`;
}

function expectedCommandBoundary(operationId, mode) {
  if (mode === "READ") return "NOT_APPLICABLE";
  return COMMAND_BOUNDARY_BY_OPERATION[operationId] ?? "OWNER_COMMAND";
}

function validateBindingContract(root, binding, routes = routeOperations(root)) {
  const countsSource = expectedCounts(root);
  if (binding?.schemaVersion !== 1 || binding?.kind !== "operation-handler-bindings" || binding?.status !== "ACTIVE") {
    fail("BP_U02_BINDING_ENVELOPE_INVALID");
  }
  if (!Array.isArray(binding.generatedFrom) || !sameSet(binding.generatedFrom, Object.values(ROUTE_REGISTRIES))) {
    fail("BP_U02_BINDING_SOURCE_SET_INVALID");
  }
  if (JSON.stringify(binding.runtimeIntegration) !== JSON.stringify(RUNTIME_INTEGRATION)) {
    fail("BP_U02_RUNTIME_DISPOSITION_INVALID");
  }
  const expectedSources = routeSourceMetadata(root);
  if (JSON.stringify(binding.routeSources) !== JSON.stringify(expectedSources)) {
    fail("BP_U02_ROUTE_SOURCE_DIGEST_DRIFT");
  }
  const wireTypes = loadWireTypes(root);
  if (!Array.isArray(binding.operations)) fail("BP_U02_BINDING_OPERATIONS_INVALID");
  // Fail exact-set drift before row-level denominator checks. This keeps a
  // deleted or added binding as the primary red signal instead of allowing a
  // secondary context/face count mismatch to mask the missing operation.
  if (binding.operations.length !== routes.length) {
    fail("BP_U02_BINDING_EXACT_SET_DRIFT", `routes=${routes.length}:bindings=${binding.operations.length}`);
  }
  const routeById = new Map(routes.map((operation) => [operation.operationId, operation]));
  const seenOperationIds = new Set();
  const seenAdapters = new Set();
  const rows = [];
  for (const row of binding.operations) {
    if (!row || typeof row !== "object") fail("BP_U02_BINDING_ROW_INVALID");
    const fields = ["operationId", "owner", "routeRegistry", "path", "normalizedPath", "face", "mode", "adapter", "wireRequest", "wireResponse", "contextKind", "transactionMode", "copyRole", "commandBoundary"];
    for (const field of fields) if (typeof row[field] !== "string" || row[field].length === 0) fail("BP_U02_BINDING_FIELD_MISSING", `${row.operationId || "UNKNOWN"}:${field}`);
    if (seenOperationIds.has(row.operationId)) fail("BP_U02_BINDING_OPERATION_DUPLICATE", row.operationId);
    seenOperationIds.add(row.operationId);
    const route = routeById.get(row.operationId);
    if (!route) fail("BP_U02_BINDING_OPERATION_UNKNOWN", row.operationId);
    if (route.owner !== row.owner) fail("BP_U02_BINDING_OWNER_DRIFT", `${row.operationId}:${row.owner}:${route.owner}`);
    if (route.routeRegistry !== row.routeRegistry) fail("BP_U02_BINDING_ROUTE_REGISTRY_DRIFT", `${row.operationId}:${row.routeRegistry}:${route.routeRegistry}`);
    if (route.path !== row.path || route.normalizedPath !== row.normalizedPath) fail("BP_U02_BINDING_PATH_DRIFT", row.operationId);
    if (route.face !== row.face) fail("BP_U02_BINDING_FACE_DRIFT", row.operationId);
    if (!wireTypes.has(row.wireRequest) || !wireTypes.has(row.wireResponse)) fail("BP_U02_WIRE_TYPE_UNKNOWN", `${row.operationId}:${row.wireRequest}:${row.wireResponse}`);
    const isRead = row.mode === "READ";
    const isCommand = row.mode === "COMMAND";
    if (!MODES.has(row.mode)) fail("BP_U02_BINDING_MODE_INVALID", `${row.operationId}:${row.mode}`);
    if (!TRANSACTION_MODES.has(row.transactionMode)) fail("BP_U02_BINDING_TRANSACTION_MODE_INVALID", `${row.operationId}:${row.transactionMode}`);
    if (!CONTEXT_KINDS.has(row.contextKind)) fail("BP_U02_BINDING_CONTEXT_KIND_INVALID", `${row.operationId}:${row.contextKind}`);
    if (!COPY_ROLES.has(row.copyRole)) fail("BP_U02_BINDING_COPY_ROLE_INVALID", `${row.operationId}:${row.copyRole}`);
    if (!COMMAND_BOUNDARIES.has(row.commandBoundary)) fail("BP_U02_BINDING_COMMAND_BOUNDARY_INVALID", `${row.operationId}:${row.commandBoundary}`);
    const expectedCopyRole = COPY_ROLE_BY_OPERATION[row.operationId] || "NONE";
    if (row.copyRole !== expectedCopyRole) fail("BP_U02_BINDING_COPY_ROLE_DRIFT", `${row.operationId}:${row.copyRole}:${expectedCopyRole}`);
    if (isRead !== (route.method === "GET")) fail("BP_U02_BINDING_MODE_METHOD_DRIFT", row.operationId);
    if (isRead && (row.contextKind !== "READ_CONTEXT" || row.transactionMode !== "OUTSIDE_TRANSACTION")) {
      fail("BP_U02_BINDING_READ_CONTEXT_DRIFT", row.operationId);
    }
    if (isCommand && (row.transactionMode !== "REQUIRED" || !COMMAND_CONTEXTS.has(row.contextKind))) {
      fail("BP_U02_BINDING_COMMAND_CONTEXT_DRIFT", row.operationId);
    }
    const expectedBoundary = expectedCommandBoundary(row.operationId, row.mode);
    if (row.commandBoundary !== expectedBoundary) {
      fail("BP_U02_BINDING_COMMAND_BOUNDARY_DRIFT", `${row.operationId}:${row.commandBoundary}:${expectedBoundary}`);
    }
    if (route.face === "public" && isCommand && row.contextKind !== "PUBLIC_PROTOCOL_CONTEXT") fail("BP_U02_BINDING_PUBLIC_CONTEXT_DRIFT", row.operationId);
    if (route.face === "platform-admin" && row.contextKind !== "PLATFORM_COMMAND_CONTEXT" && isCommand) fail("BP_U02_BINDING_PLATFORM_CONTEXT_DRIFT", row.operationId);
    if (route.face === "operations-admin" && isCommand && !["WORKSPACE_EXECUTION_CONTEXT", "WORKSPACE_PROTOCOL_CONTEXT"].includes(row.contextKind)) {
      fail("BP_U02_BINDING_OPERATIONS_CONTEXT_DRIFT", row.operationId);
    }
    const expectedContextKind = CONTEXT_KIND_BY_OPERATION[row.operationId];
    if (expectedContextKind && row.contextKind !== expectedContextKind) {
      fail("BP_U02_BINDING_OPERATION_CONTEXT_DRIFT", `${row.operationId}:${row.contextKind}:${expectedContextKind}`);
    }
    if (["stageOperationsCatalogAsset", "stageOperationsSalesMenuAsset"].includes(row.operationId) && !row.adapter.endsWith("MultipartOperation")) {
      fail("BP_U02_MULTIPART_ADAPTER_REQUIRED", row.operationId);
    }
    if (row.adapter !== expectedAdapter(route)) fail("BP_U02_BINDING_ADAPTER_IDENTITY_DRIFT", `${row.operationId}:${row.adapter}`);
    if (seenAdapters.has(row.adapter)) fail("BP_U02_BINDING_ADAPTER_DUPLICATE", row.adapter);
    seenAdapters.add(row.adapter);
    if (row.operationId === "stagePlatformAsset" && row.wireRequest !== "PlatformAssetStageMultipart") fail("BP_U02_MULTIPART_WIRE_REQUIRED", row.operationId);
    rows.push({ ...row, method: route.method, face: route.face });
  }
  const routeIds = routes.map(({ operationId }) => operationId);
  if (!sameSet(routeIds, [...seenOperationIds])) fail("BP_U02_BINDING_EXACT_SET_DRIFT", `routes=${routeIds.length}:bindings=${seenOperationIds.size}`);
  if (rows.length !== countsSource.operations || binding.operationCount !== countsSource.operations
    || binding.readCount !== countsSource.reads || binding.commandCount !== countsSource.commands) {
    fail("BP_U02_BINDING_COUNT_DRIFT", `${rows.length}/${binding.operationCount}/${binding.readCount}/${binding.commandCount}`);
  }
  const counts = {
    operationsAdminCommands: rows.filter((row) => row.face === "operations-admin" && row.mode === "COMMAND").length,
    platformAdminCommands: rows.filter((row) => row.face === "platform-admin" && row.mode === "COMMAND").length,
    publicCommands: rows.filter((row) => row.face === "public" && row.mode === "COMMAND").length,
  };
  if (counts.operationsAdminCommands !== countsSource.operationsAdminCommands || counts.platformAdminCommands !== countsSource.platformAdminCommands || counts.publicCommands !== countsSource.publicCommands) {
    fail("BP_U02_COMMAND_FACE_DENOMINATOR_DRIFT", JSON.stringify(counts));
  }
  if (JSON.stringify(binding.contextCounts) !== JSON.stringify(Object.fromEntries([...CONTEXT_KINDS].sort().map((kind) => [kind, rows.filter((row) => row.contextKind === kind).length])))) {
    fail("BP_U02_CONTEXT_DENOMINATOR_DRIFT");
  }
  if (JSON.stringify(binding.commandBoundaryCounts) !== JSON.stringify(Object.fromEntries([...COMMAND_BOUNDARIES].sort().map((boundary) => [boundary, rows.filter((row) => row.commandBoundary === boundary).length])))) {
    fail("BP_U02_COMMAND_BOUNDARY_DENOMINATOR_DRIFT");
  }
  return rows;
}

function generatedOwnerProjection(owner, rows) {
  const operations = rows.filter((row) => row.owner === owner);
  const read = operations.filter((row) => row.mode === "READ");
  const command = operations.filter((row) => row.mode === "COMMAND");
  const contextGroups = Object.fromEntries([...COMMAND_CONTEXTS].sort().map((contextKind) => [contextKind, command.filter((row) => row.contextKind === contextKind).map((row) => row.operationId)]).filter(([, ids]) => ids.length > 0));
  return {
    schemaVersion: 1,
    kind: "generated-owner-operation-bindings",
    owner,
    operationCount: operations.length,
    readCount: read.length,
    commandCount: command.length,
    dispatchStrategy: "CLOSED_SWITCH",
    commandBindingBoundary: "KIND_SPECIFIC_TYPED_METHODS",
    dynamicDispatch: false,
    operations: operations.map((row) => ({
      operationId: row.operationId,
      method: row.method,
      path: row.path,
      normalizedPath: row.normalizedPath,
      face: row.face,
      mode: row.mode,
      adapter: row.adapter,
      wireRequest: row.wireRequest,
      wireResponse: row.wireResponse,
      contextKind: row.contextKind,
      transactionMode: row.transactionMode,
      copyRole: row.copyRole,
      commandBoundary: row.commandBoundary,
      dispatchMethod: row.operationId,
    })),
    commandContextGroups: contextGroups,
  };
}

function ownerSlug(owner) {
  return owner.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function ownerClassName(owner) {
  return `${pascal(owner)}OperationBindings`;
}

function ownerPackage(owner) {
  return `${JAVA_PACKAGE_ROOT}.${ownerSlug(owner)}`;
}

function descriptorFieldName(operationId) {
  return `${operationId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_DESCRIPTOR`;
}

function javaString(value) {
  return JSON.stringify(value);
}

function javaTypeRef(wireName) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(wireName)) fail("BP_U02_JAVA_WIRE_TYPE_INVALID", wireName);
  return `OperationBindingTypes.Wire.${wireName}`;
}

function contextTypeRef(contextKind) {
  if (contextKind === "READ_CONTEXT") return "OperationBindingTypes.ReadContext";
  if (contextKind === "WORKSPACE_EXECUTION_CONTEXT") return "OperationBindingTypes.WorkspaceExecutionContext";
  if (contextKind === "WORKSPACE_PROTOCOL_CONTEXT") return "OperationBindingTypes.WorkspaceProtocolContext";
  if (contextKind === "PLATFORM_COMMAND_CONTEXT") return "OperationBindingTypes.PlatformCommandContext";
  if (contextKind === "PUBLIC_PROTOCOL_CONTEXT") return "OperationBindingTypes.PublicProtocolCommandContext";
  fail("BP_U02_JAVA_CONTEXT_TYPE_INVALID", contextKind);
}

function generatedJavaSupportSource(rows) {
  const wireNames = [...new Set(rows.flatMap((row) => [row.wireRequest, row.wireResponse]))].sort();
  const records = wireNames.map((wireName) => `    public record ${wireName}() {}`).join("\n");
  return `package ${JAVA_PACKAGE_ROOT};

/**
 * Generated compile-time support types for operation-handler-bindings.json.
 * These marker/context and wire aliases are intentionally closed: runtime
 * adapters are supplied by the owning module in the implementation phase.
 */
public final class OperationBindingTypes {
  public record OperationDescriptor(String operationId, String owner, String routeRegistry) {}

  public static final class ReadContext {
    private ReadContext() {}
  }

  public static final class WorkspaceExecutionContext {
    private WorkspaceExecutionContext() {}
  }

  public static final class WorkspaceProtocolContext {
    private WorkspaceProtocolContext() {}
  }

  public static final class PlatformCommandContext {
    private PlatformCommandContext() {}
  }

  public static final class PublicProtocolCommandContext {
    private PublicProtocolCommandContext() {}
  }

  public static final class Wire {
${records}
    private Wire() {}
  }

  private OperationBindingTypes() {}
}
`;
}

function generatedJavaOwnerSource(owner, rows) {
  const className = ownerClassName(owner);
  const packageName = ownerPackage(owner);
  const ownerOperations = rows.filter((row) => row.owner === owner);
  const readOperations = ownerOperations.filter((row) => row.mode === "READ");
  const commandOperations = ownerOperations.filter((row) => row.mode === "COMMAND");
  const adapterMethods = ownerOperations.map((row) => {
    const requestType = javaTypeRef(row.wireRequest);
    const responseType = javaTypeRef(row.wireResponse);
    const contextType = contextTypeRef(row.contextKind);
    return `    ${responseType} ${row.operationId}(OperationBindingTypes.OperationDescriptor descriptor, ${contextType} context, ${requestType} request);`;
  }).join("\n");
  const descriptors = ownerOperations.map((row) =>
    `  public static final OperationBindingTypes.OperationDescriptor ${descriptorFieldName(row.operationId)} = new OperationBindingTypes.OperationDescriptor(${javaString(row.operationId)}, ${javaString(owner)}, ${javaString(row.routeRegistry)});`).join("\n");
  const readCases = readOperations.map((row) => {
    const requestType = javaTypeRef(row.wireRequest);
    return `      case ${javaString(row.operationId)} -> adapters.${row.operationId}(${descriptorFieldName(row.operationId)}, context, (${requestType}) request);`;
  }).join("\n");
  const readDescriptorGuard = readOperations.length === 0 ? "" : `  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
${readOperations.map((row) => `      case ${javaString(row.operationId)} -> { if (descriptor != ${descriptorFieldName(row.operationId)} || !${javaString(owner)}.equals(descriptor.owner()) || !${javaString(row.routeRegistry)}.equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }`).join("\n")}
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
${readCases}
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }
`;
  const commandMethods = commandOperations.map((row) => {
    const requestType = javaTypeRef(row.wireRequest);
    const responseType = javaTypeRef(row.wireResponse);
    const contextType = contextTypeRef(row.contextKind);
    return `  public ${responseType} ${row.operationId}(${contextType} context, ${requestType} request) {
    return adapters.${row.operationId}(${descriptorFieldName(row.operationId)}, context, request);
  }`;
  }).join("\n\n");
  return `package ${packageName};

import ${JAVA_PACKAGE_ROOT}.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for ${owner}. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class ${className} {
  public interface OwnerLocalAdapters {
${adapterMethods}
  }

  private final OwnerLocalAdapters adapters;

  public ${className}(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

${descriptors}

${readDescriptorGuard}

${commandMethods}
}
`;
}

function javaOutputMap(rows) {
  const outputs = new Map();
  outputs.set(`${JAVA_OUTPUT_ROOT}/com/catering/v2s/generated/operationbindings/OperationBindingTypes.java`, generatedJavaSupportSource(rows));
  for (const owner of [...new Set(rows.map((row) => row.owner))].sort()) {
    const file = `${JAVA_OUTPUT_ROOT}/com/catering/v2s/generated/operationbindings/${ownerSlug(owner)}/${ownerClassName(owner)}.java`;
    outputs.set(file, generatedJavaOwnerSource(owner, rows));
  }
  return outputs;
}

function outputMap(root, rows) {
  const owners = [...new Set(rows.map((row) => row.owner))].sort();
  const outputs = new Map();
  for (const owner of owners) outputs.set(`${OUTPUT_ROOT}/${owner}.json`, generatedOwnerProjection(owner, rows));
  outputs.set(`${OUTPUT_ROOT}/index.json`, {
    schemaVersion: 1,
    kind: "generated-owner-operation-binding-index",
    operationCount: rows.length,
    owners,
    outputs: owners.map((owner) => `${OUTPUT_ROOT}/${owner}.json`),
    javaOutputs: [...javaOutputMap(rows).keys()],
    dispatchStrategy: "OWNER_LOCAL_CLOSED_SWITCH",
    dynamicDispatch: false,
    runtimeIntegration: RUNTIME_INTEGRATION,
  });
  return outputs;
}

function expected(root = ROOT) {
  const binding = readJson(root, BINDINGS_PATH);
  const rows = validateBindingContract(root, binding);
  return outputMap(root, rows);
}

function expectedJavaSources(root = ROOT) {
  const binding = readJson(root, BINDINGS_PATH);
  const rows = validateBindingContract(root, binding);
  return javaOutputMap(rows);
}

// New catalog routes are introduced by the catalog P1 generator.  The binding
// registry is itself generated, so a write must expand the registry from the
// route source before validating exact-set/count invariants; hand-editing a
// generated row would create a second source of truth.
const ADDITIONAL_ROUTE_WIRE_TYPES = Object.freeze({
  listOperationsCatalogUnits: ["CatalogUnitListQuery", "CatalogUnitList"],
  createOperationsCatalogUnit: ["CatalogUnitCreateRequest", "CatalogUnitReadback"],
  updateOperationsCatalogUnit: ["CatalogUnitUpdateRequest", "CatalogUnitReadback"],
  transitionOperationsCatalogAttributeDefinitionStatus: ["CatalogAttributeDefinitionStatusTransitionRequest", "CatalogAttributeDefinitionReadback"],
  transitionOperationsCatalogOrderOptionDefinitionStatus: ["CatalogOrderOptionDefinitionStatusTransitionRequest", "CatalogOrderOptionDefinitionReadback"],
  transitionOperationsCatalogUnitStatus: ["CatalogUnitStatusTransitionRequest", "CatalogUnitReadback"],
  transitionOperationsCatalogCategoryStatus: ["CatalogCategoryStatusTransitionRequest", "CatalogCategoryReadback"],
  getOperationsInventoryConsumptionTargetCandidates: ["InventoryConsumptionTargetCandidateQuery", "InventoryConsumptionTargetCandidatePage"],
  getOperationsCatalogCategoryCandidates: ["CatalogCategoryCandidateQuery", "CatalogCategoryCandidatePage"],
  getOperationsCatalogItemSkus: ["CatalogItemSkusQuery", "CatalogItemSkuPage"],
  getOperationsSalesMenus: ["NoBody", "SalesMenuPage"],
  getOperationsSalesMenu: ["NoBody", "SalesMenuDetail"],
  getOperationsSalesMenuDraftSections: ["NoBody", "SalesMenuSectionList"],
  getOperationsSalesMenuDraftItems: ["NoBody", "SalesMenuItemPage"],
  getOperationsSalesMenuDraftItem: ["NoBody", "SalesMenuDraftItemView"],
  getOperationsSalesMenuPublishedSections: ["NoBody", "SalesMenuPublishedSectionList"],
  getOperationsSalesMenuPublishedItems: ["NoBody", "SalesMenuPublishedItemPage"],
  getOperationsSalesMenuPublishedItem: ["NoBody", "SalesMenuPublishedItemView"],
  getOperationsSalesMenuItemCandidates: ["NoBody", "SalesMenuCandidatePage"],
  getOperationsSalesMenuPublicationPreview: ["NoBody", "SalesMenuPublicationPreview"],
  getOperationsSalesMenuOperationRecords: ["NoBody", "SalesMenuOperationRecordPage"],
  getOperationsBusinessChannelTemplateVisibleStores: ["NoBody", "BusinessChannelTemplateVisibleStorePage"],
  createOperationsSalesMenu: ["SalesMenuCreateRequest", "SalesMenuCommandReadback"],
  copyOperationsSalesMenu: ["SalesMenuCopyRequest", "SalesMenuCommandReadback"],
  renameOperationsSalesMenu: ["SalesMenuRenameRequest", "SalesMenuCommandReadback"],
  archiveOperationsSalesMenu: ["SalesMenuArchiveRequest", "SalesMenuCommandReadback"],
  setOperationsSalesMenuActivation: ["SalesMenuActivationRequest", "SalesMenuCommandReadback"],
  updateOperationsSalesMenuSchedule: ["SalesMenuScheduleUpdateRequest", "SalesMenuCommandReadback"],
  createOperationsSalesMenuSection: ["SalesMenuSectionCreateRequest", "SalesMenuCommandReadback"],
  renameOperationsSalesMenuSection: ["SalesMenuSectionRenameRequest", "SalesMenuCommandReadback"],
  deleteOperationsSalesMenuSection: ["SalesMenuDeleteRequest", "SalesMenuCommandReadback"],
  moveOperationsSalesMenuSection: ["SalesMenuSectionMoveRequest", "SalesMenuCommandReadback"],
  addOperationsSalesMenuItems: ["SalesMenuItemsAddRequest", "SalesMenuCommandReadback"],
  updateOperationsSalesMenuItem: ["SalesMenuItemUpdateRequest", "SalesMenuCommandReadback"],
  deleteOperationsSalesMenuItem: ["SalesMenuDeleteRequest", "SalesMenuCommandReadback"],
  moveOperationsSalesMenuItem: ["SalesMenuItemMoveRequest", "SalesMenuCommandReadback"],
  stageOperationsSalesMenuAsset: ["SalesMenuAssetStageRequest", "SalesMenuAssetStageReadback"],
  releaseOperationsSalesMenuStagedAsset: ["SalesMenuAssetReleaseRequest", "SalesMenuAssetReleaseReadback"],
  publishOperationsSalesMenu: ["SalesMenuPublishRequest", "SalesMenuCommandReadback"],
  setOperationsSalesMenuItemSoldOut: ["SalesMenuManualSoldOutRequest", "SalesMenuCommandReadback"],
  restoreOperationsSalesMenuItemSale: ["SalesMenuManualRestoreRequest", "SalesMenuCommandReadback"],
  getOperationsOrganizationStoreOperatingRule: ["NoBody", "OrganizationStore"],
});
function expandGeneratedCatalogUnitRows(binding, root) {
  const routes = routeOperations(root);
  const routeById = new Map(routes.map((route) => [route.operationId, route]));
  const rows = binding.operations.filter((row) => routeById.has(row.operationId));
  const present = new Set(rows.map((row) => row.operationId));
  for (const route of routes.filter((candidate) => !present.has(candidate.operationId))) {
    const wire = ADDITIONAL_ROUTE_WIRE_TYPES[route.operationId];
    if (!wire) fail("BP_U02_NEW_ROUTE_BINDING_UNMAPPED", route.operationId);
    const mode = route.method === "GET" ? "READ" : "COMMAND";
    rows.push({
      operationId: route.operationId,
      owner: route.owner,
      routeRegistry: route.routeRegistry,
      path: route.path,
      normalizedPath: route.normalizedPath,
      face: route.face,
      mode,
      adapter: expectedAdapter(route),
      wireRequest: wire[0],
      wireResponse: wire[1],
      contextKind: mode === "READ" ? "READ_CONTEXT" : "WORKSPACE_EXECUTION_CONTEXT",
      transactionMode: mode === "READ" ? "OUTSIDE_TRANSACTION" : "REQUIRED",
      copyRole: "NONE",
      commandBoundary: expectedCommandBoundary(route.operationId, mode),
    });
  }
  const counts = {
    operationCount: rows.length,
    readCount: rows.filter((row) => row.mode === "READ").length,
    commandCount: rows.filter((row) => row.mode === "COMMAND").length,
    contextCounts: Object.fromEntries([...CONTEXT_KINDS].sort().map((kind) => [kind, rows.filter((row) => row.contextKind === kind).length])),
    commandBoundaryCounts: Object.fromEntries([...COMMAND_BOUNDARIES].sort().map((boundary) => [boundary, rows.filter((row) => row.commandBoundary === boundary).length])),
  };
  return {...binding, ...counts, operations: rows};
}

function writeText(root, relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, value);
}

function writeOutputs(root = ROOT) {
  const binding = readJson(root, BINDINGS_PATH);
  const expandedBinding = expandGeneratedCatalogUnitRows(binding, root);
  const routeById = new Map(routeOperations(root).map((route) => [route.operationId, route]));
  const adapterRefreshedBinding = {
    ...expandedBinding,
    operations: expandedBinding.operations.map((row) => {
      const route = routeById.get(row.operationId);
      return route ? {...row, adapter: expectedAdapter(route)} : row;
    }),
  };
  const refreshedBinding = {...adapterRefreshedBinding, routeSources: routeSourceMetadata(root)};
  const rows = validateBindingContract(root, refreshedBinding);
  writeJson(root, BINDINGS_PATH, refreshedBinding);
  const outputs = outputMap(root, rows);
  for (const [relative, value] of outputs) writeJson(root, relative, value);
  const javaSources = javaOutputMap(rows);
  for (const [relative, value] of javaSources) writeText(root, relative, value);
  return { json: outputs.size, java: javaSources.size };
}

function assertStaticSource(relative, actual) {
  const forbidden = [
    "Map<",
    "Map.",
    "Class.forName",
    "java.lang.reflect",
    "ServiceLoader",
    "service locator",
    "String.valueOf(operationId)",
  ];
  for (const phrase of forbidden) if (actual.includes(phrase)) fail("BP_U02_DYNAMIC_DISPATCH_OUTPUT", `${relative}:${phrase}`);
  if (relative.endsWith("OperationBindings.java") && actual.includes("public Object invoke") && !actual.includes("switch (descriptor.operationId())")) {
    fail("BP_U02_CLOSED_SWITCH_MISSING", relative);
  }
  if (relative.endsWith("OperationBindings.java") && actual.includes("public Object invoke") && (!actual.includes("requireReadDescriptor") || !actual.includes("descriptor !="))) {
    fail("BP_U02_DESCRIPTOR_GUARD_MISSING", relative);
  }
  if (relative.endsWith("OperationBindings.java") && /\bCommandContext\b/.test(actual)) {
    fail("BP_U02_COMMON_COMMAND_CONTEXT_OUTPUT", relative);
  }
}

function compileJavaSources(root, javaSources) {
  // A missing JDK is not a generated-source failure. Keep that distinction
  // machine-readable so an unavailable compiler cannot be reported as a
  // failed compile proof.
  const compilerProbe = spawnSync("javac", ["-version"], { encoding: "utf8" });
  if (compilerProbe.error || compilerProbe.status !== 0) {
    const detail = (compilerProbe.error?.message || compilerProbe.stderr || compilerProbe.stdout || "javac unavailable").trim().slice(0, 4000);
    fail("BP_U02_COMPILE_UNVERIFIED", detail);
  }
  const compileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-bp-u02-javac-"));
  try {
    const sourcePaths = [];
    for (const [relative, source] of javaSources) {
      const absolute = path.join(compileRoot, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, source);
      sourcePaths.push(absolute);
    }
    const classRoot = path.join(compileRoot, "classes");
    fs.mkdirSync(classRoot, { recursive: true });
    const result = spawnSync("javac", ["-d", classRoot, ...sourcePaths], { encoding: "utf8" });
    if (result.error) fail("BP_U02_COMPILE_UNVERIFIED", result.error.message);
    if (result.status !== 0) fail("BP_U02_GENERATED_JAVA_COMPILE_FAIL", (result.stderr || result.stdout || "").trim().slice(0, 4000));
    // The workspace password protocol classification must also be visible to
    // javac, not merely to the JSON validator. This source deliberately sends
    // a WorkspaceExecutionContext to the generated protocol method; success
    // would mean the kind-specific public signature has been widened.
    const negativeSource = path.join(compileRoot, "WrongWorkspacePasswordContextMustNotCompile.java");
    fs.writeFileSync(negativeSource, `
import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import com.catering.v2s.generated.operationbindings.workspaceiam.WorkspaceIamOperationBindings;

final class WrongWorkspacePasswordContextMustNotCompile {
  void invoke(
      WorkspaceIamOperationBindings bindings,
      OperationBindingTypes.WorkspaceExecutionContext wrongContext,
      OperationBindingTypes.Wire.WorkspaceCurrentPasswordChangeRequest request) {
    bindings.changeCurrentWorkspacePassword(wrongContext, request);
  }
}
`);
    const negativeResult = spawnSync("javac", ["-cp", classRoot, "-d", classRoot, negativeSource], { encoding: "utf8" });
    if (negativeResult.error) fail("BP_U02_COMPILE_UNVERIFIED", negativeResult.error.message);
    if (negativeResult.status === 0) fail("BP_U02_CONTEXT_KIND_COMPILE_NEGATIVE_MISSED");
  } finally {
    fs.rmSync(compileRoot, { recursive: true, force: true });
  }
}

function generatedOutputFiles(root) {
  const absoluteRoot = path.join(root, OUTPUT_ROOT);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const visit = (current, relative) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const childRelative = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) visit(child, childRelative);
      else if (entry.isFile()) files.push(childRelative);
    }
  };
  visit(absoluteRoot, OUTPUT_ROOT);
  return files.sort();
}

function assertGeneratedOutputSet(root, expectedFiles) {
  const actualFiles = generatedOutputFiles(root);
  if (!sameSet(actualFiles, expectedFiles)) {
    const expectedSet = new Set(expectedFiles);
    const actualSet = new Set(actualFiles);
    const missing = expectedFiles.filter((relative) => !actualSet.has(relative));
    const extra = actualFiles.filter((relative) => !expectedSet.has(relative));
    fail("BP_U02_GENERATED_OUTPUT_SET_DRIFT", `missing=${missing.join(",")}:extra=${extra.join(",")}`);
  }
}

function checkOutputs(root = ROOT) {
  const outputs = expected(root);
  for (const [relative, value] of outputs) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) fail("BP_U02_GENERATED_OUTPUT_MISSING", relative);
    const actual = fs.readFileSync(absolute, "utf8");
    if (actual !== `${JSON.stringify(value, null, 2)}\n`) fail("BP_U02_GENERATED_OUTPUT_DRIFT", relative);
    if (relative.endsWith(".json") && (actual.includes("Map<String, Handler>") || actual.includes("service locator") || actual.includes("Class.forName") || actual.includes("java.lang.reflect"))) fail("BP_U02_DYNAMIC_DISPATCH_OUTPUT", relative);
  }
  const javaSources = expectedJavaSources(root);
  for (const [relative, expectedSource] of javaSources) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) fail("BP_U02_GENERATED_JAVA_MISSING", relative);
    const actual = fs.readFileSync(absolute, "utf8");
    if (actual !== expectedSource) fail("BP_U02_GENERATED_JAVA_DRIFT", relative);
    assertStaticSource(relative, actual);
  }
  compileJavaSources(root, javaSources);
  assertGeneratedOutputSet(root, [...outputs.keys(), ...javaSources.keys()].sort());
  return { json: outputs.size, java: javaSources.size, contextKindNegative: "PASS" };
}

function mutateAndExpect(root, mutate, expectedCode, checker = expected) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-bp-u02-"));
  try {
    // Self-test copies only the three immutable inputs. Copying the repository
    // root would traverse node_modules/.gradle and turn this minute-scale gate
    // into an unbounded filesystem operation.
    for (const relative of [BINDINGS_PATH, OPERATION_COUNT_SOURCE_PATH, ...Object.values(ROUTE_REGISTRIES)]) {
      const source = path.join(root, relative);
      const target = path.join(scratch, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
    const wireSource = path.join(root, "contracts/openapi/components");
    const wireTarget = path.join(scratch, "contracts/openapi/components");
    fs.cpSync(wireSource, wireTarget, { recursive: true });
    mutate(scratch);
    try {
      checker(scratch);
      fail("BP_U02_RED_MUTATION_NOT_DETECTED", expectedCode);
    } catch (error) {
      if (error.code !== expectedCode) throw error;
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function mutateCountSource(root, mutate) {
  const sourcePath = path.join(root, OPERATION_COUNT_SOURCE_PATH);
  const value = readJson(root, OPERATION_COUNT_SOURCE_PATH);
  mutate(value);
  fs.writeFileSync(sourcePath, `${JSON.stringify(value, null, 2)}\n`);
}

function selfTest(root = ROOT) {
  const binding = readJson(root, BINDINGS_PATH);
  const baselineRows = validateBindingContract(root, binding);
  const expectedJsonOutputCount = outputMap(root, baselineRows).size;
  const expectedJavaOutputCount = javaOutputMap(baselineRows).size;
  for (const field of ["operations", "reads"]) {
    mutateAndExpect(root, (scratch) => {
      mutateCountSource(scratch, (value) => {
        value[field] -= 1;
      });
    }, "BP_U02_BINDING_COUNT_DRIFT");
  }
  mutateAndExpect(root, (scratch) => {
    mutateCountSource(scratch, (value) => {
      value.commands -= 1;
      value.commandsByFace.operationsAdmin -= 1;
    });
  }, "BP_U02_BINDING_COUNT_DRIFT");
  for (const [decrement, increment] of [
    ["operationsAdmin", "platformAdmin"],
    ["platformAdmin", "public"],
    ["public", "operationsAdmin"],
  ]) {
    mutateAndExpect(root, (scratch) => {
      mutateCountSource(scratch, (value) => {
        value.commandsByFace[decrement] -= 1;
        value.commandsByFace[increment] += 1;
      });
    }, "BP_U02_COMMAND_FACE_DENOMINATOR_DRIFT");
  }
  mutateAndExpect(root, (scratch) => {
    mutateCountSource(scratch, (value) => {
      value.decisionRef = "NOT_ALLOWED";
    });
  }, "OPERATION_COUNT_SOURCE_FIELD_UNKNOWN");
  mutateAndExpect(root, (scratch) => {
    mutateCountSource(scratch, (value) => {
      value.commandsByFace.digest = "NOT_ALLOWED";
    });
  }, "OPERATION_COUNT_SOURCE_FACE_FIELD_UNKNOWN");
  const staleDeletionScratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-bp-u02-"));
  try {
    for (const relative of [BINDINGS_PATH, OPERATION_COUNT_SOURCE_PATH, ...Object.values(ROUTE_REGISTRIES)]) {
      const source = path.join(root, relative);
      const target = path.join(staleDeletionScratch, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
    const wireSource = path.join(root, "contracts/openapi/components");
    const wireTarget = path.join(staleDeletionScratch, "contracts/openapi/components");
    fs.cpSync(wireSource, wireTarget, { recursive: true });
    const removedOperationId = "transitionOperationsCatalogUnitStatus";
    const routePath = ROUTE_REGISTRIES["catalog-inventory"];
    const routeRegistry = readJson(staleDeletionScratch, routePath);
    routeRegistry.operations = routeRegistry.operations.filter((row) => row.operationId !== removedOperationId);
    fs.writeFileSync(path.join(staleDeletionScratch, routePath), `${JSON.stringify(routeRegistry, null, 2)}\n`);
    mutateCountSource(staleDeletionScratch, (value) => {
      value.operations -= 1;
      value.commands -= 1;
      value.commandsByFace.operationsAdmin -= 1;
    });
    const result = writeOutputs(staleDeletionScratch);
    const refreshedBinding = readJson(staleDeletionScratch, BINDINGS_PATH);
    if (refreshedBinding.operations.some((row) => row.operationId === removedOperationId)) {
      fail("BP_U02_RETIRED_ROUTE_BINDING_ROW_RETAINED", removedOperationId);
    }
    validateBindingContract(staleDeletionScratch, refreshedBinding);
    if (result.json !== expectedJsonOutputCount || result.java !== expectedJavaOutputCount) {
      fail("BP_U02_RETIRED_ROUTE_OUTPUT_SHAPE_DRIFT");
    }
  } finally {
    fs.rmSync(staleDeletionScratch, { recursive: true, force: true });
  }
  for (const field of ["operationsAdmin", "platformAdmin", "public"]) {
    mutateAndExpect(root, (scratch) => {
      mutateCountSource(scratch, (value) => {
        value.commandsByFace[field] -= 1;
      });
    }, "OPERATION_COUNT_SOURCE_FACE_SUM_INVALID");
  }
  mutateAndExpect(root, (scratch) => {
    const routePath = ROUTE_REGISTRIES["catalog-inventory"];
    const value = readJson(scratch, routePath);
    value.revision = `${value.revision}-stale-mutation`;
    fs.writeFileSync(path.join(scratch, routePath), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_ROUTE_SOURCE_DIGEST_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.runtimeIntegration.legacyDispatcher = "CatalogInventoryApplicationService.dispatch(String,...)";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_RUNTIME_DISPOSITION_INVALID");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations.pop();
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_EXACT_SET_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations[0].owner = "inventory";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_OWNER_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations.find((row) => row.operationId === "stageOperationsCatalogAsset").adapter = "com.catering.v2s.asset.application.StageOperationsCatalogAssetMultipartOperation";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_ADAPTER_IDENTITY_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations.find((row) => row.operationId === "stagePlatformAsset").contextKind = "WORKSPACE_EXECUTION_CONTEXT";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_PLATFORM_CONTEXT_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations.find((row) => row.operationId === "changeCurrentWorkspacePassword").contextKind = "WORKSPACE_EXECUTION_CONTEXT";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_OPERATION_CONTEXT_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations.find((row) => row.operationId === "changeCurrentPlatformPassword").commandBoundary = "OWNER_COMMAND";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_COMMAND_BOUNDARY_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations[0].path = "/drifted/path";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_PATH_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations[0].face = "platform-admin";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_FACE_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations[0].wireRequest = "MadeUpWireType";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_WIRE_TYPE_UNKNOWN");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations.find((row) => row.operationId === "getOperationsLocalCatalogCopyCandidates").copyRole = "NONE";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_BINDING_COPY_ROLE_DRIFT");
  mutateAndExpect(root, (scratch) => {
    const value = readJson(scratch, BINDINGS_PATH);
    value.operations.find((row) => row.operationId === "stageOperationsCatalogAsset").adapter = "com.catering.v2s.platform.asset.application.StageOperationsCatalogAssetOperation";
    fs.writeFileSync(path.join(scratch, BINDINGS_PATH), `${JSON.stringify(value, null, 2)}\n`);
  }, "BP_U02_MULTIPART_ADAPTER_REQUIRED");
  mutateAndExpect(root, (scratch) => {
    writeOutputs(scratch);
    const stalePath = path.join(scratch, `${OUTPUT_ROOT}/stale-owner.json`);
    fs.writeFileSync(stalePath, "{}\n");
  }, "BP_U02_GENERATED_OUTPUT_SET_DRIFT", checkOutputs);
  process.stdout.write("BP_U02_BINDING_SELF_TEST=PASS\nRED=BP_U02_BINDING_COUNT_DRIFT,OPERATION_COUNT_SOURCE_FIELD_UNKNOWN,OPERATION_COUNT_SOURCE_FACE_FIELD_UNKNOWN,OPERATION_COUNT_SOURCE_FACE_SUM_INVALID,BP_U02_COMMAND_FACE_DENOMINATOR_DRIFT,BP_U02_ROUTE_SOURCE_DIGEST_DRIFT,BP_U02_BINDING_EXACT_SET_DRIFT,BP_U02_BINDING_OWNER_DRIFT,BP_U02_BINDING_ADAPTER_IDENTITY_DRIFT,BP_U02_BINDING_PLATFORM_CONTEXT_DRIFT,BP_U02_BINDING_OPERATION_CONTEXT_DRIFT,BP_U02_BINDING_COMMAND_BOUNDARY_DRIFT,BP_U02_BINDING_PATH_DRIFT,BP_U02_BINDING_FACE_DRIFT,BP_U02_WIRE_TYPE_UNKNOWN,BP_U02_BINDING_COPY_ROLE_DRIFT,BP_U02_MULTIPART_ADAPTER_REQUIRED,BP_U02_GENERATED_OUTPUT_SET_DRIFT\n");
}

const isDirectInvocation = path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
if (isDirectInvocation) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0 || (args.length === 1 && args[0] === "--write")) {
      const counts = writeOutputs();
      process.stdout.write(`BP_U02_BINDING_GENERATION=PASS\nJSON_FILES=${counts.json}\nJAVA_FILES=${counts.java}\nFILES=${counts.json + counts.java}\n`);
    } else if (args.length === 2 && args[0] === "--write" && args[1] === "--check") {
      const written = writeOutputs();
      const checked = checkOutputs();
      process.stdout.write(`BP_U02_BINDING_WRITE_CHECK=PASS\nRUNTIME_INTEGRATION=${RUNTIME_INTEGRATION.status}\nJSON_FILES=${checked.json}\nJAVA_FILES=${checked.java}\nFILES=${written.json + written.java}\n`);
    } else if (args.length === 1 && args[0] === "--check") {
      const counts = checkOutputs();
      process.stdout.write(`BP_U02_BINDING_CHECK=PASS\nRUNTIME_INTEGRATION=${RUNTIME_INTEGRATION.status}\nCONTEXT_KIND_NEGATIVE=${counts.contextKindNegative}\nJSON_FILES=${counts.json}\nJAVA_FILES=${counts.java}\nFILES=${counts.json + counts.java}\n`);
    } else if (args.length === 1 && args[0] === "--self-test") {
      selfTest();
    } else {
      fail("BP_U02_BINDING_ARGUMENT_INVALID");
    }
  } catch (error) {
    process.stderr.write(`${error.code || "BP_U02_BINDING_FAIL"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

export {
  BINDINGS_PATH,
  JAVA_OUTPUT_ROOT,
  OUTPUT_ROOT,
  checkOutputs,
  compileJavaSources,
  expected,
  expectedJavaSources,
  selfTest,
  validateBindingContract,
  writeOutputs,
};
