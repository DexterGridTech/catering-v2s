#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectEdgeCatalog } from "./edge-operation-projections.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = "doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json";
const placementPath = "doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json";
const errorCatalogPath = "doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json";
const authorizationManifestPath = "contracts/registry/iam-org-governance-manifest.json";
const outputReport = "doc/evidence/platform/r5-u01-edge-placement-resolution.json";
const generatedRoot = "contracts/openapi";
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function fail(code, detail = "") { throw new Error(`${code}${detail ? `:${detail}` : ""}`); }
function readJson(relative, base = root) { return JSON.parse(fs.readFileSync(path.join(base, relative), "utf8")); }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function write(relative, value, base = root) {
  const absolute = path.join(base, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}
function generatedOutputSnapshot(base = root) {
  const outputRoot = path.join(base, generatedRoot);
  const files = new Map();
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.set(path.relative(outputRoot, absolute).split(path.sep).join('/'), fs.readFileSync(absolute, 'utf8'));
    }
  };
  visit(outputRoot);
  return files;
}
function assertGeneratedOutputSnapshots(actual, expected) {
  const actualPaths = [...actual.keys()].sort();
  const expectedPaths = [...expected.keys()].sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('R5_EDGE_GENERATED_OUTPUT_SET_DRIFT');
  for (const relative of expectedPaths) if (actual.get(relative) !== expected.get(relative)) fail('R5_EDGE_GENERATED_OUTPUT_DRIFT', relative);
}
function compareGeneratedOutputs(actualBase, expectedBase) {
  assertGeneratedOutputSnapshots(generatedOutputSnapshot(actualBase), generatedOutputSnapshot(expectedBase));
}
function yamlAsJson(file) {
  const result = spawnSync("ruby", ["-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.load_file(ARGV[0]))", file], { encoding: "utf8" });
  if (result.status !== 0) fail("R5_EDGE_HERITAGE_YAML_INVALID", `${file}:${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}
function pointer(pathValue) {
  if (typeof pathValue !== "string" || pathValue.length === 0) fail("R5_EDGE_JSON_POINTER_TOKEN_INVALID");
  return pathValue.replaceAll("~", "~0").replaceAll("/", "~1");
}
function clone(value) { return structuredClone(value); }
const uuidReferenceExceptions = new Set(["sourceOrderRef", "sourceRecordRef", "sourceItemRef", "optionSourceRef"]);
const isUuidReferenceName = (name) => typeof name === "string" && name.endsWith("Ref") && !uuidReferenceExceptions.has(name);
function applyUuidReferenceFormat(schema, name) {
  const next = clone(schema);
  const scalarString = next?.type === "string"
    || (Array.isArray(next?.type) && next.type.includes("string") && next.type.every((type) => type === "string" || type === "null"));
  if (isUuidReferenceName(name) && scalarString && !next.format) next.format = "uuid";
  if (name === "mediaRefs" && next?.type === "array" && next.items?.type === "string" && !next.items.format) next.items.format = "uuid";
  return next;
}
function annotateUuidReferences(value, propertyName = undefined) {
  if (Array.isArray(value)) return value.map((item) => annotateUuidReferences(item));
  if (!value || typeof value !== "object") return value;
  const annotated = applyUuidReferenceFormat(value, propertyName);
  return Object.fromEntries(Object.entries(annotated).map(([key, item]) => [key, key === "properties" && item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).map(([name, schema]) => [name, annotateUuidReferences(schema, name)]))
    : annotateUuidReferences(item)]));
}
function replaceNames(value, renames) {
  if (Array.isArray(value)) return value.map((item) => replaceNames(item, renames));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [renames[key] || key, replaceNames(item, renames)]));
  }
  return typeof value === "string" ? (renames[value] || value) : value;
}
function convertSymbolRefs(value) {
  if (Array.isArray(value)) return value.map(convertSymbolRefs);
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convertSymbolRefs(item)]));
  if (Object.hasOwn(result, "ref")) {
    // `ref` is also a legitimate business property name inside a JSON-schema
    // `properties` map. Treat only the compact symbol-reference shape as a
    // reference; recurse through ordinary property maps unchanged.
    const symbolReferenceShape = Object.keys(result).every((key) => key === "ref" || ["nullable", "description"].includes(key));
    if (symbolReferenceShape) {
      if (typeof result.ref !== "string") fail("R5_EDGE_SYMBOL_REF_INVALID");
      const {ref, ...annotations} = result;
      return { $ref: `#/components/schemas/${ref}`, ...annotations };
    }
  }
  return result;
}
function removeProperty(schema, property) {
  if (Array.isArray(schema)) {
    for (const item of schema) removeProperty(item, property);
    return;
  }
  if (!schema || typeof schema !== "object") return;
  if (schema.properties) delete schema.properties[property];
  if (Array.isArray(schema.required)) schema.required = schema.required.filter((name) => name !== property);
  for (const value of Object.values(schema)) removeProperty(value, property);
}
function inlineMissingReferences(value, knownComponents, sourceSchemas, renames, forbiddenPropertiesForComponent, resolving = new Set()) {
  if (Array.isArray(value)) return value.map((item) => inlineMissingReferences(item, knownComponents, sourceSchemas, renames, forbiddenPropertiesForComponent, resolving));
  if (!value || typeof value !== "object") return value;
  if (typeof value.$ref === "string" && value.$ref.includes("#/components/schemas/")) {
    const name = value.$ref.slice(value.$ref.lastIndexOf("#/components/schemas/") + "#/components/schemas/".length);
    if (!knownComponents.has(name)) {
      if (resolving.has(name) || !sourceSchemas.has(name)) fail("R5_EDGE_COMPONENT_REF_UNRESOLVED", name);
      resolving.add(name);
      const replacement = replaceNames(clone(sourceSchemas.get(name)), renames);
      for (const property of forbiddenPropertiesForComponent(name)) removeProperty(replacement, property);
      const resolved = inlineMissingReferences(convertSymbolRefs(replacement), knownComponents, sourceSchemas, renames, forbiddenPropertiesForComponent, resolving);
      resolving.delete(name);
      return resolved;
    }
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inlineMissingReferences(item, knownComponents, sourceSchemas, renames, forbiddenPropertiesForComponent, resolving)]));
}
function addRequired(schema, names) {
  schema.required = [...new Set([...(schema.required || []), ...names])];
}
function addNestedProperties(schema, additions, components, sourceSchemas) {
  for (const [parent, properties] of Object.entries(additions || {})) {
    let nested = schema.properties?.[parent];
    if (nested?.$ref?.startsWith("#/components/schemas/")) {
      const name = nested.$ref.slice("#/components/schemas/".length);
      const resolved = components.get(name) || sourceSchemas.get(name);
      if (!resolved) fail("R5_EDGE_NESTED_PROPERTY_PARENT_UNRESOLVED", parent);
      nested = clone(resolved);
      schema.properties[parent] = nested;
    }
    if (!nested || typeof nested !== "object" || !nested.properties || typeof nested.properties !== "object") {
      fail("R5_EDGE_NESTED_PROPERTY_PARENT_UNRESOLVED", parent);
    }
    nested.properties = { ...nested.properties, ...clone(properties) };
  }
}
function addEnumValues(schema, propertyName, values) {
  if (Array.isArray(schema)) {
    for (const item of schema) addEnumValues(item, propertyName, values);
    return;
  }
  if (!schema || typeof schema !== "object") return;
  if (schema.properties?.[propertyName]?.enum && Array.isArray(values)) {
    schema.properties[propertyName].enum = [...new Set([...schema.properties[propertyName].enum, ...values])];
  }
  for (const value of Object.values(schema)) addEnumValues(value, propertyName, values);
}
function resolveCapability(operation, placement) {
  const override = placement.operationOverrides[operation.operationId];
  const capability = override?.capability || placement.pageKeyToCapability[operation.pageKey];
  if (!capability) fail("R5_EDGE_CAPABILITY_UNRESOLVED", operation.operationId);
  const pathFile = override?.pathFile || `paths/${operation.face}/${capability}.paths.json`;
  return { capability, pathFile };
}
function resolveComponentFile(component, placement) {
  const exact = placement.exactComponentOverrides[component];
  if (exact) return exact;
  const matching = placement.componentFamilyRules.filter((rule) => new RegExp(rule.match).test(component));
  if (matching.length !== 1) fail(matching.length === 0 ? "R5_EDGE_COMPONENT_UNRESOLVED" : "R5_EDGE_COMPONENT_AMBIGUOUS", component);
  const family = matching[0].family;
  const owner = placement.familyToOwner[family];
  if (!owner) fail("R5_EDGE_COMPONENT_OWNER_UNRESOLVED", component);
  return `components/${owner}/${family}.schemas.json`;
}
function security(operation) {
  if (operation.security === "NONE") return [];
  if (operation.security === "PLATFORM_SESSION_COOKIE") return [{ platformSessionCookie: [] }];
  if (operation.security === "OPERATIONS_SESSION_COOKIE") return [{ operationsSessionCookie: [] }];
  fail("R5_EDGE_SECURITY_UNRESOLVED", operation.operationId);
}
function successContentType(operation) {
  if (operation.responseSchema === "NoContent") return null;
  if (operation.responseSchema === "BinaryAssetContent") return "application/octet-stream";
  return "application/json";
}
function requestContentType(operation) {
  if (operation.requestSchema === "NoBody") return null;
  const contentType = operation.requestContentType || "application/json";
  if (!["application/json", "multipart/form-data"].includes(contentType)) {
    fail("R5_EDGE_REQUEST_MEDIA_TYPE_INVALID", `${operation.operationId}:${contentType}`);
  }
  return contentType;
}
function operationErrors(operation, catalog) {
  const selection = catalog.operationErrorSelectionRules[operation.operationId];
  if (selection?.mode === "REPLACE_BASE_WITH_AUGMENTATION") return catalog.operationErrorAugmentations[operation.operationId] || [];
  return [...new Set([...(catalog.errorSets[operation.errorSetRef] || []), ...(catalog.operationErrorAugmentations[operation.operationId] || [])])].sort();
}
function operationIdentity(operation) {
  return [operation.operationId, operation.method, operation.path, operation.face, operation.owner].join("|");
}
function authorizationRequirements(manifest) {
  const requirements = new Map();
  for (const requirement of manifest.requirements || []) {
    const identity = requirement.operationIdentity;
    if (!identity) continue;
    const key = [identity.operationId, identity.method, identity.path, identity.consumerFace, identity.ownerModule].join("|");
    if (requirements.has(key)) fail("R5_EDGE_AUTHORIZATION_REQUIREMENT_DUPLICATE", key);
    requirements.set(key, requirement);
  }
  return requirements;
}
function operationDocument(operation, catalog, requirements, pathFile) {
  const parameters = [
    ...(operation.pathParameters || []).map((name) => ({ name, in: "path", required: true, schema: applyUuidReferenceFormat({ type: "string", minLength: 1, maxLength: 128 }, name) })),
    ...(operation.queryParameters || []).map((parameter) => ({ in: "query", ...clone(parameter), schema: applyUuidReferenceFormat(convertSymbolRefs(parameter.schema), parameter.name) })),
    ...(operation.headerParameters || []).map((parameter) => ({ ...clone(parameter), schema: applyUuidReferenceFormat(convertSymbolRefs(parameter.schema), parameter.name) })),
  ];
  if (operation.idempotency.header === "REQUIRED_16_128") parameters.push({ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 16, maxLength: 128 } });
  if (operation.idempotency.header !== "REQUIRED_16_128" && operation.idempotency.header !== "FORBIDDEN") fail("R5_EDGE_IDEMPOTENCY_POLICY_INVALID", operation.operationId);
  const successType = successContentType(operation);
  const response = successType ? { description: "Owner readback", content: { [successType]: { schema: { $ref: `#/components/schemas/${operation.responseSchema}` } } } } : { description: "No content" };
  const responses = { [operation.successStatus]: response };
  const problemResponseRef = `${path.posix.relative(path.posix.dirname(pathFile), "edge.openapi.json")}#/components/responses/ProblemResponse`;
  for (const status of ["400", "401", "403", "404", "409", "429", "500"]) responses[status] = { $ref: problemResponseRef };
  const document = {
    operationId: operation.operationId,
    tags: [operation.owner],
    "x-consumer-faces": [operation.face],
    "x-owner-module": operation.owner,
    "x-scenario-ids": operation.scenarioIds,
    "x-page-key": operation.pageKey,
    "x-idempotency-policy": operation.idempotency.header,
    "x-error-codes": operationErrors(operation, catalog),
    security: security(operation),
    parameters,
    responses,
  };
  if (["REQUIRED", "REQUIRED_CONTEXT_VERSION"].includes(operation.expectedVersion)) {
    document["x-expected-version-policy"] = operation.expectedVersion;
  }
  const requirement = requirements.get(operationIdentity(operation));
  if (requirement && writeMethods.has(operation.method)) {
    if (requirement.authorizationMode === "AUTHENTICATED_PLATFORM_SUPER_ADMIN") {
      document["x-required-platform-authorization"] = requirement.requirementId;
    } else if (requirement.authorizationMode === "PUBLIC_PROTOCOL") {
      document["x-required-owner-protocol"] = requirement.requirementId;
    } else if (requirement.authorizationMode === "AUTHENTICATED_WORKSPACE") {
      document["x-required-capability"] = requirement.requirementId;
    } else {
      fail("R5_EDGE_AUTHORIZATION_MODE_UNRESOLVED", operation.operationId);
    }
  }
  const requestType = requestContentType(operation);
  if (requestType) document.requestBody = { required: true, content: { [requestType]: { schema: { $ref: `#/components/schemas/${operation.requestSchema}` } } } };
  return document;
}
function collectSourceSchemas(catalog) {
  const schemas = new Map();
  const ranks = new Map();
  for (const source of catalog.sources) {
    const absolute = path.resolve(root, source.path);
    if (!fs.existsSync(absolute)) fail("R5_EDGE_HERITAGE_SOURCE_MISSING", source.path);
    if (sha256(absolute) !== source.sha256) fail("R5_EDGE_HERITAGE_HASH_DRIFT", source.path);
    const document = yamlAsJson(absolute);
    const rank = source.path.includes("/components/") ? 0 : (source.path.includes("wire-model") ? 1 : 2);
    for (const [name, schema] of Object.entries(document.components?.schemas || {})) {
      if (schemas.has(name)) {
        const currentRank = ranks.get(name);
        if (rank > currentRank) continue;
        if (rank === currentRank && JSON.stringify(schemas.get(name)) !== JSON.stringify(schema)) fail("R5_EDGE_HERITAGE_COMPONENT_AMBIGUOUS", name);
      }
      schemas.set(name, schema);
      ranks.set(name, rank);
    }
  }
  return schemas;
}
function materializeComponents(catalog, placement) {
  const sourceSchemas = collectSourceSchemas(catalog);
  const components = new Map();
  for (const [name, baseline] of Object.entries(catalog.componentFieldBaseline)) {
    if (baseline.ref) {
      if (baseline.ref !== name || !sourceSchemas.has(name)) fail("R5_EDGE_BASELINE_REF_UNRESOLVED", name);
      components.set(name, clone(sourceSchemas.get(name)));
    } else {
      components.set(name, convertSymbolRefs(clone(baseline)));
    }
  }
  components.set("NoBody", { type: "object", additionalProperties: false });
  components.set("NoContent", { type: "null" });
  const forbiddenPropertiesForComponent = (name) => {
    const preserved = new Set(catalog.componentOverrides[name]?.preserveProperties || []);
    return (catalog.componentOverrides.forbiddenProperties || []).filter((property) => !preserved.has(property));
  };
  for (const [name, override] of Object.entries(catalog.componentOverrides)) {
    if (["globalRenames", "forbiddenProperties", "forbiddenSymbols", "sourceResolution", "propertyPolicies", "zeroReferenceClosure", "StoreContractDateFields", "readbackMinimum"].includes(name)) continue;
    const prior = components.get(name) || {};
    let next = clone(prior);
    if (["Problem", "EpochMillis", "ServiceNodeType", "ProjectPhaseNames", "WorkspaceRoleAuthorizationReplaceRequest", "StoreContractItem"].includes(name)) next = { type: override.type, ...(override.enum ? { enum: override.enum } : {}), ...(override.required ? { required: override.required } : {}), ...(override.properties ? { properties: override.properties } : {}), ...(override.additionalProperties !== undefined ? { additionalProperties: override.additionalProperties } : {}) };
    if (override.removeProperties) for (const property of override.removeProperties) removeProperty(next, property);
    if (override.required) next.required = clone(override.required);
    if (override.requiredAdditions) addRequired(next, override.requiredAdditions);
    if (override.properties) next.properties = { ...(next.properties || {}), ...clone(override.properties) };
    if (override.nestedPropertyAdditions) addNestedProperties(next, override.nestedPropertyAdditions, components, sourceSchemas);
    if (override.requiredNestedReferences) {
      next.properties = { ...(next.properties || {}) };
      for (const rule of override.requiredNestedReferences) next.properties[rule.property] = clone(rule);
    }
    if (override.type && !next.type) next.type = override.type;
    if (override.additionalProperties !== undefined) next.additionalProperties = override.additionalProperties;
    if (override.enum) next.enum = clone(override.enum);
    components.set(name, next);
  }
  for (const [name, schema] of components) {
    const renamed = replaceNames(schema, catalog.componentOverrides.globalRenames);
    Object.keys(schema).forEach((key) => delete schema[key]);
    Object.assign(schema, convertSymbolRefs(renamed));
    for (const property of forbiddenPropertiesForComponent(name)) removeProperty(schema, property);
  }
  const generated = ["Problem", "EpochMillis", "ServiceNodeType", "ProjectPhaseNames", "WorkspaceRoleAuthorizationReplaceRequest"];
  for (const name of generated) if (!components.has(name)) fail("R5_EDGE_GENERATED_COMPONENT_MISSING", name);
  for (const [name, schema] of components) {
    const inlined = annotateUuidReferences(inlineMissingReferences(schema, components, sourceSchemas, catalog.componentOverrides.globalRenames, forbiddenPropertiesForComponent));
    const override = catalog.componentOverrides[name];
    if (override?.enumAdditions) {
      for (const [propertyName, values] of Object.entries(override.enumAdditions)) addEnumValues(inlined, propertyName, values);
    }
    components.set(name, inlined);
  }
  const files = new Map();
  for (const [name, schema] of components) {
    if (name === "BusinessEntitySource") continue;
    const file = resolveComponentFile(name, placement);
    if (!files.has(file)) files.set(file, {});
    files.get(file)[name] = schema;
  }
  return { components, files };
}
function rewriteRefs(value, currentFile, componentFiles) {
  if (Array.isArray(value)) return value.map((item) => rewriteRefs(item, currentFile, componentFiles));
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteRefs(item, currentFile, componentFiles)]));
  const schemaReference = typeof result.$ref === "string"
    ? result.$ref.match(/#\/components\/schemas\/([^/]+)$/)?.[1]
    : undefined;
  if (schemaReference) {
    const component = schemaReference;
    const target = componentFiles.get(component);
    if (!target) fail("R5_EDGE_COMPONENT_REF_UNRESOLVED", component);
    result.$ref = target === currentFile ? `#/components/schemas/${component}` : `${path.posix.relative(path.posix.dirname(currentFile), target)}#/components/schemas/${component}`;
  }
  return result;
}
function materialize(rootDir = root, writeOutputs = true) {
  const catalog = projectEdgeCatalog(readJson(catalogPath, rootDir)).catalog;
  const placement = readJson(placementPath, rootDir);
  const errors = readJson(errorCatalogPath, rootDir);
  const requirements = authorizationRequirements(readJson(authorizationManifestPath, rootDir));
  const expectedOperationCount = catalog.denominator?.operations;
  if (!Number.isInteger(expectedOperationCount) || catalog.operations.length !== expectedOperationCount || placement.closure.expectedResolvedOperationCount !== expectedOperationCount) fail("R5_EDGE_OPERATION_DENOMINATOR_DRIFT");
  const operationRows = catalog.operations.map((operation) => ({ ...operation, ...resolveCapability(operation, placement) }));
  const ids = new Set(operationRows.map((operation) => operation.operationId));
  if (ids.size !== expectedOperationCount) fail("R5_EDGE_OPERATION_DUPLICATE");
  const counts = Object.fromEntries(["platform-admin", "operations-admin", "public"].map((face) => [face, operationRows.filter((operation) => operation.face === face).length]));
  if (JSON.stringify(counts) !== JSON.stringify(placement.closure.faceCounts)) fail("R5_EDGE_FACE_DENOMINATOR_DRIFT");
  const { components, files } = materializeComponents(catalog, placement);
  const componentFiles = new Map([...files.entries()].flatMap(([file, entries]) => Object.keys(entries).map((name) => [name, file])));
  const pathFiles = new Map();
  for (const operation of operationRows) {
    if (!pathFiles.has(operation.pathFile)) pathFiles.set(operation.pathFile, {});
    const routes = pathFiles.get(operation.pathFile);
    routes[operation.path] ||= {};
    const method = operation.method.toLowerCase();
    if (routes[operation.path][method]) fail("R5_EDGE_ROUTE_METHOD_DUPLICATE", operation.operationId);
    routes[operation.path][method] = operationDocument(operation, catalog, requirements, operation.pathFile);
  }
  const rootPaths = {};
  for (const [file, routes] of pathFiles) for (const route of Object.keys(routes)) {
    if (rootPaths[route]) fail("R5_EDGE_PATH_SPLIT_ACROSS_FILES", route);
    rootPaths[route] = { $ref: `./${file}#/paths/${pointer(route)}` };
  }
  const edge = {
    openapi: "3.1.0",
    info: { title: "catering-v2s R5 edge API", version: "0.5.0" },
    paths: rootPaths,
    components: {
      securitySchemes: {
        platformSessionCookie: { type: "apiKey", in: "cookie", name: "V2S_PLATFORM_SESSION" },
        operationsSessionCookie: { type: "apiKey", in: "cookie", name: "V2S_OPERATIONS_SESSION" }
      },
      schemas: Object.fromEntries([...componentFiles.entries()].map(([name, file]) => [name, { $ref: `./${file}#/components/schemas/${name}` }])),
      responses: { ProblemResponse: { description: "Typed problem", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } } } }
    }
  };
  const report = {
    kind: "R5_U01_EDGE_PLACEMENT_RESOLUTION",
    status: "GENERATED_FROM_ACCEPTED_CATALOG",
    source: { catalog: catalogPath, placement: placementPath, errorCatalog: errorCatalogPath, authorizationManifest: authorizationManifestPath },
    closure: { operations: operationRows.length, faceCounts: counts, componentBaseline: Object.keys(catalog.componentFieldBaseline).length, componentFiles: files.size, unreachable: [{ component: "BusinessEntitySource", disposition: "NOT_CARRIED_NO_EXTERNAL_SYNC_SOURCE" }] },
    operations: operationRows.map(({ operationId, face, owner, method, path: route, capability, pathFile, requestSchema, responseSchema, errorSetRef }) => ({ operationId, face, owner, method, path: route, capability, pathFile, requestComponentFile: requestSchema === "NoBody" ? "components/common/empty.schemas.json" : componentFiles.get(requestSchema), responseComponentFile: responseSchema === "NoContent" ? "components/common/empty.schemas.json" : componentFiles.get(responseSchema), errorSetRef })),
    requiredNestedReferenceChecks: placement.resolvedFieldContract.requiredNestedReferenceChecks
  };
  const result = { edge, files, pathFiles, report, errors, componentFiles };
  if (writeOutputs) {
    write("contracts/openapi/edge.openapi.json", edge, rootDir);
    for (const [file, entries] of files) write(path.posix.join(generatedRoot, file), { components: { schemas: rewriteRefs(entries, file, componentFiles) } }, rootDir);
    for (const [file, routes] of pathFiles) write(path.posix.join(generatedRoot, file), { paths: rewriteRefs(routes, file, componentFiles) }, rootDir);
    write(outputReport, report, rootDir);
  }
  return result;
}
function check() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-r5-edge-"));
  try {
    fs.cpSync(root, scratch, { recursive: true, filter: (file) => !file.includes("/build") && !file.includes("/dist") && !file.includes("/.git") });
    const materialized = materialize(scratch, true);
    compareGeneratedOutputs(root, scratch);
    const report = fs.readFileSync(path.join(root, outputReport), "utf8");
    const expectedReport = fs.readFileSync(path.join(scratch, outputReport), "utf8");
    if (report !== expectedReport) fail("R5_EDGE_RESOLUTION_REPORT_DRIFT");
    process.stdout.write(`R5_EDGE_MATERIALIZE_CHECK=PASS\nOPERATIONS=${materialized.report.closure.operations}\nFACES=${Object.values(materialized.report.closure.faceCounts).join("/")}\n`);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}
