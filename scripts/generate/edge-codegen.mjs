#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCapabilityInvariants} from '../../tools/capability-invariants/cli.mjs';
import {projectEdgeCatalog} from './edge-operation-projections.mjs';
import {
  buildBudgetProjectionSubset,
  buildCp05CalibrationIdentityProjection,
  isCp05IdentityOnlyProjectionMode,
  readCp05CalibrationReport,
} from './backend-performance-budget.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalogPath = 'doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json';
const errorsPath = 'doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json';
const adminCatalogPath = 'contracts/catalog/admin-catalog.json';
const frontendManifestPath = 'contracts/policy/frontend-asset-carryover-manifest.json';
const reportPath = 'doc/evidence/platform/r5-u01-edge-placement-resolution.json';
const problemComponentPath = 'contracts/openapi/components/common/problem.schemas.json';
const salesMenuTagPolicyPath = 'contracts/policy/sales-menu-rtk-tag-policy.json';
const storeServicePointTagPolicyPath = 'contracts/policy/store-service-point-rtk-tag-policy.json';
const storeTerminalTagPolicyPath = 'contracts/policy/store-terminal-rtk-tag-policy.json';
const safeRetryableOperationIds = new Set(['activateTerminal', 'cancelTerminalActivation']);
const targets = {
  errorsJava:
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/EdgeProblemCode.java',
  r3CompatibilityJava:
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/CommercialGroupProblemCode.java',
  wireJavaRoot: 'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire',
  routeRegistry: 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
  capabilityOperationsCatalog:
    'apps/backend/catering-business-server/src/main/resources/generated/capability-operation-registry.json',
  capabilityRequirementCatalogJava:
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/CapabilityRequirementCatalog.java',
  capabilityResolverRegistryJava:
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/CapabilityResolverRegistry.java',
  workspaceCapabilityRequirementCatalogJava:
    'apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java',
  platformTs: 'apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts',
  operationsTs: 'apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts',
  publicTs: 'apps/frontend/operations-admin/src/app/api/generated/public-edge.ts',
  platformRtkTs: 'apps/frontend/platform-admin/src/app/api/generated/platform-edge.rtk.ts',
  operationsRtkTs: 'apps/frontend/operations-admin/src/app/api/generated/operations-edge.rtk.ts',
  publicRtkTs: 'apps/frontend/operations-admin/src/app/api/generated/public-edge.rtk.ts',
  platformAdminCatalogTs: 'apps/frontend/platform-admin/src/app/catalog/generatedAdminCatalog.ts',
  operationsAdminCatalogTs: 'apps/frontend/operations-admin/src/app/catalog/generatedAdminCatalog.ts',
  workspaceAuthorizationCatalogJava:
    'apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java',
};

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `:${detail}` : ''}`);
  error.code = code;
  throw error;
}
function read(relative, base = root) {
  return JSON.parse(fs.readFileSync(path.join(base, relative), 'utf8'));
}
function normalized(value) {
  return JSON.stringify(value, null, 2) + '\n';
}
function assertCanonicalOperationIdentity(catalog) {
  const expectedOperationCount = catalog?.denominator?.operations;
  if (!Number.isInteger(expectedOperationCount) || catalog.operations.length !== expectedOperationCount) {
    fail('R5_EDGE_BUDGET_OPERATION_COUNT', `${catalog.operations.length}:${expectedOperationCount}`);
  }
  const seen = new Set();
  for (const operation of catalog.operations) {
    if (seen.has(operation.operationId)) fail('R5_EDGE_BUDGET_OPERATION_DUPLICATE', operation.operationId);
    seen.add(operation.operationId);
    if (Object.hasOwn(operation, 'databaseOperationBudget'))
      fail('R5_EDGE_STATIC_BUDGET_RETIRED', operation.operationId);
  }
}
function activeCodes(errors) {
  const codes = [
    ...errors.heritageCodes.filter(row => row.target).map(row => row.target),
    ...errors.r3CompatibilityCodes.map(row => row.target),
    ...errors.v2sNativeCodes.map(row => row.code),
  ];
  return [...new Set(codes)].sort();
}
function operationErrorCodes(catalog, operation) {
  const base = catalog.errorSets?.[operation.errorSetRef];
  const augmentation = catalog.operationErrorAugmentations?.[operation.operationId] || [];
  if (!Array.isArray(base) || !Array.isArray(augmentation))
    fail('R5_EDGE_CODEGEN_ERROR_SET_INVALID', operation.operationId);
  const selectionRule = catalog.operationErrorSelectionRules?.[operation.operationId];
  return [
    ...new Set(selectionRule?.mode === 'REPLACE_BASE_WITH_AUGMENTATION' ? augmentation : [...base, ...augmentation]),
  ];
}
function faceErrorCodes(catalog, face, activeCodeSet) {
  const codes = [
    ...new Set(
      catalog.operations
        .filter(operation => operation.face === face)
        .flatMap(operation => operationErrorCodes(catalog, operation)),
    ),
  ].sort();
  for (const code of codes) if (!activeCodeSet.has(code)) fail('R5_EDGE_CODEGEN_FACE_ERROR_UNKNOWN', `${face}:${code}`);
  return codes;
}
function openApiSchemaName(schema, fallback, context) {
  if (!schema) return fallback;
  if (typeof schema.$ref !== 'string') fail('R5_EDGE_CODEGEN_OPENAPI_SCHEMA_REF_REQUIRED', context);
  return referenceName(schema.$ref);
}
function localReference(document, value, expectedKind, context) {
  if (!value || typeof value !== 'object' || typeof value.$ref !== 'string') return value;
  const prefix = `#/components/${expectedKind}/`;
  if (!value.$ref.startsWith(prefix)) fail('R5_EDGE_CODEGEN_LOCAL_REFERENCE_INVALID', `${context}:${value.$ref}`);
  const name = value.$ref.slice(prefix.length);
  const resolved = document.components?.[expectedKind]?.[name];
  if (!resolved || typeof resolved !== 'object')
    fail('R5_EDGE_CODEGEN_LOCAL_REFERENCE_MISSING', `${context}:${value.$ref}`);
  return resolved;
}
function openApiOperation(base, catalogOperation, reportOperation) {
  if (!reportOperation?.pathFile) fail('R5_EDGE_CODEGEN_PATH_FILE_MISSING', catalogOperation.operationId);
  const pathDocument = read(path.posix.join('contracts/openapi', reportOperation.pathFile), base);
  const operation = pathDocument.paths?.[catalogOperation.path]?.[catalogOperation.method.toLowerCase()];
  if (!operation || operation.operationId !== catalogOperation.operationId)
    fail('R5_EDGE_CODEGEN_OPENAPI_OPERATION_MISSING', catalogOperation.operationId);
  if (
    !sameSet(operation['x-consumer-faces'] || [], [catalogOperation.face]) ||
    operation['x-owner-module'] !== catalogOperation.owner
  ) {
    fail('R5_EDGE_CODEGEN_OPENAPI_OWNERSHIP_DRIFT', catalogOperation.operationId);
  }
  const parameters = (operation.parameters || []).map(parameter =>
    localReference(pathDocument, parameter, 'parameters', `${catalogOperation.operationId}:parameter`),
  );
  const pathParameters = parameters.filter(parameter => parameter.in === 'path');
  const queryParameters = parameters.filter(parameter => parameter.in === 'query');
  const headerParameters = parameters.filter(parameter => parameter.in === 'header');
  if (
    !sameSet(
      pathParameters.map(parameter => parameter.name),
      catalogOperation.pathParameters || [],
    )
  ) {
    fail('R5_EDGE_CODEGEN_OPENAPI_PATH_PARAMETER_DRIFT', catalogOperation.operationId);
  }
  if (
    !sameSet(
      queryParameters.map(parameter => parameter.name),
      (catalogOperation.queryParameters || []).map(parameter => parameter.name),
    )
  ) {
    fail('R5_EDGE_CODEGEN_OPENAPI_QUERY_PARAMETER_DRIFT', catalogOperation.operationId);
  }
  const requestBody = localReference(
    pathDocument,
    operation.requestBody,
    'requestBodies',
    `${catalogOperation.operationId}:requestBody`,
  );
  const requestContentType =
    catalogOperation.requestSchema === 'NoBody' ? null : catalogOperation.requestContentType || 'application/json';
  const requestSchema = openApiSchemaName(
    requestContentType ? requestBody?.content?.[requestContentType]?.schema : undefined,
    'NoBody',
    `${catalogOperation.operationId}:request`,
  );
  const successStatuses = Object.keys(operation.responses || {}).filter(status => /^2\d\d$/.test(status));
  if (successStatuses.length !== 1 || successStatuses[0] !== catalogOperation.successStatus) {
    fail(
      'R5_EDGE_CODEGEN_OPENAPI_SUCCESS_STATUS_DRIFT',
      `${catalogOperation.operationId}:${catalogOperation.successStatus}:${successStatuses.join(',')}`,
    );
  }
  const successResponse = localReference(
    pathDocument,
    operation.responses[successStatuses[0]],
    'responses',
    `${catalogOperation.operationId}:response`,
  );
  const successContent = successResponse?.content && Object.values(successResponse.content)[0];
  const responseSchema = openApiSchemaName(
    successContent?.schema,
    'NoContent',
    `${catalogOperation.operationId}:response`,
  );
  if (requestSchema !== catalogOperation.requestSchema || responseSchema !== catalogOperation.responseSchema) {
    fail(
      'R5_EDGE_CODEGEN_CATALOG_OPENAPI_SCHEMA_DRIFT',
      `${catalogOperation.operationId}:${catalogOperation.requestSchema}/${requestSchema}:${catalogOperation.responseSchema}/${responseSchema}`,
    );
  }
  if (!Array.isArray(operation.security))
    fail('R5_EDGE_CODEGEN_OPENAPI_SECURITY_REQUIRED', catalogOperation.operationId);
  const terminalAuthorizationMarkers = [
    operation['x-required-capability'],
    operation['x-required-owner-protocol'],
    operation['x-required-platform-authorization'],
    operation['x-required-terminal-credential'],
  ].filter(value => value !== undefined);
  if (catalogOperation.authorizationMode === 'NONE'
    && (operation['x-authorization-mode'] !== 'NONE' || operation.security.length !== 0 || terminalAuthorizationMarkers.length !== 0)) {
    fail('R5_EDGE_CODEGEN_TERMINAL_ACTIVATION_AUTH_DRIFT', catalogOperation.operationId);
  }
  if (catalogOperation.authorizationMode === 'TERMINAL_CREDENTIAL'
    && (operation['x-authorization-mode'] !== 'TERMINAL_CREDENTIAL'
      || JSON.stringify(operation.security) !== JSON.stringify([{terminalCredential: []}])
      || typeof operation['x-required-terminal-credential'] !== 'string'
      || terminalAuthorizationMarkers.length !== 1)) {
    fail('R5_EDGE_CODEGEN_TERMINAL_CREDENTIAL_AUTH_DRIFT', catalogOperation.operationId);
  }
  const safeRetryable = safeRetryableOperationIds.has(catalogOperation.operationId);
  if (safeRetryable !== (catalogOperation.safeRetryable === true)
    || safeRetryable !== (operation['x-safe-retryable'] === true)) {
    fail('R5_EDGE_CODEGEN_TERMINAL_SAFE_RETRY_DRIFT', catalogOperation.operationId);
  }
  const idempotencyHeaders = headerParameters.filter(parameter => parameter.name.toLowerCase() === 'idempotency-key');
  const expectsIdempotency = catalogOperation.idempotency?.header === 'REQUIRED_16_128';
  if (
    idempotencyHeaders.length !== (expectsIdempotency ? 1 : 0) ||
    (expectsIdempotency && idempotencyHeaders[0].required !== true)
  ) {
    fail('R5_EDGE_CODEGEN_OPENAPI_IDEMPOTENCY_HEADER_DRIFT', catalogOperation.operationId);
  }
  return {
    ...catalogOperation,
    openApi: {
      pathParameters,
      queryParameters,
      headerParameters,
      requestRequired: requestBody?.required === true,
      requiresSession: operation.security.some(requirement =>
        Object.keys(requirement || {}).some(scheme => scheme === 'platformSessionCookie' || scheme === 'operationsSessionCookie'),
      ),
    },
  };
}
function jsonPointer(document, fragment, context) {
  if (!fragment.startsWith('#/')) fail('R5_EDGE_ROOT_OPENAPI_REFERENCE_INVALID', context);
  const value = fragment
    .slice(2)
    .split('/')
    .reduce((current, token) => current?.[token.replaceAll('~1', '/').replaceAll('~0', '~')], document);
  if (!value || typeof value !== 'object') fail('R5_EDGE_ROOT_OPENAPI_REFERENCE_MISSING', context);
  return value;
}
function rootPathItem(base, rootPath, value) {
  if (!value || typeof value !== 'object' || typeof value.$ref !== 'string')
    fail('R5_EDGE_ROOT_OPENAPI_PATH_REFERENCE_REQUIRED', rootPath);
  const [referenceFile, fragment = ''] = value.$ref.split('#', 2);
  if (!referenceFile || !fragment) fail('R5_EDGE_ROOT_OPENAPI_REFERENCE_INVALID', `${rootPath}:${value.$ref}`);
  const relative = path.posix.normalize(path.posix.join('contracts/openapi', referenceFile));
  if (!relative.startsWith('contracts/openapi/'))
    fail('R5_EDGE_ROOT_OPENAPI_REFERENCE_INVALID', `${rootPath}:${value.$ref}`);
  return jsonPointer(read(relative, base), `#${fragment}`, `${rootPath}:${value.$ref}`);
}
function operationTuple({operationId, method, path: operationPath, face, owner}) {
  if (
    typeof operationId !== 'string' ||
    typeof method !== 'string' ||
    typeof operationPath !== 'string' ||
    typeof face !== 'string' ||
    typeof owner !== 'string'
  ) {
    fail('R5_EDGE_ROOT_ROUTE_REGISTRY_TUPLE_INVALID', operationId || operationPath || 'UNKNOWN');
  }
  return JSON.stringify([operationId, method.toUpperCase(), operationPath, face, owner]);
}
function rootOpenApiOperationTuples(base) {
  const document = read('contracts/openapi/edge.openapi.json', base);
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
  const tuples = [];
  for (const [rootPath, reference] of Object.entries(document.paths || {})) {
    const pathItem = rootPathItem(base, rootPath, reference);
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      const faces = operation?.['x-consumer-faces'];
      const owner = operation?.['x-owner-module'];
      if (
        !operation ||
        typeof operation.operationId !== 'string' ||
        !Array.isArray(faces) ||
        faces.length === 0 ||
        typeof owner !== 'string'
      ) {
        fail('R5_EDGE_ROOT_OPENAPI_OPERATION_INVALID', `${rootPath}:${method}`);
      }
      for (const face of faces)
        tuples.push(operationTuple({operationId: operation.operationId, method, path: rootPath, face, owner}));
    }
  }
  return tuples;
}
function assertRootOpenApiRouteRegistryExactSet(base, operations) {
  const rootTuples = rootOpenApiOperationTuples(base);
  const registryTuples = operations.map(operation => operationTuple(operation));
  if (
    new Set(rootTuples).size !== rootTuples.length ||
    new Set(registryTuples).size !== registryTuples.length ||
    !sameSet(rootTuples, registryTuples)
  ) {
    fail('R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT', `root=${rootTuples.length}:registry=${registryTuples.length}`);
  }
}
function load(base = root) {
  const sourceCatalog = read(catalogPath, base);
  const sourceReport = read(reportPath, base);
  const {catalog, report} = projectEdgeCatalog(sourceCatalog, sourceReport);
  const errors = read(errorsPath, base);
  const expectedOperationCount = catalog.denominator?.operations;
  if (
    !Number.isInteger(expectedOperationCount) ||
    catalog.operations.length !== expectedOperationCount ||
    report.operations.length !== expectedOperationCount
  )
    fail('R5_EDGE_CODEGEN_OPERATION_COUNT');
  assertCanonicalOperationIdentity(catalog);
  const budgetProjection = isCp05IdentityOnlyProjectionMode()
    ? buildCp05CalibrationIdentityProjection({operations: catalog.operations})
    : buildBudgetProjectionSubset({
        operations: catalog.operations,
        calibrationReport: readCp05CalibrationReport({root: base}).report,
      });
  const budgetsByOperationId = new Map(
    budgetProjection.operations.map(operation => [operation.operationId, operation.databaseOperationBudget]),
  );
  const byId = new Map(catalog.operations.map(operation => [operation.operationId, operation]));
  for (const row of report.operations) {
    const operation = byId.get(row.operationId);
    if (!operation || row.face !== operation.face || row.path !== operation.path || row.owner !== operation.owner)
      fail('R5_EDGE_CODEGEN_REPORT_DRIFT', row.operationId);
  }
  const reportById = new Map(report.operations.map(operation => [operation.operationId, operation]));
  const operations = catalog.operations
    .map(operation => {
      const projected = openApiOperation(base, operation, reportById.get(operation.operationId));
      const databaseOperationBudget = budgetsByOperationId.get(operation.operationId);
      return databaseOperationBudget === undefined ? projected : {...projected, databaseOperationBudget};
    })
    .sort((left, right) => left.operationId.localeCompare(right.operationId));
  const salesMenuTagPolicyByOperation = validateSalesMenuTagPolicy(read(salesMenuTagPolicyPath, base), operations);
  const storeServicePointTagPolicyByOperation = validateStoreServicePointTagPolicy(
    read(storeServicePointTagPolicyPath, base),
    operations,
  );
  const storeTerminalTagPolicyByOperation = validateStoreTerminalTagPolicy(
    read(storeTerminalTagPolicyPath, base),
    operations,
  );
  const rtkTagPoliciesByOperation = new Map([
    ...salesMenuTagPolicyByOperation.entries(),
    ...storeServicePointTagPolicyByOperation.entries(),
    ...storeTerminalTagPolicyByOperation.entries(),
  ]);
  assertRootOpenApiRouteRegistryExactSet(base, operations);
  const faceCounts = Object.fromEntries(
    ['platform-admin', 'operations-admin', 'public', 'terminal'].map(face => [
      face,
      operations.filter(operation => operation.face === face).length,
    ]),
  );
  if (JSON.stringify(faceCounts) !== JSON.stringify(catalog.denominator.faces)) fail('R5_EDGE_CODEGEN_FACE_COUNT');
  const codes = activeCodes(errors);
  if (codes.length !== errors.closure.totalActiveTargetCount) fail('R5_EDGE_CODEGEN_ERROR_COUNT');
  const activeCodeSet = new Set(codes);
  const codesByFace = Object.fromEntries(
    ['platform-admin', 'operations-admin', 'public'].map(face => [face, faceErrorCodes(catalog, face, activeCodeSet)]),
  );
  return {
    catalog,
    operations,
    faceCounts,
    codes,
    codesByFace,
    expectedOperationCount,
    calibrationReportDigest: budgetProjection.calibrationReportDigest,
    salesMenuTagPolicyByOperation,
    storeServicePointTagPolicyByOperation,
    storeTerminalTagPolicyByOperation,
    rtkTagPoliciesByOperation,
  };
}
function sameSet(left, right) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}
function validateSalesMenuTagDescriptor(operation, descriptor, collection) {
  if (!descriptor || typeof descriptor !== 'object' || typeof descriptor.kind !== 'string') {
    fail('R5_SALES_MENU_RTK_TAG_DESCRIPTOR_INVALID', `${operation.operationId}:${collection}`);
  }
  if (descriptor.kind === 'static') {
    if (typeof descriptor.id !== 'string' || descriptor.id.trim() === '' || descriptor.id === 'LIST') {
      fail('R5_SALES_MENU_RTK_TAG_STATIC_ID_INVALID', `${operation.operationId}:${collection}`);
    }
    return;
  }
  const pathNames =
    descriptor.kind === 'requestPath'
      ? operation.openApi.pathParameters.map(parameter => parameter.name)
      : descriptor.kind === 'requestQuery'
        ? operation.openApi.queryParameters.map(parameter => parameter.name)
        : undefined;
  if (
    (descriptor.kind !== 'requestPath' && descriptor.kind !== 'requestQuery') ||
    typeof descriptor.prefix !== 'string' ||
    descriptor.prefix.trim() === '' ||
    typeof descriptor.path !== 'string' ||
    descriptor.path.trim() === '' ||
    !pathNames.includes(descriptor.path)
  ) {
    fail('R5_SALES_MENU_RTK_TAG_REQUEST_PATH_INVALID', `${operation.operationId}:${collection}`);
  }
}
function validateSalesMenuTagPolicy(policy, operations) {
  if (policy?.kind !== 'sales-menu-rtk-tag-policy') fail('R5_SALES_MENU_RTK_TAG_POLICY_KIND_INVALID');
  if (policy?.tagType !== 'salesMenu') fail('R5_SALES_MENU_RTK_TAG_TYPE_INVALID');
  const salesMenuOperations = operations.filter(
    operation => operation.face === 'operations-admin' && operation.path.includes('/sales-menus'),
  );
  if (policy?.operationCount !== salesMenuOperations.length) fail('R5_SALES_MENU_RTK_TAG_OPERATION_COUNT_INVALID');
  if (!Array.isArray(policy?.operations) || policy.operations.length !== salesMenuOperations.length)
    fail('R5_SALES_MENU_RTK_TAG_OPERATION_LIST_INVALID');
  const operationById = new Map(salesMenuOperations.map(operation => [operation.operationId, operation]));
  const policyById = new Map();
  for (const entry of policy.operations) {
    const operation = operationById.get(entry?.operationId);
    if (!operation) fail('R5_SALES_MENU_RTK_TAG_OPERATION_UNKNOWN', entry?.operationId || 'MISSING');
    if (policyById.has(operation.operationId)) fail('R5_SALES_MENU_RTK_TAG_OPERATION_DUPLICATE', operation.operationId);
    if (!Array.isArray(entry.provides) || !Array.isArray(entry.invalidates))
      fail('R5_SALES_MENU_RTK_TAG_OPERATION_SHAPE_INVALID', operation.operationId);
    if (operation.method === 'GET' && (entry.provides.length === 0 || entry.invalidates.length !== 0))
      fail('R5_SALES_MENU_RTK_TAG_GET_SHAPE_INVALID', operation.operationId);
    if (operation.method !== 'GET' && entry.provides.length !== 0)
      fail('R5_SALES_MENU_RTK_TAG_MUTATION_PROVIDER_PRESENT', operation.operationId);
    for (const descriptor of entry.provides) validateSalesMenuTagDescriptor(operation, descriptor, 'provides');
    for (const descriptor of entry.invalidates) validateSalesMenuTagDescriptor(operation, descriptor, 'invalidates');
    if (
      ['stageOperationsSalesMenuAsset', 'releaseOperationsSalesMenuStagedAsset'].includes(operation.operationId) &&
      entry.invalidates.length !== 0
    ) {
      fail('R5_SALES_MENU_RTK_TAG_UNRELATED_INVALIDATION', operation.operationId);
    }
    policyById.set(operation.operationId, {...entry, tagType: 'salesMenu'});
  }
  for (const operation of salesMenuOperations)
    if (!policyById.has(operation.operationId)) fail('R5_SALES_MENU_RTK_TAG_OPERATION_MISSING', operation.operationId);
  return policyById;
}
function validateStoreServicePointTagDescriptor(operation, descriptor, collection) {
  if (!descriptor || typeof descriptor !== 'object' || typeof descriptor.kind !== 'string') {
    fail('R5_STORE_SERVICE_POINT_RTK_TAG_DESCRIPTOR_INVALID', `${operation.operationId}:${collection}`);
  }
  if (descriptor.kind === 'static') {
    if (typeof descriptor.id !== 'string' || descriptor.id.trim() === '' || descriptor.id === 'LIST') {
      fail('R5_STORE_SERVICE_POINT_RTK_TAG_STATIC_ID_INVALID', `${operation.operationId}:${collection}`);
    }
    return;
  }
  const pathNames =
    descriptor.kind === 'requestPath' ? operation.openApi.pathParameters.map(parameter => parameter.name) : undefined;
  if (
    descriptor.kind !== 'requestPath' ||
    typeof descriptor.prefix !== 'string' ||
    descriptor.prefix.trim() === '' ||
    typeof descriptor.path !== 'string' ||
    descriptor.path.trim() === '' ||
    !pathNames.includes(descriptor.path)
  ) {
    fail('R5_STORE_SERVICE_POINT_RTK_TAG_REQUEST_PATH_INVALID', `${operation.operationId}:${collection}`);
  }
}
function validateStoreServicePointTagPolicy(policy, operations) {
  if (policy?.kind !== 'store-service-point-rtk-tag-policy') fail('R5_STORE_SERVICE_POINT_RTK_TAG_POLICY_KIND_INVALID');
  if (policy?.tagType !== 'wire') fail('R5_STORE_SERVICE_POINT_RTK_TAG_TYPE_INVALID');
  const storeServicePointOperations = operations.filter(
    operation =>
      operation.face === 'operations-admin' &&
      (operation.path.includes('/service-point') ||
        operation.path.includes('/qr-configuration') ||
        operation.operationId === 'getOperationsStoreQrChannelCandidates'),
  );
  if (policy?.operationCount !== storeServicePointOperations.length)
    fail('R5_STORE_SERVICE_POINT_RTK_TAG_OPERATION_COUNT_INVALID');
  if (!Array.isArray(policy?.operations) || policy.operations.length !== storeServicePointOperations.length) {
    fail('R5_STORE_SERVICE_POINT_RTK_TAG_OPERATION_LIST_INVALID');
  }
  const operationById = new Map(storeServicePointOperations.map(operation => [operation.operationId, operation]));
  const policyById = new Map();
  for (const entry of policy.operations) {
    const operation = operationById.get(entry?.operationId);
    if (!operation) fail('R5_STORE_SERVICE_POINT_RTK_TAG_OPERATION_UNKNOWN', entry?.operationId || 'MISSING');
    if (policyById.has(operation.operationId))
      fail('R5_STORE_SERVICE_POINT_RTK_TAG_OPERATION_DUPLICATE', operation.operationId);
    if (!Array.isArray(entry.provides) || !Array.isArray(entry.invalidates)) {
      fail('R5_STORE_SERVICE_POINT_RTK_TAG_OPERATION_SHAPE_INVALID', operation.operationId);
    }
    if (operation.method === 'GET' && (entry.provides.length === 0 || entry.invalidates.length !== 0)) {
      fail('R5_STORE_SERVICE_POINT_RTK_TAG_GET_SHAPE_INVALID', operation.operationId);
    }
    if (operation.method !== 'GET' && entry.provides.length !== 0) {
      fail('R5_STORE_SERVICE_POINT_RTK_TAG_MUTATION_PROVIDER_PRESENT', operation.operationId);
    }
    for (const descriptor of entry.provides) validateStoreServicePointTagDescriptor(operation, descriptor, 'provides');
    for (const descriptor of entry.invalidates)
      validateStoreServicePointTagDescriptor(operation, descriptor, 'invalidates');
    if (
      ['stageStoreServicePointImage', 'releaseStagedStoreServicePointImage'].includes(operation.operationId) &&
      entry.invalidates.length !== 0
    ) {
      fail('R5_STORE_SERVICE_POINT_RTK_TAG_UNRELATED_INVALIDATION', operation.operationId);
    }
    policyById.set(operation.operationId, {...entry, tagType: 'wire'});
  }
  for (const operation of storeServicePointOperations) {
    if (!policyById.has(operation.operationId))
      fail('R5_STORE_SERVICE_POINT_RTK_TAG_OPERATION_MISSING', operation.operationId);
  }
  return policyById;
}
function validateStoreTerminalTagDescriptor(operation, descriptor, collection) {
  if (!descriptor || typeof descriptor !== 'object' || typeof descriptor.kind !== 'string') {
    fail('R5_STORE_TERMINAL_RTK_TAG_DESCRIPTOR_INVALID', `${operation.operationId}:${collection}`);
  }
  if (descriptor.kind === 'static') {
    if (typeof descriptor.id !== 'string' || descriptor.id.trim() === '' || descriptor.id === 'LIST') {
      fail('R5_STORE_TERMINAL_RTK_TAG_STATIC_ID_INVALID', `${operation.operationId}:${collection}`);
    }
    return;
  }
  const pathNames =
    descriptor.kind === 'requestPath' ? operation.openApi.pathParameters.map(parameter => parameter.name) : undefined;
  if (
    descriptor.kind !== 'requestPath' ||
    typeof descriptor.prefix !== 'string' ||
    descriptor.prefix.trim() === '' ||
    typeof descriptor.path !== 'string' ||
    descriptor.path.trim() === '' ||
    !pathNames.includes(descriptor.path)
  ) {
    fail('R5_STORE_TERMINAL_RTK_TAG_REQUEST_PATH_INVALID', `${operation.operationId}:${collection}`);
  }
}
function validateStoreTerminalTagPolicy(policy, operations) {
  if (policy?.kind !== 'store-terminal-rtk-tag-policy') fail('R5_STORE_TERMINAL_RTK_TAG_POLICY_KIND_INVALID');
  if (policy?.tagType !== 'wire') fail('R5_STORE_TERMINAL_RTK_TAG_TYPE_INVALID');
  const storeTerminalOperations = operations.filter(
    operation => operation.face === 'operations-admin' && operation.owner === 'store-terminal',
  );
  if (policy?.operationCount !== storeTerminalOperations.length)
    fail('R5_STORE_TERMINAL_RTK_TAG_OPERATION_COUNT_INVALID');
  if (!Array.isArray(policy?.operations) || policy.operations.length !== storeTerminalOperations.length) {
    fail('R5_STORE_TERMINAL_RTK_TAG_OPERATION_LIST_INVALID');
  }
  const operationById = new Map(storeTerminalOperations.map(operation => [operation.operationId, operation]));
  const policyById = new Map();
  for (const entry of policy.operations) {
    const operation = operationById.get(entry?.operationId);
    if (!operation) fail('R5_STORE_TERMINAL_RTK_TAG_OPERATION_UNKNOWN', entry?.operationId || 'MISSING');
    if (policyById.has(operation.operationId))
      fail('R5_STORE_TERMINAL_RTK_TAG_OPERATION_DUPLICATE', operation.operationId);
    if (!Array.isArray(entry.provides) || !Array.isArray(entry.invalidates)) {
      fail('R5_STORE_TERMINAL_RTK_TAG_OPERATION_SHAPE_INVALID', operation.operationId);
    }
    if (operation.method === 'GET' && (entry.provides.length === 0 || entry.invalidates.length !== 0)) {
      fail('R5_STORE_TERMINAL_RTK_TAG_GET_SHAPE_INVALID', operation.operationId);
    }
    if (operation.method !== 'GET' && entry.provides.length !== 0) {
      fail('R5_STORE_TERMINAL_RTK_TAG_MUTATION_PROVIDER_PRESENT', operation.operationId);
    }
    for (const descriptor of entry.provides) validateStoreTerminalTagDescriptor(operation, descriptor, 'provides');
    for (const descriptor of entry.invalidates)
      validateStoreTerminalTagDescriptor(operation, descriptor, 'invalidates');
    policyById.set(operation.operationId, {...entry, tagType: 'wire'});
  }
  for (const operation of storeTerminalOperations) {
    if (!policyById.has(operation.operationId))
      fail('R5_STORE_TERMINAL_RTK_TAG_OPERATION_MISSING', operation.operationId);
  }
  return policyById;
}
function loadAdminCatalog(base = root) {
  const source = read(adminCatalogPath, base);
  const manifest = read(frontendManifestPath, base);
  if (
    !Array.isArray(source.nodes) ||
    Object.keys(source).some(key => !['schemaVersion', 'kind', 'authority', 'sourcePolicy', 'nodes'].includes(key))
  ) {
    fail('R5_ADMIN_CATALOG_NODE_MODEL_REQUIRED');
  }
  const nodesByKey = new Map();
  for (const node of source.nodes) {
    if (
      !node ||
      typeof node.key !== 'string' ||
      nodesByKey.has(node.key) ||
      !['NAVIGATION_GROUP', 'ACTION_GROUP', 'PAGE', 'ACTION', 'SHELL_COPY'].includes(node.kind) ||
      typeof node.display?.label !== 'string' ||
      node.display.label.length === 0
    )
      fail('R5_ADMIN_CATALOG_NODE_INVALID', node?.key);
    nodesByKey.set(node.key, node);
  }
  const nodes = [...nodesByKey.values()];
  const navigationGroups = nodes.filter(node => node.kind === 'NAVIGATION_GROUP');
  const actionGroups = nodes.filter(node => node.kind === 'ACTION_GROUP');
  const pages = nodes.filter(node => node.kind === 'PAGE');
  const actions = nodes.filter(node => node.kind === 'ACTION');
  const shellCopy = nodes.filter(node => node.kind === 'SHELL_COPY');
  const pageKeys = pages.map(node => node.key);
  const actionKeys = actions.map(node => node.key);
  const manifestPages = Object.keys(manifest.pageDesignKeySurfaceCrosswalk.byPageDesignKey);
  const manifestActions = manifest.policy.actionCapabilityCatalog.activeKeys;
  if (!sameSet(pageKeys, manifestPages)) fail('R5_ADMIN_CATALOG_PAGE_SET_DRIFT');
  if (!sameSet(actionKeys, manifestActions) || actionKeys.length !== manifestActions.length)
    fail('R5_ADMIN_CATALOG_ACTION_SET_DRIFT');
  if (new Set(pageKeys).size !== pageKeys.length || new Set(actionKeys).size !== actionKeys.length)
    fail('R5_ADMIN_CATALOG_DUPLICATE_KEY');
  if (shellCopy.some(node => node.consumerFace !== 'platform-admin')) fail('R5_ADMIN_CATALOG_SHELL_COPY_SET_DRIFT');
  if (actionGroups.length !== navigationGroups.length) fail('R5_ADMIN_CATALOG_GROUP_SET_DRIFT');
  const navigationByKey = new Map(navigationGroups.map(node => [node.key, node]));
  const actionGroupByKey = new Map(actionGroups.map(node => [node.key, node]));
  const navigationIconKeys = new Set(['WORKBENCH', 'ACCESS', 'ORGANIZATION', 'STORE_OPERATIONS', 'CATALOG_SERVICES']);
  if (
    navigationByKey.size !== navigationGroups.length ||
    actionGroupByKey.size !== actionGroups.length ||
    navigationGroups.some(
      node =>
        node.consumerFace !== 'operations-admin' ||
        !Number.isInteger(node.navigation?.order) ||
        !navigationIconKeys.has(node.navigation?.iconKey),
    ) ||
    actionGroups.some(node => !Number.isInteger(node.actionGroup?.order))
  )
    fail('R5_ADMIN_CATALOG_GROUP_INVALID');
  const platformNodes = pages.filter(node => node.consumerFace === 'platform-admin');
  const operationsNodes = pages.filter(node => node.consumerFace === 'operations-admin');
  const roleHomes = operationsNodes.filter(node => node.page?.kind === 'ROLE_HOME');
  const businessPages = operationsNodes.filter(node => node.page?.kind === 'BUSINESS');
  if (businessPages.length !== operationsNodes.length - roleHomes.length) fail('R5_ADMIN_CATALOG_PAGE_KIND_SET_DRIFT');
  if (new Set(roleHomes.map(node => node.page.roleHomeForNodeType)).size !== roleHomes.length)
    fail('R5_ADMIN_CATALOG_ROLE_HOME_INVALID');
  const experienceOf = node => {
    const experience = node.experience;
    if (
      !experience ||
      typeof experience.pageDescription !== 'string' ||
      !Array.isArray(experience.cascadeLevelLabels) ||
      !Array.isArray(experience.forbiddenAlternatives)
    ) {
      fail('R5_ADMIN_CATALOG_UX_DRIFT', node.key);
    }
    return experience;
  };
  const operationsPages = operationsNodes.map(node => {
    if (!navigationByKey.has(node.navigation?.groupKey) || !Number.isInteger(node.navigation?.order))
      fail('R5_ADMIN_CATALOG_NAVIGATION_BINDING_DRIFT', node.key);
    const experience = experienceOf(node);
    if (node.page.kind === 'ROLE_HOME') {
      if (
        node.pageAccess ||
        node.workspaceRequirement !== undefined ||
        typeof node.page.roleHomeForNodeType !== 'string'
      )
        fail('R5_ADMIN_CATALOG_ROLE_HOME_INVALID', node.key);
      return {
        pageDesignKey: node.key,
        kind: 'ROLE_HOME',
        pageAccessManaged: false,
        menuOrder: node.navigation.order,
        menuGroupKey: node.navigation.groupKey,
        menuGroupIconKey: navigationByKey.get(node.navigation.groupKey).navigation.iconKey,
        menuGroupLabel: navigationByKey.get(node.navigation.groupKey).display.label,
        menuLabel: node.display.label,
        pageTitle: node.display.label,
        contentTabLabel: node.display.label,
        ...experience,
        requiredDataNodeType: 'NONE',
        supportedRoleNodeTypes: [node.page.roleHomeForNodeType],
        userManagementTargetOrganizationType: null,
      };
    }
    const access = node.pageAccess;
    if (
      node.workspaceRequirement !== undefined ||
      node.page.roleHomeForNodeType !== undefined ||
      !access ||
      access.pageAccessManaged !== true ||
      !Array.isArray(access.grantableRoleNodeTypes) ||
      access.grantableRoleNodeTypes.length === 0 ||
      typeof access.requiredDataNodeType !== 'string'
    )
      fail('R5_ADMIN_CATALOG_PAGE_ACCESS_INVALID', node.key);
    return {
      pageDesignKey: node.key,
      kind: 'BUSINESS',
      pageAccessManaged: true,
      menuOrder: node.navigation.order,
      menuGroupKey: node.navigation.groupKey,
      menuGroupIconKey: navigationByKey.get(node.navigation.groupKey).navigation.iconKey,
      menuGroupLabel: navigationByKey.get(node.navigation.groupKey).display.label,
      menuLabel: node.display.label,
      pageTitle: node.display.label,
      contentTabLabel: node.display.label,
      ...experience,
      requiredDataNodeType: access.requiredDataNodeType,
      supportedRoleNodeTypes: access.grantableRoleNodeTypes,
      userManagementTargetOrganizationType: access.userManagementTargetOrganizationType ?? null,
    };
  });
  if (
    new Set(operationsNodes.map(node => `${node.navigation.groupKey}:${node.navigation.order}`)).size !==
    operationsNodes.length
  )
    fail('R5_ADMIN_CATALOG_NAVIGATION_BINDING_DRIFT');
  const platformPages = platformNodes.map(node => {
    if (
      node.page?.kind !== 'BUSINESS' ||
      node.page.roleHomeForNodeType !== undefined ||
      node.pageAccess ||
      node.experience !== undefined ||
      typeof node.workspaceRequirement !== 'string' ||
      !Number.isInteger(node.navigation?.order) ||
      typeof node.navigation?.iconKey !== 'string'
    )
      fail('R5_ADMIN_CATALOG_PLATFORM_PAGE_INVALID', node.key);
    return {
      pageDesignKey: node.key,
      title: node.display.label,
      iconKey: node.navigation.iconKey,
      menuOrder: node.navigation.order,
      workspaceRequirement: node.workspaceRequirement,
    };
  });
  const catalogActions = actions.map(node => {
    const action = node.action;
    const group = actionGroupByKey.get(action?.groupKey);
    const page = operationsPages.find(candidate => candidate.pageDesignKey === action?.targetPageKey);
    const actionRoleTargetPages = [page];
    const actionRoleTargetSet = new Set(
      actionRoleTargetPages.flatMap(candidate => candidate?.supportedRoleNodeTypes ?? []),
    );
    if (
      node.consumerFace !== 'operations-admin' ||
      !group ||
      !page ||
      page.kind !== 'BUSINESS' ||
      !Array.isArray(action?.grantableRoleNodeTypes) ||
      action.grantableRoleNodeTypes.length === 0 ||
      actionRoleTargetPages.length === 0 ||
      action.grantableRoleNodeTypes.some(role => !actionRoleTargetSet.has(role)) ||
      typeof action.scopeApplicability !== 'string'
    )
      fail('R5_ADMIN_CATALOG_ACTION_BINDING_DRIFT', node.key);
    if (
      action.userManagement &&
      (!['INVITE', 'ROLE_REVOKE'].includes(action.userManagement.purpose) ||
        typeof action.userManagement.targetOrganizationType !== 'string')
    )
      fail('R5_ADMIN_CATALOG_USER_MANAGEMENT_BINDING_DRIFT', node.key);
    return {
      actionKey: node.key,
      actionLabel: node.display.label,
      actionDescription: node.display.label,
      actionGroupKey: group.key,
      actionGroupLabel: group.display.label,
      actionGroupOrder: group.actionGroup.order,
      pageBindings: [
        {
          pageDesignKey: page.pageDesignKey,
          selectedIdentityTypes: action.grantableRoleNodeTypes,
          scopeApplicability: action.scopeApplicability,
        },
      ],
      grantableRoleNodeTypes: action.grantableRoleNodeTypes,
      userManagement: action.userManagement,
    };
  });
  const userManagementActionBindings = catalogActions
    .filter(action => action.userManagement)
    .map(action => ({
      pageDesignKey: action.pageBindings[0].pageDesignKey,
      targetOrganizationType: action.userManagement.targetOrganizationType,
      actionPurpose: action.userManagement.purpose,
      actionKey: action.actionKey,
    }));
  const bindingKeys = userManagementActionBindings.map(binding => `${binding.pageDesignKey}:${binding.actionPurpose}`);
  if (new Set(bindingKeys).size !== bindingKeys.length) fail('R5_ADMIN_CATALOG_USER_MANAGEMENT_BINDING_SET_DRIFT');
  const managedTargetPages = operationsPages.filter(page => page.userManagementTargetOrganizationType);
  if (
    managedTargetPages.length === 0 ||
    !managedTargetPages.every(page =>
      ['INVITE', 'ROLE_REVOKE'].every(purpose => bindingKeys.includes(`${page.pageDesignKey}:${purpose}`)),
    )
  ) {
    fail('R5_ADMIN_CATALOG_USER_MANAGEMENT_BINDING_SET_DRIFT');
  }
  const userManagementByPage = Object.fromEntries(
    managedTargetPages.map(page => {
      const bindings = Object.fromEntries(
        userManagementActionBindings
          .filter(binding => binding.pageDesignKey === page.pageDesignKey)
          .map(binding => [binding.actionPurpose, binding.actionKey]),
      );
      if (
        bindings.INVITE === undefined ||
        bindings.ROLE_REVOKE === undefined ||
        userManagementActionBindings.some(
          binding =>
            binding.pageDesignKey === page.pageDesignKey &&
            binding.targetOrganizationType !== page.userManagementTargetOrganizationType,
        )
      )
        fail('R5_ADMIN_CATALOG_USER_MANAGEMENT_BINDING_SET_DRIFT');
      return [
        page.pageDesignKey,
        {
          targetOrganizationType: page.userManagementTargetOrganizationType,
          inviteActionKey: bindings.INVITE,
          roleRevokeActionKey: bindings.ROLE_REVOKE,
        },
      ];
    }),
  );
  return {
    platformPages,
    platformShellCopy: Object.fromEntries(shellCopy.map(node => [node.key, node.display.label])),
    operationsPages,
    actions: catalogActions,
    actionGroups: actionGroups.map(group => ({
      actionGroupKey: group.key,
      actionGroupLabel: group.display.label,
      actionGroupOrder: group.actionGroup.order,
    })),
    userManagementActionBindings,
    userManagementByPage,
    roleHomes: roleHomes.map(node => ({roleNodeType: node.page.roleHomeForNodeType, pageDesignKey: node.key})),
  };
}
function symbolName(key) {
  return key
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
}
function javaConstantName(key) {
  return key.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
}
function tsAdminCatalog(face, base = root) {
  const catalog = loadAdminCatalog(base);
  const pages = face === 'platform-admin' ? catalog.platformPages : catalog.operationsPages;
  const keyName = face === 'platform-admin' ? 'platformPageDesignKeys' : 'operationsPageDesignKeys';
  const keys = Object.fromEntries(pages.map(page => [symbolName(page.pageDesignKey), page.pageDesignKey]));
  const shellCopyKeys =
    face === 'platform-admin'
      ? Object.fromEntries(Object.keys(catalog.platformShellCopy).map(key => [symbolName(key), key]))
      : undefined;
  const body =
    face === 'platform-admin'
      ? {platformPages: catalog.platformPages, platformShellCopy: catalog.platformShellCopy}
      : {
          operationsPages: catalog.operationsPages,
          actionGroups: catalog.actionGroups,
          actions: catalog.actions,
          userManagementActionBindings: catalog.userManagementActionBindings,
          userManagementByPage: catalog.userManagementByPage,
        };
  const actionCapabilities = Object.fromEntries(
    catalog.actions.map(action => [action.actionKey.replace(/^BC-/, '').replaceAll('-', '_'), action.actionKey]),
  );
  const userManagementPageDesignKeys = [
    ...new Set(catalog.userManagementActionBindings.map(binding => binding.pageDesignKey)),
  ];
  const actionExports =
    face === 'operations-admin'
      ? `export const ACTION_CAPABILITIES = ${JSON.stringify(actionCapabilities, null, 2)} as const;\nexport type AdminActionCapabilityKey = typeof ACTION_CAPABILITIES[keyof typeof ACTION_CAPABILITIES];\nexport const USER_MANAGEMENT_PAGE_DESIGN_KEYS = ${JSON.stringify(userManagementPageDesignKeys, null, 2)} as const;\nexport type UserManagementPageDesignKey = typeof USER_MANAGEMENT_PAGE_DESIGN_KEYS[number];\n`
      : '';
  const userManagementLookup =
    face === 'operations-admin'
      ? `export function userManagementFor(pageDesignKey: UserManagementPageDesignKey) {\n  const value = adminCatalog.userManagementByPage[pageDesignKey];\n  if (!value) throw new Error(\`USER_MANAGEMENT_TARGET_MISSING:\${pageDesignKey}\`);\n  return value;\n}\n`
      : '';
  const shellCopyExports =
    face === 'platform-admin'
      ? `export const platformShellCopyKeys = ${JSON.stringify(shellCopyKeys, null, 2)} as const;\n`
      : '';
  return `// Generated from ${adminCatalogPath}; do not edit.\nexport const adminCatalog = ${JSON.stringify(body, null, 2)} as const;\nexport const ${keyName} = ${JSON.stringify(keys, null, 2)} as const;\n${shellCopyExports}export type AdminCatalog = typeof adminCatalog;\nexport type ${face === 'platform-admin' ? 'Platform' : 'Operations'}PageDesignKey = typeof ${keyName}[keyof typeof ${keyName}];\n${actionExports}${userManagementLookup}`;
}
function javaString(value) {
  return JSON.stringify(value);
}
function javaList(values) {
  return values.length === 0 ? 'List.of()' : `List.of(${values.map(javaString).join(', ')})`;
}
function javaWorkspaceAuthorizationCatalog(base = root) {
  const catalog = loadAdminCatalog(base);
  const capabilities = catalog.actions
    .map(
      action =>
        `            capability(${javaString(action.actionKey)}, ${javaString(action.actionLabel)}, ${javaString(action.actionGroupKey)}, ${javaString(action.actionGroupLabel)}, ${action.actionGroupOrder}, ${javaList(action.grantableRoleNodeTypes)}, ${javaString(action.pageBindings[0].pageDesignKey)}, ${javaString(action.pageBindings[0].scopeApplicability)})`,
    )
    .join(',\n');
  const pages = catalog.operationsPages
    .map(
      page =>
        `            page(${javaString(page.pageDesignKey)}, ${javaString(page.pageTitle)}, ${javaString(page.menuGroupLabel)}, ${page.menuOrder}, ${javaString(page.requiredDataNodeType)}, ${javaList(page.supportedRoleNodeTypes)}, ${page.userManagementTargetOrganizationType ? javaString(page.userManagementTargetOrganizationType) : 'null'}, ${page.pageAccessManaged})`,
    )
    .join(',\n');
  const pageConstants = catalog.operationsPages
    .map(
      page =>
        `        public static final String ${javaConstantName(page.pageDesignKey)} = ${javaString(page.pageDesignKey)};`,
    )
    .join('\n');
  const capabilityConstants = catalog.actions
    .map(
      action =>
        `        public static final String ${javaConstantName(action.actionKey)} = ${javaString(action.actionKey)};`,
    )
    .join('\n');
  const userManagementBindings = catalog.userManagementActionBindings
    .map(
      binding =>
        `            new UserManagementActionBinding(${javaString(binding.pageDesignKey)}, ${javaString(binding.targetOrganizationType)}, UserManagementAction.${binding.actionPurpose}, ${javaString(binding.actionKey)})`,
    )
    .join(',\n');
  const roleHomes = catalog.roleHomes
    .map(
      entry => `            new RoleHomeEntry(${javaString(entry.roleNodeType)}, ${javaString(entry.pageDesignKey)})`,
    )
    .join(',\n');
  return `// Generated from ${adminCatalogPath}; do not edit.\npackage com.catering.v2s.workspace.iam.api;\n\nimport java.util.List;\nimport java.util.Optional;\n\npublic final class WorkspaceAuthorizationCatalog {\n    private WorkspaceAuthorizationCatalog() { }\n    public static final class PageDesignKeys {\n        private PageDesignKeys() { }\n${pageConstants}\n    }\n    public static final class CapabilityKeys {\n        private CapabilityKeys() { }\n${capabilityConstants}\n    }\n    public static List<CapabilityCatalogEntry> capabilityCatalog() { return List.of(\n${capabilities}); }\n    public static List<PageAccessCatalogEntry> pageCatalog() { return List.of(\n${pages}); }\n    public static List<UserManagementActionBinding> userManagementActionBindings() { return List.of(\n${userManagementBindings}); }\n    public static List<RoleHomeEntry> roleHomeCatalog() { return List.of(\n${roleHomes}); }\n    public static List<PageAccessCatalogEntry> managedPageCatalog() { return pageCatalog().stream().filter(PageAccessCatalogEntry::pageAccessManaged).toList(); }\n    public static Optional<PageAccessCatalogEntry> page(String pageDesignKey) { return pageCatalog().stream().filter(page -> page.pageDesignKey().equals(pageDesignKey)).findFirst(); }\n    public static Optional<String> homePageForRoleNodeType(String roleNodeType) { return roleHomeCatalog().stream().filter(entry -> entry.roleNodeType().equals(roleNodeType)).map(RoleHomeEntry::pageDesignKey).findFirst(); }\n    public static Optional<String> userManagementTargetOrganizationType(String pageDesignKey) { return page(pageDesignKey).map(PageAccessCatalogEntry::userManagementTargetOrganizationType).filter(value -> value != null); }\n    public static Optional<String> userManagementPageForTargetType(String targetOrganizationType) { return pageCatalog().stream().filter(page -> targetOrganizationType.equals(page.userManagementTargetOrganizationType())).map(PageAccessCatalogEntry::pageDesignKey).findFirst(); }\n    public static Optional<String> requiredUserManagementCapability(String pageDesignKey, UserManagementAction action) { return userManagementActionBindings().stream().filter(binding -> binding.pageDesignKey().equals(pageDesignKey) && binding.action() == action).map(UserManagementActionBinding::capabilityKey).findFirst(); }\n    public static Optional<String> requiredUserManagementCapabilityForTarget(String targetOrganizationType, UserManagementAction action) { return userManagementActionBindings().stream().filter(binding -> binding.targetOrganizationType().equals(targetOrganizationType) && binding.action() == action).map(UserManagementActionBinding::capabilityKey).findFirst(); }\n    private static CapabilityCatalogEntry capability(String key, String label, String groupKey, String groupLabel, int order, List<String> types, String pageDesignKey, String scopeApplicability) { return new CapabilityCatalogEntry(key, groupKey, groupLabel, order, label, label, types, pageDesignKey, scopeApplicability); }\n    private static PageAccessCatalogEntry page(String key, String title, String group, int order, String dataNodeType, List<String> types, String targetType, boolean managed) { return new PageAccessCatalogEntry(key, title, group, order, dataNodeType, types, targetType, managed); }\n    public enum UserManagementAction { INVITE, ROLE_REVOKE }\n    public record UserManagementActionBinding(String pageDesignKey, String targetOrganizationType, UserManagementAction action, String capabilityKey) { }\n    public record RoleHomeEntry(String roleNodeType, String pageDesignKey) { }\n    public record CapabilityCatalogEntry(String key, String actionGroupKey, String actionGroupLabel, int actionGroupOrder, String label, String description, List<String> organizationTypes, String pageDesignKey, String scopeApplicability) { }\n    public record PageAccessCatalogEntry(String pageDesignKey, String title, String menuGroup, int menuOrder, String requiredDataNodeType, List<String> eligibleOrganizationTypes, String userManagementTargetOrganizationType, boolean pageAccessManaged) { }\n}\n`;
}
function enforceRoleHomeLookupCardinality(source) {
  const legacyLookup =
    'homePageForRoleNodeType(String roleNodeType) { return roleHomeCatalog().stream().filter(entry -> entry.roleNodeType().equals(roleNodeType)).map(RoleHomeEntry::pageDesignKey).findFirst(); }';
  const strictLookup =
    'homePageForRoleNodeType(String roleNodeType) { return roleHomeCatalog().stream().filter(entry -> entry.roleNodeType().equals(roleNodeType)).reduce((first, duplicate) -> { throw new IllegalStateException("ROLE_HOME_CATALOG_DUPLICATE:" + roleNodeType); }).map(RoleHomeEntry::pageDesignKey); }';
  if (!source.includes(legacyLookup)) fail('R5_ADMIN_CATALOG_ROLE_HOME_RUNTIME_CARDINALITY_TEMPLATE_MISSING');
  return source.replace(legacyLookup, strictLookup);
}
function javaErrors(codes) {
  return `// Generated from accepted R5 error disposition catalog; do not edit.\npackage com.catering.v2s.app.edge.generated;\n\npublic enum EdgeProblemCode {\n${codes.map(code => `  ${code}("${code}")`).join(',\n')};\n\n  private final String wireValue;\n  EdgeProblemCode(String wireValue) { this.wireValue = wireValue; }\n  public String wireValue() { return wireValue; }\n}\n`;
}
function r3CompatibilityErrors() {
  const codes = [
    'INVALID_EDGE_CONTEXT',
    'GROUP_WORKSPACE_NOT_FOUND',
    'COMMERCIAL_GROUP_ALREADY_INITIALIZED',
    'IDEMPOTENCY_CONFLICT',
    'VALIDATION_FAILED',
    'UNKNOWN_SUBMISSION_RESULT',
  ];
  return `// Generated R3 wire-compatibility subset from accepted R5 error disposition; do not edit.\npackage com.catering.v2s.app.edge.generated;\n\npublic enum CommercialGroupProblemCode {\n${codes.map(code => `  ${code}("${code}")`).join(',\n')};\n\n  private final String wireValue;\n  CommercialGroupProblemCode(String wireValue) { this.wireValue = wireValue; }\n  public String wireValue() { return wireValue; }\n}\n`;
}
function generatedWireComponents(base = root) {
  const {report} = projectEdgeCatalog(read(catalogPath, base), read(reportPath, base));
  if (report.closure?.operations !== report.operations?.length || !Array.isArray(report.operations)) {
    fail('R5_EDGE_WIRE_RESOLUTION_REPORT_INVALID');
  }
  const componentFiles = new Set([
    path.join(base, problemComponentPath),
    ...report.operations
      .flatMap(operation => [operation.requestComponentFile, operation.responseComponentFile])
      .map(relative => path.join(base, 'contracts/openapi', relative)),
  ]);
  const documents = new Map();
  const visitReferences = (value, currentFile) => {
    if (Array.isArray(value)) value.forEach(entry => visitReferences(entry, currentFile));
    else if (value && typeof value === 'object') {
      if (typeof value.$ref === 'string') {
        const [referenceFile, fragment = ''] = value.$ref.split('#', 2);
        const candidate = referenceFile ? path.resolve(path.dirname(currentFile), referenceFile) : currentFile;
        if (!fs.existsSync(candidate))
          fail('R5_EDGE_WIRE_REFERENCE_TARGET_MISSING', `${path.relative(base, currentFile)}:${value.$ref}`);
        const referenceDocument = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        const referenceSchemaName = referenceName(`#${fragment}`);
        if (!Object.hasOwn(referenceDocument.components?.schemas || {}, referenceSchemaName)) {
          fail('R5_EDGE_WIRE_REFERENCE_FRAGMENT_MISSING', `${path.relative(base, currentFile)}:${value.$ref}`);
        }
        if (referenceFile && !componentFiles.has(candidate)) componentFiles.add(candidate);
      }
      Object.values(value).forEach(entry => visitReferences(entry, currentFile));
    }
  };
  for (const file of componentFiles) {
    if (documents.has(file)) continue;
    if (!fs.existsSync(file)) fail('R5_EDGE_WIRE_COMPONENT_FILE_MISSING', path.relative(base, file));
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    documents.set(file, document);
    visitReferences(document.components?.schemas || {}, file);
  }
  for (const file of componentFiles) {
    if (!documents.has(file)) {
      if (!fs.existsSync(file)) fail('R5_EDGE_WIRE_COMPONENT_FILE_MISSING', path.relative(base, file));
      const document = JSON.parse(fs.readFileSync(file, 'utf8'));
      documents.set(file, document);
      visitReferences(document.components?.schemas || {}, file);
    }
  }
  const components = new Map();
  for (const file of [...componentFiles].sort()) {
    const document = documents.get(file);
    for (const [name, schema] of Object.entries(document.components?.schemas || {})) {
      if (components.has(name) && JSON.stringify(components.get(name)) !== JSON.stringify(schema)) {
        fail('R5_EDGE_WIRE_COMPONENT_DUPLICATE', name);
      }
      components.set(name, schema);
    }
  }
  return components;
}
function javaIdentifier(value) {
  const keyword = new Set([
    'abstract',
    'assert',
    'boolean',
    'break',
    'byte',
    'case',
    'catch',
    'char',
    'class',
    'const',
    'continue',
    'default',
    'do',
    'double',
    'else',
    'enum',
    'extends',
    'final',
    'finally',
    'float',
    'for',
    'goto',
    'if',
    'implements',
    'import',
    'instanceof',
    'int',
    'interface',
    'long',
    'native',
    'new',
    'package',
    'private',
    'protected',
    'public',
    'record',
    'return',
    'short',
    'static',
    'strictfp',
    'super',
    'switch',
    'synchronized',
    'this',
    'throw',
    'throws',
    'transient',
    'try',
    'void',
    'volatile',
    'while',
  ]);
  const normalized = value.replace(/[^A-Za-z0-9_$]/g, '_');
  return keyword.has(normalized) ? `${normalized}Value` : normalized;
}
function referenceName(reference) {
  const marker = '/components/schemas/';
  const offset = reference.lastIndexOf(marker);
  if (offset === -1) fail('R5_EDGE_WIRE_REFERENCE_INVALID', reference);
  return reference.slice(offset + marker.length);
}
function pascal(value) {
  return (
    String(value)
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join('') || 'Value'
  );
}
function strictOperatingRuleDeserializer(name, properties) {
  if (name !== 'OrganizationStoreOperatingRuleValues') return '';
  const javaTypes = {boolean: 'Boolean', integer: 'Long', number: 'java.math.BigDecimal', string: 'String'};
  const fields = properties
    .map(([property, propertySchema]) => {
      const field = javaIdentifier(property);
      const type = propertySchema?.type;
      if (!Object.hasOwn(javaTypes, type))
        fail('R5_EDGE_OPERATING_RULE_DESERIALIZER_TYPE_UNSUPPORTED', `${name}.${property}:${type || 'missing'}`);
      const tokenCheck =
        type === 'boolean'
          ? 'parser.currentToken() != tools.jackson.core.JsonToken.VALUE_TRUE && parser.currentToken() != tools.jackson.core.JsonToken.VALUE_FALSE'
          : type === 'string'
            ? 'parser.currentToken() != tools.jackson.core.JsonToken.VALUE_STRING'
            : '!parser.currentToken().isNumeric()';
      const read =
        type === 'boolean'
          ? 'parser.getBooleanValue()'
          : type === 'string'
            ? 'parser.getString()'
            : type === 'integer'
              ? 'parser.getLongValue()'
              : 'parser.getDecimalValue()';
      return `          case ${javaString(property)} -> {
            if (${tokenCheck}) return context.reportInputMismatch(${name}.class, "property ${property} must be ${type}");
            ${field} = ${read};
          }`;
    })
    .join('\n');
  const declarations = properties
    .map(
      ([property]) =>
        `      ${javaTypes[propertySchemaType(properties, property)]} ${javaIdentifier(property)} = null;`,
    )
    .join('\n');
  const missingChecks = properties
    .map(
      ([property]) =>
        `      if (${javaIdentifier(property)} == null) return context.reportInputMismatch(${name}.class, "missing required property ${property}");`,
    )
    .join('\n');
  const constructorArgs = properties.map(([property]) => javaIdentifier(property)).join(', ');
  const recordFields = properties
    .map(([property, propertySchema]) => `    ${javaTypes[propertySchema.type]} ${javaIdentifier(property)}`)
    .join(',\n');
  return `@tools.jackson.databind.annotation.JsonDeserialize(using = ${name}.Deserializer.class)
public record ${name}(
${recordFields}
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<${name}> {
    @Override
    public ${name} deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (${name}) context.handleUnexpectedToken(${name}.class, parser);
${declarations}
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(${name}.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(${name}.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(${name}.class, "property value is required");
        switch (property) {
${fields}
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(${name}.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(${name}.class, "object must end with END_OBJECT");
${missingChecks}
      return new ${name}(${constructorArgs});
    }
  }
}
`;
}
function strictWireReadExpression(type, nullable = false) {
  const read =
    type === 'tools.jackson.databind.JsonNode'
      ? 'context.readTree(parser)'
      : type.includes('<')
        ? `context.readValue(parser, new tools.jackson.core.type.TypeReference<${type}>() {})`
        : `context.readValue(parser, ${type}.class)`;
  return nullable ? `(parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : ${read})` : read;
}
function strictEmptyObjectDeserializer(name) {
  return `@tools.jackson.databind.annotation.JsonDeserialize(using = ${name}.Deserializer.class)
public record ${name}(

) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<${name}> {
    @Override
    public ${name} deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (${name}) context.handleUnexpectedToken(${name}.class, parser);
      tools.jackson.core.JsonToken token = parser.nextToken();
      if (token == null)
        return context.reportInputMismatch(${name}.class, "object must end with END_OBJECT");
      if (token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token == tools.jackson.core.JsonToken.PROPERTY_NAME) {
          String property = parser.currentName();
          parser.nextToken();
          parser.skipChildren();
          return context.reportInputMismatch(${name}.class, "unknown property " + property);
        }
        return context.reportInputMismatch(${name}.class, "object property name is required");
      }
      return new ${name}();
    }
  }
}
`;
}
function strictWireDeserializer(name, properties, required, components, inlineTypes) {
  if (properties.length === 0) return strictEmptyObjectDeserializer(name);
  const javaTypes = new Map();
  const nullableProperties = new Set(
    properties
      .filter(([, propertySchema]) => schemaAllowsNull(propertySchema, components))
      .map(([property]) => property),
  );
  const fields = properties
    .map(([property, propertySchema]) => {
      const resolved = resolvedSchema(propertySchema, components, new Set([name]));
      const inlineName = `${name}${pascal(property)}`;
      const type = javaType(resolved, components, inlineName, inlineTypes, false);
      javaTypes.set(property, type);
      return `          case ${javaString(property)} -> ${javaIdentifier(property)} = ${strictWireReadExpression(type, nullableProperties.has(property))};`;
    })
    .join('\n');
  const declarations = properties
    .map(([property]) => `      ${javaTypes.get(property)} ${javaIdentifier(property)} = null;`)
    .join('\n');
  const missingChecks = properties
    .filter(([property]) => required.has(property))
    .map(([property]) =>
      nullableProperties.has(property)
        ? `      if (!seen.contains(${javaString(property)})) return context.reportInputMismatch(${name}.class, "missing required property ${property}");`
        : `      if (${javaIdentifier(property)} == null) return context.reportInputMismatch(${name}.class, "missing required property ${property}");`,
    )
    .join('\n');
  const constructorArgs = properties.map(([property]) => javaIdentifier(property)).join(', ');
  const recordFields = properties
    .map(([property]) => `    ${javaTypes.get(property)} ${javaIdentifier(property)}`)
    .join(',\n');
  const deserializationBody =
    properties.length === 0
      ? `      tools.jackson.core.JsonToken token = parser.nextToken();
      if (token == null)
        return context.reportInputMismatch(${name}.class, "object must end with END_OBJECT");
      if (token != tools.jackson.core.JsonToken.END_OBJECT)
        return context.reportInputMismatch(${name}.class, "object must not contain properties");
      return new ${name}();`
      : `      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(${name}.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(${name}.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(${name}.class, "property value is required");
        switch (property) {
${fields}
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(${name}.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(${name}.class, "object must end with END_OBJECT");
${missingChecks}
      return new ${name}(${constructorArgs});`;
  return `@tools.jackson.databind.annotation.JsonDeserialize(using = ${name}.Deserializer.class)
public record ${name}(
${recordFields}
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<${name}> {
    @Override
    public ${name} deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (${name}) context.handleUnexpectedToken(${name}.class, parser);
${properties.length === 0 ? '' : declarations}
${deserializationBody}
    }
  }
}
`;
}
function propertySchemaType(properties, property) {
  return properties.find(([name]) => name === property)?.[1]?.type;
}
// Response closed sets are generated as Java enums as well as TypeScript
// unions.  Request DTOs intentionally remain string-shaped because their
// controllers pass the owner command values through unchanged; only these
// response/read-model fields participate in the closed-code presentation
// contract for base-1.
const RESPONSE_INLINE_ENUM_FIELDS = new Set([
  'ExternalCapability.capabilityClass',
  'ExternalCapabilityAttributeValues.groupBuyMappingDirection',
  'ExternalCapabilityAttributeValues.menuCollaborationDirection',
  'ExternalSystemView.catalogStatus',
  'ExternalSystemView.enablementStatus',
  'ProviderProfileView.businessScope',
  'ProviderProfileView.bindableNodeTypes',
  'ProviderProfileView.authenticationKind',
  'ProviderProfileView.unbindKind',
  'ProviderProfileView.catalogStatus',
  'ProviderProfileView.enablementStatus',
  'OwnerBindingView.capabilityClass',
  'OwnerBindingView.businessScope',
  'OwnerBindingView.nodeType',
  'OwnerBindingView.status',
  'BusinessChannelTemplateView.accessKind',
  'BusinessChannelTemplateView.operatorKind',
  'BusinessChannelTemplateView.orderKind',
  'BusinessChannelTemplateView.dineInForm',
  'BusinessChannelTemplateView.status',
  'BusinessChannelView.ownerNodeType',
  'BusinessChannelView.status',
  'BusinessChannelView.bindingStatus',
  'BusinessChannelView.selfStatus',
  'BusinessChannelViewStatusDimensionsItem.type',
  'BusinessChannelViewStatusDimensionsItem.status',
  'BusinessChannelViewBlockersItem.type',
  'BusinessChannelViewBlockersItem.status',
  'BusinessChannelTemplateViewStatusDimensionsItem.type',
  'BusinessChannelTemplateViewStatusDimensionsItem.status',
  'BusinessChannelTemplateViewBlockersItem.type',
  'BusinessChannelTemplateViewBlockersItem.status',
]);
function javaType(schema, components, inlineName, inlineTypes, generateInlineEnum = false) {
  if (!schema || typeof schema !== 'object') return 'tools.jackson.databind.JsonNode';
  if (schema.format === 'uuid') return 'java.util.UUID';
  if (typeof schema.$ref === 'string') {
    const name = referenceName(schema.$ref);
    const target = components.get(name);
    if (target?.type === 'integer') return 'Long';
    if (target?.type === 'number') return 'java.math.BigDecimal';
    if (target?.type === 'boolean') return 'Boolean';
    if (target?.type === 'string' && !Array.isArray(target.enum))
      return target.format === 'uuid' ? 'java.util.UUID' : 'String';
    return name;
  }
  if (schema.type === 'array')
    return `java.util.List<${javaType(schema.items, components, `${inlineName}Item`, inlineTypes, generateInlineEnum)}>`;
  if (schema.type === 'integer') return 'Long';
  if (schema.type === 'number') return 'java.math.BigDecimal';
  if (schema.type === 'boolean') return 'Boolean';
  if (Array.isArray(schema.enum)) {
    if (generateInlineEnum) {
      const values = schema.enum.filter(value => value !== null);
      if (values.length === 0) return 'String';
      inlineTypes.set(inlineName, {type: 'string', enum: values});
      return inlineName;
    }
    return 'String';
  }
  if (schema.type === 'string') return 'String';
  if (schema.type === 'object' && schema.properties) return inlineName;
  if (schema.type === 'object') return 'tools.jackson.databind.JsonNode';
  return 'tools.jackson.databind.JsonNode';
}
function resolvedSchema(schema, components, seen = new Set()) {
  if (!schema || typeof schema !== 'object' || !Array.isArray(schema.allOf)) return schema;
  const merged = {...schema, properties: {}, required: []};
  delete merged.allOf;
  for (const part of schema.allOf) {
    let resolved = part;
    if (typeof part.$ref === 'string') {
      const name = referenceName(part.$ref);
      if (seen.has(name)) fail('R5_EDGE_WIRE_ALLOF_CYCLE', name);
      const target = components.get(name);
      if (!target) fail('R5_EDGE_WIRE_ALLOF_TARGET_MISSING', name);
      resolved = resolvedSchema(target, components, new Set([...seen, name]));
    } else {
      resolved = resolvedSchema(part, components, seen);
    }
    Object.assign(merged.properties, resolved.properties || {});
    merged.required.push(...(resolved.required || []));
    if (resolved.additionalProperties === false) merged.additionalProperties = false;
  }
  merged.required = [...new Set(merged.required)];
  return merged;
}
function schemaAllowsNull(schema, components, seen = new Set()) {
  if (!schema || typeof schema !== 'object') return false;
  if (schema.nullable === true) return true;
  if (Array.isArray(schema.type) && schema.type.includes('null')) return true;
  if (Array.isArray(schema.enum) && schema.enum.includes(null)) return true;
  if (typeof schema.$ref === 'string') {
    const name = referenceName(schema.$ref);
    if (seen.has(name)) return false;
    const target = components.get(name);
    if (!target) fail('R5_EDGE_WIRE_NULLABILITY_REFERENCE_MISSING', name);
    return schemaAllowsNull(target, components, new Set([...seen, name]));
  }
  return [...(schema.anyOf || []), ...(schema.oneOf || [])].some(candidate =>
    schemaAllowsNull(candidate, components, seen),
  );
}
function javaWireType(
  name,
  schema,
  components,
  inlineTypes = new Map(),
  strictNames = new Set(),
  strictInlineNames = new Set(),
) {
  schema = resolvedSchema(schema, components, new Set([name]));
  if (Array.isArray(schema.enum)) {
    const values = schema.enum.filter(value => value !== null);
    if (
      values.length === 0 ||
      values.some(value => typeof value !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value))
    ) {
      fail('R5_EDGE_WIRE_ENUM_VALUE_INVALID', name);
    }
    return {
      name,
      source: `// Generated from accepted R5 OpenAPI components; do not edit.\npackage com.catering.v2s.app.edge.generated.wire;\n\npublic enum ${name} {\n${values.map(value => `    ${value}`).join(',\n')};\n\n    public String wire() { return name(); }\n}\n`,
    };
  }
  const properties = Object.entries(schema.properties || {});
  const required = new Set(schema.required || []);
  const strict = strictNames.has(name) || strictInlineNames.has(name);
  for (const [property, propertySchema] of properties) {
    const resolved = resolvedSchema(propertySchema, components, new Set([name]));
    const inlineName = `${name}${pascal(property)}`;
    const inlineSchema = resolved?.type === 'array' ? resolved.items : resolved;
    const targetName = resolved?.type === 'array' ? `${inlineName}Item` : inlineName;
    if (inlineSchema?.type === 'object' && inlineSchema.properties && !inlineTypes.has(targetName)) {
      inlineTypes.set(targetName, inlineSchema);
      if (strict && inlineSchema.additionalProperties === false) strictInlineNames.add(targetName);
    }
  }
  const strictDeserializer = strict
    ? strictWireDeserializer(name, properties, required, components, inlineTypes)
    : strictOperatingRuleDeserializer(name, properties);
  if (strictDeserializer) {
    return {
      name,
      source: `// Generated from accepted R5 OpenAPI components; do not edit.\npackage com.catering.v2s.app.edge.generated.wire;\n\n${strictDeserializer}`,
    };
  }
  const fields = properties.map(([property, propertySchema]) => {
    const field = javaIdentifier(property);
    const resolved = resolvedSchema(propertySchema, components, new Set([name]));
    const type = javaType(
      resolved,
      components,
      `${name}${pascal(property)}`,
      inlineTypes,
      RESPONSE_INLINE_ENUM_FIELDS.has(`${name}.${property}`),
    );
    if (required.has(property)) {
      return `    @com.fasterxml.jackson.annotation.JsonProperty(value = "${property}", required = true) ${type} ${field}`;
    }
    return field === property
      ? `    ${type} ${field}`
      : `    @com.fasterxml.jackson.annotation.JsonProperty("${property}") ${type} ${field}`;
  });
  const strictUnknownRequest = new Set([
    'StoreTerminalCreateRequest',
    'StoreTerminalReplaceRequest',
    'StoreTerminalStatusRequest',
  ]).has(name);
  const strictUnknownAnnotation = strictUnknownRequest
    ? '@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = false)\n'
    : '';
  const source = `// Generated from accepted R5 OpenAPI components; do not edit.\npackage com.catering.v2s.app.edge.generated.wire;\n\n${strictUnknownAnnotation}public record ${name}(\n${fields.join(',\n')}\n) {}\n`;
  return {name, source};
}
function strictWireSchemaNames(operations, components) {
  const strictNames = new Set();
  const visited = new Set();
  function visitSchema(schema) {
    if (!schema || typeof schema !== 'object') return;
    if (typeof schema.$ref === 'string') {
      const name = referenceName(schema.$ref);
      if (visited.has(name)) return;
      visited.add(name);
      const target = components.get(name);
      if (!target) fail('R5_EDGE_WIRE_REFERENCE_TARGET_MISSING', name);
      if (target.type === 'object' && target.additionalProperties === false) strictNames.add(name);
      visitSchema(target);
      return;
    }
    for (const property of Object.values(schema.properties || {})) visitSchema(property);
    if (schema.items) visitSchema(schema.items);
    for (const part of [...(schema.allOf || []), ...(schema.oneOf || []), ...(schema.anyOf || [])]) visitSchema(part);
  }
  for (const operation of operations) {
    if (operation.requestSchema !== 'NoBody') visitSchema({$ref: `#/components/schemas/${operation.requestSchema}`});
  }
  return strictNames;
}
function wireJavaOutputs(base = root, operations = load(base).operations) {
  const components = generatedWireComponents(base);
  const strictNames = strictWireSchemaNames(operations, components);
  const strictInlineNames = new Set();
  const inlineTypes = new Map();
  const named = [...components.entries()].filter(
    ([, schema]) =>
      Array.isArray(schema.enum) || schema.type === 'object' || schema.properties || Array.isArray(schema.allOf),
  );
  const output = named.map(([name, schema]) => {
    const wire = javaWireType(name, schema, components, inlineTypes, strictNames, strictInlineNames);
    return [`${targets.wireJavaRoot}/${wire.name}.java`, wire.source];
  });
  for (const [name, schema] of inlineTypes) {
    if (components.has(name)) fail('R5_EDGE_WIRE_INLINE_NAME_CONFLICT', name);
    const wire = javaWireType(name, schema, components, inlineTypes, strictNames, strictInlineNames);
    output.push([`${targets.wireJavaRoot}/${wire.name}.java`, wire.source]);
  }
  return output;
}
function tsTypeIdentifier(value, context) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) fail('R5_EDGE_TS_IDENTIFIER_INVALID', `${context}:${value}`);
  return value;
}
function tsPropertyName(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}
function tsSchemaType(schema, components, context) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) fail('R5_EDGE_TS_SCHEMA_INVALID', context);
  let type;
  if (Array.isArray(schema.type)) {
    const variants = schema.type.map(entry => {
      // OpenAPI nullable unions must not carry string-only format metadata into
      // their null branch. Otherwise {type:[string,null],format:uuid} becomes
      // Uuid | Uuid and the generated consumer silently loses nullability.
      const variantSchema = entry === 'null' ? {type: entry} : {...schema, type: entry};
      return tsSchemaType(variantSchema, components, `${context}:${entry}`);
    });
    type = [...new Set(variants)].join(' | ');
  } else if (Array.isArray(schema.allOf)) {
    if (schema.allOf.length === 0) fail('R5_EDGE_TS_ALLOF_EMPTY', context);
    type = schema.allOf
      .map((part, index) => `(${tsSchemaType(part, components, `${context}.allOf[${index}]`)})`)
      .join(' & ');
  } else if (typeof schema.$ref === 'string') {
    const name = referenceName(schema.$ref);
    if (!components.has(name)) fail('R5_EDGE_TS_REFERENCE_TARGET_MISSING', `${context}:${name}`);
    type = tsTypeIdentifier(name, context);
  } else if (Array.isArray(schema.enum)) {
    if (schema.enum.length === 0) fail('R5_EDGE_TS_ENUM_EMPTY', context);
    type = schema.enum.map(value => JSON.stringify(value)).join(' | ');
  } else if (schema.type === 'array') {
    if (!schema.items) fail('R5_EDGE_TS_ARRAY_ITEMS_MISSING', context);
    type = `Array<${tsSchemaType(schema.items, components, `${context}[]`)}>`;
  } else if (schema.type === 'object' || schema.properties) {
    const properties = schema.properties || {};
    const required = new Set(schema.required || []);
    for (const name of required)
      if (!Object.hasOwn(properties, name)) fail('R5_EDGE_TS_REQUIRED_PROPERTY_MISSING', `${context}:${name}`);
    const fields = Object.entries(properties).map(
      ([name, propertySchema]) =>
        `  ${tsPropertyName(name)}${required.has(name) ? '' : '?'}: ${tsSchemaType(propertySchema, components, `${context}.${name}`)};`,
    );
    const objectType = fields.length > 0 ? `{\n${fields.join('\n')}\n}` : 'Record<string, never>';
    let additionalType = null;
    if (schema.additionalProperties === true) additionalType = 'Record<string, JsonValue>';
    else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      additionalType = `Record<string, ${tsSchemaType(schema.additionalProperties, components, `${context}{}`)}>`;
    }
    type = additionalType ? (fields.length > 0 ? `(${objectType}) & ${additionalType}` : additionalType) : objectType;
  } else if (schema.type === 'string') {
    type =
      schema.format === 'uuid'
        ? 'string & { readonly __uuid: "Uuid" }'
        : schema.format === 'binary'
          ? 'Blob'
          : 'string';
  } else if (schema.type === 'integer' || schema.type === 'number') {
    type = 'number';
  } else if (schema.type === 'boolean') {
    type = 'boolean';
  } else if (schema.type === 'null') {
    type = 'null';
  } else {
    fail('R5_EDGE_TS_SCHEMA_UNSUPPORTED', `${context}:${schema.type || 'missing-type'}`);
  }
  return schema.nullable === true && type !== 'null' && !type.split(' | ').includes('null') ? `(${type}) | null` : type;
}
function tsReachableComponentNames(selected, components) {
  const names = new Set(['Problem']);
  const visitSchema = (schema, context) => {
    if (Array.isArray(schema)) {
      schema.forEach((entry, index) => visitSchema(entry, `${context}[${index}]`));
      return;
    }
    if (!schema || typeof schema !== 'object') return;
    if (typeof schema.$ref === 'string') visitComponent(referenceName(schema.$ref), context);
    Object.entries(schema).forEach(([key, value]) => visitSchema(value, `${context}.${key}`));
  };
  const visitComponent = (name, context) => {
    tsTypeIdentifier(name, context);
    if (names.has(name)) return;
    const schema = components.get(name);
    if (!schema) fail('R5_EDGE_TS_COMPONENT_MISSING', `${context}:${name}`);
    names.add(name);
    visitSchema(schema, name);
  };
  for (const operation of selected) {
    visitComponent(operation.requestSchema, `${operation.operationId}:request`);
    visitComponent(operation.responseSchema, `${operation.operationId}:response`);
    for (const parameter of [
      ...operation.openApi.pathParameters,
      ...operation.openApi.queryParameters,
      ...operation.openApi.headerParameters,
    ])
      visitSchema(parameter.schema, `${operation.operationId}:${parameter.in}.${parameter.name}`);
  }
  return [...names].sort();
}
function tsOpenApiParameterType(parameter, components, context) {
  if (!parameter?.schema) fail('R5_EDGE_TS_PARAMETER_SCHEMA_MISSING', context);
  return tsSchemaType(parameter.schema, components, context);
}
function tsPathParametersType(operation, components) {
  const parameters = operation.openApi.pathParameters;
  return parameters.length === 0
    ? 'Record<string, never>'
    : `{\n${parameters.map(parameter => `    ${tsPropertyName(parameter.name)}: ${tsOpenApiParameterType(parameter, components, `${operation.operationId}:path.${parameter.name}`)};`).join('\n')}\n  }`;
}
function tsQueryParametersType(operation, components) {
  const parameters = operation.openApi.queryParameters;
  return parameters.length === 0
    ? 'Record<string, never>'
    : `{\n${parameters.map(parameter => `    ${tsPropertyName(parameter.name)}${parameter.required ? '' : '?'}: ${tsOpenApiParameterType(parameter, components, `${operation.operationId}:query.${parameter.name}`)};`).join('\n')}\n  }`;
}
function tsHeaderParametersType(operation, components) {
  const parameters = operation.openApi.headerParameters;
  return parameters.length === 0
    ? 'Record<string, never>'
    : `{\n${parameters.map(parameter => `    ${JSON.stringify(parameter.name)}${parameter.required ? '' : '?'}: ${tsOpenApiParameterType(parameter, components, `${operation.operationId}:header.${parameter.name}`)};`).join('\n')}\n  }`;
}
function tsOperationContractEntry(operation, components) {
  return `  ${JSON.stringify(operation.operationId)}: {\n    request: ${tsTypeIdentifier(operation.requestSchema, `${operation.operationId}:request`)};\n    response: ${tsTypeIdentifier(operation.responseSchema, `${operation.operationId}:response`)};\n    requestRequired: ${operation.openApi.requestRequired ? 'true' : 'false'};\n    requiresSession: ${operation.openApi.requiresSession ? 'true' : 'false'};\n    path: ${tsPathParametersType(operation, components)};\n    query: ${tsQueryParametersType(operation, components)};\n    queryRequired: ${operation.openApi.queryParameters.some(parameter => parameter.required) ? 'true' : 'false'};\n    headers: ${tsHeaderParametersType(operation, components)};\n    headersRequired: ${operation.openApi.headerParameters.some(parameter => parameter.required) ? 'true' : 'false'};\n  };`;
}
function faceTypeName(face) {
  return face
    .split('-')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
}
function tsClientMethod(operation) {
  return `    ${operation.operationId}: (pathParameters: FaceOperationContracts[${JSON.stringify(operation.operationId)}]["path"], options: FaceOperationOptions<${JSON.stringify(operation.operationId)}>) => execute({\n      operationId: ${JSON.stringify(operation.operationId)},\n      method: ${JSON.stringify(operation.method)},\n      path: ${JSON.stringify(operation.path)},\n      pathParameters,\n      requiresSession: ${operation.openApi.requiresSession},\n      ...options,\n    })`;
}
function tsFace(face, operations, codes, components) {
  const selected = operations.filter(operation => operation.face === face);
  const componentTypes = [
    'export type Uuid = string & { readonly __uuid: "Uuid" };',
    ...tsReachableComponentNames(selected, components).map(name => {
      const type = tsSchemaType(components.get(name), components, name);
      return `export type ${name} = ${name === 'Problem' ? type.replace('errorCode: string;', 'errorCode: EdgeProblemCode;') : type};`;
    }),
  ].join('\n\n');
  const operationContracts = selected.map(operation => tsOperationContractEntry(operation, components)).join('\n');
  const clientMethods = selected.map(tsClientMethod).join(',\n');
  const operationSymbol = `${face.replaceAll('-', '_').toUpperCase()}_OPERATIONS`;
  const operationIdsSymbol = `${face.replaceAll('-', '_').toUpperCase()}_OPERATION_IDS`;
  const operationIdType = `${faceTypeName(face)}OperationId`;
  const clientFactory = `create${faceTypeName(face)}Client`;
  const jsonValueType = /\bJsonValue\b/.test(componentTypes)
    ? 'export type JsonValue = string | number | boolean | null | Array<JsonValue> | { [key: string]: JsonValue };'
    : '';
  return `// Generated from accepted R5 edge catalog; do not edit.\n\nexport const ${operationSymbol} = ${normalized(selected.map(operation => ({operationId: operation.operationId, method: operation.method, path: operation.path, owner: operation.owner, requiresSession: operation.openApi.requiresSession}))).trim()} as const;\n\nexport const ${operationIdsSymbol} = ${normalized(Object.fromEntries(selected.map(({operationId}) => [operationId, operationId]))).trim()} as const;\n\nexport const EDGE_PROBLEM_CODES = ${normalized(codes).trim()} as const;\nexport type EdgeProblemCode = (typeof EDGE_PROBLEM_CODES)[number];\nexport type ${operationIdType} = (typeof ${operationSymbol})[number]["operationId"];\n\n${jsonValueType}\n\n${componentTypes}\n\nexport type FaceOperationContracts = {\n${operationContracts}\n};\n\ntype RequestPart<I extends ${operationIdType}> = FaceOperationContracts[I]["requestRequired"] extends true\n  ? {body: FaceOperationContracts[I]["request"]}\n  : {body?: never};\ntype QueryPart<I extends ${operationIdType}> = FaceOperationContracts[I]["queryRequired"] extends true\n  ? {query: FaceOperationContracts[I]["query"]}\n  : {query?: FaceOperationContracts[I]["query"]};\ntype HeaderPart<I extends ${operationIdType}> = FaceOperationContracts[I]["headersRequired"] extends true\n  ? {headers: FaceOperationContracts[I]["headers"]}\n  : {headers?: never};\nexport type FaceOperationOptions<I extends ${operationIdType}> = RequestPart<I> & QueryPart<I> & HeaderPart<I>;\nexport type FaceOperationRequest<I extends ${operationIdType}> = FaceOperationOptions<I> & {\n  operationId: I;\n  method: (typeof ${operationSymbol})[number]["method"];\n  path: (typeof ${operationSymbol})[number]["path"];\n  pathParameters: FaceOperationContracts[I]["path"];\n  requiresSession: FaceOperationContracts[I]["requiresSession"];\n};\nexport type FaceExecutor = <I extends ${operationIdType}>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;\n\nexport function ${clientFactory}(execute: FaceExecutor) {\n  return {\n${clientMethods}\n  } as const;\n}\n`;
}
function tsFaceWithBudget(face, operations, codes, components) {
  const source = tsFace(face, operations, codes, components);
  const selected = operations.filter(operation => operation.face === face);
  const operationSymbol = `${face.replaceAll('-', '_').toUpperCase()}_OPERATIONS`;
  const operationIdsSymbol = `${face.replaceAll('-', '_').toUpperCase()}_OPERATION_IDS`;
  const budgetSymbol = `${face.replaceAll('-', '_').toUpperCase()}_DATABASE_OPERATION_BUDGETS`;
  const budgetExport = `\n\nexport const ${budgetSymbol} = ${normalized(Object.fromEntries(selected.map(operation => [operation.operationId, operation.databaseOperationBudget]))).trim()} as const;`;
  return source.replace(
    `\n\nexport const ${operationIdsSymbol}`,
    `${budgetExport}\n\nexport const ${operationIdsSymbol}`,
  );
}
/**
 * Emits the only RTK endpoint inventory that an app may bind.  Features receive
 * a generated operation client, but RTK needs named endpoint definitions in
 * order to retain active query subscriptions and let mutations invalidate them.
 * The request stays a FaceOperationRequest, so routes, methods, headers and
 * request-shape continue to come only from the accepted edge catalog.
 */
