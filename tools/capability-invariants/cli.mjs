#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const OPENAPI_ROOT = "contracts/openapi";
const REGISTRY_PATH = "contracts/registry/iam-org-governance-manifest.json";
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AUTHENTICATED_MODE = "AUTHENTICATED_WORKSPACE";
const PLATFORM_SUPER_ADMIN_MODE = "AUTHENTICATED_PLATFORM_SUPER_ADMIN";
const PUBLIC_MODE = "PUBLIC_PROTOCOL";
const SELF_SESSION_RESOLVER = "AUTHENTICATED_WORKSPACE_SELF_SESSION";
const READ_SCOPE_RESOLVER = "AUTHENTICATED_WORKSPACE_ROLE_NODE_RANGE";
const ROLE_NODE_RANGE_READ = "ROLE_NODE_RANGE_READ";
const SELF_SESSION_OPERATION_IDS = new Set([
  "changeCurrentWorkspacePassword",
  "operationsWorkspaceLogout",
  "selectOperationsWorkspaceSessionContext",
  "selectOperationsWorkspaceSessionDataNode",
]);
const R24_SHARED_BUSINESS_CAPABILITY = "BC-ORG-HEAD-COMPANY-BRAND";
const FIXED_BUSINESS_CAPABILITY_OPERATIONS = new Map([
  [
    "createOperationsContract|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/contracts|operations-admin",
    "BC-CONTRACT-CREATE",
  ],
  [
    "createOperationsOrganizationBrand|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands|operations-admin",
    "BC-ORG-BRAND-CREATE",
  ],
  [
    "createOperationsOrganizationHeadCompany|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies|operations-admin",
    "BC-ORG-HEAD-COMPANY-CREATE",
  ],
  [
    "createOperationsOrganizationProject|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions/{regionId}/projects|operations-admin",
    "BC-ORG-PROJECT-CREATE",
  ],
  [
    "createOperationsOrganizationRegion|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions|operations-admin",
    "BC-ORG-REGION-CREATE",
  ],
  [
    "createOperationsOrganizationStore|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores|operations-admin",
    "BC-ORG-STORE-CREATE",
  ],
  [
    "createOperationsOrganizationTenant|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants|operations-admin",
    "BC-ORG-TENANT-CREATE",
  ],
  [
    "invalidateOperationsContract|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}/invalidate|operations-admin",
    "BC-CONTRACT-INVALIDATE",
  ],
  [
    "transitionOperationsOrganizationBrandStatus|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}/status|operations-admin",
    "BC-ORG-BRAND-STATUS",
  ],
  [
    "transitionOperationsOrganizationHeadCompanyStatus|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/status|operations-admin",
    "BC-ORG-HEAD-COMPANY-STATUS",
  ],
  [
    "transitionOperationsOrganizationStoreStatus|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/status|operations-admin",
    "BC-ORG-STORE-STATUS",
  ],
  [
    "transitionOperationsOrganizationTenantStatus|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}/status|operations-admin",
    "BC-ORG-TENANT-STATUS",
  ],
  [
    "updateOperationsCommercialGroup|PATCH|/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/commercial-group|operations-admin",
    "BC-ORG-GROUP-EDIT",
  ],
  [
    "updateOperationsContract|PATCH|/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}|operations-admin",
    "BC-CONTRACT-EDIT",
  ],
  [
    "updateOperationsOrganizationBrand|PATCH|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}|operations-admin",
    "BC-ORG-BRAND-EDIT",
  ],
  [
    "updateOperationsOrganizationHeadCompany|PATCH|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}|operations-admin",
    "BC-ORG-HEAD-COMPANY-EDIT",
  ],
  [
    "updateOperationsOrganizationStore|PATCH|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}|operations-admin",
    "BC-ORG-STORE-EDIT",
  ],
  [
    "updateOperationsOrganizationTenant|PATCH|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}|operations-admin",
    "BC-ORG-TENANT-EDIT",
  ],
]);
const RESOURCE_TYPE_CAPABILITY_OPERATIONS = new Map([
  [
    "updateOperationsOrganizationNode|PATCH|/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}|operations-admin",
    {REGION: "BC-ORG-REGION-EDIT", PROJECT: "BC-ORG-PROJECT-EDIT"},
  ],
  [
    "transitionOperationsOrganizationNodeStatus|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}/status|operations-admin",
    {REGION: "BC-ORG-REGION-STATUS", PROJECT: "BC-ORG-PROJECT-STATUS"},
  ],
]);
const R24_OPERATION_REQUIREMENTS = new Map([
  [
    "addOperationsOrganizationHeadCompanyBrandAuthorization|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations|operations-admin",
    "REQ_ADD_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION",
  ],
  [
    "removeOperationsOrganizationHeadCompanyBrandAuthorization|DELETE|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}|operations-admin",
    "REQ_REMOVE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION",
  ],
]);
const R24_PATH_DOCUMENT = "contracts/openapi/paths/operations-admin/head-company-management.paths.yaml";
const R24_BUSINESS_ENTITY_SCHEMA = "contracts/openapi/components/organization/business-entity.schemas.yaml";
const P3_C_PATH_DOCUMENT = "contracts/openapi/paths/operations-admin/workspace-access.paths.yaml";
const P3_C_SCHEMA_DOCUMENT = "contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml";
const ADMIN_CATALOG_PATH = "contracts/catalog/admin-catalog.json";
const P3_C_TARGETS = [
  {type: "GROUP", segment: "group", suffix: "Group", pageKey: "PG-IAM-GROUP-USERS"},
  {type: "REGION", segment: "region", suffix: "Region", pageKey: "PG-IAM-REGION-USERS"},
  {type: "PROJECT", segment: "project", suffix: "Project", pageKey: "PG-IAM-PROJECT-USERS"},
  {type: "HEAD_COMPANY", segment: "head-company", suffix: "HeadCompany", pageKey: "PG-IAM-HEAD-COMPANY-USERS"},
  {type: "STORE", segment: "store", suffix: "Store", pageKey: "PG-IAM-STORE-USERS"},
];
const P3_C_OPERATION_SPECS = [
  {id: "getOperationsWorkspace{suffix}Invitations", method: "GET", path: "invitations", action: "INVITE"},
  {id: "createOperationsWorkspace{suffix}Invitation", method: "POST", path: "invitations", action: "INVITE", requestSchema: "WorkspaceOperationsInvitationCreateRequest", forbiddenRequestFields: ["targetOrganizationType", "targetOrganizationPath"]},
  {id: "getOperationsWorkspace{suffix}InvitationCandidates", method: "GET", path: "invitations/candidates", action: "INVITE"},
  {id: "cancelOperationsWorkspace{suffix}Invitation", method: "POST", path: "invitations/{invitationId}/cancel", action: "INVITE", requestSchema: "WorkspaceOperationsInvitationActionRequest"},
  {id: "reissueOperationsWorkspace{suffix}Invitation", method: "POST", path: "invitations/{invitationId}/reissue", action: "INVITE", requestSchema: "WorkspaceOperationsInvitationActionRequest"},
  {id: "getOperationsWorkspace{suffix}User", method: "GET", path: "user", action: "ROLE_REVOKE"},
  {id: "getOperationsWorkspace{suffix}UserAccount", method: "GET", path: "user/accounts/{accountId}", action: "ROLE_REVOKE"},
  {id: "revokeOperationsWorkspace{suffix}UserAssignment", method: "POST", path: "user/assignments/{assignmentId}/revoke", action: "ROLE_REVOKE", requestSchema: "WorkspaceUserRevokeRequest"},
];
const P3_C_OPERATIONS = new Map(P3_C_TARGETS.flatMap((target) => P3_C_OPERATION_SPECS.map((spec) => {
  const operationId = spec.id.replace("{suffix}", target.suffix);
  return [operationId, {
    ...spec,
    operationId,
    path: `/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/${target.segment}/${spec.path}`,
    targetType: target.type,
    pageKey: target.pageKey,
    capabilityKey: `BC-IAM-${target.type.replaceAll("_", "-")}-${spec.action.replace("_", "-")}`,
  }];
})));
const P3_C_LEGACY_OPERATION_IDS = new Set([
  "getOperationsWorkspaceInvitations",
  "createOperationsWorkspaceInvitation",
  "getOperationsWorkspaceInvitationCandidates",
  "cancelOperationsWorkspaceInvitation",
  "reissueOperationsWorkspaceInvitation",
  "getOperationsWorkspaceUser",
  "getOperationsWorkspaceUserAccount",
  "revokeOperationsWorkspaceUserAssignment",
]);
const P3_C_MUTATING_OPERATION_IDS = new Set([...P3_C_OPERATIONS.entries()]
  .filter(([, operation]) => operation.method === "POST")
  .map(([operationId]) => operationId));
const EDGE_ROOT = "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge";
const OWNER_OTP_DELIVERY_ROOT = "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application";
const LEGACY_TEST_CODE_OWNER_PATHS = new Set();
const DEBUG_VERIFICATION_CODE_OWNER_PATHS = new Set([
  "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java",
  "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java",
  "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryService.java",
]);
const DEBUG_VERIFICATION_CODE_EXTERNAL_PATHS = new Set([
  "contracts/openapi/components/platform-iam/platform-identity.schemas.yaml",
  "contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/session/PlatformAuthenticationController.java",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsCatalogAuthenticationController.java",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/publicentry/passwordrecovery/OperationsPasswordRecoveryController.java",
  "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/publicentry/invitation/PublicInvitationController.java",
]);
const PROBLEM_ADVICE_PATH = "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java";
const PROBLEM_SCHEMA_PATH = "contracts/openapi/components/common/problem.schemas.yaml";
const TYPED_OWNER_EXCEPTION_ROOTS = [
  "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application",
  "apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application",
  "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application",
  "apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application",
  "apps/backend/catering-business-server/modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application",
  "apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application",
  "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application",
];
const FROZEN_TYPED_OWNER_EXCEPTION_COUNT = 94;
const FROZEN_TYPED_OWNER_EXCEPTION_SHA256 = "5aa8e91794bbc8aba87582c7bdd0561951db31e236fe62dcaaba946a2f27fc96";
const EXACT_TYPED_OWNER_EXCEPTION_MAPPINGS = [
  "com.catering.v2s.organization.application.BusinessEntityService.HeadCompanyBrandAuthorizationInUseException",
];

function fail(reason) {
  const error = new Error(reason);
  error.code = String(reason).split(":")[0];
  throw error;
}

function json(root, relative, reason) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) fail(`${reason}:${relative}`);
  try { return JSON.parse(fs.readFileSync(target, "utf8")); }
  catch { fail(`${reason}:${relative}`); }
}

function walkOpenApi(root, relative = OPENAPI_ROOT) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) fail(`OPENAPI_ROOT_MISSING:${relative}`);
  return fs.readdirSync(absolute, {withFileTypes: true})
    .flatMap((entry) => {
      const child = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) return walkOpenApi(root, child);
      return /\.(?:yaml|yml)$/.test(entry.name) ? [child] : [];
    })
    .sort();
}

function walkFiles(root, relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) fail(`P3_A_STATIC_PROOF_ROOT_MISSING:${relative}`);
  if (fs.statSync(absolute).isFile()) return [relative];
  return fs.readdirSync(absolute, {withFileTypes: true})
    .flatMap((child) => walkFiles(root, path.posix.join(relative, child.name)))
    .sort();
}

function textHits(root, relative, token = "testCode") {
  return walkFiles(root, relative)
    .filter((sourcePath) => fs.statSync(path.join(root, sourcePath)).isFile())
    .filter((sourcePath) => fs.readFileSync(path.join(root, sourcePath), "utf8").includes(token));
}