function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-r5-edge-red-"));
  try {
    const route = "/api/public/path~token";
    const rootReference = `#/paths/${pointer(route)}`;
    if (rootReference !== "#/paths/~1api~1public~1path~0token") fail("R5_EDGE_JSON_POINTER_TOKEN_RED_NOT_DETECTED");
    const nestedCommandSchema = {
      allOf: [{
        type: "object",
        required: ["expectedVersion", "expectedContextVersion"],
        properties: { expectedVersion: { type: "integer" }, expectedContextVersion: { type: "integer" } },
      }],
    };
    removeProperty(nestedCommandSchema, "expectedContextVersion");
    if (JSON.stringify(nestedCommandSchema).includes("expectedContextVersion")) {
      fail("R5_EDGE_NESTED_FORBIDDEN_PROPERTY_RED_NOT_DETECTED");
    }
    const relativeComponentReference = rewriteRefs(
      { $ref: "./platform-time.schemas.json#/components/schemas/EpochMillis" },
      "components/workspace-iam/workspace-access.schemas.json",
      new Map([["EpochMillis", "components/common/time.schemas.json"]]),
    ).$ref;
    if (relativeComponentReference !== "../common/time.schemas.json#/components/schemas/EpochMillis") {
      fail("R5_EDGE_RELATIVE_COMPONENT_REFERENCE_RED_NOT_DETECTED");
    }
    fs.cpSync(root, scratch, { recursive: true, filter: (file) => !file.includes("/build") && !file.includes("/dist") && !file.includes("/.git") });
    const requiredDataNodeTypeEnums = (value, result = []) => {
      if (Array.isArray(value)) {
        for (const item of value) requiredDataNodeTypeEnums(item, result);
      } else if (value && typeof value === "object") {
        if (value.properties?.requiredDataNodeType?.enum) result.push(value.properties.requiredDataNodeType.enum);
        for (const child of Object.values(value)) requiredDataNodeTypeEnums(child, result);
      }
      return result;
    };
    materialize(scratch, true);
    const sessionOutput = yamlAsJson(path.join(scratch, generatedRoot, "components/workspace-iam/workspace-session.schemas.json"));
    const sessionEnums = requiredDataNodeTypeEnums(sessionOutput);
    if (sessionEnums.length < 2 || sessionEnums.some((values) => !values.includes("HEAD_COMPANY"))) {
      fail("R5_EDGE_SESSION_REQUIRED_DATA_NODE_TYPE_HEAD_COMPANY_MISSING");
    }
    const accessOutput = yamlAsJson(path.join(scratch, generatedRoot, "components/workspace-iam/workspace-access.schemas.json"));
    const rolePageEnums = requiredDataNodeTypeEnums(accessOutput.components?.schemas?.WorkspaceRolePage);
    if (rolePageEnums.length !== 1 || !rolePageEnums[0].includes("HEAD_COMPANY")) {
      fail("R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_HEAD_COMPANY_MISSING");
    }
    const acceptedCatalog = readJson(catalogPath, scratch);
    const enumMutation = clone(acceptedCatalog);
    enumMutation.componentOverrides.WorkspaceSessionEntry.enumAdditions.requiredDataNodeType = [];
    enumMutation.componentOverrides.WorkspaceRolePage.enumAdditions.requiredDataNodeType = [];
    write(catalogPath, enumMutation, scratch);
    materialize(scratch, true);
    const mutatedSession = yamlAsJson(path.join(scratch, generatedRoot, "components/workspace-iam/workspace-session.schemas.json"));
    const mutatedEnums = requiredDataNodeTypeEnums(mutatedSession);
    if (mutatedEnums.some((values) => values.includes("HEAD_COMPANY"))) {
      fail("R5_EDGE_SESSION_REQUIRED_DATA_NODE_TYPE_RED_NOT_DETECTED");
    }
    const mutatedAccess = yamlAsJson(path.join(scratch, generatedRoot, "components/workspace-iam/workspace-access.schemas.json"));
    const mutatedRolePageEnums = requiredDataNodeTypeEnums(mutatedAccess.components?.schemas?.WorkspaceRolePage);
    if (mutatedRolePageEnums.some((values) => values.includes("HEAD_COMPANY"))) {
      fail("R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_RED_NOT_DETECTED");
    }
    write(catalogPath, acceptedCatalog, scratch);
    const catalog = readJson(catalogPath, scratch);
    catalog.operations[0].pageKey = "UNKNOWN-PAGE";
    write(catalogPath, catalog, scratch);
    try { materialize(scratch, true); fail("R5_EDGE_MATERIALIZE_RED_NOT_DETECTED"); } catch (error) { if (!String(error.message).includes("R5_EDGE_CAPABILITY_UNRESOLVED")) throw error; }
    const expectedOutputs = generatedOutputSnapshot(scratch);
    const pathOutput = path.join(scratch, generatedRoot, "paths/operations-admin/store-management.paths.json");
    fs.appendFileSync(pathOutput, "\n");
    try { assertGeneratedOutputSnapshots(generatedOutputSnapshot(scratch), expectedOutputs); fail("R5_EDGE_PATH_OUTPUT_DRIFT_RED_NOT_DETECTED"); } catch (error) { if (!String(error.message).includes("R5_EDGE_GENERATED_OUTPUT_DRIFT")) throw error; }
    fs.writeFileSync(pathOutput, expectedOutputs.get("paths/operations-admin/store-management.paths.json"));
    const componentOutput = path.join(scratch, generatedRoot, "components/organization/store.schemas.json");
    fs.appendFileSync(componentOutput, "\n");
    try { assertGeneratedOutputSnapshots(generatedOutputSnapshot(scratch), expectedOutputs); fail("R5_EDGE_COMPONENT_OUTPUT_DRIFT_RED_NOT_DETECTED"); } catch (error) { if (!String(error.message).includes("R5_EDGE_GENERATED_OUTPUT_DRIFT")) throw error; }
    process.stdout.write("R5_EDGE_MATERIALIZE_SELF_TEST=PASS\nRED=R5_EDGE_JSON_POINTER_TOKEN_RED_NOT_DETECTED,R5_EDGE_NESTED_FORBIDDEN_PROPERTY_RED_NOT_DETECTED,R5_EDGE_RELATIVE_COMPONENT_REFERENCE_RED_NOT_DETECTED,R5_EDGE_SESSION_REQUIRED_DATA_NODE_TYPE_HEAD_COMPANY_MISSING,R5_EDGE_SESSION_REQUIRED_DATA_NODE_TYPE_RED_NOT_DETECTED,R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_HEAD_COMPANY_MISSING,R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_RED_NOT_DETECTED,R5_EDGE_CAPABILITY_UNRESOLVED,R5_EDGE_PATH_OUTPUT_DRIFT_RED_NOT_DETECTED,R5_EDGE_COMPONENT_OUTPUT_DRIFT_RED_NOT_DETECTED\n");
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

try {
  if (process.argv.includes("--check")) check();
  else if (process.argv.includes("--self-test")) selfTest();
  else { const result = materialize(); process.stdout.write(`R5_EDGE_MATERIALIZE=PASS\nOPERATIONS=${result.report.closure.operations}\nFACES=${Object.values(result.report.closure.faceCounts).join("/")}\n`); }
} catch (error) {
  process.stderr.write(`R5_EDGE_MATERIALIZE=FAIL\nREASON=${error.message}\n`);
  process.exitCode = 1;
}