function tsRtkEndpoint(operation, tagPolicyByOperation = new Map()) {
  const operationId = JSON.stringify(operation.operationId);
  const result = `FaceOperationContracts[${operationId}]["response"]`;
  const request = `FaceOperationRequest<${operationId}>`;
  const policy = tagPolicyByOperation.get(operation.operationId);
  const tagKey = operation.method === 'GET' ? 'provides' : 'invalidates';
  const policyResolver = policy?.tagType === 'wire' ? 'resolveWireTags' : 'resolveSalesMenuTags';
  const tags = policy
    ? `${policyResolver}<TagTypes>(${JSON.stringify(policy[tagKey])} as const, request)`
    : `[{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}]`;
  if (operation.method === 'GET') {
    return `    ${operation.operationId}: build.query<${result}, ${request}>({\n      query: (request) => toWireRequest(request),\n      providesTags: (_result, _error, request) => ${tags},\n    })`;
  }
  return `    ${operation.operationId}: build.mutation<${result}, ${request}>({\n      query: (request) => toWireRequest(request),\n      invalidatesTags: (_result, _error, request) => ${tags},\n    })`;
}
/**
 * A hook consumer must not reconstruct the catalog identity just to call a
 * generated RTK endpoint. Keep that identity in the same generated surface as
 * the endpoint: callers supply only the typed dynamic request parts.
 */