function validateOtpResponseExposure(root) {
  const legacyExternalHits = [...new Set([
    ...textHits(root, OPENAPI_ROOT),
    ...textHits(root, EDGE_ROOT).filter((sourcePath) => !sourcePath.includes("/generated/")),
  ])].sort();
  if (legacyExternalHits.length > 0) fail(`P3_A_OTP_TEST_CODE_EXTERNAL_EXPOSURE:${legacyExternalHits.join(",")}`);
  const debugExternalHits = [...new Set([
    ...textHits(root, OPENAPI_ROOT, "debugVerificationCode"),
    ...textHits(root, EDGE_ROOT, "debugVerificationCode").filter((sourcePath) => !sourcePath.includes("/generated/")),
  ])].sort();
  if (debugExternalHits.length > 0 && !exactSet(debugExternalHits, [...DEBUG_VERIFICATION_CODE_EXTERNAL_PATHS])) {
    fail(`P3_A_OTP_DEBUG_CODE_EXTERNAL_BOUNDARY_DRIFT:${debugExternalHits.join(",") || "NONE"}`);
  }
  const legacyOwnerHits = textHits(root, OWNER_OTP_DELIVERY_ROOT);
  if (!exactSet(legacyOwnerHits, [...LEGACY_TEST_CODE_OWNER_PATHS])) {
    fail(`P3_A_OTP_TEST_CODE_OWNER_BOUNDARY_DRIFT:${legacyOwnerHits.join(",") || "NONE"}`);
  }
  const debugOwnerHits = textHits(root, OWNER_OTP_DELIVERY_ROOT, "debugVerificationCode");
  if (!exactSet(debugOwnerHits, [...DEBUG_VERIFICATION_CODE_OWNER_PATHS])) {
    fail(`P3_A_OTP_DEBUG_CODE_OWNER_BOUNDARY_DRIFT:${debugOwnerHits.join(",") || "NONE"}`);
  }
  return {externalOtpResponseRoots: [OPENAPI_ROOT, `${EDGE_ROOT} (non-generated)`], debugExternalOtpResponsePaths: debugExternalHits, legacyOwnerOtpDeliveryPaths: legacyOwnerHits, debugOwnerOtpDeliveryPaths: debugOwnerHits};
}

function validateTypedProblemAdviceSurface(root) {
  const advice = path.join(root, PROBLEM_ADVICE_PATH);
  if (!fs.existsSync(advice)) fail(`P3_A_TYPED_PROBLEM_ADVICE_MISSING:${PROBLEM_ADVICE_PATH}`);
  const source = fs.readFileSync(advice, "utf8");
  if (!source.includes("@RestControllerAdvice")) fail("P3_A_TYPED_PROBLEM_ADVICE_ANNOTATION_MISSING");
  if (!source.includes("@ExceptionHandler")) fail("P3_A_TYPED_PROBLEM_ADVICE_HANDLER_MISSING");
  if (!source.includes("application/problem+json")) fail("P3_A_TYPED_PROBLEM_ADVICE_MEDIA_TYPE_MISSING");
  if (!source.includes("record Problem(")) fail("P3_A_TYPED_PROBLEM_ADVICE_WIRE_MISSING");
  const schema = json(root, PROBLEM_SCHEMA_PATH, "P3_A_TYPED_PROBLEM_SCHEMA_INVALID");
  const properties = schema?.components?.schemas?.Problem?.properties;
  if (!properties || typeof properties.errorCode !== "object" || typeof properties.correlationId !== "object") {
    fail("P3_A_TYPED_PROBLEM_SCHEMA_SHAPE_INVALID");
  }
  return {advicePath: PROBLEM_ADVICE_PATH, ownerConsumption: validateTypedOwnerExceptionMappings(root)};
}

function javaImports(source) {
  return new Map([...source.matchAll(/^import\s+([\w.]+);$/gm)].map((match) => {
    const fqcn = match[1];
    return [fqcn.slice(fqcn.lastIndexOf(".") + 1), fqcn];
  }));
}

function resolveJavaType(raw, imports, packageName) {
  const segments = raw.split(".");
  if (raw.startsWith("com.")) return raw;
  const imported = imports.get(segments[0]);
  if (imported) return [imported, ...segments.slice(1)].join(".");
  return `${packageName}.${raw}`;
}

function typedOwnerExceptionInventory(root) {
  const types = new Map();
  for (const ownerRoot of TYPED_OWNER_EXCEPTION_ROOTS) {
    for (const sourcePath of walkFiles(root, ownerRoot).filter((candidate) => candidate.endsWith(".java"))) {
      const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
      const packageMatch = source.match(/^package\s+([\w.]+);/m);
      if (!packageMatch) fail(`P3_A_TYPED_OWNER_EXCEPTION_PACKAGE_MISSING:${sourcePath}`);
      const packageName = packageMatch[1];
      const outer = path.posix.basename(sourcePath, ".java");
      for (const match of source.matchAll(/public\s+static(?:\s+final)?\s+class\s+(\w*Exception)\b(?:\s+extends\s+([\w.]+))?/g)) {
        const type = `${packageName}.${outer}.${match[1]}`;
        const parent = match[2] && match[2] !== "RuntimeException"
          ? (match[2].includes(".")
            ? resolveJavaType(match[2], new Map([[outer, `${packageName}.${outer}`]]), packageName)
            : `${packageName}.${outer}.${match[2]}`)
          : undefined;
        if (types.has(type)) fail(`P3_A_TYPED_OWNER_EXCEPTION_DUPLICATE:${type}`);
        types.set(type, {sourcePath, parent});
      }
    }
  }
  if (types.size === 0) fail("P3_A_TYPED_OWNER_EXCEPTION_DENOMINATOR_EMPTY");
  return types;
}

function typedOwnerExceptionFingerprint(types) {
  return crypto.createHash("sha256").update([...types.entries()]
    .map(([type, entry]) => `${type}|${entry.sourcePath}|${entry.parent || ""}`)
    .sort()
    .join("\n"))
    .digest("hex");
}

function assertFrozenTypedOwnerExceptionInventory(types, expectedCount, expectedSha256) {
  if (types.size !== expectedCount) fail(`P3_A_TYPED_OWNER_EXCEPTION_FROZEN_COUNT_DRIFT:${types.size}`);
  const fingerprint = typedOwnerExceptionFingerprint(types);
  if (fingerprint !== expectedSha256) fail(`P3_A_TYPED_OWNER_EXCEPTION_FROZEN_SET_DRIFT:${fingerprint}`);
  return `EXACT_SET=${types.size}:${fingerprint}`;
}

function validateFrozenTypedOwnerExceptionInventory(root) {
  return assertFrozenTypedOwnerExceptionInventory(
    typedOwnerExceptionInventory(root),
    FROZEN_TYPED_OWNER_EXCEPTION_COUNT,
    FROZEN_TYPED_OWNER_EXCEPTION_SHA256);
}

function edgeHandlerExceptionTypes(root) {
  const mapped = new Set();
  for (const sourcePath of walkFiles(root, EDGE_ROOT).filter((candidate) => candidate.endsWith(".java"))) {
    const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
    const packageMatch = source.match(/^package\s+([\w.]+);/m);
    if (!packageMatch) fail(`P3_A_TYPED_OWNER_EXCEPTION_EDGE_PACKAGE_MISSING:${sourcePath}`);
    const imports = javaImports(source);
    for (const annotation of source.matchAll(/@(?:[\w.]+\.)?ExceptionHandler\s*\(([^)]*)\)/gs)) {
      for (const candidate of annotation[1].matchAll(/([A-Za-z_][\w.]*)\.class/g)) {
        const raw = candidate[1];
        if (["RuntimeException", "Exception", "Throwable"].includes(raw)) {
          fail(`P3_A_TYPED_OWNER_EXCEPTION_CATCH_ALL:${sourcePath}:${raw}`);
        }
        mapped.add(resolveJavaType(raw, imports, packageMatch[1]));
      }
    }
  }
  return mapped;
}

function validateTypedOwnerExceptionMappings(root) {
  const ownerTypes = typedOwnerExceptionInventory(root);
  const mapped = edgeHandlerExceptionTypes(root);
  const missing = [];
  for (const [type, entry] of ownerTypes) {
    let cursor = type;
    const visited = new Set();
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor);
      if (mapped.has(cursor)) break;
      cursor = ownerTypes.get(cursor)?.parent;
    }
    if (!cursor || !mapped.has(cursor)) missing.push(`${type}@${entry.sourcePath}`);
  }
  if (missing.length > 0) fail(`P3_A_TYPED_OWNER_EXCEPTION_SET_DRIFT:missing=${missing.sort().join(",")}`);
  validateExactTypedOwnerExceptionMappings(ownerTypes, mapped);
  return `MAPPED=${ownerTypes.size}:NOT_REACHABLE=0:UNMAPPED=0:EXACT=${EXACT_TYPED_OWNER_EXCEPTION_MAPPINGS.length}`;
}

function validateExactTypedOwnerExceptionMappings(ownerTypes, mapped) {
  for (const type of EXACT_TYPED_OWNER_EXCEPTION_MAPPINGS) {
    if (!ownerTypes.has(type)) fail(`P3_A_TYPED_OWNER_EXCEPTION_EXACT_TYPE_MISSING:${type}`);
    if (!mapped.has(type)) fail(`P3_A_TYPED_OWNER_EXCEPTION_EXACT_MAPPING_MISSING:${type}`);
  }
}

function validateP3AStaticProofSurfaces(root) {
  return {
    otp: validateOtpResponseExposure(root),
    problemAdvice: validateTypedProblemAdviceSurface(root),
  };
}

function operationIdentity(row) {
  return [row.operationId, row.method, row.path, row.consumerFace].join("|");
}

function capabilityRequirementId(operationId) {
  return operationId === "updateOperationsOrganizationNode"
    ? "ORG_NODE_EDIT"
    : `REQ_${operationId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`;
}

export function mutatingOperationInventory(root = process.cwd()) {
  const rows = [];
  for (const sourcePath of walkOpenApi(root)) {
    const document = json(root, sourcePath, "OPENAPI_DOCUMENT_INVALID");
    for (const [route, methods] of Object.entries(document.paths || {})) {
      for (const [method, operation] of Object.entries(methods || {})) {
        if (!WRITE_METHODS.has(String(method).toUpperCase()) || !operation || typeof operation !== "object") continue;
        const consumerFaces = operation["x-consumer-faces"];
        if (!operation.operationId) fail(`CAPABILITY_OPERATION_ID_MISSING:${sourcePath}:${method}:${route}`);
        if (!Array.isArray(consumerFaces) || consumerFaces.length !== 1 || typeof consumerFaces[0] !== "string" || consumerFaces[0].length === 0) {
          fail(`CAPABILITY_CONSUMER_FACE_INVALID:${operation.operationId}`);
        }
        if (typeof operation["x-owner-module"] !== "string" || operation["x-owner-module"].length === 0) {
          fail(`CAPABILITY_OWNER_MODULE_MISSING:${operation.operationId}`);
        }
        const anonymousProtocol = Array.isArray(operation.security) && operation.security.length === 0;
        const authorizationMode = consumerFaces[0] === "platform-admin" && !anonymousProtocol
          ? PLATFORM_SUPER_ADMIN_MODE
          : anonymousProtocol ? PUBLIC_MODE : AUTHENTICATED_MODE;
        const requiredCapability = authorizationMode === PLATFORM_SUPER_ADMIN_MODE
          ? operation["x-required-platform-authorization"]
          : authorizationMode === PUBLIC_MODE
            ? operation["x-required-owner-protocol"] ?? operation["x-required-capability"]
            : operation["x-required-capability"];
        rows.push({
          sourcePath,
          operationId: operation.operationId,
          method: String(method).toUpperCase(),
          path: route,
          consumerFace: consumerFaces[0],
          anonymousProtocol,
          authorizationMode,
          ownerModule: operation["x-owner-module"],
          requiredCapability,
        });
      }
    }
  }
  const identities = new Set();
  for (const row of rows) {
    const key = operationIdentity(row);
    if (identities.has(key)) fail(`CAPABILITY_OPERATION_IDENTITY_DUPLICATE:${key}`);
    identities.add(key);
  }
  return rows.sort((left, right) => operationIdentity(left).localeCompare(operationIdentity(right)));
}

