#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = path.join(root, "contracts/catalog/catalog-inventory-edge-contract.json");
const openApiPath = path.join(root, "contracts/openapi/catalog-inventory.openapi.yaml");
const outputDir = path.join(root, "apps/frontend/operations-admin/src/app/api/generated");

const catalog = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const openApi = JSON.parse(fs.readFileSync(openApiPath, "utf8"));
const schemas = openApi.components?.schemas ?? {};
const typedProblemCodes = schemas.TypedProblem?.properties?.code?.enum ?? [];
const operations = catalog.operations.map((operation) => ({
  ...operation,
  method: operation.method.toUpperCase(),
  path: `/api${operation.path}`,
  requestType: operation.requestComponent,
  responseType: operation.responseComponent,
}));
const pathNames = (template) => [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
const pascal = (value) => value.replace(/(^|[-_])([a-z])/g, (_, _prefix, letter) => letter.toUpperCase());

function pathType(operation) {
  const names = pathNames(operation.path);
  if (names.length === 0) return "Record<string, never>";
  return `{ ${names.map((name) => `${tsPropertyName(name)}: string;`).join(" ")} }`;
}

function queryType(operation) {
  if (operation.method !== "GET") return "never";
  const schema = schemas[operation.requestType];
  if (!schema || typeof schema !== "object") return "Record<string, never>";
  const pathFields = new Set(pathNames(operation.path));
  if (pathFields.size === 0) return pascal(operation.requestType);
  const omitted = [...pathFields].map((name) => JSON.stringify(name)).join(" | ");
  return `Omit<${pascal(operation.requestType)}, ${omitted}>`;
}

function headerType(operation) {
  return operation.method === "GET"
    ? `{ "X-Workspace-Brand-Ref"?: string; }`
    : `{ "X-Workspace-Brand-Ref"?: string; "Idempotency-Key": string; }`;
}

function schemaRefName(schema) {
  return typeof schema?.$ref === "string" && schema.$ref.startsWith("#/components/schemas/")
    ? schema.$ref.slice("#/components/schemas/".length)
    : undefined;
}

function tsPropertyName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function tsType(schema) {
  if (!schema || typeof schema !== "object") return "JsonValue";
  if (schema.format === "binary") return "Blob";
  const ref = schemaRefName(schema);
  if (ref) return pascal(ref);
  if (Array.isArray(schema.type)) return schema.type.map((type) => tsType({...schema, type})).join(" | ");
  if (Array.isArray(schema.oneOf)) return schema.oneOf.map(tsType).join(" | ");
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map(tsType).join(" | ");
  if (Array.isArray(schema.allOf)) return schema.allOf.map(tsType).join(" & ");
  if (Array.isArray(schema.enum)) return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.type === "array") return `Array<${tsType(schema.items)}>`;
  if (schema.type === "object" || schema.properties) {
    const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const entries = Object.entries(properties).map(([name, value]) => `${tsPropertyName(name)}${required.has(name) ? "" : "?"}: ${tsType(value)};`);
    if (schema.additionalProperties === true) entries.push("[key: string]: JsonValue | undefined;");
    else if (schema.additionalProperties && typeof schema.additionalProperties === "object") entries.push(`[key: string]: ${tsType(schema.additionalProperties)};`);
    return `{ ${entries.join(" ")} }`;
  }
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "null") return "null";
  if (schema.type === "string") return "string";
  return "JsonValue";
}

function generatedSchemaTypes() {
  return Object.entries(schemas).map(([name, schema]) => `export type ${pascal(name)} = ${tsType(schema)};`).join("\n");
}