function tsRtkRequestHelper(operation) {
  const operationId = JSON.stringify(operation.operationId);
  return `    ${operation.operationId}: (pathParameters: FaceOperationContracts[${operationId}]["path"], options: FaceOperationOptions<${operationId}>): FaceOperationRequest<${operationId}> => ({\n      operationId: ${operationId},\n      method: ${JSON.stringify(operation.method)},\n      path: ${JSON.stringify(operation.path)},\n      pathParameters,\n      requiresSession: ${operation.openApi.requiresSession},\n      ...options,\n    })`;
}
function tsWireTagSupport(face, faceType, tagPolicyByOperation) {
  if (face !== 'operations-admin' || ![...tagPolicyByOperation.values()].some(policy => policy.tagType === 'wire'))
    return '';
  return [
    '',
    'export type WireRtkTagDescriptor =',
    '  | {kind: "static"; id: string}',
    '  | {kind: "requestPath"; prefix: string; path: string};',
    'function readWireTagPath(value: unknown, path: readonly string[]): unknown {',
    '  return path.reduce<unknown>((current, segment) => {',
    '    if (current === null || typeof current !== "object") return undefined;',
    '    return (current as Record<string, unknown>)[segment];',
    '  }, value);',
    '}',
    `function resolveWireTags<TagTypes extends ${faceType}RtkTagType>(`,
    '  descriptors: readonly WireRtkTagDescriptor[],',
    '  request: {pathParameters: object},',
    '): Array<{type: Extract<TagTypes, "wire">; id: string}> {',
    '  const tags: Array<{type: Extract<TagTypes, "wire">; id: string}> = [];',
    '  const seen = new Set<string>();',
    '  const add = (id: string) => {',
    '    if (id.trim() === "" || seen.has(id)) return;',
    '    seen.add(id);',
    '    tags.push({type: "wire" as Extract<TagTypes, "wire">, id});',
    '  };',
    '  for (const descriptor of descriptors) {',
    '    if (descriptor.kind === "static") add(descriptor.id);',
    '    else {',
    '      const value = readWireTagPath(request.pathParameters, descriptor.path.split("."));',
    '      if (typeof value === "string") add(descriptor.prefix + ":" + value);',
    '    }',
    '  }',
    '  return tags;',
    '}',
    '',
  ].join('\n');
}
function tsRtkFace(face, operations, tagPolicyByOperation = new Map()) {
  const selected = operations.filter(operation => operation.face === face);
  const faceType = faceTypeName(face);
  const source = `./${face === 'platform-admin' ? 'platform-edge' : face === 'operations-admin' ? 'operations-edge' : 'public-edge'}`;
  const endpointFactory = `create${faceType}RtkEndpoints`;
  const requestHelper = `${faceType[0].toLowerCase()}${faceType.slice(1)}RtkRequest`;
  const salesMenuSupport =
    (face === 'operations-admin' && tagPolicyByOperation.size > 0
      ? `\nexport type SalesMenuRtkTagDescriptor =\n  | {kind: "static"; id: string}\n  | {kind: "requestPath"; prefix: string; path: string}\n  | {kind: "requestQuery"; prefix: string; path: string};\nfunction readSalesMenuTagPath(value: unknown, path: readonly string[]): unknown {\n  return path.reduce<unknown>((current, segment) => {\n    if (current === null || typeof current !== "object") return undefined;\n    return (current as Record<string, unknown>)[segment];\n  }, value);\n}\nfunction resolveSalesMenuTags<TagTypes extends ${faceType}RtkTagType>(\n  descriptors: readonly SalesMenuRtkTagDescriptor[],\n  request: {pathParameters: object; query?: object},\n): Array<{type: Extract<TagTypes, "salesMenu">; id: string}> {\n  const tags: Array<{type: Extract<TagTypes, "salesMenu">; id: string}> = [];\n  const seen = new Set<string>();\n  const add = (id: string) => {\n    if (id.trim() === "" || seen.has(id)) return;\n    seen.add(id);\n    tags.push({type: "salesMenu" as Extract<TagTypes, "salesMenu">, id});\n  };\n  for (const descriptor of descriptors) {\n    if (descriptor.kind === "static") add(descriptor.id);\n    else if (descriptor.kind === "requestPath") {\n      const value = readSalesMenuTagPath(request.pathParameters, descriptor.path.split("."));\n      if (typeof value === "string") add(descriptor.prefix + ":" + value);\n    } else {\n      const value = readSalesMenuTagPath(request.query, descriptor.path.split("."));\n      if (typeof value === "string") add(descriptor.prefix + ":" + value);\n    }\n  }\n  return tags;\n}\n`
      : '') + tsWireTagSupport(face, faceType, tagPolicyByOperation);
  return `// Generated from accepted R5 edge catalog; do not edit.\n\nimport type {BaseQueryFn, EndpointBuilder, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta} from "@reduxjs/toolkit/query";\nimport type {FaceOperationContracts, FaceOperationOptions, FaceOperationRequest} from ${JSON.stringify(source)};\n\ntype EdgeBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>;\nexport type ${faceType}OperationId = keyof FaceOperationContracts;\nexport type ${faceType}RtkWireRequest = <I extends ${faceType}OperationId>(request: FaceOperationRequest<I>) => FetchArgs & {requiresSession: FaceOperationContracts[I]["requiresSession"]};\n${salesMenuSupport}\n/**\n * Operation-shaped request constructors for RTK hooks. Consumers supply only\n * typed path parameters and operation options; catalog id, method and path are\n * frozen here rather than handwritten in pages.\n */\nexport const ${requestHelper} = {\n${selected.map(tsRtkRequestHelper).join(',\n')}\n} as const;\n\n/**\n * Operation-shaped RTK definitions generated from the face catalog.  The app\n * supplies only HTTP encoding; it cannot invent paths, methods or endpoint ids.\n */\nexport function ${endpointFactory}(\n  build: EndpointBuilder<EdgeBaseQuery, "wire", string>,\n  toWireRequest: ${faceType}RtkWireRequest,\n) {\n  return {\n${selected.map(operation => tsRtkEndpoint(operation, tagPolicyByOperation)).join(',\n')}\n  };\n}\n`;
}
function tsRtkFaceWithFlexibleTagTypes(face, operations, tagPolicyByOperation = new Map()) {
  const faceType = faceTypeName(face);
  const endpointFactory = `create${faceType}RtkEndpoints`;
  const tagTypeUnion =
    face === 'platform-admin' ? `"wire" | "catalogInventory"` : `"wire" | "catalogInventory" | "salesMenu"`;
  return tsRtkFace(face, operations, tagPolicyByOperation)
    .replace(
      `export type ${faceType}RtkWireRequest = <I extends ${faceType}OperationId>(request: FaceOperationRequest<I>) => FetchArgs & {requiresSession: FaceOperationContracts[I]["requiresSession"]};\n`,
      `export type ${faceType}RtkWireRequest = <I extends ${faceType}OperationId>(request: FaceOperationRequest<I>) => FetchArgs & {requiresSession: FaceOperationContracts[I]["requiresSession"]};\nexport type ${faceType}RtkTagType = ${tagTypeUnion};\n`,
    )
    .replace(
      `export function ${endpointFactory}(\n  build: EndpointBuilder<EdgeBaseQuery, "wire", string>,`,
      `export function ${endpointFactory}<TagTypes extends ${faceType}RtkTagType = "wire">(\n  build: EndpointBuilder<EdgeBaseQuery, TagTypes, string>,`,
    );
}
function javaMap(entries) {
  const values = Object.entries(entries || {}).sort(([left], [right]) => left.localeCompare(right));
  return values.length === 0
    ? 'Map.of()'
    : 'Map.of(' + values.flatMap(([key, value]) => [javaString(key), javaCapabilityKey(value)]).join(', ') + ')';
}
const javaCapabilityKeyPattern = /^(?:BC-[A-Z0-9-]+|EDIT_[A-Z0-9_]+)$/;
function javaCapabilityKey(value) {
  if (typeof value === 'string' && javaCapabilityKeyPattern.test(value)) {
    return `WorkspaceAuthorizationCatalog.CapabilityKeys.${javaConstantName(value)}`;
  }
  return javaString(value);
}
function workspaceCapabilityRequirementCatalog(model) {
  const requirements = model.requirements
    .filter(
      requirement =>
        requirement.authorizationMode === 'AUTHENTICATED_WORKSPACE' &&
        requirement.authorizationKind !== 'ROLE_NODE_RANGE_READ',
    )
    .sort((left, right) => left.requirementId.localeCompare(right.requirementId));
  const entries = requirements
    .map(
      requirement =>
        '        requirement(' +
        [
          requirement.requirementId,
          requirement.capabilityKey || null,
          requirement.authorizationMode,
          requirement.resolverId,
          requirement.ownerModule,
          requirement.ownerRecheckId,
          requirement.typedProblemMappingId,
          requirement.redFixtureId,
        ]
          .map((value, index) => (index === 1 ? javaCapabilityKey(value) : javaString(value)))
          .join(', ') +
        ', ' +
        javaMap(requirement.capabilityMapping?.resourceTypeCapabilities) +
        ')',
    )
    .join(',\n');
  return [
    '// Generated from contracts/registry/iam-org-governance-manifest.json; do not edit.',
    'package com.catering.v2s.workspace.iam.api;',
    '',
    'import java.util.List;',
    'import java.util.Map;',
    'import java.util.Optional;',
    '',
    'public final class WorkspaceCapabilityRequirementCatalog {',
    '    private WorkspaceCapabilityRequirementCatalog() { }',
    '    public static List<CapabilityRequirement> requirements() { return List.of(',
    entries,
    '    ); }',
    '    public static Optional<CapabilityRequirement> requirement(String requirementId) { return requirements().stream().filter(value -> value.requirementId().equals(requirementId)).findFirst(); }',
    '    public static Optional<String> resolveCapabilityKey(String requirementId, String serverResolvedResourceType) { return requirement(requirementId).flatMap(value -> value.resourceTypeCapabilities().isEmpty() ? Optional.ofNullable(value.capabilityKey()) : Optional.ofNullable(value.resourceTypeCapabilities().get(serverResolvedResourceType))); }',
    '    private static CapabilityRequirement requirement(String requirementId, String capabilityKey, String authorizationMode, String resolverId, String ownerModule, String ownerRecheckId, String typedProblemMappingId, String redFixtureId, Map<String, String> resourceTypeCapabilities) { return new CapabilityRequirement(requirementId, capabilityKey, authorizationMode, resolverId, ownerModule, ownerRecheckId, typedProblemMappingId, redFixtureId, resourceTypeCapabilities); }',
    '    public record CapabilityRequirement(String requirementId, String capabilityKey, String authorizationMode, String resolverId, String ownerModule, String ownerRecheckId, String typedProblemMappingId, String redFixtureId, Map<String, String> resourceTypeCapabilities) { }',
    '}',
    '',
  ].join('\n');
}
function capabilityRequirementCatalog() {
  return [
    '// Generated from contracts/registry/iam-org-governance-manifest.json; do not edit.',
    'package com.catering.v2s.app.edge.generated;',
    '',
    'import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;',
    'import java.util.List;',
    'import java.util.Optional;',
    '',
    'public final class CapabilityRequirementCatalog {',
    '    private CapabilityRequirementCatalog() { }',
    '    public static List<WorkspaceCapabilityRequirementCatalog.CapabilityRequirement> requirements() { return WorkspaceCapabilityRequirementCatalog.requirements(); }',
    '    public static Optional<WorkspaceCapabilityRequirementCatalog.CapabilityRequirement> requirement(String requirementId) { return WorkspaceCapabilityRequirementCatalog.requirement(requirementId); }',
    '    public static Optional<String> resolveCapabilityKey(String requirementId, String serverResolvedResourceType) { return WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirementId, serverResolvedResourceType); }',
    '}',
    '',
  ].join('\n');
}
function capabilityResolverRegistry(model) {
  const resolvers = [...model.manifest.resolvers].sort((left, right) =>
    left.resolverId.localeCompare(right.resolverId),
  );
  const entries = resolvers
    .map(
      resolver =>
        '        resolver(' +
        javaString(resolver.resolverId) +
        ', AuthorizationMode.' +
        resolver.authorizationMode +
        ', ' +
        javaList(resolver.inputs) +
        ', ' +
        javaList(resolver.outputs) +
        ', ' +
        (resolver.authenticatedWorkspaceSessionForbidden === true) +
        ')',
    )
    .join(',\n');
  return [
    '// Generated from contracts/registry/iam-org-governance-manifest.json; do not edit.',
    'package com.catering.v2s.app.edge.generated;',
    '',
    'import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;',
    'import java.util.List;',
    'import java.util.Optional;',
    '',
    'public final class CapabilityResolverRegistry {',
    '    private CapabilityResolverRegistry() { }',
    '    public static List<ResolverDefinition> resolvers() { return List.of(',
    entries,
    '    ); }',
    '    public static Optional<ResolverDefinition> resolver(String resolverId) { return resolvers().stream().filter(value -> value.resolverId().equals(resolverId)).findFirst(); }',
    '    public static Optional<String> resolveCapabilityKey(String requirementId, String serverResolvedResourceType) { return WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirementId, serverResolvedResourceType); }',
    '    private static ResolverDefinition resolver(String resolverId, AuthorizationMode authorizationMode, List<String> inputs, List<String> outputs, boolean authenticatedWorkspaceSessionForbidden) { return new ResolverDefinition(resolverId, authorizationMode, inputs, outputs, authenticatedWorkspaceSessionForbidden); }',
    '    public enum AuthorizationMode { AUTHENTICATED_WORKSPACE, AUTHENTICATED_PLATFORM_SUPER_ADMIN, PUBLIC_PROTOCOL, TERMINAL_CREDENTIAL }',
    '    public record ResolverDefinition(String resolverId, AuthorizationMode authorizationMode, List<String> inputs, List<String> outputs, boolean authenticatedWorkspaceSessionForbidden) { }',
    '}',
    '',
  ].join('\n');
}
function capabilityOperationCatalog(model) {
  const requirements = [...model.requirements]
    .filter(requirement => requirement.authorizationKind !== 'ROLE_NODE_RANGE_READ')
    .sort((left, right) => left.requirementId.localeCompare(right.requirementId))
    .map(requirement => ({
      operationIdentity: requirement.operationIdentity,
      requirementId: requirement.requirementId,
      capabilityKey: requirement.capabilityKey || null,
      resourceTypeCapabilities: requirement.capabilityMapping?.resourceTypeCapabilities || {},
      unsupportedResourceTypeDecision: requirement.capabilityMapping?.unsupportedResourceTypeDecision || null,
      authorizationMode: requirement.authorizationMode,
      resolverId: requirement.resolverId,
      ownerModule: requirement.ownerModule,
      ownerRecheckId: requirement.ownerRecheckId,
      typedProblemMappingId: requirement.typedProblemMappingId,
      redFixtureId: requirement.redFixtureId,
    }));
  return normalized({
    schemaVersion: 1,
    kind: 'generated-operation-authorization-catalog',
    generatedFrom: 'contracts/registry/iam-org-governance-manifest.json',
    closure: {mutatingOperations: requirements.length},
    requirements,
  });
}
function capabilityOutputs(base) {
  let model;
  try {
    model = validateCapabilityInvariants(base);
  } catch (error) {
    fail('P3_CAPABILITY_INVARIANTS', error.message);
  }
  return [
    [targets.workspaceCapabilityRequirementCatalogJava, workspaceCapabilityRequirementCatalog(model)],
    [targets.capabilityRequirementCatalogJava, capabilityRequirementCatalog(model)],
    [targets.capabilityResolverRegistryJava, capabilityResolverRegistry(model)],
    [targets.capabilityOperationsCatalog, capabilityOperationCatalog(model)],
  ];
}
function identityOnlyRouteRegistryMatches(actualSource, expectedSource) {
  let actual;
  let expected;
  try {
    actual = JSON.parse(actualSource);
    expected = JSON.parse(expectedSource);
  } catch {
    fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', targets.routeRegistry);
  }
  if (!/^[a-f0-9]{64}$/.test(actual.calibrationReportDigest || ''))
    fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${targets.routeRegistry}:calibrationReportDigest`);
  const projectedBudgetCount = (actual.operations || []).filter(operation =>
    Object.hasOwn(operation, 'databaseOperationBudget'),
  ).length;
  if (projectedBudgetCount !== 0 && projectedBudgetCount !== (actual.operations || []).length)
    fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${targets.routeRegistry}:partialBudgetProjection`);
  for (const operation of actual.operations || []) {
    const budget = operation.databaseOperationBudget;
    if (
      budget !== undefined &&
      (!budget || typeof budget !== 'object' || !Number.isSafeInteger(budget.max) || budget.max < 0)
    )
      fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${targets.routeRegistry}:${operation.operationId}`);
    delete operation.databaseOperationBudget;
  }
  delete actual.calibrationReportDigest;
  delete expected.calibrationReportDigest;
  for (const operation of expected.operations || []) delete operation.databaseOperationBudget;
  return normalized(actual) === normalized(expected);
}
function identityOnlyTsSource(relative, source, expected, face, operations) {
  const symbol = `${face.replaceAll('-', '_').toUpperCase()}_DATABASE_OPERATION_BUDGETS`;
  const marker = `\n\nexport const ${symbol} = `;
  const start = source.indexOf(marker);
  const expectedStart = expected.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + marker.length) >= 0 || expectedStart < 0)
    fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${relative}:${symbol}`);
  const valueStart = start + marker.length;
  const valueEnd = source.indexOf(' as const;', valueStart);
  if (valueEnd < 0) fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${relative}:${symbol}`);
  let budgetProjection;
  try {
    budgetProjection = JSON.parse(source.slice(valueStart, valueEnd));
  } catch {
    fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${relative}:${symbol}`);
  }
  const expectedIds = operations.filter(operation => operation.face === face).map(operation => operation.operationId);
  const budgetIds = budgetProjection && typeof budgetProjection === 'object' ? Object.keys(budgetProjection) : [];
  if (budgetIds.length !== 0 && !sameSet(budgetIds, expectedIds))
    fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${relative}:${symbol}:operationIds`);
  const expectedEnd = expected.indexOf(' as const;', expectedStart + marker.length);
  if (expectedEnd < 0) fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_PROJECTION_INVALID', `${relative}:${symbol}:expected`);
  return [
    source.slice(0, start) + source.slice(valueEnd + ' as const;'.length),
    expected.slice(0, expectedStart) + expected.slice(expectedEnd + ' as const;'.length),
  ];
}
function generatedOutputMatches(relative, actual, expected, operations) {
  if (!isCp05IdentityOnlyProjectionMode()) return actual === expected;
  if (relative === targets.routeRegistry) return identityOnlyRouteRegistryMatches(actual, expected);
  const faceByTarget = new Map([
    [targets.platformTs, 'platform-admin'],
    [targets.operationsTs, 'operations-admin'],
    [targets.publicTs, 'public'],
  ]);
  const face = faceByTarget.get(relative);
  if (!face) return actual === expected;
  const [actualWithoutBudget, expectedWithoutBudget] = identityOnlyTsSource(
    relative,
    actual,
    expected,
    face,
    operations,
  );
  return actualWithoutBudget === expectedWithoutBudget;
}
function expected(base = root) {
  const {
    operations,
    faceCounts,
    codes,
    codesByFace,
    expectedOperationCount,
    calibrationReportDigest,
    rtkTagPoliciesByOperation,
  } = load(base);
  const components = generatedWireComponents(base);
  return new Map([
    [targets.errorsJava, javaErrors(codes)],
    [targets.r3CompatibilityJava, r3CompatibilityErrors()],
    [
      targets.routeRegistry,
      normalized({
        schemaVersion: 2,
        generatedFrom: [catalogPath, reportPath],
        calibrationReportDigest,
        closure: {operations: expectedOperationCount, faceCounts},
        operations: operations.map(({operationId, method, path: route, face, owner, databaseOperationBudget}) => ({
          operationId,
          method,
          path: route,
          consumerFaces: [face],
          owner,
          databaseOperationBudget,
        })),
      }),
    ],
    [targets.platformTs, tsFaceWithBudget('platform-admin', operations, codesByFace['platform-admin'], components)],
    [
      targets.operationsTs,
      tsFaceWithBudget('operations-admin', operations, codesByFace['operations-admin'], components),
    ],
    [targets.publicTs, tsFaceWithBudget('public', operations, codesByFace.public, components)],
    [targets.platformRtkTs, tsRtkFaceWithFlexibleTagTypes('platform-admin', operations)],
    [targets.operationsRtkTs, tsRtkFaceWithFlexibleTagTypes('operations-admin', operations, rtkTagPoliciesByOperation)],
    [targets.publicRtkTs, tsRtkFaceWithFlexibleTagTypes('public', operations)],
    [targets.platformAdminCatalogTs, tsAdminCatalog('platform-admin', base)],
    [targets.operationsAdminCatalogTs, tsAdminCatalog('operations-admin', base)],
    [
      targets.workspaceAuthorizationCatalogJava,
      enforceRoleHomeLookupCardinality(javaWorkspaceAuthorizationCatalog(base)),
    ],
    ...capabilityOutputs(base),
    ...wireJavaOutputs(base, operations),
  ]);
}
function writeOutputs(base = root) {
  const outputs = expected(base);
  const wireDirectory = path.join(base, targets.wireJavaRoot);
  const expectedWireFiles = new Set(
    [...outputs.keys()]
      .filter(relative => relative.startsWith(`${targets.wireJavaRoot}/`))
      .map(relative => path.basename(relative)),
  );
  if (fs.existsSync(wireDirectory)) {
    for (const name of fs.readdirSync(wireDirectory)) {
      if (name.endsWith('.java') && !expectedWireFiles.has(name)) fs.unlinkSync(path.join(wireDirectory, name));
    }
  }
  for (const [relative, value] of outputs) {
    const absolute = path.join(base, relative);
    fs.mkdirSync(path.dirname(absolute), {recursive: true});
    fs.writeFileSync(absolute, value);
  }
}
function checkOutputs(base = root) {
  const outputs = expected(base);
  const {operations, codesByFace, rtkTagPoliciesByOperation} = load(base);
  const components = generatedWireComponents(base);
  const tsFaces = new Map([
    [targets.platformTs, 'platform-admin'],
    [targets.operationsTs, 'operations-admin'],
    [targets.publicTs, 'public'],
  ]);
  const rtkFaces = new Map([
    [targets.platformRtkTs, 'platform-admin'],
    [targets.operationsRtkTs, 'operations-admin'],
    [targets.publicRtkTs, 'public'],
  ]);
  for (const [relative, face] of tsFaces) {
    const actual = path.join(base, relative);
    if (!fs.existsSync(actual)) continue;
    const source = fs.readFileSync(actual, 'utf8');
    if (source.includes('ACTION_CAPABILITIES')) fail('R5_EDGE_TS_FACE_CATALOG_LEAK', relative);
    const problemCodesMatch = source.match(/export const EDGE_PROBLEM_CODES = (\[[\s\S]*?\]) as const;/);
    let actualProblemCodes;
    try {
      actualProblemCodes = JSON.parse(problemCodesMatch?.[1] || 'null');
    } catch {
      actualProblemCodes = undefined;
    }
    if (!Array.isArray(actualProblemCodes) || !sameSet(actualProblemCodes, codesByFace[face]))
      fail('R5_EDGE_TS_PROBLEM_CODE_FACE_DRIFT', relative);
    const hasJsonValueDefinition = source.includes('export type JsonValue =');
    const hasJsonValueConsumer = source.replace(/^export type JsonValue =.*$/m, '').includes('JsonValue');
    if (hasJsonValueDefinition !== hasJsonValueConsumer) fail('R5_EDGE_TS_HELPER_REACHABILITY_DRIFT', relative);
    if (/\b(?:any|unknown)\b/.test(source)) fail('R5_EDGE_TS_UNTYPED_DTO', relative);
    if (!source.includes('export type FaceOperationContracts = {'))
      fail('R5_EDGE_TS_OPERATION_CONTRACT_MISSING', `${relative}:FaceOperationContracts`);
    for (const operation of operations.filter(candidate => candidate.face === face)) {
      if (!source.includes(tsOperationContractEntry(operation, components)))
        fail('R5_EDGE_TS_OPERATION_CONTRACT_MISSING', `${relative}:${operation.operationId}`);
    }
  }
  for (const [relative, face] of rtkFaces) {
    const actual = path.join(base, relative);
    if (!fs.existsSync(actual)) fail('R5_EDGE_RTK_GENERATED_MISSING', relative);
    const source = fs.readFileSync(actual, 'utf8');
    for (const operation of operations.filter(candidate => candidate.face === face)) {
      const endpoint = tsRtkEndpoint(operation, face === 'operations-admin' ? rtkTagPoliciesByOperation : new Map());
      if (!source.includes(endpoint)) fail('R5_EDGE_RTK_ENDPOINT_MISSING', `${relative}:${operation.operationId}`);
      const helper = tsRtkRequestHelper(operation);
      if (!source.includes(helper)) fail('R5_EDGE_RTK_REQUEST_HELPER_MISSING', `${relative}:${operation.operationId}`);
    }
  }
  for (const [relative] of outputs) {
    const actual = path.join(base, relative);
    if (
      relative.startsWith(`${targets.wireJavaRoot}/`) &&
      fs.existsSync(actual) &&
      /(?:java\.util\.)?Map\s*<\s*String\s*,\s*Object\s*>/.test(fs.readFileSync(actual, 'utf8'))
    )
      fail('R5_EDGE_WIRE_UNTYPED_MAP', relative);
  }
  let count = 0;
  for (const [relative, value] of outputs) {
    if (!fs.existsSync(path.join(base, relative))) fail('R5_EDGE_CODEGEN_MISSING', relative);
    if (!generatedOutputMatches(relative, fs.readFileSync(path.join(base, relative), 'utf8'), value, operations))
      fail(
        tsFaces.has(relative) || rtkFaces.has(relative) ? 'R5_EDGE_TS_GENERATED_DRIFT' : 'R5_EDGE_CODEGEN_DRIFT',
        relative,
      );
    count += 1;
  }
  const expectedWireFiles = new Set(
    [...outputs.keys()].filter(relative => relative.startsWith(`${targets.wireJavaRoot}/`)),
  );
  const actualWireFiles = new Set(
    fs
      .readdirSync(path.join(base, targets.wireJavaRoot))
      .filter(name => name.endsWith('.java'))
      .map(name => `${targets.wireJavaRoot}/${name}`),
  );
  for (const relative of actualWireFiles)
    if (!expectedWireFiles.has(relative)) fail('R5_EDGE_WIRE_MANUAL_FILE', relative);
  for (const relative of expectedWireFiles)
    if (!actualWireFiles.has(relative)) fail('R5_EDGE_WIRE_MISSING_FILE', relative);
  return count;
}
function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-r5-codegen-'));
  try {
    fs.cpSync(root, scratch, {
      recursive: true,
      filter: source => !source.includes('/build') && !source.includes('/dist') && !source.includes('/.git'),
    });
    writeOutputs(scratch);
    const previousProjectionMode = process.env.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE;
    process.env.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE = 'IDENTITY_ONLY';
    try {
      checkOutputs(scratch);
      const routeRegistryPath = path.join(scratch, targets.routeRegistry);
      const routeRegistrySource = fs.readFileSync(routeRegistryPath, 'utf8');
      const routeRegistry = JSON.parse(routeRegistrySource);
      routeRegistry.operations[0].path += '/identity-only-red';
      fs.writeFileSync(routeRegistryPath, normalized(routeRegistry));
      try {
        checkOutputs(scratch);
        fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_ROUTE_DRIFT_RED_NOT_DETECTED');
      } catch (error) {
        if (error.code !== 'R5_EDGE_CODEGEN_DRIFT') throw error;
      }
      fs.writeFileSync(routeRegistryPath, routeRegistrySource);
      const platformTsPath = path.join(scratch, targets.platformTs);
      const platformTsSource = fs.readFileSync(platformTsPath, 'utf8');
      fs.appendFileSync(platformTsPath, '\n// identity-only drift red mutation\n');
      try {
        checkOutputs(scratch);
        fail('R5_EDGE_CODEGEN_IDENTITY_ONLY_TS_DRIFT_RED_NOT_DETECTED');
      } catch (error) {
        if (error.code !== 'R5_EDGE_TS_GENERATED_DRIFT') throw error;
      }
      fs.writeFileSync(platformTsPath, platformTsSource);
      writeOutputs(scratch);
      checkOutputs(scratch);
      process.stdout.write('R5_EDGE_CODEGEN_IDENTITY_ONLY_CHECK=PASS\n');
    } finally {
      if (previousProjectionMode === undefined) delete process.env.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE;
      else process.env.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE = previousProjectionMode;
    }
    for (const name of ['PlatformPasswordRecoveryOtpSendRequest', 'OperationsPasswordRecoveryOtpSendRequest']) {
      const source = fs.readFileSync(path.join(scratch, targets.wireJavaRoot, `${name}.java`), 'utf8');
      if (
        !source.includes('if (token != tools.jackson.core.JsonToken.END_OBJECT)') ||
        source.includes('switch (property)')
      ) {
        fail('R5_EDGE_EMPTY_OBJECT_DESERIALIZER_REGRESSION', name);
      }
    }
    for (const [name, property] of [
      ['BusinessChannelTemplateCreateRequest', 'storeVisibilityScope'],
      ['SalesMenuItemUpdateRequest', 'displayNameOverride'],
      ['SalesMenuItemUpdateRequestSaleContent', 'listedPriceCents'],
    ]) {
      const source = fs.readFileSync(path.join(scratch, targets.wireJavaRoot, `${name}.java`), 'utf8');
      if (!source.includes(`if (!seen.contains("${property}"))`))
        fail('R5_EDGE_NULLABLE_REQUIRED_DESERIALIZER_REGRESSION', `${name}.${property}`);
    }
    for (const [name, property] of [
      ['BusinessChannelTemplateCreateRequest', 'dineInForm'],
      ['SalesMenuItemUpdateRequest', 'displayNameOverride'],
      ['SalesMenuDisplayMedia', 'primaryAssetRef'],
    ]) {
      const source = fs.readFileSync(path.join(scratch, targets.wireJavaRoot, `${name}.java`), 'utf8');
      if (!source.includes('parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null :'))
        fail('R5_EDGE_NULLABLE_VALUE_DESERIALIZER_REGRESSION', `${name}.${property}`);
    }
    const staticCatalog = read(catalogPath, scratch);
    staticCatalog.operations[0].databaseOperationBudget = {kind: 'FIXED', max: 1};
    fs.writeFileSync(path.join(scratch, catalogPath), normalized(staticCatalog));
    try {
      load(scratch);
      fail('R5_EDGE_STATIC_BUDGET_RETIRED_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_STATIC_BUDGET_RETIRED') throw error;
    }
    fs.writeFileSync(path.join(scratch, catalogPath), normalized(read(catalogPath, root)));
    const denominatorCatalog = read(catalogPath, scratch);
    denominatorCatalog.denominator.operations += 1;
    fs.writeFileSync(path.join(scratch, catalogPath), normalized(denominatorCatalog));
    try {
      load(scratch);
      fail('R5_EDGE_CODEGEN_OPERATION_DENOMINATOR_RED_NOT_DETECTED');
    } catch (error) {
      const code = error.code || error.message;
      if (!['R5_EDGE_CODEGEN_OPERATION_COUNT', 'R5_EDGE_MATERIALIZED_OPERATION_DENOMINATOR_INVALID'].includes(code))
        throw error;
    }
    fs.writeFileSync(path.join(scratch, catalogPath), normalized(read(catalogPath, root)));
    const reportPathDocument = read(reportPath, scratch);
    reportPathDocument.operations.pop();
    fs.writeFileSync(path.join(scratch, reportPath), normalized(reportPathDocument));
    try {
      load(scratch);
      fail('R5_EDGE_CODEGEN_REPORT_DENOMINATOR_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_CODEGEN_OPERATION_COUNT') throw error;
    }
    fs.writeFileSync(path.join(scratch, reportPath), fs.readFileSync(path.join(root, reportPath)));
    const salesMenuPolicy = read(salesMenuTagPolicyPath, scratch);
    salesMenuPolicy.operations = salesMenuPolicy.operations.slice(1);
    salesMenuPolicy.operationCount -= 1;
    fs.writeFileSync(path.join(scratch, salesMenuTagPolicyPath), normalized(salesMenuPolicy));
    try {
      load(scratch);
      fail('R5_SALES_MENU_RTK_TAG_OPERATION_DENOMINATOR_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_SALES_MENU_RTK_TAG_OPERATION_COUNT_INVALID') throw error;
    }
    fs.writeFileSync(
      path.join(scratch, salesMenuTagPolicyPath),
      fs.readFileSync(path.join(root, salesMenuTagPolicyPath)),
    );
    const storeTerminalPolicy = read(storeTerminalTagPolicyPath, scratch);
    const storeTerminalDenominatorMutation = structuredClone(storeTerminalPolicy);
    storeTerminalDenominatorMutation.operations = storeTerminalDenominatorMutation.operations.slice(1);
    storeTerminalDenominatorMutation.operationCount -= 1;
    fs.writeFileSync(path.join(scratch, storeTerminalTagPolicyPath), normalized(storeTerminalDenominatorMutation));
    try {
      load(scratch);
      fail('R5_STORE_TERMINAL_RTK_TAG_OPERATION_DENOMINATOR_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_STORE_TERMINAL_RTK_TAG_OPERATION_COUNT_INVALID') throw error;
    }
    fs.writeFileSync(
      path.join(scratch, storeTerminalTagPolicyPath),
      fs.readFileSync(path.join(root, storeTerminalTagPolicyPath)),
    );
    const storeTerminalStaticIdMutation = structuredClone(storeTerminalPolicy);
    storeTerminalStaticIdMutation.operations = storeTerminalStaticIdMutation.operations.map(entry =>
      entry.operationId === 'getOperationsStoreTerminals'
        ? {
            ...entry,
            provides: entry.provides.map(descriptor =>
              descriptor.kind === 'static' ? {...descriptor, id: 'LIST'} : descriptor,
            ),
          }
        : entry,
    );
    fs.writeFileSync(path.join(scratch, storeTerminalTagPolicyPath), normalized(storeTerminalStaticIdMutation));
    try {
      load(scratch);
      fail('R5_STORE_TERMINAL_RTK_TAG_STATIC_ID_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_STORE_TERMINAL_RTK_TAG_STATIC_ID_INVALID') throw error;
    }
    fs.writeFileSync(
      path.join(scratch, storeTerminalTagPolicyPath),
      fs.readFileSync(path.join(root, storeTerminalTagPolicyPath)),
    );
    const globalTagPolicy = read(salesMenuTagPolicyPath, scratch);
    const globalTagEntry = globalTagPolicy.operations.find(entry => entry.operationId === 'getOperationsSalesMenus');
    globalTagEntry.provides.push({kind: 'static', id: 'LIST'});
    fs.writeFileSync(path.join(scratch, salesMenuTagPolicyPath), normalized(globalTagPolicy));
    try {
      load(scratch);
      fail('R5_SALES_MENU_RTK_GLOBAL_TAG_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_SALES_MENU_RTK_TAG_STATIC_ID_INVALID') throw error;
    }
    fs.writeFileSync(
      path.join(scratch, salesMenuTagPolicyPath),
      fs.readFileSync(path.join(root, salesMenuTagPolicyPath)),
    );
    const capabilityRequirementCatalogSource = fs.readFileSync(
      path.join(scratch, targets.workspaceCapabilityRequirementCatalogJava),
      'utf8',
    );
    for (const capability of ['EDIT_HEAD_COMPANY_CATALOG', 'EDIT_STORE_CATALOG', 'EDIT_STORE_INVENTORY']) {
      if (!capabilityRequirementCatalogSource.includes(`WorkspaceAuthorizationCatalog.CapabilityKeys.${capability}`)) {
        fail('R5_EDGE_CODEGEN_EDIT_CAPABILITY_CONSTANT_MISSING', capability);
      }
    }
    const rootOpenApiPath = 'contracts/openapi/edge.openapi.json';
    const rootOpenApiSource = fs.readFileSync(path.join(scratch, rootOpenApiPath), 'utf8');
    const rootOpenApi = read(rootOpenApiPath, scratch);
    const releasePath = '/api/platform/assets/staging/{assetRef}/release';
    if (!rootOpenApi.paths?.[releasePath]?.$ref) fail('R5_EDGE_ROOT_ROUTE_REGISTRY_FIXTURE_INVALID');
    delete rootOpenApi.paths[releasePath];
    fs.writeFileSync(path.join(scratch, rootOpenApiPath), normalized(rootOpenApi));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_ROOT_ROUTE_REGISTRY_MISSING_ROOT_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, rootOpenApiPath), rootOpenApiSource);
    const wrongRootOpenApi = read(rootOpenApiPath, scratch);
    wrongRootOpenApi.paths[releasePath].$ref =
      './paths/platform-admin/group-workspace-management.paths.json#/paths/~1api~1platform~1assets~1staging';
    fs.writeFileSync(path.join(scratch, rootOpenApiPath), normalized(wrongRootOpenApi));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_ROOT_ROUTE_REGISTRY_WRONG_REFERENCE_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, rootOpenApiPath), rootOpenApiSource);
    const operationsAuthPath = 'contracts/openapi/paths/operations-admin/workspace-auth.paths.json';
    const operationsAuthSource = read(operationsAuthPath, scratch);
    const operationsOtpSend =
      operationsAuthSource.paths['/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send']?.post;
    if (!Array.isArray(operationsOtpSend?.security)) fail('R5_EDGE_OPENAPI_SECURITY_FIXTURE_INVALID');
    delete operationsOtpSend.security;
    fs.writeFileSync(path.join(scratch, operationsAuthPath), normalized(operationsAuthSource));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_OPENAPI_SECURITY_REQUIRED_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_CODEGEN_OPENAPI_SECURITY_REQUIRED') throw error;
    }
    fs.writeFileSync(path.join(scratch, operationsAuthPath), fs.readFileSync(path.join(root, operationsAuthPath)));
    writeOutputs(scratch);
    const mapTarget = wireJavaOutputs(scratch).find(([relative]) => relative.endsWith('.java'))[0];
    fs.appendFileSync(path.join(scratch, mapTarget), '// java.util.Map<String, Object> red mutation\n');
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_WIRE_UNTYPED_MAP_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_WIRE_UNTYPED_MAP') throw error;
    }
    writeOutputs(scratch);
    const wireTarget = wireJavaOutputs(scratch)[0][0];
    fs.appendFileSync(path.join(scratch, wireTarget), '// red mutation\n');
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_CODEGEN_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_CODEGEN_DRIFT') throw error;
    }
    writeOutputs(scratch);
    fs.writeFileSync(path.join(scratch, targets.wireJavaRoot, 'ManualWire.java'), 'package generated;\n');
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_WIRE_MANUAL_FILE_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_WIRE_MANUAL_FILE') throw error;
    }
    writeOutputs(scratch);
    fs.appendFileSync(path.join(scratch, targets.platformTs), '// manual generated TS drift\n');
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_TS_GENERATED_DRIFT_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_TS_GENERATED_DRIFT') throw error;
    }
    writeOutputs(scratch);
    const rtkOperation = load(scratch).operations.find(candidate => candidate.face === 'platform-admin');
    const rtkEndpoint = tsRtkEndpoint(rtkOperation);
    const rtkTarget = path.join(scratch, targets.platformRtkTs);
    const rtkSource = fs.readFileSync(rtkTarget, 'utf8');
    if (!rtkSource.includes(rtkEndpoint)) fail('R5_EDGE_RTK_ENDPOINT_FIXTURE_INVALID', rtkOperation.operationId);
    fs.writeFileSync(rtkTarget, rtkSource.replace(rtkEndpoint, ''));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_RTK_ENDPOINT_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_RTK_ENDPOINT_MISSING') throw error;
    }
    writeOutputs(scratch);
    const rtkRequestHelper = tsRtkRequestHelper(rtkOperation);
    const helperSource = fs.readFileSync(rtkTarget, 'utf8');
    if (!helperSource.includes(rtkRequestHelper))
      fail('R5_EDGE_RTK_REQUEST_HELPER_FIXTURE_INVALID', rtkOperation.operationId);
    fs.writeFileSync(rtkTarget, helperSource.replace(rtkRequestHelper, ''));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_RTK_REQUEST_HELPER_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_RTK_REQUEST_HELPER_MISSING') throw error;
    }
    writeOutputs(scratch);
    const operation = load(scratch).operations.find(candidate => candidate.face === 'platform-admin');
    const contractEntry = tsOperationContractEntry(operation, generatedWireComponents(scratch));
    const contractTarget = path.join(scratch, targets.platformTs);
    const contractSource = fs.readFileSync(contractTarget, 'utf8');
    if (!contractSource.includes(contractEntry))
      fail('R5_EDGE_TS_OPERATION_CONTRACT_FIXTURE_INVALID', operation.operationId);
    fs.writeFileSync(contractTarget, contractSource.replace(contractEntry, ''));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_TS_OPERATION_CONTRACT_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_TS_OPERATION_CONTRACT_MISSING') throw error;
    }
    writeOutputs(scratch);
    fs.appendFileSync(path.join(scratch, targets.platformTs), '\nexport type UntypedDtoEscape = any;\n');
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_TS_UNTYPED_DTO_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_TS_UNTYPED_DTO') throw error;
    }
    writeOutputs(scratch);
    const adminSource = read(adminCatalogPath, scratch);
    adminSource.nodes.find(node => node.key === 'HOME-GROUP').key = 'HOME-FAKE';
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(adminSource));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_PAGE_SET_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_PAGE_SET_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const actionSource = read(adminCatalogPath, scratch);
    actionSource.nodes.find(node => node.key === 'BC-ORG-GROUP-EDIT').key = 'BC-FAKE-ACTION';
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(actionSource));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_ACTION_SET_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_ACTION_SET_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const shellCopySource = read(adminCatalogPath, scratch);
    shellCopySource.nodes.find(node => node.key === 'PLATFORM-SHELL-LOGOUT').consumerFace = 'operations-admin';
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(shellCopySource));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_SHELL_COPY_SET_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_SHELL_COPY_SET_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const pageGrowthSource = read(adminCatalogPath, scratch);
    const pageGrowthManifest = read(frontendManifestPath, scratch);
    const pageGrowthNode = JSON.parse(
      JSON.stringify(pageGrowthSource.nodes.find(node => node.key === 'PG-ORG-STRUCTURE')),
    );
    pageGrowthNode.key = 'PG-ORG-STRUCTURE-EXTRA';
    pageGrowthNode.display.label = '组织架构扩展';
    pageGrowthNode.navigation.order = 160;
    pageGrowthSource.nodes.push(pageGrowthNode);
    pageGrowthManifest.pageDesignKeySurfaceCrosswalk.byPageDesignKey[pageGrowthNode.key] = 'OPERATIONS-ORG-STRUCTURE';
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(pageGrowthSource));
    fs.writeFileSync(path.join(scratch, frontendManifestPath), normalized(pageGrowthManifest));
    try {
      writeOutputs(scratch);
      checkOutputs(scratch);
    } catch (error) {
      fail('R5_ADMIN_CATALOG_DYNAMIC_PAGE_COUNT_ACCEPTANCE_FAILED', error.code || error.message);
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    fs.writeFileSync(path.join(scratch, frontendManifestPath), fs.readFileSync(path.join(root, frontendManifestPath)));
    writeOutputs(scratch);
    const invalidPageKindSource = read(adminCatalogPath, scratch);
    invalidPageKindSource.nodes.find(node => node.key === 'PG-ORG-STRUCTURE').page.kind = 'UNCLASSIFIED';
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(invalidPageKindSource));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_PAGE_KIND_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_PAGE_KIND_SET_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    writeOutputs(scratch);
    const bindingSource = read(adminCatalogPath, scratch);
    delete bindingSource.nodes.find(node => node.key === 'BC-IAM-GROUP-INVITE').action.userManagement;
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(bindingSource));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_USER_MANAGEMENT_BINDING_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_USER_MANAGEMENT_BINDING_SET_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const uxSource = read(adminCatalogPath, scratch);
    delete uxSource.nodes.find(node => node.key === 'HOME-GROUP').experience;
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(uxSource));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_UX_SET_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_UX_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const crossFaceAction = read(adminCatalogPath, scratch);
    crossFaceAction.nodes.find(node => node.key === 'BC-ORG-GROUP-EDIT').action.targetPageKey = 'PLATFORM-WORKSPACES';
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(crossFaceAction));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_CROSS_FACE_ACTION_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_ACTION_BINDING_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const duplicateNavigation = read(adminCatalogPath, scratch);
    duplicateNavigation.nodes.find(node => node.key === 'HOME-REGION').navigation.order = 10;
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(duplicateNavigation));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_DUPLICATE_NAVIGATION_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_NAVIGATION_BINDING_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const roleHomeAccess = read(adminCatalogPath, scratch);
    roleHomeAccess.nodes.find(node => node.key === 'HOME-GROUP').pageAccess = {
      pageAccessManaged: true,
      grantableRoleNodeTypes: ['GROUP'],
      requiredDataNodeType: 'NONE',
    };
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(roleHomeAccess));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_ROLE_HOME_ACCESS_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_ROLE_HOME_INVALID') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    const roleHomeWorkspaceRequirement = read(adminCatalogPath, scratch);
    roleHomeWorkspaceRequirement.nodes.find(node => node.key === 'HOME-GROUP').workspaceRequirement = 'REQUIRED';
    fs.writeFileSync(path.join(scratch, adminCatalogPath), normalized(roleHomeWorkspaceRequirement));
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_ROLE_HOME_WORKSPACE_REQUIREMENT_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_ADMIN_CATALOG_ROLE_HOME_INVALID') throw error;
    }
    fs.writeFileSync(path.join(scratch, adminCatalogPath), fs.readFileSync(path.join(root, adminCatalogPath)));
    writeOutputs(scratch);
    const roleHomeCatalogTarget = path.join(scratch, targets.workspaceAuthorizationCatalogJava);
    const roleHomeCatalogSource = fs.readFileSync(roleHomeCatalogTarget, 'utf8');
    if (!roleHomeCatalogSource.includes('ROLE_HOME_CATALOG_DUPLICATE:'))
      fail('R5_ADMIN_CATALOG_ROLE_HOME_RUNTIME_CARDINALITY_FIXTURE_INVALID');
    fs.writeFileSync(
      roleHomeCatalogTarget,
      roleHomeCatalogSource.replace('ROLE_HOME_CATALOG_DUPLICATE:', 'ROLE_HOME_CATALOG_DUPLICATE_REMOVED:'),
    );
    try {
      checkOutputs(scratch);
      fail('R5_ADMIN_CATALOG_ROLE_HOME_RUNTIME_CARDINALITY_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_CODEGEN_DRIFT') throw error;
    }
    writeOutputs(scratch);
    fs.appendFileSync(path.join(scratch, targets.publicTs), '\nexport const ACTION_CAPABILITIES = {};\n');
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_TS_FACE_CATALOG_LEAK_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_TS_FACE_CATALOG_LEAK') throw error;
    }
    writeOutputs(scratch);
    const publicTarget = path.join(scratch, targets.publicTs);
    const publicSource = fs.readFileSync(publicTarget, 'utf8');
    fs.writeFileSync(
      publicTarget,
      publicSource.replace(
        /export const EDGE_PROBLEM_CODES = \[/,
        'export const EDGE_PROBLEM_CODES = [\n  "PLATFORM_IAM_ACCOUNT_DISABLED",',
      ),
    );
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_TS_PROBLEM_CODE_FACE_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_TS_PROBLEM_CODE_FACE_DRIFT') throw error;
    }
    writeOutputs(scratch);
    const exactRefFile = 'contracts/openapi/components/workspace-iam/workspace-access.schemas.json';
    const exactRefSource = fs.readFileSync(path.join(scratch, exactRefFile), 'utf8');
    fs.writeFileSync(
      path.join(scratch, exactRefFile),
      exactRefSource.replace(
        '../common/enum.schemas.json#/components/schemas/ServiceNodeType',
        '../common/time.schemas.json#/components/schemas/ServiceNodeType',
      ),
    );
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_WIRE_REFERENCE_FRAGMENT_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_WIRE_REFERENCE_FRAGMENT_MISSING') throw error;
    }
    fs.writeFileSync(path.join(scratch, exactRefFile), exactRefSource);
    const statusCatalog = read(catalogPath, scratch);
    const statusOperation = statusCatalog.operations.find(candidate => candidate.successStatus !== '400');
    statusOperation.successStatus = '400';
    fs.writeFileSync(path.join(scratch, catalogPath), normalized(statusCatalog));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_OPENAPI_SUCCESS_STATUS_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_CODEGEN_OPENAPI_SUCCESS_STATUS_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, catalogPath), fs.readFileSync(path.join(root, catalogPath)));
    writeOutputs(scratch);
    const p3CAuthorizationPath = 'contracts/openapi/paths/operations-admin/workspace-access.paths.json';
    const p3CAuthorizationSource = read(p3CAuthorizationPath, scratch);
    p3CAuthorizationSource.paths[
      '/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user'
    ].get.parameters.push({
      name: 'pageDesignKey',
      in: 'query',
      required: true,
      schema: {type: 'string'},
    });
    fs.writeFileSync(path.join(scratch, p3CAuthorizationPath), normalized(p3CAuthorizationSource));
    try {
      checkOutputs(scratch);
      fail('P3_C_PAGE_KEY_REQUEST_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_CODEGEN_OPENAPI_QUERY_PARAMETER_DRIFT') throw error;
    }
    fs.writeFileSync(path.join(scratch, p3CAuthorizationPath), fs.readFileSync(path.join(root, p3CAuthorizationPath)));
    writeOutputs(scratch);
    const bodyOperation = load(scratch).operations.find(
      candidate => candidate.path.includes('/user-management/') && candidate.requestSchema !== 'NoBody',
    );
    const bodyPathFile = 'contracts/openapi/paths/operations-admin/workspace-access.paths.json';
    const bodyPathDocument = read(bodyPathFile, scratch);
    const bodyRequest = bodyPathDocument.paths[bodyOperation.path][bodyOperation.method.toLowerCase()].requestBody;
    if (!bodyRequest || typeof bodyRequest !== 'object' || bodyRequest.required !== true) {
      fail('R5_EDGE_REQUEST_REQUIRED_FIXTURE_INVALID');
    }
    bodyRequest.required = false;
    fs.writeFileSync(path.join(scratch, bodyPathFile), normalized(bodyPathDocument));
    try {
      checkOutputs(scratch);
      fail('R5_EDGE_REQUEST_REQUIRED_RED_NOT_DETECTED');
    } catch (error) {
      if (error.code !== 'R5_EDGE_TS_OPERATION_CONTRACT_MISSING') throw error;
    }
    process.stdout.write(
      'R5_EDGE_CODEGEN_EDIT_CAPABILITY_CONSTANT=PASS\nR5_EDGE_CODEGEN_SELF_TEST=PASS\nRED=R5_EDGE_CODEGEN_OPERATION_DENOMINATOR,R5_EDGE_CODEGEN_REPORT_DENOMINATOR,R5_SALES_MENU_RTK_TAG_OPERATION_DENOMINATOR,R5_SALES_MENU_RTK_TAG_STATIC_ID_INVALID,R5_STORE_TERMINAL_RTK_TAG_OPERATION_DENOMINATOR,R5_STORE_TERMINAL_RTK_TAG_STATIC_ID_INVALID,R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT,R5_EDGE_CODEGEN_OPENAPI_SECURITY_REQUIRED,R5_EDGE_WIRE_UNTYPED_MAP,R5_EDGE_CODEGEN_DRIFT,R5_EDGE_WIRE_MANUAL_FILE,R5_EDGE_TS_GENERATED_DRIFT,R5_EDGE_RTK_ENDPOINT_MISSING,R5_EDGE_RTK_REQUEST_HELPER_MISSING,R5_EDGE_TS_OPERATION_CONTRACT_MISSING,R5_EDGE_TS_UNTYPED_DTO,R5_ADMIN_CATALOG_PAGE_SET_DRIFT,R5_ADMIN_CATALOG_ACTION_SET_DRIFT,R5_ADMIN_CATALOG_SHELL_COPY_SET_DRIFT,R5_ADMIN_CATALOG_PAGE_KIND_SET_DRIFT,R5_ADMIN_CATALOG_USER_MANAGEMENT_BINDING_SET_DRIFT,R5_ADMIN_CATALOG_UX_DRIFT,R5_ADMIN_CATALOG_ACTION_BINDING_DRIFT,R5_ADMIN_CATALOG_NAVIGATION_BINDING_DRIFT,R5_ADMIN_CATALOG_ROLE_HOME_INVALID,R5_ADMIN_CATALOG_ROLE_HOME_WORKSPACE_REQUIREMENT_RED,R5_EDGE_TS_FACE_CATALOG_LEAK,R5_EDGE_TS_PROBLEM_CODE_FACE_DRIFT,R5_EDGE_WIRE_REFERENCE_FRAGMENT_MISSING,R5_EDGE_CODEGEN_OPENAPI_SUCCESS_STATUS_DRIFT,P3_C_PAGE_KEY_REQUEST,R5_EDGE_REQUEST_REQUIRED\n',
    );
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
  }
}
try {
  const argumentsAfterScript = process.argv.slice(2);
  if (argumentsAfterScript.length === 1 && argumentsAfterScript[0] === '--self-test') selfTest();
  else if (argumentsAfterScript.length === 1 && argumentsAfterScript[0] === '--check')
    process.stdout.write(`R5_EDGE_CODEGEN_CHECK=PASS\nFILES=${checkOutputs()}\n`);
  else if (argumentsAfterScript.length === 1 && argumentsAfterScript[0] === '--write') {
    writeOutputs(root);
    process.stdout.write(`R5_EDGE_CODEGEN_WRITE=PASS\nFILES=${expected(root).size}\n`);
  } else if (argumentsAfterScript.length === 0) fail('R5_EDGE_CODEGEN_WRITE_REQUIRED');
  else fail('R5_EDGE_CODEGEN_ARGUMENT_INVALID');
} catch (error) {
  process.stderr.write(`${error.code || 'R5_EDGE_CODEGEN_FAIL'}: ${error.message}\n`);
  process.exitCode = 1;
}