export function governanceManifest(root = process.cwd()) {
  return json(root, REGISTRY_PATH, "CAPABILITY_REGISTRY_MISSING");
}

function expectObject(value, reason) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(reason);
  return value;
}

function exactSet(left, right) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function indexBy(values, key, duplicateReason) {
  const result = new Map();
  for (const value of values || []) {
    const id = typeof key === "function" ? key(value) : value?.[key];
    if (typeof id !== "string" || id.length === 0 || result.has(id)) fail(`${duplicateReason}:${id || "UNSET"}`);
    result.set(id, value);
  }
  return result;
}

function validateResolver(resolver) {
  expectObject(resolver, "CAPABILITY_RESOLVER_INVALID");
  if (!["AUTHENTICATED_WORKSPACE_TARGET_SCOPE", READ_SCOPE_RESOLVER, SELF_SESSION_RESOLVER, "PLATFORM_SESSION_ENABLED_ADMIN", "PUBLIC_PROTOCOL_TOKEN", "PUBLIC_PROTOCOL_OWNER_FACT"].includes(resolver.resolverId)) {
    fail(`CAPABILITY_RESOLVER_ID_INVALID:${resolver.resolverId || "UNSET"}`);
  }
  if (![AUTHENTICATED_MODE, PLATFORM_SUPER_ADMIN_MODE, PUBLIC_MODE].includes(resolver.authorizationMode)) fail(`CAPABILITY_RESOLVER_MODE_INVALID:${resolver.resolverId}`);
  if (!Array.isArray(resolver.inputs) || !Array.isArray(resolver.outputs) || !Array.isArray(resolver.clientDerivedInputsForbidden)) {
    fail(`CAPABILITY_RESOLVER_SHAPE_INVALID:${resolver.resolverId}`);
  }
  const expectedOutputs = resolver.resolverId === READ_SCOPE_RESOLVER
    ? ["ALLOW", "DENY", "readScopePredicate"]
    : ["ALLOW", "DENY", "firstOwnerQueryPredicate"];
  if (!exactSet(resolver.outputs, expectedOutputs)) fail(`CAPABILITY_RESOLVER_OUTPUT_INVALID:${resolver.resolverId}`);
  if (!resolver.clientDerivedInputsForbidden.includes("pageDesignKey")
    || !resolver.clientDerivedInputsForbidden.includes("clientCapabilityLiteral")) {
    fail(`CAPABILITY_RESOLVER_CLIENT_DERIVATION_GAP:${resolver.resolverId}`);
  }
  if (resolver.authorizationMode === AUTHENTICATED_MODE && resolver.resolverId === SELF_SESSION_RESOLVER
    && !exactSet(resolver.inputs, ["authenticatedWorkspaceSession"])) {
    fail(`CAPABILITY_SELF_SESSION_RESOLVER_INPUT_INVALID:${resolver.resolverId}`);
  }
  if (resolver.authorizationMode === AUTHENTICATED_MODE && resolver.resolverId !== SELF_SESSION_RESOLVER
    && !exactSet(resolver.inputs, ["authenticatedWorkspaceSession", "serverResolvedResourceTypeAndId", "assignmentNode"])) {
    fail(`CAPABILITY_WORKSPACE_RESOLVER_INPUT_INVALID:${resolver.resolverId}`);
  }
  if (resolver.authorizationMode === PLATFORM_SUPER_ADMIN_MODE
    && (!exactSet(resolver.inputs, ["activePlatformSession", "enabledPlatformAdministrator"])
      || resolver.authenticatedWorkspaceSessionForbidden !== true)) {
    fail(`CAPABILITY_PLATFORM_RESOLVER_INPUT_INVALID:${resolver.resolverId}`);
  }
  if (resolver.authorizationMode === PUBLIC_MODE
    && (!exactSet(resolver.inputs, resolver.resolverId === "PUBLIC_PROTOCOL_OWNER_FACT"
      ? ["ownerValidatedCredentialOrOtpOrBoundFlow", "serverResolvedResourceTypeAndId"]
      : ["serverValidatedInvitationOrResetToken", "serverResolvedResourceTypeAndId"])
      || resolver.authenticatedWorkspaceSessionForbidden !== true)) {
    fail(`CAPABILITY_PUBLIC_PROTOCOL_RESOLVER_INVALID:${resolver.resolverId}`);
  }
}

