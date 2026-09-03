#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCatalogInventoryOpenApi} from '../lib/catalog-inventory-openapi.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'contracts/catalog/catalog-inventory-edge-contract.json');
const readModelsPath = path.join(root, 'contracts/catalog/catalog-inventory-read-models.json');
const tagPolicyPath = path.join(root, 'contracts/catalog/catalog-inventory-rtk-tag-policy.json');
const outputDir = path.join(root, 'apps/frontend/operations-admin/src/app/api/generated');

const catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const readModels = JSON.parse(fs.readFileSync(readModelsPath, 'utf8'));
const tagPolicy = JSON.parse(fs.readFileSync(tagPolicyPath, 'utf8'));
const openApi = readCatalogInventoryOpenApi(root);
const schemas = openApi.components?.schemas ?? {};
const typedProblemCodes = schemas.TypedProblem?.properties?.code?.enum ?? [];
const readModelRequired = new Map(readModels.models.map(model => [model.name, model.required]));
const operations = catalog.operations.map(operation => ({
  ...operation,
  method: operation.method.toUpperCase(),
  path: `/api${operation.path}`,
  requestType: operation.requestComponent,
  responseType: operation.responseComponent,
}));
const pathNames = template => [...template.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
const pascal = value => value.replace(/(^|[-_])([a-z])/g, (_, _prefix, letter) => letter.toUpperCase());

function pathType(operation) {
  const names = pathNames(operation.path);
  if (names.length === 0) return 'Record<string, never>';
  return `{ ${names.map(name => `${tsPropertyName(name)}: ${name.endsWith('Ref') ? 'Uuid' : 'string'};`).join(' ')} }`;
}

function queryType(operation) {
  if (operation.method !== 'GET') return 'never';
  const schema = schemas[operation.requestType];
  if (!schema || typeof schema !== 'object') return 'Record<string, never>';
  const pathFields = new Set(pathNames(operation.path));
  if (pathFields.size === 0) return pascal(operation.requestType);
  const omitted = [...pathFields].map(name => JSON.stringify(name)).join(' | ');
  return `Omit<${pascal(operation.requestType)}, ${omitted}>`;
}

function headerType(operation) {
  return operation.method === 'GET'
    ? `{ "X-Workspace-Brand-Ref"?: string; }`
    : `{ "X-Workspace-Brand-Ref"?: string; "Idempotency-Key": string;${operation.operationId === 'saveOperationsCatalogItem' ? ' "X-Catalog-Asset-Bind-Grants"?: string;' : ''} }`;
}

function schemaRefName(schema) {
  return typeof schema?.$ref === 'string' && schema.$ref.startsWith('#/components/schemas/')
    ? schema.$ref.slice('#/components/schemas/'.length)
    : undefined;
}

function tsPropertyName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function transportEnvelopeRequired(required) {
  return (
    required.includes('revision') &&
    required.includes('requestId') &&
    (required.includes('data') || required.includes('result') || required.includes('results'))
  );
}

function schemaRequired(response) {
  const required = schemas[response]?.required;
  if (!Array.isArray(required)) throw new Error(`P3_RESPONSE_SCHEMA_REQUIRED_MISSING:${response}`);
  return required;
}

function policyError(code) {
  throw new Error(code);
}

function hasDescriptor(descriptors, kind, prefix) {
  return descriptors.some(descriptor => descriptor.kind === kind && descriptor.prefix === prefix);
}

function hasResponseArrayDescriptor(descriptors, prefix, arrayPath, valuePath) {
  return descriptors.some(
    descriptor =>
      descriptor.kind === 'responseArrayValue' &&
      descriptor.prefix === prefix &&
      JSON.stringify(descriptor.arrayPath) === JSON.stringify(arrayPath) &&
      descriptor.valuePath === valuePath,
  );
}

function hasResponsePathDescriptor(descriptors, prefix, path) {
  return descriptors.some(
    descriptor =>
      descriptor.kind === 'responsePath' &&
      descriptor.prefix === prefix &&
      JSON.stringify(descriptor.path) === JSON.stringify(path),
  );
}

function validateTagDescriptor(operation, descriptor, collection) {
  if (!descriptor || typeof descriptor !== 'object' || typeof descriptor.kind !== 'string')
    policyError(`CATALOG_INVENTORY_RTK_TAG_DESCRIPTOR_INVALID:${operation.operationId}:${collection}`);
  if (descriptor.kind === 'static') {
    if (typeof descriptor.id !== 'string' || descriptor.id.trim() === '')
      policyError(`CATALOG_INVENTORY_RTK_TAG_STATIC_ID_MISSING:${operation.operationId}:${collection}`);
    return;
  }
  if (descriptor.kind === 'requestPath') {
    if (typeof descriptor.prefix !== 'string' || typeof descriptor.path !== 'string')
      policyError(`CATALOG_INVENTORY_RTK_TAG_REQUEST_PATH_INVALID:${operation.operationId}:${collection}`);
    if (!pathNames(operation.path).includes(descriptor.path))
      policyError(
        `CATALOG_INVENTORY_RTK_TAG_REQUEST_PATH_NOT_IN_OPERATION:${operation.operationId}:${descriptor.path}`,
      );
    return;
  }
  if (descriptor.kind === 'responsePath') {
    if (
      typeof descriptor.prefix !== 'string' ||
      !Array.isArray(descriptor.path) ||
      descriptor.path.length === 0 ||
      descriptor.path.some(part => typeof part !== 'string' || part.trim() === '')
    )
      policyError(`CATALOG_INVENTORY_RTK_TAG_RESPONSE_PATH_INVALID:${operation.operationId}:${collection}`);
    return;
  }
  if (descriptor.kind === 'responseArrayValue') {
    if (
      typeof descriptor.prefix !== 'string' ||
      !Array.isArray(descriptor.arrayPath) ||
      descriptor.arrayPath.length === 0 ||
      descriptor.arrayPath.some(part => typeof part !== 'string' || part.trim() === '') ||
      typeof descriptor.valuePath !== 'string' ||
      descriptor.valuePath.trim() === ''
    )
      policyError(`CATALOG_INVENTORY_RTK_TAG_RESPONSE_ARRAY_INVALID:${operation.operationId}:${collection}`);
    return;
  }
  policyError(`CATALOG_INVENTORY_RTK_TAG_DESCRIPTOR_KIND_UNKNOWN:${operation.operationId}:${descriptor.kind}`);
}

function validateTagPolicy(policy = tagPolicy, operationSet = operations) {
  if (policy?.kind !== 'catalog-inventory-rtk-tag-policy') policyError('CATALOG_INVENTORY_RTK_TAG_POLICY_KIND_INVALID');
  if (policy?.tagType !== 'catalogInventory') policyError('CATALOG_INVENTORY_RTK_TAG_TYPE_INVALID');
  if (policy?.operationCount !== operationSet.length) policyError('CATALOG_INVENTORY_RTK_TAG_OPERATION_COUNT_INVALID');
  if (!Array.isArray(policy?.operations) || policy.operations.length !== operationSet.length)
    policyError('CATALOG_INVENTORY_RTK_TAG_OPERATION_LIST_INVALID');

  const operationById = new Map(operationSet.map(operation => [operation.operationId, operation]));
  const policyById = new Map();
  for (const entry of policy.operations) {
    const operation = operationById.get(entry?.operationId);
    if (!operation) policyError(`CATALOG_INVENTORY_RTK_TAG_OPERATION_UNKNOWN:${entry?.operationId ?? 'MISSING'}`);
    if (policyById.has(entry.operationId))
      policyError(`CATALOG_INVENTORY_RTK_TAG_OPERATION_DUPLICATE:${entry.operationId}`);
    if (!Array.isArray(entry.provides) || !Array.isArray(entry.invalidates))
      policyError(`CATALOG_INVENTORY_RTK_TAG_OPERATION_SHAPE_INVALID:${entry.operationId}`);
    if (operation.method === 'GET' && entry.provides.length === 0)
      policyError(`CATALOG_INVENTORY_RTK_PROVIDER_MISSING:${entry.operationId}`);
    if (operation.method === 'GET' && entry.invalidates.length > 0)
      policyError(`CATALOG_INVENTORY_RTK_GET_INVALIDATION_PRESENT:${entry.operationId}`);
    if (operation.method !== 'GET' && entry.provides.length > 0)
      policyError(`CATALOG_INVENTORY_RTK_MUTATION_PROVIDER_PRESENT:${entry.operationId}`);
    for (const descriptor of entry.provides) validateTagDescriptor(operation, descriptor, 'provides');
    for (const descriptor of entry.invalidates) validateTagDescriptor(operation, descriptor, 'invalidates');
    if (/^(preflight|stageOperations|releaseOperations)/.test(entry.operationId) && entry.invalidates.length > 0)
      policyError(`CATALOG_INVENTORY_RTK_UNRELATED_INVALIDATION:${entry.operationId}`);
    policyById.set(entry.operationId, entry);
  }
  for (const operation of operationSet) {
    if (!policyById.has(operation.operationId))
      policyError(`CATALOG_INVENTORY_RTK_OPERATION_MISSING:${operation.operationId}`);
  }

  const itemDetail = policyById.get('getOperationsCatalogItem');
  if (
    !hasDescriptor(itemDetail.provides, 'requestPath', 'catalog-item-code') ||
    !hasDescriptor(itemDetail.provides, 'responsePath', 'catalog-item-ref')
  )
    policyError('CATALOG_INVENTORY_RTK_ITEM_REFERENCE_TAG_MISSING');

  if (!hasResponseArrayDescriptor(itemDetail.provides, 'production-tag-ref', ['data', 'productionTags'], 'tagRef'))
    policyError('CATALOG_INVENTORY_RTK_PRODUCTION_TAG_REFERENCE_PROVIDER_MISSING');

  for (const operationId of [
    'createOperationsProductionTag',
    'updateOperationsProductionTag',
    'transitionOperationsProductionTagStatus',
  ]) {
    const operation = policyById.get(operationId);
    if (!hasResponsePathDescriptor(operation.invalidates, 'production-tag-ref', ['tagRef']))
      policyError(`CATALOG_INVENTORY_RTK_PRODUCTION_TAG_REFERENCE_INVALIDATION_MISSING:${operationId}`);
  }

  const inventoryTarget = policyById.get('getOperationsInventoryTarget');
  if (!hasDescriptor(inventoryTarget.provides, 'requestPath', 'inventory-target'))
    policyError('CATALOG_INVENTORY_RTK_TARGET_REFERENCE_TAG_MISSING');

  for (const operationId of ['executeOperationsLocalCatalogCopy', 'executeOperationsBrandCatalogCopy']) {
    const copyOperation = policyById.get(operationId);
    if (
      !hasResponseArrayDescriptor(
        copyOperation.invalidates,
        'catalog-item-ref',
        ['data', 'targetVersions'],
        'targetRef',
      )
    )
      policyError('CATALOG_INVENTORY_RTK_COPY_ITEM_REFERENCE_TAG_MISSING');
    if (
      hasResponseArrayDescriptor(copyOperation.invalidates, 'inventory-target', ['data', 'targetVersions'], 'targetRef')
    )
      policyError('CATALOG_INVENTORY_RTK_COPY_TARGET_REFERENCE_MISLABELED');
  }

  return policyById;
}

const tagPolicyByOperation = validateTagPolicy();

// Exactly one boundary owns a response envelope: the model, P1's generated GET
// schema, or P3's strict GET wrapper. A mutation uses the legacy envelope only
// when its generated response component is transport-flat.
function responseEnvelopeOwner(operation) {
  const response = operation.responseType;
  const wireRequired = schemaRequired(response);
  if (operation.method !== 'GET') return transportEnvelopeRequired(wireRequired) ? 'MODEL' : 'LEGACY';

  const sourceRequired = readModelRequired.get(response);
  if (!Array.isArray(sourceRequired)) throw new Error(`P3_GET_READ_MODEL_REQUIRED_MISSING:${response}`);
  if (transportEnvelopeRequired(sourceRequired)) return 'MODEL';
  return transportEnvelopeRequired(wireRequired) ? 'P1' : 'P3';
}

function responseType(operation) {
  const response = pascal(operation.responseType);
  const owner = responseEnvelopeOwner(operation);
  if (owner === 'P3') return `CatalogQueryEnvelope<${response}>`;
  if (owner === 'LEGACY') return `CatalogInventoryEnvelope<${response}>`;
  return response;
}

function tsType(schema) {
  if (!schema || typeof schema !== 'object') return 'JsonValue';
  const ref = schemaRefName(schema);
  if (ref) {
    const type = pascal(ref);
    return schema.nullable === true ? `${type} | null` : type;
  }
  if (Array.isArray(schema.type)) {
    const variants = schema.type.map(type => {
      // Only the string branch may retain format: uuid/binary. The null branch
      // must remain null so nullable UUIDs do not collapse to Uuid | Uuid.
      const variantSchema = type === 'null' ? {type} : {...schema, type};
      return tsType(variantSchema);
    });
    return [...new Set(variants)].join(' | ');
  }
  if (schema.type === 'string' && schema.format === 'uuid') return schema.nullable === true ? 'Uuid | null' : 'Uuid';
  if (schema.type === 'string' && schema.format === 'binary') return 'Blob';
  if (Array.isArray(schema.oneOf)) return schema.oneOf.map(tsType).join(' | ');
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map(tsType).join(' | ');
  // `if`/`then` constraints enrich a concrete object schema at runtime but do
  // not define a second TypeScript object shape.  Prefer the schema's own
  // structural type when present; only compose allOf-only schemas.
  if (Array.isArray(schema.allOf) && !schema.type && !schema.properties && !schema.items)
    return schema.allOf.map(tsType).join(' & ');
  if (Array.isArray(schema.enum)) return schema.enum.map(value => JSON.stringify(value)).join(' | ');
  if (schema.type === 'array') return `Array<${tsType(schema.items)}>`;
  if (schema.type === 'object' || schema.properties) {
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const entries = Object.entries(properties).map(
      ([name, value]) => `${tsPropertyName(name)}${required.has(name) ? '' : '?'}: ${tsType(value)};`,
    );
    if (schema.additionalProperties === true) entries.push('[key: string]: JsonValue | undefined;');
    else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
      entries.push(`[key: string]: ${tsType(schema.additionalProperties)};`);
    const type = `{ ${entries.join(' ')} }`;
    return schema.nullable === true ? `${type} | null` : type;
  }
  if (schema.type === 'integer' || schema.type === 'number')
    return schema.nullable === true ? 'number | null' : 'number';
  if (schema.type === 'boolean') return schema.nullable === true ? 'boolean | null' : 'boolean';
  if (schema.type === 'null') return 'null';
  if (schema.type === 'string') return schema.nullable === true ? 'string | null' : 'string';
  return schema.nullable === true ? 'JsonValue | null' : 'JsonValue';
}

function generatedSchemaTypes() {
  return [
    'export type Uuid = string & { readonly __uuid: "Uuid" };',
    ...Object.entries(schemas).map(([name, schema]) => `export type ${pascal(name)} = ${tsType(schema)};`),
  ].join('\n');
}

function generatedEdge() {
  const descriptors = operations
    .map(
      operation =>
        `  ${JSON.stringify({
          operationId: operation.operationId,
          method: operation.method,
          path: operation.path,
          owner: operation.initiatingOwner,
          requiresSession: true,
        })}`,
    )
    .join(',\n');
  const operationIds = operations
    .map(operation => `  ${JSON.stringify(operation.operationId)}: ${JSON.stringify(operation.operationId)}`)
    .join(',\n');
  const contracts = operations
    .map(
      operation =>
        `  ${JSON.stringify(operation.operationId)}: {request: ${pascal(operation.requestType)}; response: ${responseType(operation)}; requestRequired: ${operation.method !== 'GET'}; requiresSession: true; path: ${pathType(operation)}; query: ${queryType(operation)}; queryRequired: false; headers: ${headerType(operation)}; headersRequired: ${operation.method !== 'GET'};}`,
    )
    .join('\n');
  const methods = operations
    .map(
      operation =>
        `    ${operation.operationId}: (pathParameters: FaceOperationContracts[${JSON.stringify(operation.operationId)}]["path"], options${operation.method === 'GET' ? '?' : ''}: CatalogInventoryOperationOptions<${JSON.stringify(operation.operationId)}>) => execute({operationId: ${JSON.stringify(operation.operationId)}, method: ${JSON.stringify(operation.method)}, path: ${JSON.stringify(operation.path)}, pathParameters, requiresSession: true, ...options}),`,
    )
    .join('\n');
  const typedProblemCodes = schemas.TypedProblem?.properties?.code?.enum ?? [];
  return `// Generated from contracts/catalog/catalog-inventory-edge-contract.json and catalog-inventory.openapi.json; do not edit.\n\nexport const CATALOG_INVENTORY_REVISION = ${JSON.stringify(catalog.revision)} as const;\nexport const CATALOG_INVENTORY_OPERATIONS = [\n${descriptors}\n] as const;\nexport const CATALOG_INVENTORY_OPERATION_IDS = {\n${operationIds}\n} as const;\nexport type CatalogInventoryOperationId = (typeof CATALOG_INVENTORY_OPERATIONS)[number]["operationId"];\nexport type JsonValue = string | number | boolean | null | Array<JsonValue> | { [key: string]: JsonValue | undefined };\nexport type CatalogInventoryEnvelope<T = JsonValue> = {revision?: string; requestId?: string; data?: T; result?: T; version?: number; [key: string]: JsonValue | T | undefined};\n${generatedSchemaTypes()}\nexport type FaceOperationContracts = {\n${contracts}\n};\ntype RequestPart<I extends CatalogInventoryOperationId> = FaceOperationContracts[I]["requestRequired"] extends true ? {body: FaceOperationContracts[I]["request"]} : {body?: never};\ntype QueryPart<I extends CatalogInventoryOperationId> = FaceOperationContracts[I]["queryRequired"] extends true ? {query: FaceOperationContracts[I]["query"]} : {query?: FaceOperationContracts[I]["query"]};\ntype HeaderPart<I extends CatalogInventoryOperationId> = FaceOperationContracts[I]["headersRequired"] extends true ? {headers: FaceOperationContracts[I]["headers"]} : {headers?: never};\nexport type CatalogInventoryOperationOptions<I extends CatalogInventoryOperationId> = RequestPart<I> & QueryPart<I> & HeaderPart<I>;\nexport type FaceOperationRequest<I extends CatalogInventoryOperationId> = CatalogInventoryOperationOptions<I> & {operationId: I; method: string; path: string; pathParameters: FaceOperationContracts[I]["path"]; requiresSession: true};\nexport type FaceExecutor = <I extends CatalogInventoryOperationId>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;\nexport function createCatalogInventoryClient(execute: FaceExecutor) {\n  return {\n${methods}\n  };\n}\n`;
}

function generatedRtk() {
  const requestHelpers = operations
    .map(
      operation =>
        `  ${operation.operationId}: (pathParameters: FaceOperationContracts[${JSON.stringify(operation.operationId)}]["path"], options${operation.method === 'GET' ? '?' : ''}: CatalogInventoryOperationOptions<${JSON.stringify(operation.operationId)}>) => ({operationId: ${JSON.stringify(operation.operationId)}, method: ${JSON.stringify(operation.method)}, path: ${JSON.stringify(operation.path)}, pathParameters, requiresSession: true, ...options} as CatalogInventoryOperationRequest<${JSON.stringify(operation.operationId)}>),`,
    )
    .join('\n');
  const endpoints = operations
    .map(operation => {
      const tagMode = operation.method === 'GET' ? 'providesTags' : 'invalidatesTags';
      const tagKey = operation.method === 'GET' ? 'provides' : 'invalidates';
      const descriptors = JSON.stringify(tagPolicyByOperation.get(operation.operationId)[tagKey]);
      return `    ${operation.operationId}: build.${operation.method === 'GET' ? 'query' : 'mutation'}<${responseType(operation)}, CatalogInventoryOperationRequest<${JSON.stringify(operation.operationId)}>>({query: wire, ${tagMode}: (_result, _error, request) => resolveCatalogInventoryTags(${descriptors} as const, request, _result)}),`;
    })
    .join('\n');
  const responseTypes = [...new Set(operations.map(operation => pascal(operation.responseType)))].sort().join(', ');
  return `// Generated from contracts/catalog/catalog-inventory-edge-contract.json, catalog-inventory.openapi.json and catalog-inventory-rtk-tag-policy.json; do not edit.\nimport type {BaseQueryFn, EndpointBuilder, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta} from "@reduxjs/toolkit/query";\nimport type {CatalogInventoryEnvelope, CatalogInventoryOperationId, CatalogInventoryOperationOptions, FaceOperationContracts, FaceOperationRequest, ${responseTypes}} from "./catalog-inventory-edge";\ntype EdgeBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>;\nexport type CatalogInventoryOperationRequest<I extends CatalogInventoryOperationId> = FaceOperationRequest<I>;\nexport type CatalogInventoryWireRequest = <I extends CatalogInventoryOperationId>(request: CatalogInventoryOperationRequest<I>) => FetchArgs & {requiresSession: true};\nexport type CatalogInventoryTag = {type: "catalogInventory"; id: string};\ntype CatalogInventoryTagDescriptor =\n  | {kind: "static"; id: string}\n  | {kind: "requestPath"; prefix: string; path: string}\n  | {kind: "responsePath"; prefix: string; path: readonly string[]}\n  | {kind: "responseArrayValue"; prefix: string; arrayPath: readonly string[]; valuePath: string};\nfunction readTagPath(value: unknown, path: readonly string[]): unknown {\n  return path.reduce<unknown>((current, segment) => {\n    if (current === null || typeof current !== "object") return undefined;\n    return (current as Record<string, unknown>)[segment];\n  }, value);\n}\nfunction readResponseTagPath(value: unknown, path: readonly string[]): unknown {\n  const direct = readTagPath(value, path);\n  if (direct !== undefined) return direct;\n  for (const wrapper of ["data", "result"]) {\n    const nested = readTagPath(value, [wrapper, ...path]);\n    if (nested !== undefined) return nested;\n  }\n  return undefined;\n}\nfunction resolveCatalogInventoryTags<I extends CatalogInventoryOperationId>(\n  descriptors: readonly CatalogInventoryTagDescriptor[],\n  request: CatalogInventoryOperationRequest<I>,\n  result: unknown,\n): CatalogInventoryTag[] {\n  const tags: CatalogInventoryTag[] = [];\n  const seen = new Set<string>();\n  const add = (prefix: string, value: unknown) => {\n    if (typeof value !== "string" || value.trim() === "") return;\n    const id = prefix + ":" + value;\n    if (seen.has(id)) return;\n    seen.add(id);\n    tags.push({type: "catalogInventory", id});\n  };\n  for (const descriptor of descriptors) {\n    if (descriptor.kind === "static") add(descriptor.id, descriptor.id);\n    else if (descriptor.kind === "requestPath") add(descriptor.prefix, readTagPath(request.pathParameters, descriptor.path.split(".")));\n    else if (descriptor.kind === "responsePath") add(descriptor.prefix, readResponseTagPath(result, descriptor.path));\n    else {\n      const values = readResponseTagPath(result, descriptor.arrayPath);\n      if (!Array.isArray(values)) continue;\n      for (const value of values) add(descriptor.prefix, readTagPath(value, descriptor.valuePath.split(".")));\n    }\n  }\n  return tags;\n}\nexport const catalogInventoryRtkRequest = {\n${requestHelpers}\n};\nexport function createCatalogInventoryRtkEndpoints(build: EndpointBuilder<EdgeBaseQuery, "wire" | "catalogInventory", string>, wire: CatalogInventoryWireRequest) {\n  return {\n${endpoints}\n  };\n}\n`;
}

function generatedRtkWithExactStaticTags() {
  return generatedRtk().replace(
    'if (descriptor.kind === "static") add(descriptor.id, descriptor.id);',
    'if (descriptor.kind === "static") {\n      if (descriptor.id.trim() !== "" && !seen.has(descriptor.id)) {\n        seen.add(descriptor.id);\n        tags.push({type: "catalogInventory", id: descriptor.id});\n      }\n    }',
  );
}

function generatedOutputs() {
  fs.mkdirSync(outputDir, {recursive: true});
  const generatedEdgeText = generatedEdge()
    .replace(
      'export type CatalogInventoryEnvelope<T = JsonValue> = {revision?: string; requestId?: string; data?: T; result?: T; version?: number; [key: string]: JsonValue | T | undefined};',
      'export type CatalogInventoryEnvelope<T = JsonValue> = {revision?: string; requestId?: string; data?: T; result?: T; version?: number; [key: string]: JsonValue | T | undefined};\nexport type CatalogQueryEnvelope<T> = {revision: string; requestId: string; data: T;};',
    )
    .replace(
      `export const CATALOG_INVENTORY_REVISION = ${JSON.stringify(catalog.revision)} as const;`,
      `export const CATALOG_INVENTORY_REVISION = ${JSON.stringify(catalog.revision)} as const;\nexport const CATALOG_INVENTORY_PROBLEM_CODES = ${JSON.stringify(typedProblemCodes)} as const;\nexport type CatalogInventoryProblemCode = (typeof CATALOG_INVENTORY_PROBLEM_CODES)[number];`,
    )
    .replace(`: {headers?: never};`, `: {headers?: FaceOperationContracts[I]["headers"]};`);
  writeGeneratedOutput(path.join(outputDir, 'catalog-inventory-edge.ts'), generatedEdgeText);
  const generatedRtkText = generatedRtkWithExactStaticTags()
    .replace(
      'CatalogInventoryEnvelope, CatalogInventoryOperationId',
      'CatalogInventoryEnvelope, CatalogQueryEnvelope, CatalogInventoryOperationId',
    )
    .replace(
      'EndpointBuilder<EdgeBaseQuery, "wire" | "catalogInventory", string>',
      'EndpointBuilder<EdgeBaseQuery, "wire" | "catalogInventory" | "salesMenu", string>',
    );
  writeGeneratedOutput(path.join(outputDir, 'catalog-inventory-edge.rtk.ts'), generatedRtkText);
  console.log(`CATALOG_INVENTORY_P3_FRONTEND_GENERATED operations=${operations.length} revision=${catalog.revision}`);
}

function writeGeneratedOutput(filePath, content) {
  try {
    if (fs.readFileSync(filePath, 'utf8') === content) return false;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  fs.writeFileSync(filePath, content);
  return true;
}

function expectPolicyFailure(mutatedPolicy, expectedCode) {
  try {
    validateTagPolicy(mutatedPolicy);
  } catch (error) {
    if (error instanceof Error && error.message === expectedCode) return;
    throw error;
  }
  throw new Error(`EXPECTED_POLICY_FAILURE_NOT_RAISED:${expectedCode}`);
}

function selfTest() {
  const idempotenceScratch = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-inventory-p3-frontend-'));
  try {
    const idempotenceTarget = path.join(idempotenceScratch, 'generated.ts');
    fs.writeFileSync(idempotenceTarget, 'stable generated output\n');
    const before = fs.statSync(idempotenceTarget);
    if (writeGeneratedOutput(idempotenceTarget, 'stable generated output\n') !== false)
      throw new Error('P3_GENERATED_OUTPUT_NOT_IDEMPOTENT');
    const unchanged = fs.statSync(idempotenceTarget);
    if (unchanged.ino !== before.ino || unchanged.mtimeMs !== before.mtimeMs)
      throw new Error('P3_GENERATED_OUTPUT_METADATA_CHANGED_ON_NOOP');
    if (writeGeneratedOutput(idempotenceTarget, 'changed generated output\n') !== true)
      throw new Error('P3_GENERATED_OUTPUT_CHANGE_NOT_WRITTEN');
    if (fs.readFileSync(idempotenceTarget, 'utf8') !== 'changed generated output\n')
      throw new Error('P3_GENERATED_OUTPUT_CHANGE_WRONG');
  } finally {
    fs.rmSync(idempotenceScratch, {recursive: true, force: true});
  }
  console.log('P3_GENERATED_OUTPUT_IDEMPOTENCE=PASS');

  const conditionalObjectType = tsType({
    type: 'object',
    additionalProperties: false,
    required: ['canVoid', 'blockingReasons'],
    properties: {canVoid: {type: 'boolean'}, blockingReasons: {type: 'array', items: {type: 'string'}}},
    allOf: [{if: {properties: {canVoid: {const: false}}}, then: {properties: {blockingReasons: {minItems: 1}}}}],
  });
  if (!conditionalObjectType.includes('canVoid: boolean') || !conditionalObjectType.includes('blockingReasons: Array<string>'))
    throw new Error('P3_CONDITIONAL_OBJECT_TYPE_COLLAPSED');
  console.log('RED_CONDITIONAL_OBJECT_TYPE_COLLAPSE=PASS');

  const missingProvider = structuredClone(tagPolicy);
  missingProvider.operations.find(operation => operation.operationId === 'getOperationsCatalogItems').provides = [];
  expectPolicyFailure(missingProvider, 'CATALOG_INVENTORY_RTK_PROVIDER_MISSING:getOperationsCatalogItems');
  console.log('RED_MISSING_PROVIDER=PASS');

  const unrelatedInvalidation = structuredClone(tagPolicy);
  unrelatedInvalidation.operations.find(
    operation => operation.operationId === 'preflightOperationsLocalCatalogCopy',
  ).invalidates = [{kind: 'static', id: 'inventory-target-page'}];
  expectPolicyFailure(
    unrelatedInvalidation,
    'CATALOG_INVENTORY_RTK_UNRELATED_INVALIDATION:preflightOperationsLocalCatalogCopy',
  );
  console.log('RED_UNRELATED_INVALIDATION=PASS');

  const missingItemReference = structuredClone(tagPolicy);
  missingItemReference.operations.find(operation => operation.operationId === 'getOperationsCatalogItem').provides =
    missingItemReference.operations
      .find(operation => operation.operationId === 'getOperationsCatalogItem')
      .provides.filter(descriptor => descriptor.prefix !== 'catalog-item-ref');
  expectPolicyFailure(missingItemReference, 'CATALOG_INVENTORY_RTK_ITEM_REFERENCE_TAG_MISSING');
  console.log('RED_ITEM_REFERENCE_TAG=PASS');

  const missingProductionTagReference = structuredClone(tagPolicy);
  missingProductionTagReference.operations.find(
    operation => operation.operationId === 'getOperationsCatalogItem',
  ).provides = missingProductionTagReference.operations
    .find(operation => operation.operationId === 'getOperationsCatalogItem')
    .provides.filter(descriptor => descriptor.prefix !== 'production-tag-ref');
  expectPolicyFailure(missingProductionTagReference, 'CATALOG_INVENTORY_RTK_PRODUCTION_TAG_REFERENCE_PROVIDER_MISSING');
  console.log('RED_PRODUCTION_TAG_REFERENCE_PROVIDER=PASS');

  const missingProductionTagInvalidation = structuredClone(tagPolicy);
  missingProductionTagInvalidation.operations.find(
    operation => operation.operationId === 'updateOperationsProductionTag',
  ).invalidates = missingProductionTagInvalidation.operations
    .find(operation => operation.operationId === 'updateOperationsProductionTag')
    .invalidates.filter(descriptor => descriptor.prefix !== 'production-tag-ref');
  expectPolicyFailure(
    missingProductionTagInvalidation,
    'CATALOG_INVENTORY_RTK_PRODUCTION_TAG_REFERENCE_INVALIDATION_MISSING:updateOperationsProductionTag',
  );
  console.log('RED_PRODUCTION_TAG_REFERENCE_INVALIDATION=PASS');

  const missingTargetReference = structuredClone(tagPolicy);
  missingTargetReference.operations.find(
    operation => operation.operationId === 'getOperationsInventoryTarget',
  ).provides = [{kind: 'static', id: 'inventory-target-page'}];
  expectPolicyFailure(missingTargetReference, 'CATALOG_INVENTORY_RTK_TARGET_REFERENCE_TAG_MISSING');
  console.log('RED_TARGET_REFERENCE_TAG=PASS');

  const missingCopyItemReference = structuredClone(tagPolicy);
  for (const operationId of ['executeOperationsLocalCatalogCopy', 'executeOperationsBrandCatalogCopy']) {
    const operation = missingCopyItemReference.operations.find(candidate => candidate.operationId === operationId);
    operation.invalidates = operation.invalidates.filter(
      descriptor =>
        !(descriptor.kind === 'responseArrayValue' && descriptor.arrayPath?.join('.') === 'data.targetVersions'),
    );
  }
  expectPolicyFailure(missingCopyItemReference, 'CATALOG_INVENTORY_RTK_COPY_ITEM_REFERENCE_TAG_MISSING');
  console.log('RED_COPY_ITEM_REFERENCE_TAG=PASS');
  console.log('CATALOG_INVENTORY_P3_RTK_TAG_RED_MUTATIONS=PASS');
}

if (process.argv.includes('--self-test')) selfTest();
else generatedOutputs();