function generatedEdge() {
  const descriptors = operations.map((operation) => `  {operationId: ${JSON.stringify(operation.operationId)}, method: ${JSON.stringify(operation.method)}, path: ${JSON.stringify(operation.path)}, owner: ${JSON.stringify(operation.initiatingOwner)}, requiresSession: true}`).join(",\n");
  const contracts = operations.map((operation) => `  ${JSON.stringify(operation.operationId)}: {request: ${pascal(operation.requestType)}; response: CatalogInventoryEnvelope<${pascal(operation.responseType)}>; requestRequired: ${operation.method !== "GET"}; requiresSession: true; path: ${pathType(operation)}; query: ${queryType(operation)}; queryRequired: false; headers: ${headerType(operation)}; headersRequired: ${operation.method !== "GET"};}`).join("\n");
  const methods = operations.map((operation) => `    ${operation.operationId}: (pathParameters: FaceOperationContracts[${JSON.stringify(operation.operationId)}]["path"], options${operation.method === "GET" ? "?" : ""}: CatalogInventoryOperationOptions<${JSON.stringify(operation.operationId)}>) => execute({operationId: ${JSON.stringify(operation.operationId)}, method: ${JSON.stringify(operation.method)}, path: ${JSON.stringify(operation.path)}, pathParameters, requiresSession: true, ...options}),`).join("\n");
  const typedProblemCodes = schemas.TypedProblem?.properties?.code?.enum ?? [];
  return `// Generated from contracts/catalog/catalog-inventory-edge-contract.json and catalog-inventory.openapi.yaml; do not edit.\n\nexport const CATALOG_INVENTORY_REVISION = ${JSON.stringify(catalog.revision)} as const;\nexport const CATALOG_INVENTORY_OPERATIONS = [\n${descriptors}\n] as const;\nexport type CatalogInventoryOperationId = (typeof CATALOG_INVENTORY_OPERATIONS)[number]["operationId"];\nexport type JsonValue = string | number | boolean | null | Array<JsonValue> | { [key: string]: JsonValue };\nexport type CatalogInventoryEnvelope<T = JsonValue> = {revision?: string; requestId?: string; data?: T; result?: T; version?: number; [key: string]: JsonValue | T | undefined};\n${generatedSchemaTypes()}\nexport type FaceOperationContracts = {\n${contracts}\n};\ntype RequestPart<I extends CatalogInventoryOperationId> = FaceOperationContracts[I]["requestRequired"] extends true ? {body: FaceOperationContracts[I]["request"]} : {body?: never};\ntype QueryPart<I extends CatalogInventoryOperationId> = FaceOperationContracts[I]["queryRequired"] extends true ? {query: FaceOperationContracts[I]["query"]} : {query?: FaceOperationContracts[I]["query"]};\ntype HeaderPart<I extends CatalogInventoryOperationId> = FaceOperationContracts[I]["headersRequired"] extends true ? {headers: FaceOperationContracts[I]["headers"]} : {headers?: never};\nexport type CatalogInventoryOperationOptions<I extends CatalogInventoryOperationId> = RequestPart<I> & QueryPart<I> & HeaderPart<I>;\nexport type FaceOperationRequest<I extends CatalogInventoryOperationId> = CatalogInventoryOperationOptions<I> & {operationId: I; method: string; path: string; pathParameters: FaceOperationContracts[I]["path"]; requiresSession: true};\nexport type FaceExecutor = <I extends CatalogInventoryOperationId>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;\nexport function createCatalogInventoryClient(execute: FaceExecutor) {\n  return {\n${methods}\n  };\n}\n`;
}

function generatedRtk() {
  const requestHelpers = operations.map((operation) => `  ${operation.operationId}: (pathParameters: FaceOperationContracts[${JSON.stringify(operation.operationId)}]["path"], options${operation.method === "GET" ? "?" : ""}: CatalogInventoryOperationOptions<${JSON.stringify(operation.operationId)}>) => ({operationId: ${JSON.stringify(operation.operationId)}, method: ${JSON.stringify(operation.method)}, path: ${JSON.stringify(operation.path)}, pathParameters, requiresSession: true, ...options} as CatalogInventoryOperationRequest<${JSON.stringify(operation.operationId)}>),`).join("\n");
  const endpoints = operations.map((operation) => `    ${operation.operationId}: build.${operation.method === "GET" ? "query" : "mutation"}<CatalogInventoryEnvelope<${pascal(operation.responseType)}>, CatalogInventoryOperationRequest<${JSON.stringify(operation.operationId)}>>({query: wire}),`).join("\n");
  const responseTypes = [...new Set(operations.map((operation) => pascal(operation.responseType)))].sort().join(", ");
  return `// Generated from contracts/catalog/catalog-inventory-edge-contract.json and catalog-inventory.openapi.yaml; do not edit.\nimport type {BaseQueryFn, EndpointBuilder, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta} from "@reduxjs/toolkit/query";\nimport type {CatalogInventoryEnvelope, CatalogInventoryOperationId, CatalogInventoryOperationOptions, FaceOperationContracts, FaceOperationRequest, ${responseTypes}} from "./catalog-inventory-edge";\nexport type CatalogInventoryOperationRequest<I extends CatalogInventoryOperationId> = FaceOperationRequest<I>;\nexport type CatalogInventoryWireRequest = <I extends CatalogInventoryOperationId>(request: CatalogInventoryOperationRequest<I>) => FetchArgs & {requiresSession: true};\nexport const catalogInventoryRtkRequest = {\n${requestHelpers}\n};\nexport function createCatalogInventoryRtkEndpoints(build: EndpointBuilder<BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>, "wire", "operationsApi">, wire: CatalogInventoryWireRequest) {\n  return {\n${endpoints}\n  };\n}\n`;
}

fs.mkdirSync(outputDir, {recursive: true});
const generatedEdgeText = generatedEdge()
  .replace(
    `export const CATALOG_INVENTORY_REVISION = ${JSON.stringify(catalog.revision)} as const;`,
    `export const CATALOG_INVENTORY_REVISION = ${JSON.stringify(catalog.revision)} as const;\nexport const CATALOG_INVENTORY_PROBLEM_CODES = ${JSON.stringify(typedProblemCodes)} as const;\nexport type CatalogInventoryProblemCode = (typeof CATALOG_INVENTORY_PROBLEM_CODES)[number];`,
  )
  .replace(
    `: {headers?: never};`,
    `: {headers?: FaceOperationContracts[I]["headers"]};`,
  );
fs.writeFileSync(path.join(outputDir, "catalog-inventory-edge.ts"), generatedEdgeText);
fs.writeFileSync(path.join(outputDir, "catalog-inventory-edge.rtk.ts"), generatedRtk());
console.log(`CATALOG_INVENTORY_P3_FRONTEND_GENERATED operations=${operations.length} revision=${catalog.revision}`);