function validateCapabilityWriteOnlyBoundary(root, manifest) {
  const openApiReadCapabilities = [];
  for (const sourcePath of walkOpenApi(root)) {
    const document = json(root, sourcePath, "OPENAPI_DOCUMENT_INVALID");
    for (const [route, methods] of Object.entries(document.paths || {})) {
      for (const [method, operation] of Object.entries(methods || {})) {
        if (WRITE_METHODS.has(String(method).toUpperCase()) || !operation || typeof operation !== "object") continue;
        if (operation["x-required-capability"] !== undefined) openApiReadCapabilities.push(`${sourcePath}:${String(method).toUpperCase()}:${route}:${operation.operationId || "UNSET"}`);
      }
    }
  }
  if (openApiReadCapabilities.length > 0) fail(`CAPABILITY_READ_OPENAPI_CAPABILITY_PRESENT:${openApiReadCapabilities.sort().join(",")}`);
  const registryReadCapabilities = (manifest.requirements || [])
    .filter((requirement) => !WRITE_METHODS.has(String(requirement?.operationIdentity?.method || "").toUpperCase()))
    .filter((requirement) => requirement.capabilityKey !== undefined || requirement.capabilityMapping !== undefined || requirement.ownerRecheckId !== undefined)
    .map((requirement) => requirement?.requirementId || "UNSET");
  if (registryReadCapabilities.length > 0) fail(`CAPABILITY_READ_REGISTRY_CAPABILITY_PRESENT:${registryReadCapabilities.sort().join(",")}`);
  const registryReadScopeDrift = (manifest.requirements || [])
    .filter((requirement) => !WRITE_METHODS.has(String(requirement?.operationIdentity?.method || "").toUpperCase()))
    .filter((requirement) => requirement.authorizationMode === AUTHENTICATED_MODE)
    .filter((requirement) => requirement.authorizationKind !== ROLE_NODE_RANGE_READ
      || requirement.readScopeResolverId !== READ_SCOPE_RESOLVER
      || requirement.resolverId !== undefined)
    .map((requirement) => requirement?.requirementId || "UNSET");
  if (registryReadScopeDrift.length > 0) fail(`CAPABILITY_READ_REGISTRY_SCOPE_MODEL_DRIFT:${registryReadScopeDrift.sort().join(",")}`);

  if (fs.existsSync(path.join(root, EDGE_ROOT))) {
    const edgeGetCapabilityHits = [];
    for (const sourcePath of walkFiles(root, EDGE_ROOT).filter((candidate) => candidate.endsWith(".java"))) {
      const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
      const capabilityResolverFields = [...source.matchAll(/(?:[\w.]+\.)?WorkspaceCapabilityScopeResolver\s+(\w+)\b/g)].map((match) => match[1]);
      const capabilityHelperNames = [];
      for (const helper of source.matchAll(/\bprivate\s+(?:static\s+)?[\w<>?,\s\[\].]+\s+(\w+)\s*\([^;{}]*\)\s*\{/g)) {
        let depth = 0;
        let bodyEnd = -1;
        const bodyStart = helper.index + helper[0].length - 1;
        for (let cursor = bodyStart; cursor < source.length; cursor += 1) {
          if (source[cursor] === "{") depth += 1;
          else if (source[cursor] === "}" && --depth === 0) {
            bodyEnd = cursor;
            break;
          }
        }
        if (bodyEnd < 0) fail(`CAPABILITY_READ_EDGE_HELPER_BODY_UNCLOSED:${sourcePath}:${helper[1]}`);
        const body = source.slice(bodyStart, bodyEnd + 1);
        if (capabilityResolverFields.some((field) => new RegExp(`\\b${field}\\.resolve\\s*\\(`).test(body)) || /\brequireCapability\s*\(/.test(body)) {
          capabilityHelperNames.push(helper[1]);
        }
      }
      let annotationOffset = 0;
      while (true) {
        const getMappingOffset = source.indexOf("@GetMapping", annotationOffset);
        if (getMappingOffset < 0) break;
        const bodyStart = source.indexOf("{", getMappingOffset);
        if (bodyStart < 0) fail(`CAPABILITY_READ_EDGE_GET_HANDLER_BODY_MISSING:${sourcePath}`);
        let depth = 0;
        let bodyEnd = -1;
        for (let cursor = bodyStart; cursor < source.length; cursor += 1) {
          if (source[cursor] === "{") depth += 1;
          else if (source[cursor] === "}" && --depth === 0) {
            bodyEnd = cursor;
            break;
          }
        }
        if (bodyEnd < 0) fail(`CAPABILITY_READ_EDGE_GET_HANDLER_BODY_UNCLOSED:${sourcePath}`);
        const body = source.slice(bodyStart, bodyEnd + 1);
        const capabilityResolverCall = capabilityResolverFields.some((field) => new RegExp(`\\b${field}\\.resolve\\s*\\(`).test(body));
        const capabilityHelperCall = capabilityHelperNames.some((helper) => new RegExp(`\\b${helper}\\s*\\(`).test(body));
        if (capabilityResolverCall || capabilityHelperCall || /\brequireCapability\s*\(/.test(body)) edgeGetCapabilityHits.push(sourcePath);
        annotationOffset = bodyEnd + 1;
      }
    }
    if (edgeGetCapabilityHits.length > 0) fail(`CAPABILITY_READ_EDGE_GET_CAPABILITY_PRESENT:${[...new Set(edgeGetCapabilityHits)].sort().join(",")}`);
  }
}

function validateR24OperationSet(inventory, manifest) {
  if (manifest.authority === "fixture") return;
  const actual = inventory
    .filter((row) => R24_OPERATION_REQUIREMENTS.has(operationIdentity(row)))
    .map(operationIdentity);
  if (!exactSet(actual, [...R24_OPERATION_REQUIREMENTS.keys()])) {
    fail(`CAPABILITY_R24_OPERATION_SET_DRIFT:actual=${actual.join(",") || "NONE"}`);
  }
  if (inventory.some((row) => row.operationId === "replaceOperationsOrganizationHeadCompanyBrandAuthorizations")) {
    fail("CAPABILITY_R24_RETIRED_PUT_PRESENT");
  }
}

function validateR24ContractProjection(root, manifest) {
  if (manifest.authority === "fixture") return;
  const pathDocument = json(root, R24_PATH_DOCUMENT, "CAPABILITY_R24_PATH_DOCUMENT_INVALID");
  const paths = pathDocument.paths || {};
  const add = paths["/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations"]?.post;
  const remove = paths["/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}"]?.delete;
  const successStatuses = (operation) => Object.keys(operation?.responses || {}).filter((status) => /^2\d\d$/.test(status));
  if (!add || add.operationId !== "addOperationsOrganizationHeadCompanyBrandAuthorization"
    || add["x-required-capability"] !== R24_OPERATION_REQUIREMENTS.get("addOperationsOrganizationHeadCompanyBrandAuthorization|POST|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations|operations-admin")
    || add["x-expected-version-policy"] !== undefined
    || !exactSet(successStatuses(add), ["204"])) {
    fail("CAPABILITY_R24_ADD_CONTRACT_DRIFT");
  }
  if (!remove || remove.operationId !== "removeOperationsOrganizationHeadCompanyBrandAuthorization"
    || remove["x-required-capability"] !== R24_OPERATION_REQUIREMENTS.get("removeOperationsOrganizationHeadCompanyBrandAuthorization|DELETE|/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}|operations-admin")
    || remove["x-expected-version-policy"] !== undefined
    || !remove["x-error-codes"]?.includes("ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE")
    || !exactSet(successStatuses(remove), ["204"])) {
    fail("CAPABILITY_R24_REMOVE_CONTRACT_DRIFT");
  }
  const businessSchemas = json(root, R24_BUSINESS_ENTITY_SCHEMA, "CAPABILITY_R24_BUSINESS_SCHEMA_INVALID")?.components?.schemas || {};
  const addRequest = businessSchemas.HeadCompanyBrandAuthorizationAddRequest;
  if (!addRequest || addRequest.additionalProperties !== false || !exactSet(addRequest.required || [], ["brandId"])
    || !addRequest.properties?.brandId || Object.hasOwn(businessSchemas, "HeadCompanyBrandAuthorizationRequest")
    || Object.hasOwn(businessSchemas, "HeadCompanyBrandAuthorizationResult")
    || JSON.stringify(businessSchemas).includes("referencingStoreCount")) {
    fail("CAPABILITY_R24_READBACK_OR_REQUEST_DRIFT");
  }
  const problemDocument = json(root, PROBLEM_SCHEMA_PATH, "CAPABILITY_R24_PROBLEM_SCHEMA_INVALID");
  const problemProperties = problemDocument?.components?.schemas?.Problem?.properties || {};
  if (Object.hasOwn(problemProperties, "brandAuthorizationBlockers")
    || /(?:visibleStores|referencingStoreCount|canRevoke|hasAdditional)/.test(JSON.stringify(problemProperties))) {
    fail("CAPABILITY_R24_BLOCKER_DISCLOSURE_PRESENT");
  }
  const edgeDocument = json(root, "contracts/openapi/edge.openapi.yaml", "CAPABILITY_R24_EDGE_ROOT_INVALID");
  const problemResponse = edgeDocument?.components?.responses?.ProblemResponse?.content;
  if (!problemResponse || !exactSet(Object.keys(problemResponse), ["application/problem+json"])) {
    fail("CAPABILITY_R24_PROBLEM_MEDIA_TYPE_DRIFT");
  }
}

function validateP3CAccessContract(root, manifest) {
  if (manifest.authority !== "p3-c-fixture" && !String(manifest.authority).startsWith("P3-A authoritative")) return;
  const pathDocument = json(root, P3_C_PATH_DOCUMENT, "CAPABILITY_P3_C_PATH_DOCUMENT_INVALID");
  const schemas = json(root, P3_C_SCHEMA_DOCUMENT, "CAPABILITY_P3_C_SCHEMA_DOCUMENT_INVALID")?.components?.schemas || {};
  const actual = [];
  for (const [route, methods] of Object.entries(pathDocument.paths || {})) {
    for (const [rawMethod, operation] of Object.entries(methods || {})) {
      if (!operation || typeof operation !== "object") continue;
      if (!P3_C_OPERATIONS.has(operation.operationId)
        && !P3_C_LEGACY_OPERATION_IDS.has(operation.operationId)
        && !route.includes("/user-management/")) continue;
      actual.push(`${operation.operationId}|${String(rawMethod).toUpperCase()}|${route}`);
    }
  }
  const expected = [...P3_C_OPERATIONS.entries()].map(([operationId, operation]) => `${operationId}|${operation.method}|${operation.path}`);
  if (!exactSet(actual, expected)) fail(`CAPABILITY_P3_C_OPERATION_SET_DRIFT:actual=${actual.sort().join(",") || "NONE"}`);
  const authorityCapabilities = manifest.authority === "p3-c-fixture"
    ? undefined
    : new Map((json(root, ADMIN_CATALOG_PATH, "CAPABILITY_P3_C_AUTHORITY_CATALOG_INVALID").nodes || [])
      .filter((node) => node?.kind === "ACTION" && node?.action?.userManagement)
      .map((node) => [`${node.action.userManagement.targetOrganizationType}|${node.action.userManagement.purpose}`, node.key]));
  const requirements = new Map((manifest.requirements || []).map((requirement) => [requirement?.operationIdentity?.operationId, requirement]));
  for (const [operationId, expectedOperation] of P3_C_OPERATIONS) {
    const operation = pathDocument.paths?.[expectedOperation.path]?.[expectedOperation.method.toLowerCase()];
    const isWrite = WRITE_METHODS.has(expectedOperation.method);
    if (!operation
      || operation["x-page-key"] !== expectedOperation.pageKey
      || operation["x-required-capability"] !== (isWrite ? capabilityRequirementId(operationId) : undefined)
      || (operation.parameters || []).some((parameter) => ["pageDesignKey", "targetOrganizationType", "targetType", "capabilityKey"].includes(parameter?.name))
      || /fallback/i.test(JSON.stringify(operation))) {
      fail(`CAPABILITY_P3_C_PAGE_KEY_OR_FALLBACK_PRESENT:${operationId}`);
    }
    if (expectedOperation.requestSchema) {
      const schema = schemas[expectedOperation.requestSchema];
      if (!schema || Object.hasOwn(schema.properties || {}, "pageDesignKey") || (schema.required || []).includes("pageDesignKey")) {
        fail(`CAPABILITY_P3_C_REQUEST_SCHEMA_PAGE_KEY_PRESENT:${operationId}`);
      }
      for (const field of expectedOperation.forbiddenRequestFields || []) {
        if (Object.hasOwn(schema.properties || {}, field) || (schema.required || []).includes(field)) {
          fail(`CAPABILITY_P3_C_REQUEST_SCHEMA_CLIENT_TARGET_PRESENT:${operationId}:${field}`);
        }
      }
    }
    const requirement = requirements.get(operationId);
    const authorityCapability = authorityCapabilities?.get(`${expectedOperation.targetType}|${expectedOperation.action}`);
    if (!isWrite) {
      if (!requirement
        || requirement.requirementId !== capabilityRequirementId(operationId)
        || operationIdentity(requirement.operationIdentity || {}) !== operationIdentity({operationId, method: expectedOperation.method, path: expectedOperation.path, consumerFace: "operations-admin"})
        || requirement.authorizationMode !== AUTHENTICATED_MODE
        || requirement.authorizationKind !== ROLE_NODE_RANGE_READ
        || requirement.readScopeResolverId !== READ_SCOPE_RESOLVER
        || requirement.resolverId !== undefined
        || requirement.capabilityKey !== undefined
        || requirement.capabilityMapping !== undefined
        || requirement.ownerRecheckId !== undefined
        || requirement.serverDerivedTarget !== undefined
        || requirement.targetOrganizationType !== undefined
        || requirement.ownerModule !== "workspace-iam"
        || requirement.typedProblemMappingId !== "PROBLEM_WORKSPACE_IAM_TYPED_OWNER_EXCEPTION"
        || requirement.noClientDerivedAuthorization !== true
        || /pageDesignKey|fallback/i.test(JSON.stringify(requirement))) {
        fail(`CAPABILITY_P3_C_ROLE_NODE_READ_DRIFT:${operationId}`);
      }
      continue;
    }
    if (!requirement
      || requirement.requirementId !== capabilityRequirementId(operationId)
      || operationIdentity(requirement.operationIdentity || {}) !== operationIdentity({operationId, method: expectedOperation.method, path: expectedOperation.path, consumerFace: "operations-admin"})
      || requirement.authorizationMode !== AUTHENTICATED_MODE
      || requirement.serverDerivedTarget !== "STATIC_OPERATION_CAPABILITY"
      || requirement.targetOrganizationType !== expectedOperation.targetType
      || requirement.capabilityKey !== expectedOperation.capabilityKey
      || requirement.ownerModule !== "workspace-iam"
      || requirement.ownerRecheckId !== "OWNER_RECHECK_WORKSPACE_IAM"
      || requirement.typedProblemMappingId !== "PROBLEM_WORKSPACE_IAM_TYPED_OWNER_EXCEPTION"
      || requirement.noClientDerivedAuthorization !== true
      || /pageDesignKey|fallback/i.test(JSON.stringify(requirement))) {
      fail(`CAPABILITY_P3_C_SERVER_DERIVED_REQUIREMENT_DRIFT:${operationId}`);
    }
    if (authorityCapabilities && (typeof authorityCapability !== "string" || requirement.capabilityKey !== authorityCapability)) {
      fail(`CAPABILITY_P3_C_AUTHORITY_CAPABILITY_DRIFT:${operationId}`);
    }
  }
}

function p3CEdgeRootRef(route) {
  return `./paths/operations-admin/workspace-access.paths.yaml#/paths/${route.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

function p3CLegacyRootPaths() {
  const base = "/api/operations/group-workspaces/{groupWorkspaceKey}";
  return [
    `${base}/invitations`,
    `${base}/invitations/candidates`,
    `${base}/invitations/{invitationId}/cancel`,
    `${base}/invitations/{invitationId}/reissue`,
    `${base}/user`,
    `${base}/user/accounts/{accountId}`,
    `${base}/user/assignments/{assignmentId}/revoke`,
  ];
}

export function validateP3CEdgeRootProjection(root = process.cwd()) {
  const edge = json(root, "contracts/openapi/edge.openapi.yaml", "CAPABILITY_P3_C_EDGE_ROOT_INVALID");
  const pathDocument = json(root, P3_C_PATH_DOCUMENT, "CAPABILITY_P3_C_PATH_DOCUMENT_INVALID");
  const expectedPaths = [...new Set([...P3_C_OPERATIONS.values()].map((operation) => operation.path))];
  const expectedOperations = [...P3_C_OPERATIONS.values()]
    .map((operation) => `${operation.operationId}|${operation.method}|${operation.path}`);
  const rootPaths = Object.keys(edge.paths || {}).filter((route) => route.includes("/user-management/"));
  if (!exactSet(rootPaths, expectedPaths)) {
    fail(`CAPABILITY_P3_C_EDGE_ROOT_SET_DRIFT:actual=${rootPaths.sort().join(",") || "NONE"}`);
  }
  for (const route of expectedPaths) {
    if (edge.paths?.[route]?.$ref !== p3CEdgeRootRef(route)) {
      fail(`CAPABILITY_P3_C_EDGE_ROOT_REF_DRIFT:${route}`);
    }
  }
  for (const legacyPath of p3CLegacyRootPaths()) {
    if (Object.hasOwn(edge.paths || {}, legacyPath)) {
      fail(`CAPABILITY_P3_C_EDGE_LEGACY_ROOT_PRESENT:${legacyPath}`);
    }
  }
  const targetPaths = Object.keys(pathDocument.paths || {}).filter((route) => route.includes("/user-management/"));
  if (!exactSet(targetPaths, expectedPaths)) {
    fail(`CAPABILITY_P3_C_TARGET_PATH_SET_DRIFT:actual=${targetPaths.sort().join(",") || "NONE"}`);
  }
  const targetOperations = targetPaths.flatMap((route) => Object.entries(pathDocument.paths[route] || {})
    .filter(([method]) => WRITE_METHODS.has(method.toUpperCase()) || method === "get")
    .map(([method, operation]) => `${operation?.operationId}|${method.toUpperCase()}|${route}`));
  if (!exactSet(targetOperations, expectedOperations)) {
    fail(`CAPABILITY_P3_C_TARGET_OPERATION_SET_DRIFT:actual=${targetOperations.sort().join(",") || "NONE"}`);
  }
  return {rootTargetRefs: rootPaths.length, targetPaths: targetPaths.length, targetOperations: targetOperations.length};
}

export function validateCapabilityInvariants(root = process.cwd()) {
  const inventory = mutatingOperationInventory(root);
  const manifest = governanceManifest(root);
  expectObject(manifest, "CAPABILITY_REGISTRY_INVALID");
  if (manifest.schemaVersion !== 1 || manifest.kind !== "iam-org-governance-manifest"
    || !exactSet(manifest.operationIdentityKey || [], ["operationId", "method", "path", "consumerFace"])
    || !exactSet(manifest.authorizationModes || [], [AUTHENTICATED_MODE, PLATFORM_SUPER_ADMIN_MODE, PUBLIC_MODE])) {
    fail("CAPABILITY_REGISTRY_HEADER_INVALID");
  }
  if (!manifest.generationTargets || typeof manifest.generationTargets !== "object"
    || !["serverCatalog", "typedResolverRegistry", "workspaceIamCatalog", "operationsCatalog"].every((key) => typeof manifest.generationTargets[key] === "string" && manifest.generationTargets[key].length > 0)) {
    fail("CAPABILITY_GENERATION_TARGETS_INVALID");
  }

  const resolvers = indexBy(manifest.resolvers, "resolverId", "CAPABILITY_RESOLVER_DUPLICATE");
  for (const resolver of resolvers.values()) validateResolver(resolver);
  const ownerRechecks = indexBy(manifest.ownerRechecks, "ownerRecheckId", "CAPABILITY_OWNER_RECHECK_DUPLICATE");
  const problems = indexBy(manifest.typedProblemMappings, "typedProblemMappingId", "CAPABILITY_PROBLEM_MAPPING_DUPLICATE");
  const requirements = indexBy(manifest.requirements, "requirementId", "CAPABILITY_REQUIREMENT_DUPLICATE");
  const byIdentity = indexBy(manifest.requirements, (requirement) => {
    const identity = requirement?.operationIdentity;
    return identity && [identity.operationId, identity.method, identity.path, identity.consumerFace].every((value) => typeof value === "string")
      ? operationIdentity(identity) : undefined;
  }, "CAPABILITY_REQUIREMENT_OPERATION_DUPLICATE");

  validateCapabilityWriteOnlyBoundary(root, manifest);

  const inventoryKeys = inventory.map(operationIdentity);
  const p3cReadRequirementKeys = String(manifest.authority).startsWith("P3-A authoritative")
    ? [...P3_C_OPERATIONS.values()]
      .filter((operation) => operation.method === "GET")
      .map((operation) => operationIdentity({
        operationId: operation.operationId,
        method: operation.method,
        path: operation.path,
        consumerFace: "operations-admin",
      }))
    : [];
  const expectedRequirementKeys = [...inventoryKeys, ...p3cReadRequirementKeys];
  if (!exactSet(expectedRequirementKeys, [...byIdentity.keys()])) {
    const missing = expectedRequirementKeys.filter((key) => !byIdentity.has(key));
    const extra = [...byIdentity.keys()].filter((key) => !expectedRequirementKeys.includes(key));
    fail(`CAPABILITY_OPERATION_REGISTRY_SET_DRIFT:missing=${missing.join(",") || "NONE"}:extra=${extra.join(",") || "NONE"}`);
  }
  validateR24OperationSet(inventory, manifest);
  validateR24ContractProjection(root, manifest);
  validateP3CAccessContract(root, manifest);
  if (String(manifest.authority).startsWith("P3-A authoritative")) validateP3CEdgeRootProjection(root);

  const failures = [];
  for (const row of inventory) {
    const requirement = byIdentity.get(operationIdentity(row));
    const expectedRequirement = capabilityRequirementId(row.operationId);
    if (typeof row.requiredCapability !== "string" || row.requiredCapability.length === 0) {
      failures.push(`CAPABILITY_REQUIRED_MISSING:${row.operationId}`);
      continue;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(row.requiredCapability)) failures.push(`CAPABILITY_REQUIRED_FORMAT_INVALID:${row.operationId}`);
    if (!requirement || requirement.requirementId !== row.requiredCapability) failures.push(`CAPABILITY_REQUIREMENT_BINDING_DRIFT:${row.operationId}`);
    if (row.requiredCapability !== expectedRequirement) failures.push(`CAPABILITY_REQUIREMENT_ID_DRIFT:${row.operationId}:${expectedRequirement}`);
    if (!requirement) continue;

    if (!expectObject(requirement.operationIdentity, `CAPABILITY_REQUIREMENT_IDENTITY_INVALID:${requirement.requirementId}`)
      || operationIdentity(requirement.operationIdentity) !== operationIdentity(row)) {
      failures.push(`CAPABILITY_REQUIREMENT_IDENTITY_DRIFT:${row.operationId}`);
    }
    const r24RequirementId = R24_OPERATION_REQUIREMENTS.get(operationIdentity(row));
    const fixedBusinessCapability = FIXED_BUSINESS_CAPABILITY_OPERATIONS.get(operationIdentity(row));
    const resourceTypeCapabilities = RESOURCE_TYPE_CAPABILITY_OPERATIONS.get(operationIdentity(row));
    const p3cOperation = P3_C_OPERATIONS.get(row.operationId);
    const selfSessionOperation = SELF_SESSION_OPERATION_IDS.has(row.operationId);
    const mapping = requirement.capabilityMapping;
    const validResourceTypeMapping = resourceTypeCapabilities
      && requirement.capabilityKey === undefined
      && mapping?.kind === "SERVER_RESOLVED_RESOURCE_TYPE"
      && mapping.unsupportedResourceTypeDecision === "DENY"
      && mapping.resourceTypeCapabilities
      && Object.keys(mapping.resourceTypeCapabilities).length === Object.keys(resourceTypeCapabilities).length
      && Object.entries(resourceTypeCapabilities).every(([type, capability]) => mapping.resourceTypeCapabilities[type] === capability);
    const validFixedCapability = !resourceTypeCapabilities
      && !selfSessionOperation
      && row.authorizationMode === AUTHENTICATED_MODE
      && typeof requirement.capabilityKey === "string"
      && (r24RequirementId
        ? requirement.capabilityKey === R24_SHARED_BUSINESS_CAPABILITY
        : p3cOperation
          ? requirement.capabilityKey === p3cOperation.capabilityKey
          : fixedBusinessCapability
            ? requirement.capabilityKey === fixedBusinessCapability
          : /^CAP_[A-Z0-9_]+$/.test(requirement.capabilityKey))
      && requirement.capabilityMapping === undefined;
    if (resourceTypeCapabilities && !validResourceTypeMapping) {
      failures.push("CAPABILITY_ORG_NODE_EDIT_MAPPING_INVALID:" + row.operationId);
      continue;
    }
    if (r24RequirementId && requirement.requirementId !== r24RequirementId) {
      failures.push(`CAPABILITY_R24_REQUIREMENT_ID_DRIFT:${row.operationId}:${r24RequirementId}`);
    }
    if (r24RequirementId && requirement.capabilityKey !== R24_SHARED_BUSINESS_CAPABILITY) {
      failures.push(`CAPABILITY_R24_BUSINESS_CAPABILITY_DRIFT:${row.operationId}`);
    }
    if (!r24RequirementId && requirement.capabilityKey === R24_SHARED_BUSINESS_CAPABILITY) {
      failures.push(`CAPABILITY_R24_BUSINESS_CAPABILITY_OVERBROAD:${row.operationId}`);
    }
    const validSelfSession = selfSessionOperation
      && row.authorizationMode === AUTHENTICATED_MODE
      && requirement.capabilityKey === undefined
      && requirement.capabilityMapping === undefined
      && requirement.resolverId === SELF_SESSION_RESOLVER;
    const noWorkspaceCapability = row.authorizationMode !== AUTHENTICATED_MODE
      && requirement.capabilityKey === undefined
      && requirement.capabilityMapping === undefined;
    if (row.consumerFace === "platform-admin" && (requirement.capabilityKey !== undefined || requirement.capabilityMapping !== undefined)) {
      failures.push(`CAPABILITY_PLATFORM_CAPABILITY_FORBIDDEN:${row.operationId}`);
    }
    if ((!resourceTypeCapabilities && !validFixedCapability && !validSelfSession && !noWorkspaceCapability)
      || typeof requirement.ownerModule !== "string" || requirement.ownerModule !== row.ownerModule
      || typeof requirement.ownerRecheckId !== "string" || typeof requirement.typedProblemMappingId !== "string"
      || typeof requirement.redFixtureId !== "string" || requirement.noClientDerivedAuthorization !== true) {
      failures.push("CAPABILITY_REQUIREMENT_SHAPE_INVALID:" + row.operationId);
      continue;
    }
    const publicOperation = row.anonymousProtocol === true;
    const expectedMode = row.authorizationMode;
    if (requirement.authorizationMode !== expectedMode) failures.push(`CAPABILITY_AUTHORIZATION_MODE_DRIFT:${row.operationId}`);
    const resolver = resolvers.get(requirement.resolverId);
    if (!resolver || resolver.authorizationMode !== expectedMode) failures.push(`CAPABILITY_RESOLVER_BINDING_DRIFT:${row.operationId}`);
    const ownerRecheck = ownerRechecks.get(requirement.ownerRecheckId);
    if (!ownerRecheck || ownerRecheck.ownerModule !== row.ownerModule || ownerRecheck.requiredInOwnerCommand !== true
      || ownerRecheck.transactionRequirement !== "REQUIRED" || ownerRecheck.crossOwnerWritesUsePublicCommandApi !== true) {
      failures.push(`CAPABILITY_OWNER_RECHECK_BINDING_DRIFT:${row.operationId}`);
    }
    const problem = problems.get(requirement.typedProblemMappingId);
    if (!problem || problem.ownerModule !== row.ownerModule || problem.typedProblemOnly !== true
      || problem.noTestCodeInResponse !== true || problem.unmappedExceptionFails !== true) {
      failures.push(`CAPABILITY_TYPED_PROBLEM_BINDING_DRIFT:${row.operationId}`);
    }
    if (publicOperation && requirement.authorizationMode !== PUBLIC_MODE) failures.push(`CAPABILITY_PUBLIC_PROTOCOL_REQUIRED:${row.operationId}`);
    if (!publicOperation && requirement.authorizationMode === PUBLIC_MODE) failures.push(`CAPABILITY_PUBLIC_PROTOCOL_OVERBROAD:${row.operationId}`);
    if (row.consumerFace === "platform-admin" && !publicOperation && requirement.authorizationMode !== PLATFORM_SUPER_ADMIN_MODE) failures.push(`CAPABILITY_PLATFORM_SUPER_ADMIN_REQUIRED:${row.operationId}`);
  }
  if (failures.length) fail(failures.join("\n"));
  return {inventory, manifest, requirements: [...requirements.values()]};
}

function writeFixture(root, operation) {
  fs.mkdirSync(path.join(root, "contracts/openapi"), {recursive: true});
  fs.mkdirSync(path.join(root, "contracts/registry"), {recursive: true});
  const requirementId = capabilityRequirementId(operation.operationId);
  const ownerId = operation.ownerModule.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  const resourceTypeCapabilities = RESOURCE_TYPE_CAPABILITY_OPERATIONS.get(
    `${operation.operationId}|${(operation.method || "POST").toUpperCase()}|${operation.path}|${operation.consumerFace}`,
  );
  const method = (operation.method || "POST").toLowerCase();
  const anonymousProtocol = Array.isArray(operation.security) ? operation.security.length === 0 : operation.consumerFace === "public";
  const platformSuperAdmin = operation.consumerFace === "platform-admin" && !anonymousProtocol;
  const contractAuthorization = platformSuperAdmin
    ? {"x-required-platform-authorization": requirementId}
    : anonymousProtocol
      ? {"x-required-owner-protocol": requirementId}
      : {"x-required-capability": requirementId};
  fs.writeFileSync(path.join(root, "contracts/openapi/fixture.yaml"), JSON.stringify({paths: {[operation.path]: {[method]: {
    operationId: operation.operationId,
    security: operation.security ?? (operation.consumerFace === "public" ? [] : [{session: []}]),
    "x-consumer-faces": [operation.consumerFace],
    "x-owner-module": operation.ownerModule,
    ...contractAuthorization,
  }}}}, null, 2));
  fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify({
    schemaVersion: 1,
    kind: "iam-org-governance-manifest",
    authority: "fixture",
    operationIdentityKey: ["operationId", "method", "path", "consumerFace"],
    authorizationModes: [AUTHENTICATED_MODE, PLATFORM_SUPER_ADMIN_MODE, PUBLIC_MODE],
    resolvers: [
      {resolverId: "AUTHENTICATED_WORKSPACE_TARGET_SCOPE", authorizationMode: AUTHENTICATED_MODE, inputs: ["authenticatedWorkspaceSession", "serverResolvedResourceTypeAndId", "assignmentNode"], outputs: ["ALLOW", "DENY", "firstOwnerQueryPredicate"], clientDerivedInputsForbidden: ["pageDesignKey", "clientCapabilityLiteral"]},
      {resolverId: "PLATFORM_SESSION_ENABLED_ADMIN", authorizationMode: PLATFORM_SUPER_ADMIN_MODE, inputs: ["activePlatformSession", "enabledPlatformAdministrator"], outputs: ["ALLOW", "DENY", "firstOwnerQueryPredicate"], clientDerivedInputsForbidden: ["pageDesignKey", "clientCapabilityLiteral"], authenticatedWorkspaceSessionForbidden: true},
      {resolverId: "PUBLIC_PROTOCOL_TOKEN", authorizationMode: PUBLIC_MODE, inputs: ["serverValidatedInvitationOrResetToken", "serverResolvedResourceTypeAndId"], outputs: ["ALLOW", "DENY", "firstOwnerQueryPredicate"], clientDerivedInputsForbidden: ["pageDesignKey", "clientCapabilityLiteral"], authenticatedWorkspaceSessionForbidden: true},
    ],
    ownerRechecks: [{ownerRecheckId: "OWNER_RECHECK_" + ownerId, ownerModule: operation.ownerModule, requiredInOwnerCommand: true, transactionRequirement: "REQUIRED", crossOwnerWritesUsePublicCommandApi: true}],
    typedProblemMappings: [{typedProblemMappingId: "PROBLEM_" + ownerId + "_TYPED_OWNER_EXCEPTION", ownerModule: operation.ownerModule, typedProblemOnly: true, noTestCodeInResponse: true, unmappedExceptionFails: true}],
    generationTargets: {serverCatalog: "generated/CapabilityRequirementCatalog.java", typedResolverRegistry: "generated/CapabilityResolverRegistry.java", workspaceIamCatalog: "generated/WorkspaceCapabilityRequirementCatalog.java", operationsCatalog: "generated/capability-operation-registry.json"},
    requirements: [{
      requirementId,
      operationIdentity: {operationId: operation.operationId, method: method.toUpperCase(), path: operation.path, consumerFace: operation.consumerFace},
      authorizationMode: platformSuperAdmin ? PLATFORM_SUPER_ADMIN_MODE : anonymousProtocol ? PUBLIC_MODE : AUTHENTICATED_MODE,
      ...(!platformSuperAdmin && !anonymousProtocol && (resourceTypeCapabilities ? {capabilityMapping: {kind: "SERVER_RESOLVED_RESOURCE_TYPE", resourceTypeCapabilities, unsupportedResourceTypeDecision: "DENY"}} : {capabilityKey: operation.capabilityKey || "CAP_" + requirementId.replace(/^REQ_/, "")})),
      resolverId: platformSuperAdmin ? "PLATFORM_SESSION_ENABLED_ADMIN" : anonymousProtocol ? "PUBLIC_PROTOCOL_TOKEN" : "AUTHENTICATED_WORKSPACE_TARGET_SCOPE",
      ownerModule: operation.ownerModule,
      ownerRecheckId: "OWNER_RECHECK_" + ownerId,
      typedProblemMappingId: "PROBLEM_" + ownerId + "_TYPED_OWNER_EXCEPTION",
      redFixtureId: `RED_${requirementId}`,
      noClientDerivedAuthorization: true,
    }],
  }, null, 2) + "\n");
}

function writeR24Fixture(root) {
  const add = {
    operationId: "addOperationsOrganizationHeadCompanyBrandAuthorization",
    method: "POST",
    path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations",
    consumerFace: "operations-admin",
    ownerModule: "organization",
    capabilityKey: R24_SHARED_BUSINESS_CAPABILITY,
  };
  const remove = {
    operationId: "removeOperationsOrganizationHeadCompanyBrandAuthorization",
    method: "DELETE",
    path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}",
    consumerFace: "operations-admin",
    ownerModule: "organization",
    capabilityKey: R24_SHARED_BUSINESS_CAPABILITY,
  };
  writeFixture(root, add);
  const document = json(root, "contracts/openapi/fixture.yaml", "CAPABILITY_R24_FIXTURE_INVALID");
  const requirementId = capabilityRequirementId(remove.operationId);
  document.paths[remove.path] = {delete: {
    operationId: remove.operationId,
    "x-consumer-faces": [remove.consumerFace],
    "x-owner-module": remove.ownerModule,
    "x-required-capability": requirementId,
  }};
  fs.writeFileSync(path.join(root, "contracts/openapi/fixture.yaml"), JSON.stringify(document));
  const registry = governanceManifest(root);
  registry.requirements.push({
    requirementId,
    operationIdentity: {operationId: remove.operationId, method: remove.method, path: remove.path, consumerFace: remove.consumerFace},
    authorizationMode: AUTHENTICATED_MODE,
    capabilityKey: R24_SHARED_BUSINESS_CAPABILITY,
    resolverId: "AUTHENTICATED_WORKSPACE_TARGET_SCOPE",
    ownerModule: remove.ownerModule,
    ownerRecheckId: "OWNER_RECHECK_ORGANIZATION",
    typedProblemMappingId: "PROBLEM_ORGANIZATION_TYPED_OWNER_EXCEPTION",
    redFixtureId: `RED_${requirementId}`,
    noClientDerivedAuthorization: true,
  });
  fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(registry));
}

function writeR24ContractFixture(root) {
  writeR24Fixture(root);
  fs.rmSync(path.join(root, "contracts/openapi/fixture.yaml"), {force: true});
  const registry = governanceManifest(root);
  registry.authority = "r24-contract-fixture";
  fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(registry));
  fs.mkdirSync(path.join(root, path.dirname(R24_PATH_DOCUMENT)), {recursive: true});
  fs.mkdirSync(path.join(root, path.dirname(R24_BUSINESS_ENTITY_SCHEMA)), {recursive: true});
  fs.mkdirSync(path.join(root, path.dirname(PROBLEM_SCHEMA_PATH)), {recursive: true});
  const addPath = "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations";
  const removePath = `${addPath}/{brandId}`;
  fs.writeFileSync(path.join(root, R24_PATH_DOCUMENT), JSON.stringify({
    paths: {
      [addPath]: {post: {operationId: "addOperationsOrganizationHeadCompanyBrandAuthorization", "x-consumer-faces": ["operations-admin"], "x-owner-module": "organization", "x-required-capability": "REQ_ADD_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION", responses: {204: {}}}},
      [removePath]: {delete: {operationId: "removeOperationsOrganizationHeadCompanyBrandAuthorization", "x-consumer-faces": ["operations-admin"], "x-owner-module": "organization", "x-required-capability": "REQ_REMOVE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION", "x-error-codes": ["ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE"], responses: {204: {}}}},
    },
  }));
  fs.writeFileSync(path.join(root, "contracts/openapi/edge.openapi.yaml"), JSON.stringify({
    components: {responses: {ProblemResponse: {content: {"application/problem+json": {}}}}},
  }));
  fs.writeFileSync(path.join(root, R24_BUSINESS_ENTITY_SCHEMA), JSON.stringify({components: {schemas: {
    HeadCompanyBrandAuthorizationAddRequest: {type: "object", additionalProperties: false, required: ["brandId"], properties: {brandId: {type: "string"}}},
  }}}));
  fs.writeFileSync(path.join(root, PROBLEM_SCHEMA_PATH), JSON.stringify({
    components: {
      schemas: {
        Problem: {
          properties: {
            errorCode: {},
            correlationId: {},
          },
        },
      },
    },
  }));
}

function writeP3CAccessFixture(root) {
  fs.mkdirSync(path.join(root, path.dirname(P3_C_PATH_DOCUMENT)), {recursive: true});
  fs.mkdirSync(path.join(root, path.dirname(P3_C_SCHEMA_DOCUMENT)), {recursive: true});
  const paths = {};
  for (const [operationId, operation] of P3_C_OPERATIONS) {
    paths[operation.path] ||= {};
    paths[operation.path][operation.method.toLowerCase()] = {
      operationId,
      "x-page-key": operation.pageKey,
      ...(WRITE_METHODS.has(operation.method) ? {"x-required-capability": capabilityRequirementId(operationId)} : {}),
      parameters: [{name: "groupWorkspaceKey", in: "path"}],
      ...(operation.requestSchema ? {requestBody: {content: {"application/json": {schema: {$ref: `../../components/workspace-iam/workspace-access.schemas.yaml#/components/schemas/${operation.requestSchema}`}}}}} : {}),
    };
  }
  fs.writeFileSync(path.join(root, P3_C_PATH_DOCUMENT), JSON.stringify({paths}));
  fs.writeFileSync(path.join(root, P3_C_SCHEMA_DOCUMENT), JSON.stringify({components: {schemas: {
    WorkspaceOperationsInvitationCreateRequest: {type: "object", required: ["mobile"], properties: {mobile: {type: "string"}}},
    WorkspaceOperationsInvitationActionRequest: {type: "object", required: ["expectedVersion"], properties: {expectedVersion: {type: "integer"}}},
    WorkspaceUserRevokeRequest: {type: "object", required: ["expectedVersion"], properties: {expectedVersion: {type: "integer"}}},
  }}}));
  return {
    authority: "p3-c-fixture",
    requirements: [...P3_C_OPERATIONS.values()].map((operation) => ({
      requirementId: capabilityRequirementId(operation.operationId),
      operationIdentity: {operationId: operation.operationId, method: operation.method, path: operation.path, consumerFace: "operations-admin"},
      authorizationMode: AUTHENTICATED_MODE,
      ...(WRITE_METHODS.has(operation.method)
        ? {capabilityKey: operation.capabilityKey, serverDerivedTarget: "STATIC_OPERATION_CAPABILITY", targetOrganizationType: operation.targetType, ownerRecheckId: "OWNER_RECHECK_WORKSPACE_IAM"}
        : {authorizationKind: ROLE_NODE_RANGE_READ, readScopeResolverId: READ_SCOPE_RESOLVER}),
      ownerModule: "workspace-iam",
      typedProblemMappingId: "PROBLEM_WORKSPACE_IAM_TYPED_OWNER_EXCEPTION",
      noClientDerivedAuthorization: true,
    })),
  };
}

function writeP3CEdgeRootFixture(root) {
  const paths = Object.fromEntries([...new Set([...P3_C_OPERATIONS.values()].map((operation) => operation.path))]
    .map((route) => [route, {$ref: p3CEdgeRootRef(route)}]));
  fs.writeFileSync(path.join(root, "contracts/openapi/edge.openapi.yaml"), JSON.stringify({paths}));
}

function writeStaticProofFixture(root) {
  for (const relative of [EDGE_ROOT, OWNER_OTP_DELIVERY_ROOT, ...TYPED_OWNER_EXCEPTION_ROOTS, path.posix.dirname(PROBLEM_ADVICE_PATH), path.posix.dirname(PROBLEM_SCHEMA_PATH)]) {
    fs.mkdirSync(path.join(root, relative), {recursive: true});
  }
  fs.writeFileSync(path.join(root, "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/FixtureOwner.java"), "package com.catering.v2s.contract.application; public class FixtureOwner { public static final class FixtureException extends RuntimeException {} }\n");
  fs.writeFileSync(path.join(root, "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java"), "package com.catering.v2s.organization.application; public class BusinessEntityService { public static class OrganizationConflictException extends RuntimeException {} public static final class HeadCompanyBrandAuthorizationInUseException extends OrganizationConflictException {} }\n");
  fs.writeFileSync(path.join(root, PROBLEM_ADVICE_PATH), "package fixture;\nimport com.catering.v2s.contract.application.FixtureOwner;\nimport com.catering.v2s.organization.application.BusinessEntityService;\n@RestControllerAdvice\n@ExceptionHandler({FixtureOwner.FixtureException.class, BusinessEntityService.OrganizationConflictException.class, BusinessEntityService.HeadCompanyBrandAuthorizationInUseException.class})\napplication/problem+json\nrecord Problem() {}\n");
  fs.writeFileSync(path.join(root, PROBLEM_SCHEMA_PATH), JSON.stringify({components: {schemas: {Problem: {properties: {errorCode: {}, correlationId: {}}}}}}));
  for (const ownerPath of DEBUG_VERIFICATION_CODE_OWNER_PATHS) {
    fs.writeFileSync(path.join(root, ownerPath), "package com.catering.v2s.workspace.iam.application; record OtpDelivery(long expiresAt, String debugVerificationCode) {}\n");
  }
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-capability-invariants-"));
  try {
    const frozenFixture = new Map([
      ["fixture.Owner.OneException", {sourcePath: "fixture/Owner.java", parent: undefined}],
      ["fixture.Owner.TwoException", {sourcePath: "fixture/Owner.java", parent: "fixture.Owner.OneException"}],
    ]);
    const frozenFixtureFingerprint = typedOwnerExceptionFingerprint(frozenFixture);
    assertFrozenTypedOwnerExceptionInventory(frozenFixture, 2, frozenFixtureFingerprint);
    try { assertFrozenTypedOwnerExceptionInventory(new Map([[...frozenFixture][0]]), 2, frozenFixtureFingerprint); fail("CAPABILITY_SELF_TEST_FROZEN_COUNT_NOT_DETECTED"); }
    catch (error) { if (!(error instanceof Error) || error.message !== "P3_A_TYPED_OWNER_EXCEPTION_FROZEN_COUNT_DRIFT:1") throw error; }
    const changedFrozenFixture = new Map(frozenFixture); changedFrozenFixture.set("fixture.Owner.OneException", {sourcePath: "fixture/Other.java", parent: undefined});
    try { assertFrozenTypedOwnerExceptionInventory(changedFrozenFixture, 2, frozenFixtureFingerprint); fail("CAPABILITY_SELF_TEST_FROZEN_SET_NOT_DETECTED"); }
    catch (error) { if (!(error instanceof Error) || !error.message.startsWith("P3_A_TYPED_OWNER_EXCEPTION_FROZEN_SET_DRIFT:")) throw error; }
    const publicOperation = {operationId: "acceptPublicInvitation", path: "/api/public/invitations/{token}", consumerFace: "public", ownerModule: "workspace-iam"};
    writeFixture(root, publicOperation);
    validateCapabilityInvariants(root);

    const anonymousAdminOperation = {operationId: "platformPasswordLogin", path: "/api/platform/auth/password-login", consumerFace: "platform-admin", ownerModule: "platform-iam", security: []};
    writeFixture(root, anonymousAdminOperation);
    validateCapabilityInvariants(root);
    const protectedSessionOperation = {operationId: "changeCurrentPlatformPassword", path: "/api/platform/auth/password", consumerFace: "platform-admin", ownerModule: "platform-iam", security: [{session: []}]};
    writeFixture(root, protectedSessionOperation);
    validateCapabilityInvariants(root);
    const protectedRegistry = governanceManifest(root);
    protectedRegistry.requirements[0].authorizationMode = PUBLIC_MODE;
    protectedRegistry.requirements[0].resolverId = "PUBLIC_PROTOCOL_TOKEN";
    fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(protectedRegistry));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_PROTECTED_SESSION_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_AUTHORIZATION_MODE_DRIFT:changeCurrentPlatformPassword")) throw error; }

    writeFixture(root, protectedSessionOperation);
    const platformCapabilityRegistry = governanceManifest(root);
    platformCapabilityRegistry.requirements[0].capabilityKey = "CAP_CHANGE_CURRENT_PLATFORM_PASSWORD";
    fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(platformCapabilityRegistry));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_PLATFORM_CAPABILITY_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_PLATFORM_CAPABILITY_FORBIDDEN:changeCurrentPlatformPassword")) throw error; }

    writeFixture(root, publicOperation);

    const openApi = path.join(root, "contracts/openapi/fixture.yaml");
    const document = JSON.parse(fs.readFileSync(openApi, "utf8"));
    delete document.paths[publicOperation.path].post["x-required-owner-protocol"];
    fs.writeFileSync(openApi, JSON.stringify(document));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_REQUIRED_MISSING_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_REQUIRED_MISSING:acceptPublicInvitation")) throw error; }

    writeFixture(root, publicOperation);
    const registry = governanceManifest(root);
    registry.requirements[0].authorizationMode = AUTHENTICATED_MODE;
    fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(registry));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_PUBLIC_PROTOCOL_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_AUTHORIZATION_MODE_DRIFT:acceptPublicInvitation")) throw error; }

    writeFixture(root, publicOperation);
    const ownerRegistry = governanceManifest(root);
    ownerRegistry.requirements[0].ownerRecheckId = "OWNER_RECHECK_MISSING";
    fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(ownerRegistry));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_OWNER_RECHECK_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_OWNER_RECHECK_BINDING_DRIFT:acceptPublicInvitation")) throw error; }

    const orgNodeOperation = {operationId: "updateOperationsOrganizationNode", method: "PATCH", path: "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}", consumerFace: "operations-admin", ownerModule: "organization"};
    writeFixture(root, orgNodeOperation);
    validateCapabilityInvariants(root);
    const orgNodeRegistry = governanceManifest(root);
    delete orgNodeRegistry.requirements[0].capabilityMapping.resourceTypeCapabilities.PROJECT;
    fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(orgNodeRegistry));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_ORG_NODE_MAPPING_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_ORG_NODE_EDIT_MAPPING_INVALID:updateOperationsOrganizationNode")) throw error; }

    writeR24Fixture(root);
    validateCapabilityInvariants(root);
    const r24Registry = governanceManifest(root);
    r24Registry.requirements[1].capabilityKey = "CAP_REMOVE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION";
    fs.writeFileSync(path.join(root, REGISTRY_PATH), JSON.stringify(r24Registry));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_R24_BUSINESS_CAPABILITY_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_R24_BUSINESS_CAPABILITY_DRIFT:removeOperationsOrganizationHeadCompanyBrandAuthorization")) throw error; }

    writeR24Fixture(root);
    const r24Document = json(root, "contracts/openapi/fixture.yaml", "CAPABILITY_R24_FIXTURE_INVALID");
    r24Document.paths["/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations"].post["x-required-capability"] = R24_SHARED_BUSINESS_CAPABILITY;
    fs.writeFileSync(openApi, JSON.stringify(r24Document));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_R24_CLIENT_BC_REQUIREMENT_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_REQUIREMENT_BINDING_DRIFT:addOperationsOrganizationHeadCompanyBrandAuthorization")) throw error; }

    writeR24ContractFixture(root);
    validateCapabilityInvariants(root);
    const r24Problem = json(root, PROBLEM_SCHEMA_PATH, "CAPABILITY_R24_FIXTURE_INVALID");
    r24Problem.components.schemas.Problem.properties.brandAuthorizationBlockers = {type: "object"};
    fs.writeFileSync(path.join(root, PROBLEM_SCHEMA_PATH), JSON.stringify(r24Problem));
    try { validateCapabilityInvariants(root); fail("CAPABILITY_SELF_TEST_R24_BLOCKER_DISCLOSURE_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_R24_BLOCKER_DISCLOSURE_PRESENT")) throw error; }

    const p3cManifest = writeP3CAccessFixture(root);
    validateP3CAccessContract(root, p3cManifest);
    const p3cReadCapabilityPath = json(root, P3_C_PATH_DOCUMENT, "CAPABILITY_P3_C_FIXTURE_INVALID");
    p3cReadCapabilityPath.paths[P3_C_OPERATIONS.get("getOperationsWorkspaceGroupUser").path].get["x-required-capability"] = "REQ_GET_OPERATIONS_WORKSPACE_GROUP_USER";
    fs.writeFileSync(path.join(root, P3_C_PATH_DOCUMENT), JSON.stringify(p3cReadCapabilityPath));
    try { validateCapabilityWriteOnlyBoundary(root, p3cManifest); fail("CAPABILITY_SELF_TEST_READ_OPENAPI_CAPABILITY_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_READ_OPENAPI_CAPABILITY_PRESENT:")) throw error; }
    const p3cReadRegistryManifest = writeP3CAccessFixture(root);
    p3cReadRegistryManifest.requirements.find((requirement) => requirement.operationIdentity.operationId === "getOperationsWorkspaceGroupUser").capabilityKey = "BC-IAM-GROUP-ROLE-REVOKE";
    try { validateCapabilityWriteOnlyBoundary(root, p3cReadRegistryManifest); fail("CAPABILITY_SELF_TEST_READ_REGISTRY_CAPABILITY_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_READ_REGISTRY_CAPABILITY_PRESENT:REQ_GET_OPERATIONS_WORKSPACE_GROUP_USER")) throw error; }
    const readEdgeSource = path.join(root, `${EDGE_ROOT}/FixtureReadController.java`);
    fs.mkdirSync(path.dirname(readEdgeSource), {recursive: true});
    fs.writeFileSync(readEdgeSource, "class FixtureReadController { WorkspaceCapabilityScopeResolver scopeResolver; @GetMapping void read() { scopeResolver.resolve(); } }\n");
    try { validateCapabilityWriteOnlyBoundary(root, writeP3CAccessFixture(root)); fail("CAPABILITY_SELF_TEST_READ_EDGE_GET_CAPABILITY_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes(`CAPABILITY_READ_EDGE_GET_CAPABILITY_PRESENT:${EDGE_ROOT}/FixtureReadController.java`)) throw error; }
    fs.writeFileSync(readEdgeSource, "class FixtureReadController { WorkspaceCapabilityScopeResolver scopeResolver; @GetMapping void read() { authorizeForRead(); } private void authorizeForRead() { scopeResolver.resolve(); } }\n");
    try { validateCapabilityWriteOnlyBoundary(root, writeP3CAccessFixture(root)); fail("CAPABILITY_SELF_TEST_READ_EDGE_GET_CAPABILITY_HELPER_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes(`CAPABILITY_READ_EDGE_GET_CAPABILITY_PRESENT:${EDGE_ROOT}/FixtureReadController.java`)) throw error; }
    fs.rmSync(readEdgeSource, {force: true});
    const p3cReadResolverManifest = writeP3CAccessFixture(root);
    p3cReadResolverManifest.requirements.find((requirement) => requirement.operationIdentity.operationId === "getOperationsWorkspaceGroupUser").resolverId = "AUTHENTICATED_WORKSPACE_TARGET_SCOPE";
    try { validateCapabilityWriteOnlyBoundary(root, p3cReadResolverManifest); fail("CAPABILITY_SELF_TEST_READ_REGISTRY_SCOPE_MODEL_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_READ_REGISTRY_SCOPE_MODEL_DRIFT:REQ_GET_OPERATIONS_WORKSPACE_GROUP_USER")) throw error; }
    writeP3CEdgeRootFixture(root);
    validateP3CEdgeRootProjection(root);
    const p3cRootFixture = json(root, "contracts/openapi/edge.openapi.yaml", "CAPABILITY_P3_C_FIXTURE_INVALID");
    delete p3cRootFixture.paths[P3_C_OPERATIONS.get("getOperationsWorkspaceGroupUser").path];
    fs.writeFileSync(path.join(root, "contracts/openapi/edge.openapi.yaml"), JSON.stringify(p3cRootFixture));
    try { validateP3CEdgeRootProjection(root); fail("CAPABILITY_SELF_TEST_P3_C_EDGE_ROOT_OMISSION_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_P3_C_EDGE_ROOT_SET_DRIFT")) throw error; }

    writeP3CEdgeRootFixture(root);
    const p3cLegacyRootFixture = json(root, "contracts/openapi/edge.openapi.yaml", "CAPABILITY_P3_C_FIXTURE_INVALID");
    p3cLegacyRootFixture.paths[p3CLegacyRootPaths()[0]] = {$ref: p3CEdgeRootRef(P3_C_OPERATIONS.get("getOperationsWorkspaceGroupInvitations").path)};
    fs.writeFileSync(path.join(root, "contracts/openapi/edge.openapi.yaml"), JSON.stringify(p3cLegacyRootFixture));
    try { validateP3CEdgeRootProjection(root); fail("CAPABILITY_SELF_TEST_P3_C_EDGE_LEGACY_ROOT_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_P3_C_EDGE_LEGACY_ROOT_PRESENT")) throw error; }

    const p3cPath = json(root, P3_C_PATH_DOCUMENT, "CAPABILITY_P3_C_FIXTURE_INVALID");
    p3cPath.paths[P3_C_OPERATIONS.get("getOperationsWorkspaceGroupUser").path].get.parameters.push({name: "pageDesignKey", in: "query"});
    fs.writeFileSync(path.join(root, P3_C_PATH_DOCUMENT), JSON.stringify(p3cPath));
    try { validateP3CAccessContract(root, p3cManifest); fail("CAPABILITY_SELF_TEST_P3_C_PAGE_KEY_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_P3_C_PAGE_KEY_OR_FALLBACK_PRESENT:getOperationsWorkspaceGroupUser")) throw error; }

    const p3cExactManifest = writeP3CAccessFixture(root);
    const p3cExactPath = json(root, P3_C_PATH_DOCUMENT, "CAPABILITY_P3_C_FIXTURE_INVALID");
    delete p3cExactPath.paths[P3_C_OPERATIONS.get("getOperationsWorkspaceGroupUserAccount").path].get;
    fs.writeFileSync(path.join(root, P3_C_PATH_DOCUMENT), JSON.stringify(p3cExactPath));
    try { validateP3CAccessContract(root, p3cExactManifest); fail("CAPABILITY_SELF_TEST_P3_C_EXACT_SET_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_P3_C_OPERATION_SET_DRIFT")) throw error; }

    const p3cClientTargetManifest = writeP3CAccessFixture(root);
    const p3cClientTargetSchema = json(root, P3_C_SCHEMA_DOCUMENT, "CAPABILITY_P3_C_FIXTURE_INVALID");
    p3cClientTargetSchema.components.schemas.WorkspaceOperationsInvitationCreateRequest.properties.targetOrganizationType = {type: "string"};
    fs.writeFileSync(path.join(root, P3_C_SCHEMA_DOCUMENT), JSON.stringify(p3cClientTargetSchema));
    try { validateP3CAccessContract(root, p3cClientTargetManifest); fail("CAPABILITY_SELF_TEST_P3_C_CLIENT_TARGET_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_P3_C_REQUEST_SCHEMA_CLIENT_TARGET_PRESENT:createOperationsWorkspaceGroupInvitation:targetOrganizationType")) throw error; }

    const p3cCapabilityTargetManifest = writeP3CAccessFixture(root);
    p3cCapabilityTargetManifest.requirements.find((requirement) => requirement.operationIdentity.operationId === "revokeOperationsWorkspaceProjectUserAssignment").capabilityKey = "BC-IAM-REGION-ROLE-REVOKE";
    try { validateP3CAccessContract(root, p3cCapabilityTargetManifest); fail("CAPABILITY_SELF_TEST_P3_C_TARGET_CAPABILITY_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("CAPABILITY_P3_C_SERVER_DERIVED_REQUIREMENT_DRIFT:revokeOperationsWorkspaceProjectUserAssignment")) throw error; }

    writeFixture(root, publicOperation);
    writeStaticProofFixture(root);
    validateP3AStaticProofSurfaces(root);
    const adviceFixture = path.join(root, PROBLEM_ADVICE_PATH);
    const adviceSource = fs.readFileSync(adviceFixture, "utf8");
    fs.writeFileSync(adviceFixture, adviceSource.replace("BusinessEntityService.HeadCompanyBrandAuthorizationInUseException.class", "BusinessEntityService.OrganizationConflictException.class"));
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_TYPED_OWNER_EXACT_MAPPING_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("P3_A_TYPED_OWNER_EXCEPTION_EXACT_MAPPING_MISSING:")) throw error; }
    fs.writeFileSync(adviceFixture, adviceSource.replace("FixtureOwner.FixtureException.class", "UnknownOwnerException.class"));
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_TYPED_OWNER_MAPPING_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("P3_A_TYPED_OWNER_EXCEPTION_SET_DRIFT:missing=")) throw error; }
    fs.writeFileSync(adviceFixture, adviceSource.replace("FixtureOwner.FixtureException.class", "RuntimeException.class"));
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_TYPED_OWNER_CATCH_ALL_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("P3_A_TYPED_OWNER_EXCEPTION_CATCH_ALL:")) throw error; }
    fs.writeFileSync(adviceFixture, adviceSource);
    fs.writeFileSync(path.join(root, "contracts/openapi/exposure.yaml"), JSON.stringify({components: {schemas: {OtpResponse: {properties: {testCode: {type: "string"}}}}}}));
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_OTP_OPENAPI_EXPOSURE_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("P3_A_OTP_TEST_CODE_EXTERNAL_EXPOSURE:contracts/openapi/exposure.yaml")) throw error; }
    fs.rmSync(path.join(root, "contracts/openapi/exposure.yaml"), {force: true});

    fs.writeFileSync(path.join(root, "contracts/openapi/debug-exposure.yaml"), "debugVerificationCode\n");
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_OTP_DEBUG_EXTERNAL_ESCAPE_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("P3_A_OTP_DEBUG_CODE_EXTERNAL_BOUNDARY_DRIFT:contracts/openapi/debug-exposure.yaml")) throw error; }
    fs.rmSync(path.join(root, "contracts/openapi/debug-exposure.yaml"), {force: true});

    writeFixture(root, publicOperation);
    writeStaticProofFixture(root);
    const generatedWire = path.join(root, `${EDGE_ROOT}/FixtureOtpResponse.java`);
    fs.mkdirSync(path.dirname(generatedWire), {recursive: true});
    fs.writeFileSync(generatedWire, "record FixtureOtpResponse(String testCode) {}\n");
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_OTP_GENERATED_WIRE_EXPOSURE_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes(`P3_A_OTP_TEST_CODE_EXTERNAL_EXPOSURE:${EDGE_ROOT}/FixtureOtpResponse.java`)) throw error; }
    fs.rmSync(generatedWire, {force: true});

    writeFixture(root, publicOperation);
    writeStaticProofFixture(root);
    fs.writeFileSync(path.join(root, OWNER_OTP_DELIVERY_ROOT, "UnexpectedOtpExposure.java"), "record UnexpectedOtpExposure(String testCode) {}\n");
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_OTP_OWNER_ESCAPE_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("P3_A_OTP_TEST_CODE_OWNER_BOUNDARY_DRIFT:")) throw error; }
    fs.rmSync(path.join(root, OWNER_OTP_DELIVERY_ROOT, "UnexpectedOtpExposure.java"), {force: true});

    writeFixture(root, publicOperation);
    writeStaticProofFixture(root);
    fs.writeFileSync(path.join(root, PROBLEM_ADVICE_PATH), "@RestControllerAdvice\napplication/problem+json\nrecord Problem() {}\n");
    try { validateP3AStaticProofSurfaces(root); fail("CAPABILITY_SELF_TEST_PROBLEM_ADVICE_NOT_DETECTED"); }
    catch (error) { if (!String(error.message).includes("P3_A_TYPED_PROBLEM_ADVICE_HANDLER_MISSING")) throw error; }

    process.stdout.write("CAPABILITY_INVARIANTS_SELF_TEST=PASS\nRED_MISSING_REQUIREMENT=PASS\nRED_PUBLIC_PROTOCOL=PASS\nRED_PLATFORM_CAPABILITY=PASS\nRED_OWNER_RECHECK=PASS\nRED_ORG_NODE_MAPPING=PASS\nRED_R24_SHARED_BUSINESS_CAPABILITY=PASS\nRED_R24_CLIENT_BC_REQUIREMENT=PASS\nRED_R24_BLOCKER_PROJECTION=PASS\nRED_READ_OPENAPI_CAPABILITY=PASS\nRED_READ_REGISTRY_CAPABILITY=PASS\nRED_READ_REGISTRY_SCOPE_MODEL=PASS\nRED_READ_EDGE_GET_CAPABILITY=PASS\nRED_READ_EDGE_GET_CAPABILITY_HELPER=PASS\nRED_P3_C_PAGE_KEY_OR_FALLBACK=PASS\nRED_P3_C_EXACT_OPERATION_SET=PASS\nRED_P3_C_CLIENT_TARGET=PASS\nRED_P3_C_TARGET_CAPABILITY=PASS\nRED_P3_C_EDGE_ROOT_OMISSION=PASS\nRED_P3_C_EDGE_LEGACY_ROOT=PASS\nRED_OTP_OPENAPI_EXPOSURE=PASS\nRED_OTP_GENERATED_WIRE_EXPOSURE=PASS\nRED_OTP_OWNER_ESCAPE=PASS\nRED_PROBLEM_ADVICE_SHAPE=PASS\nRED_TYPED_OWNER_EXCEPTION_MAPPING=PASS\nRED_TYPED_OWNER_EXCEPTION_EXACT_MAPPING=PASS\nRED_TYPED_OWNER_EXCEPTION_CATCH_ALL=PASS\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
}

function main() {
  const command = process.argv[2] || "check";
  if (command === "--self-test" || command === "self-test") selfTest();
  else if (command === "inventory") {
    const rows = mutatingOperationInventory();
    process.stdout.write(`${JSON.stringify({schemaVersion: 1, kind: "openapi-mutating-operation-inventory", rows}, null, 2)}\n`);
  } else if (command === "check") {
    const result = validateCapabilityInvariants();
    const staticProof = validateP3AStaticProofSurfaces(process.cwd());
    const frozenOwnerInventory = validateFrozenTypedOwnerExceptionInventory(process.cwd());
    process.stdout.write(`CAPABILITY_INVARIANTS=PASS\nMUTATING_OPERATIONS=${result.inventory.length}\nP3_A_OTP_RESPONSE_EXPOSURE=PASS\nP3_A_OTP_OWNER_INTERNAL_DELIVERY=PASS\nP3_A_TYPED_PROBLEM_ADVICE_SURFACE=PASS\nP3_A_TYPED_PROBLEM_OWNER_CONSUMPTION=${staticProof.problemAdvice.ownerConsumption}\nP3_A_TYPED_PROBLEM_OWNER_EXACT_INVENTORY=${frozenOwnerInventory}\n`);
  } else fail("USAGE: capability-invariants <check|inventory|--self-test>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) {
    process.stderr.write(`CAPABILITY_INVARIANTS=FAIL\nREASON=${error.message}\n`);
    process.exitCode = 1;
  }
}
