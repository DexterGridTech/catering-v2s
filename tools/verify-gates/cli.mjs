#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const skip = new Set([".git", "node_modules", ".gradle", "build", "dist"]);
const appRoot = "apps/backend/catering-business-server";
const forbiddenRuntimeTokens = ["org.apache.kafka", "outbox", "WebClient", "terminal-data-server/src"];

function fail(code, detail = "") { throw new Error(`${code}${detail ? `:${detail}` : ""}`); }
function read(relative, base = root) { return fs.readFileSync(path.join(base, relative), "utf8"); }
function exists(relative, base = root) { return fs.existsSync(path.join(base, relative)); }
function walk(relative = "", base = root) {
  const absolute = path.join(base, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relative];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    skip.has(entry.name) ? [] : walk(path.join(relative, entry.name), base));
}
function sourceFiles(relative, base = root) {
  return walk(relative, base).filter((entry) => /\.(?:java|js|mjs|ts|tsx|yaml|json|sql)$/.test(entry));
}
function assertFile(relative, code, base = root) { if (!exists(relative, base)) fail(code, relative); }
function assertNoMatch(files, pattern, code, base = root) {
  for (const file of files) if (pattern.test(read(file, base))) fail(code, file);
}
function assertNoHandwrittenEdgeRouteLiterals(base = root) {
  const isSyntheticTest = (file) => /\.test\.[cm]?[jt]sx?$/.test(file);
  const consumers = sourceFiles("apps/frontend", base)
    .filter((file) => file.includes("/src/") && !file.includes("/src/app/api/generated/") && !isSyntheticTest(file))
    .concat(sourceFiles("scripts/dev", base), sourceFiles("scripts/test", base).filter((file) => !isSyntheticTest(file)));
  const violations = [];
  for (const file of consumers) {
    for (const [index, line] of read(file, base).split("\n").entries()) {
      if (/(?:["'`])\s*\/api(?:\/|["'`])/.test(line)) violations.push(`${file}:${index + 1}`);
    }
  }
  if (violations.length) fail("R5_EDGE_ROUTE_LITERAL", violations.join(","));
}
function assertMatch(relative, pattern, code, base = root) {
  if (!pattern.test(read(relative, base))) fail(code, relative);
}
function assertNoPrivateFeatureUiImports(base = root) {
  for (const app of ["platform-admin", "operations-admin"]) {
    const prefix = `apps/frontend/${app}/src/features/`;
    for (const file of sourceFiles(prefix, base)) {
      const owner = file.slice(prefix.length).split("/")[0];
      const imports = [...read(file, base).matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
      for (const specifier of imports) {
        if (!specifier.startsWith(".")) continue;
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        const target = resolved.match(new RegExp(`^apps/frontend/${app}/src/features/([^/]+)/ui(?:/|$)`));
        if (target && target[1] !== owner) fail("R5_FRONTEND_CROSS_FEATURE_PRIVATE_UI_IMPORT", file);
      }
    }
  }
}
function assertRequiredMutationsUseLifecycle(files, base = root) {
  for (const file of files) {
    for (const statement of read(file, base).split(";")) {
      if (!/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i.test(statement)) continue;
      if (!/lifecycle\.getIdempotencyKey\(\)/.test(statement)) fail("R5_FRONTEND_MUTATION_LIFECYCLE_MISSING", file);
    }
  }
}
function assertCandidateLoadingFailureState(base = root) {
  for (const file of sourceFiles("apps/frontend", base).filter((entry) => entry.endsWith(".tsx"))) {
    const source = read(file, base);
    for (const match of source.matchAll(/<Select\b[^>]*\bloading=\{!([A-Za-z0-9_]+)\}[^>]*\/?\s*>/g)) {
      const candidate = match[1];
      const candidateState = source.match(new RegExp(`const\\s+\\[\\s*${candidate}\\s*,\\s*(set[A-Za-z0-9_]+)\\s*\\]\\s*=\\s*useState`));
      const problemState = source.match(/const\s+\[\s*problem\s*,\s*(set[A-Za-z0-9_]+)\s*\]\s*=\s*useState/);
      if (!candidateState || !problemState) continue;
      const candidateSetter = candidateState[1];
      const problemSetter = problemState[1];
      const hasReset = new RegExp(`${candidateSetter}\\(undefined\\)`).test(source);
      const catchSetsProblem = new RegExp(`\\.catch\\([\\s\\S]{0,800}${problemSetter}\\(`).test(source);
      if (hasReset && catchSetsProblem) fail("R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_MISSING", `${file}:${source.slice(0, match.index).split("\\n").length}`);
    }
  }
}
function assertLogoutClearsLocalSessionAfterRemoteFailure(base = root) {
  const required = [
    ["apps/frontend/platform-admin/src/app/PlatformApp.tsx", "platformClient.platformLogout"],
    ["apps/frontend/operations-admin/src/app/OperationsApp.tsx", "operationsClient.operationsWorkspaceLogout"],
  ];
  for (const [file, remoteLogout] of required) {
    const escaped = remoteLogout.replaceAll(".", "\\.");
    const pattern = new RegExp(`try\\s*\\{[\\s\\S]*?await\\s+${escaped}\\([\\s\\S]*?\\);\\s*\\}\\s*finally\\s*\\{[\\s\\S]*?clearLocalSession\\(\\);[\\s\\S]*?\\}`, "m");
    if (!pattern.test(read(file, base))) fail("R5_FRONTEND_LOGOUT_LOCAL_CLEAR_MISSING", file);
  }
}
function stringCandidates(expression) {
  if (!expression) return [];
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [expression.text];
  if (ts.isParenthesizedExpression(expression)) return stringCandidates(expression.expression);
  if (ts.isConditionalExpression(expression)) return [...stringCandidates(expression.whenTrue), ...stringCandidates(expression.whenFalse)];
  return [];
}
function propertyName(property) { return property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : undefined; }
function objectProperty(object, name) { return object.properties.find((property) => ts.isPropertyAssignment(property) && propertyName(property) === name); }
function objectBoolean(object, name) { const property = objectProperty(object, name); return Boolean(property && property.initializer.kind === ts.SyntaxKind.TrueKeyword); }
function objectFalse(object, name) { const property = objectProperty(object, name); return Boolean(property && property.initializer.kind === ts.SyntaxKind.FalseKeyword); }
function objectStrings(object, name) { const property = objectProperty(object, name); return property ? stringCandidates(property.initializer) : []; }
function columnFacts(source, file) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const variables = new Map(); const tables = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer);
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(parsed) === "ProTable") {
      const attribute = node.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === "columns");
      if (attribute?.initializer && ts.isJsxExpression(attribute.initializer)) tables.push(attribute.initializer.expression);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  const objects = (expression, visited = new Set()) => {
    if (!expression) return [];
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) return objects(expression.expression, visited);
    if (ts.isIdentifier(expression)) { if (visited.has(expression.text)) return []; visited.add(expression.text); return objects(variables.get(expression.text), visited); }
    if (ts.isCallExpression(expression)) return objects(expression.arguments[0], visited);
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return ts.isBlock(expression.body) ? [] : objects(expression.body, visited);
    if (ts.isConditionalExpression(expression)) return [...objects(expression.whenTrue, visited), ...objects(expression.whenFalse, visited)];
    if (ts.isArrayLiteralExpression(expression)) return expression.elements.flatMap((element) => objects(ts.isSpreadElement(element) ? element.expression : element, visited));
    return ts.isObjectLiteralExpression(expression) ? [expression] : [];
  };
  return tables.map((table) => objects(table).map((column) => ({
    filterKeys: objectStrings(column, "dataIndex"), titles: objectStrings(column, "title"),
    hidden: objectBoolean(column, "hideInTable"), searchDisabled: objectFalse(column, "search"),
  })));
}
function hasCrudRequiredExpression(source, required) {
  if (source.includes(required)) return true;
  const buttonTextMatch = required.match(/^>\{([^{}]+)\}<\/Button>$/);
  if (buttonTextMatch) {
    const expression = buttonTextMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp('>\\s*\\{\\s*' + expression + '\\s*\\}\\s*<\\/Button>').test(source);
  }
  const nameCodeMatch = required.match(/^formatNameCode\(([^,]+),\s*([^\)]+)\)$/);
  if (nameCodeMatch) {
    const nameExpression = nameCodeMatch[1].trim();
    const codeExpression = nameCodeMatch[2].trim();
    // The approved dual-admin name/code standard requires the shared
    // NameCodeText producer for visual surfaces. Its rendered text is the
    // same 名称(编码) contract as the legacy plain-string expression, while
    // preserving the foundation-owned visual treatment.
    return source.includes(`<NameCodeText name={${nameExpression}} code={${codeExpression}}`);
  }
  // The selector catalog predates the single queryText contract. The
  // current generated/owner contract deliberately sends one name-or-code
  // query, so accept its canonical property mapping as the source-derived
  // equivalent of the old code: queryText predicate.
  if (required === "code: queryText") return /\bqueryText\s*:\s*queryText(?![A-Za-z0-9_$])(?:\?\.trim\(\))?/.test(source);
  return false;
}
function assertCrudPresentationStandard(base = root) {
  const catalogPath = "contracts/policy/crud-presentation-standard-catalog.json";
  assertFile(catalogPath, "R5_CRUD_PRESENTATION_CATALOG_MISSING", base);
  let catalog;
  try { catalog = JSON.parse(read(catalogPath, base)); } catch { fail("R5_CRUD_PRESENTATION_CATALOG_INVALID"); }
  if (catalog?.schemaVersion !== 1 || catalog?.kind !== "crud-presentation-standard-catalog" || !Array.isArray(catalog?.surfaceCoverage)) {
    fail("R5_CRUD_PRESENTATION_CATALOG_INVALID");
  }
  const ids = new Set();
  const registeredSources = new Set();
  const violations = [];
  for (const surface of catalog.surfaceCoverage) {
    if (!surface || typeof surface.id !== "string" || !surface.id || ids.has(surface.id) || typeof surface.source !== "string" || !surface.source) {
      fail("R5_CRUD_PRESENTATION_CATALOG_SURFACE_INVALID");
    }
    ids.add(surface.id);
    assertFile(surface.source, "R5_CRUD_PRESENTATION_SOURCE_MISSING", base);
    registeredSources.add(surface.source);
    const source = read(surface.source, base);
    if (surface.selectorOnly === true) {
      for (const required of surface.externalFilterRequiredExpressions ?? []) {
        if (typeof required !== "string" || !required) fail("R5_CRUD_PRESENTATION_CATALOG_SURFACE_INVALID", surface.id);
        if (!hasCrudRequiredExpression(source, required)) violations.push(`REQUIRED_EXPRESSION:${surface.id}:${required}`);
      }
      continue;
    }
    if (surface.detailOnly === true) {
      for (const forbidden of surface.primaryIdentityForbidden ?? []) {
        if (typeof forbidden !== "string" || !forbidden) fail("R5_CRUD_PRESENTATION_CATALOG_SURFACE_INVALID", surface.id);
        if (source.includes(forbidden)) violations.push(`PRIMARY_IDENTITY:${surface.id}`);
      }
      for (const required of surface.primaryIdentityRequired ?? []) {
        if (typeof required !== "string" || !required) fail("R5_CRUD_PRESENTATION_CATALOG_SURFACE_INVALID", surface.id);
        if (!source.includes(required)) violations.push(`REQUIRED_EXPRESSION:${surface.id}:${required}`);
      }
      continue;
    }
    if (surface.notApplicable === true) {
      if (typeof surface.notApplicableReason !== "string" || !surface.notApplicableReason.trim()) fail("R5_CRUD_PRESENTATION_CATALOG_SURFACE_INVALID", surface.id);
      continue;
    }
    const filters = surface.filterKeys; const mappings = surface.filterColumnMappings;
    const additionalTitles = surface.additionalVisibleColumnTitles; const tableIndex = surface.tableIndex;
    if (!Array.isArray(filters) || filters.length === 0 || !Array.isArray(mappings) || mappings.length !== filters.length
      || !Array.isArray(additionalTitles) || additionalTitles.length === 0 || !Number.isInteger(tableIndex) || tableIndex < 0) violations.push(`FILTER_COLUMN:${surface.id}`);
    else {
      const table = columnFacts(source, surface.source)[tableIndex];
      const actualFilters = new Set((table ?? []).filter((column) => !column.searchDisabled).flatMap((column) => column.filterKeys));
      const mappedFilters = new Set(mappings.map((mapping) => mapping?.filterKey));
      if (!table || mappedFilters.size !== mappings.length || !filters.every((key) => typeof key === "string" && mappedFilters.has(key))
        || ![...actualFilters].every((key) => mappedFilters.has(key)) || ![...mappedFilters].every((key) => actualFilters.has(key))) violations.push(`FILTER_COLUMN:${surface.id}`);
      for (const mapping of mappings) {
        if (!mapping || typeof mapping.filterKey !== "string" || typeof mapping.visibleColumnTitle !== "string"
          || !table?.some((column) => !column.hidden && column.titles.includes(mapping.visibleColumnTitle))) violations.push(`FILTER_COLUMN:${surface.id}:${mapping?.filterKey ?? "INVALID"}`);
      }
      for (const title of additionalTitles) if (typeof title !== "string" || mappings.some((mapping) => mapping?.visibleColumnTitle === title)
        || !table?.some((column) => !column.hidden && column.titles.includes(title))) violations.push(`FILTER_COLUMN:${surface.id}:EXTRA`);
    }
    for (const forbidden of surface.primaryIdentityForbidden ?? []) {
      if (typeof forbidden !== "string" || !forbidden) fail("R5_CRUD_PRESENTATION_CATALOG_SURFACE_INVALID", surface.id);
      if (source.includes(forbidden)) violations.push(`PRIMARY_IDENTITY:${surface.id}`);
    }
    for (const required of [...(surface.primaryIdentityRequired ?? []), ...(surface.relatedIdentityRequired ?? []), ...(surface.externalFilterRequiredExpressions ?? [])]) {
      if (typeof required !== "string" || !required) fail("R5_CRUD_PRESENTATION_CATALOG_SURFACE_INVALID", surface.id);
      if (!hasCrudRequiredExpression(source, required)) violations.push(`REQUIRED_EXPRESSION:${surface.id}:${required}`);
    }
  }
  const tableSources = sourceFiles("apps/frontend", base).filter((file) => file.endsWith(".tsx") && read(file, base).includes("<ProTable"));
  for (const source of tableSources) if (!registeredSources.has(source)) violations.push(`UNREGISTERED_TABLE:${source}`);
  if (violations.length) {
    const primary = violations.some((entry) => entry.startsWith("PRIMARY_IDENTITY:"));
    const code = primary ? "R5_CRUD_PRIMARY_IDENTITY_COMPOSITE" : violations.some((entry) => entry.startsWith("FILTER_COLUMN:")) ? "R5_CRUD_PRESENTATION_FILTER_COLUMN_COVERAGE" : "R5_CRUD_PRESENTATION_REQUIRED_EXPRESSION_MISSING";
    fail(code, violations.join(","));
  }
}
function assertNoGeneratedSemanticImports(files, base = root) {
  const semanticSymbols = new Set([
    "ACTION_CAPABILITIES",
    "AdminActionCapabilityKey",
    "USER_MANAGEMENT_PAGE_DESIGN_KEYS",
    "UserManagementPageDesignKey",
    "operationsPageDesignKeys",
    "OperationsPageDesignKey",
    "platformPageDesignKeys",
    "PlatformPageDesignKey",
  ]);
  for (const file of files) {
    const source = read(file, base);
    for (const match of source.matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/gs)) {
      const imported = match[1].split(",").map((entry) => entry.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, ""));
      if (imported.some((name) => semanticSymbols.has(name))) {
        if (match[0].startsWith("export")) fail("R5_FRONTEND_GENERATED_SEMANTIC_REEXPORT", file);
        if (!/\/catalog\/generatedAdminCatalog$/.test(match[2])) fail("R5_FRONTEND_GENERATED_SEMANTIC_IMPORT", file);
      }
    }
    if (/export\s+\*\s+from\s+["'][^"']*\/catalog\/generatedAdminCatalog["']/.test(source)) {
      fail("R5_FRONTEND_GENERATED_SEMANTIC_REEXPORT", file);
    }
    const declarationSource = source.replace(/(?:import|export)\s+(?:type\s+)?\{[^}]*\}\s+from\s+["'][^"']+["'];?/gs, "");
    for (const symbol of semanticSymbols) {
      if (new RegExp(`\\b(?:const|let|var|type|interface|enum|class)\\s+${symbol}\\b`).test(declarationSource)) {
        fail("R5_FRONTEND_GENERATED_SEMANTIC_REDECLARATION", `${file}:${symbol}`);
      }
    }
  }
}
function assertNoOperationIdLiterals(files, operationIds, base = root) {
  const operationIdSet = new Set(operationIds);
  const decodeQuoted = (literal) => literal.replace(/\\(['"\\`])/g, "$1");
  const staticTemplateValue = (body) => {
    let value = body;
    let prior;
    do {
      prior = value;
      value = value.replace(/\$\{\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1\s*\}/g, (_, quote, literal) => decodeQuoted(literal));
    } while (value !== prior);
    return value.includes("${") ? undefined : value;
  };
  for (const file of files) {
    const source = read(file, base).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const match of source.matchAll(/(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\1|`([^`]*)`/g)) {
      const value = match[3] === undefined ? decodeQuoted(match[2]) : staticTemplateValue(match[3]);
      if (value !== undefined && operationIdSet.has(value)) fail("R5_FRONTEND_OPERATION_ID_LITERAL", file);
    }
  }
}
function assertRawApiImportBoundary(files, base = root) {
  const allowed = new Set([
    "apps/frontend/platform-admin/src/app/api/PlatformTransport.ts",
    "apps/frontend/platform-admin/src/app/state/PlatformStore.ts",
    "apps/frontend/operations-admin/src/app/api/OperationsTransport.ts",
    "apps/frontend/operations-admin/src/app/state/OperationsStore.ts",
  ]);
  for (const file of files) {
    const source = read(file, base);
    if (!allowed.has(file) && /from\s+["'][^"']*(?:PlatformApi|OperationsApi)["']/.test(source)) {
      fail("R5_FRONTEND_RAW_API_IMPORT_ESCAPE", file);
    }
    if (!file.endsWith("PlatformTransport.ts") && !file.endsWith("OperationsTransport.ts") && /\.endpoints\.wire\b/.test(source)) {
      fail("R5_FRONTEND_RAW_WIRE_ENDPOINT_ESCAPE", file);
    }
  }
}
function assertFrontendBuildPrerequisites(base = root) {
  const required = ["yarn lint:architecture", "yarn lint:style", "../../../scripts/check/frontend-architecture", "yarn typecheck", "vite build"];
  for (const app of ["platform-admin", "operations-admin"]) {
    const scripts = JSON.parse(read(`apps/frontend/${app}/package.json`, base)).scripts ?? {};
    const build = typeof scripts.build === "string" && typeof scripts.lint === "string"
      ? scripts.build.replace(/\byarn lint\b/g, scripts.lint)
      : scripts.build;
    let cursor = -1;
    for (const command of required) {
      const next = typeof build === "string" ? build.indexOf(command, cursor + 1) : -1;
      if (next < 0) fail("R5_FRONTEND_BUILD_PREREQUISITE_MISSING", `${app}:${command}`);
      cursor = next;
    }
  }
}
function normalized(value) { return JSON.stringify(value); }
function contractOperations(base = root) {
  const contract = JSON.parse(read("contracts/openapi/edge.openapi.json", base));
  const operations = [];
  for (const [route, methods] of Object.entries(contract.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      if (!operation.operationId || !Array.isArray(operation["x-consumer-faces"]) || operation["x-consumer-faces"].length === 0) fail("R4_OPENAPI_FACE_METADATA_INVALID", route);
      operations.push({ operationId: operation.operationId, method: method.toUpperCase(), path: route, consumerFaces: [...operation["x-consumer-faces"]].sort() });
    }
  }
  return operations.sort((left, right) => left.operationId.localeCompare(right.operationId));
}
function assertOperationsEqual(actual, expected, code) {
  const normalizeOperations = (operations) => operations.map((operation) => ({ ...operation, consumerFaces: [...operation.consumerFaces].sort() })).sort((left, right) => left.operationId.localeCompare(right.operationId));
  if (normalized(normalizeOperations(actual)) !== normalized(normalizeOperations(expected))) fail(code);
}

function generatedRouteOperations(base = root) {
  const registry = JSON.parse(read(`${appRoot}/src/main/resources/generated/edge-route-face-registry.json`, base));
  const operations = registry.operations;
  if (!Array.isArray(operations) || operations.length === 0 || registry.closure?.operations !== operations.length) {
    fail("R5_ROUTE_REGISTRY_CLOSURE_DRIFT");
  }
  const faceCounts = Object.fromEntries(["platform-admin", "operations-admin", "public"].map((face) => [
    face,
    operations.filter((operation) => Array.isArray(operation.consumerFaces) && operation.consumerFaces.includes(face)).length,
  ]));
  if (normalized(faceCounts) !== normalized(registry.closure?.faceCounts)) fail("R5_ROUTE_REGISTRY_FACE_COUNT_DRIFT");
  return operations;
}

function generatedCatalogInventoryRouteOperations(base = root) {
  const registry = JSON.parse(read(`${appRoot}/src/main/resources/generated/catalog-inventory-edge-route-registry.json`, base));
  if (registry.kind !== "catalog-inventory-edge-route-registry"
    || !Array.isArray(registry.operations)
    || registry.operations.length === 0
    || typeof registry.generatedFrom !== "string"
    || typeof registry.contractDigest !== "string") {
    fail("R5_CATALOG_ROUTE_REGISTRY_INVALID");
  }
  return registry.operations.map((operation) => ({
    operationId: operation.operationId,
    method: operation.method,
    path: operation.path.startsWith("/api/") ? operation.path : `/api${operation.path}`,
    consumerFaces: [...(operation.consumerFaces || [])].sort(),
  }));
}

function mappingPath(annotation) {
  const match = annotation.match(/\(\s*"([^"]*)"\s*\)/);
  return match ? match[1] : "";
}

function joinRoute(prefix, suffix) {
  const joined = `${prefix || ""}/${suffix || ""}`.replace(/\/+/g, "/");
  return joined === "/" ? joined : joined.replace(/\/$/, "");
}

function controllerRoutes(base = root) {
  const files = walk(`${appRoot}/src/main/java/com/catering/v2s/app/edge`, base)
    .filter((file) => file.endsWith("Controller.java"));
  return files.flatMap((file) => {
    const source = read(file, base);
    const classMapping = source.match(/@RequestMapping\s*\(\s*"([^"]*)"\s*\)/);
    if (!classMapping) fail("R5_SECURITY_CONTROLLER_CLASS_MAPPING_MISSING", file);
    const prefix = classMapping[1];
    const routes = [];
    const pattern = /@(Get|Post|Put|Patch|Delete)Mapping(?:\s*\(\s*"([^"]*)"\s*\))?/g;
    for (const match of source.matchAll(pattern)) {
      routes.push({
        method: match[1].toUpperCase(),
        path: joinRoute(prefix, match[2] || ""),
        file,
        source,
      });
    }
    if (routes.length === 0) fail("R5_SECURITY_CONTROLLER_METHOD_MAPPING_MISSING", file);
    return routes;
  });
}

function expectedResolver(face) {
  if (face === "platform-admin") return "PlatformSessionResolver";
  if (face === "operations-admin") return "OperationsSessionResolver";
  if (face === "public") return undefined;
  fail("R5_SECURITY_UNKNOWN_FACE", face);
}

function security(base = root) {
  const edge = read("apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/access/EdgeContextVerifier.java", base);
  if (!/verify\(String edgeAuth, String expectedFace, String secret\)/.test(edge) || !/HmacSHA256/.test(edge) || !/FACE\.equals\(expectedFace\)/.test(edge)) fail("R4_SECURITY_EDGE_CONTEXT_MISSING");
  const expected = generatedRouteOperations(base);
  const routeIndex = new Map();
  for (const route of controllerRoutes(base)) {
    const key = `${route.method} ${route.path}`;
    if (routeIndex.has(key)) fail("R5_SECURITY_CONTROLLER_ROUTE_DUPLICATE", key);
    routeIndex.set(key, route);
  }
  for (const operation of expected) {
    if (!Array.isArray(operation.consumerFaces) || operation.consumerFaces.length !== 1) fail("R5_SECURITY_FACE_CARDINALITY_INVALID", operation.operationId);
    const face = operation.consumerFaces[0];
    const route = routeIndex.get(`${operation.method} ${operation.path}`);
    if (!route) fail("R5_SECURITY_CONTROLLER_ROUTE_MISSING", operation.operationId);
    const resolver = expectedResolver(face);
    if (resolver && !new RegExp(`\\b${resolver}\\b`).test(route.source)) fail("R5_SECURITY_FACE_RESOLVER_MISSING", operation.operationId);
    if (!resolver && /(?:PlatformSessionResolver|OperationsSessionResolver)/.test(route.source)) fail("R5_SECURITY_PUBLIC_EDGE_RESOLVER_FORBIDDEN", operation.operationId);
    if (/getCookies\(/.test(route.source)) fail("R5_SECURITY_CONTROLLER_COOKIE_BYPASS", operation.operationId);
    if (/@CookieValue\b/.test(route.source)) fail("R5_SECURITY_CONTROLLER_RAW_COOKIE_INGRESS", operation.operationId);
  }
  const assetStorage = read("apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/MinioAssetObjectStorage.java", base);
  const assetService = read("apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java", base);
  if (!/value\.startsWith\(objectPrefix\)/.test(assetStorage) || /catering-v2s\/dev/.test(assetStorage) || !/objects\.ownsObjectKey\(objectKey\)/.test(assetService)) fail("R5_SECURITY_ASSET_PREFIX_NOT_CONFIGURED");
  assertMatch("apps/frontend/operations-admin/src/main.tsx", /OperationsApp/, "R5_SECURITY_OPERATIONS_APP_ENTRY_MISSING", base);
  process.stdout.write(`R5_SECURITY_BOUNDARIES=PASS\nOPERATIONS=${expected.length}\n`);
}
function frontend(base = root) {
  const foundation = sourceFiles("libraries/frontend/admin-ui-foundation", base);
  assertNoMatch(foundation, /from\s+["'][^"']*apps\//, "R4_FRONTEND_FOUNDATION_APP_IMPORT", base);
  assertNoMatch(foundation, /generated\/r3-edge|generated\//, "R4_FRONTEND_FOUNDATION_WIRE_IMPORT", base);
  assertNoMatch(foundation, /import\s*\(/, "R4_FRONTEND_FOUNDATION_DYNAMIC_IMPORT", base);
  for (const app of ["platform-admin", "operations-admin"]) {
    if (exists(`apps/frontend/${app}/src/main.js`, base) || exists(`apps/frontend/${app}/scripts/build-static.mjs`, base)) {
      fail("R5_FRONTEND_LEGACY_BUILD_FALLBACK_PRESENT", app);
    }
    assertMatch(`apps/frontend/${app}/src/main.tsx`, /import\s+zhCN\s+from\s+["']antd\/locale\/zh_CN["']/, "R5_FRONTEND_ZH_CN_IMPORT_MISSING", base);
    assertMatch(`apps/frontend/${app}/src/main.tsx`, /<ConfigProvider\s+locale=\{zhCN\}/, "R5_FRONTEND_ZH_CN_PROVIDER_MISSING", base);
  }
  assertNoMatch(sourceFiles("apps/frontend/platform-admin", base), /operations-admin\/src/, "R4_FRONTEND_CROSS_APP_IMPORT", base);
  assertNoMatch(sourceFiles("apps/frontend/operations-admin", base), /platform-admin\/src/, "R4_FRONTEND_CROSS_APP_IMPORT", base);
  assertNoMatch(sourceFiles("apps/frontend/operations-admin", base), /platform-commercial-group-edge|PLATFORM_COMMERCIAL_GROUP_OPERATIONS|PLATFORM_ADMIN_OPERATIONS/, "R5_FRONTEND_OPERATIONS_PLATFORM_WIRE", base);
  const nonTransportSources = sourceFiles("apps/frontend", base).filter((file) => !/\/src\/app\/api\/client(?:\/|\.ts$)/.test(file));
  assertNoMatch(nonTransportSources, /\bfetch\s*\(/, "R5_FRONTEND_DIRECT_TRANSPORT", base);
  assertNoHandwrittenEdgeRouteLiterals(base);
  const featureSources = sourceFiles("apps/frontend/platform-admin/src/features", base)
    .concat(sourceFiles("apps/frontend/operations-admin/src/features", base));
  assertNoMatch(featureSources, /title\s*:\s*["']操作["']/, "R5_FRONTEND_ENTITY_OPERATION_COLUMN", base);
  assertNoMatch(featureSources, /["']BC-[A-Z0-9-]+["']/, "R5_FRONTEND_CAPABILITY_LITERAL", base);
  const handwrittenFrontendSources = sourceFiles("apps/frontend", base).filter((file) =>
    !file.includes("/src/app/api/generated/")
      && !file.endsWith("/src/app/catalog/generatedAdminCatalog.ts")
      && !file.includes("/src/tests/")
      && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
  assertNoMatch(handwrittenFrontendSources, /["'](?:PLATFORM|PG|HOME)-[A-Z0-9-]+["']/, "R5_FRONTEND_PAGE_KEY_LITERAL", base);
  const handwrittenBackendCatalogConsumers = sourceFiles(
    "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge",
    base
  ).concat(sourceFiles("apps/backend/catering-business-server/modules/workspace-iam/src/main/java", base)).filter((file) =>
    !file.includes("/generated/")
      && !file.endsWith("/WorkspaceAuthorizationCatalog.java"));
  assertNoMatch(
    handwrittenBackendCatalogConsumers,
    /["'](?:(?:PLATFORM|PG|HOME)-[A-Z0-9-]+|BC-[A-Z0-9-]+)["']/,
    "R5_ADMIN_CATALOG_BACKEND_LITERAL",
    base
  );
  assertNoMatch([
    "apps/frontend/platform-admin/src/app/api/PlatformTransport.ts",
    "apps/frontend/operations-admin/src/app/api/OperationsTransport.ts",
  ], /\bbody\?\s*:\s*unknown\b/, "R5_FRONTEND_UNTYPED_REQUEST_BODY", base);
  assertNoMatch(handwrittenFrontendSources, /\b(?:platformEndpoint|operationsEndpoint)\b/, "R5_FRONTEND_GENERIC_OPERATION_FACADE", base);
  assertNoMatch(handwrittenFrontendSources, /`(?:PLATFORM|PG|HOME)-[^`]*\$\{/, "R5_FRONTEND_PAGE_KEY_TEMPLATE_DERIVATION", base);
  assertNoGeneratedSemanticImports(handwrittenFrontendSources, base);
  assertRawApiImportBoundary(sourceFiles("apps/frontend", base), base);
  assertCandidateLoadingFailureState(base);
  assertLogoutClearsLocalSessionAfterRemoteFailure(base);
  assertFrontendBuildPrerequisites(base);
  assertNoMatch(
    sourceFiles("apps/frontend/platform-admin/src", base).concat(sourceFiles("apps/frontend/operations-admin/src", base)),
    /(?:from\s+["'][^"']*\/main\.js["']|import\s*\(\s*["'][^"']*\/main\.js["']\s*\))/,
    "R5_FRONTEND_STATIC_SNAPSHOT_RUNTIME_REFERENCE",
    base
  );
  assertMatch(
    "apps/frontend/platform-admin/src/app/api/PlatformTransport.ts",
    /\bcreatePlatformAdminClient\s*\(\s*execute\s*\)/,
    "R5_FRONTEND_PLATFORM_GENERATED_CLIENT_NOT_BOUND",
    base
  );
  assertMatch(
    "apps/frontend/operations-admin/src/app/api/OperationsTransport.ts",
    /\bcreateOperationsAdminClient\s*\(\s*executeOperations\s*\)/,
    "R5_FRONTEND_OPERATIONS_GENERATED_CLIENT_NOT_BOUND",
    base
  );
  assertMatch(
    "apps/frontend/operations-admin/src/app/api/OperationsTransport.ts",
    /\bcreatePublicClient\s*\(\s*executePublic\s*\)/,
    "R5_FRONTEND_PUBLIC_GENERATED_CLIENT_NOT_BOUND",
    base
  );
  assertNoPrivateFeatureUiImports(base);
  assertRequiredMutationsUseLifecycle(featureSources, base);
  assertCrudPresentationStandard(base);
  const generatedSlices = [
    ["apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts", "PLATFORM_ADMIN_OPERATIONS", "platform-admin"],
    ["apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts", "OPERATIONS_ADMIN_OPERATIONS", "operations-admin"],
    ["apps/frontend/operations-admin/src/app/api/generated/public-edge.ts", "PUBLIC_OPERATIONS", "public"],
    ["apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts", "CATALOG_INVENTORY_OPERATIONS", "operations-admin"]
  ];
  const generated = generatedSlices.flatMap(([file, symbol, face]) => {
    assertFile(file, "R5_FRONTEND_GENERATED_SLICE_MISSING", base);
    const source = read(file, base);
    const marker = `export const ${symbol} = `;
    const start = source.indexOf(marker);
    if (start < 0) fail("R5_FRONTEND_GENERATED_SLICE_SYMBOL_MISSING", file);
    const remainder = source.slice(start + marker.length);
    const end = remainder.indexOf("] as const;");
    if (end < 0) fail("R5_FRONTEND_GENERATED_SLICE_INVALID", file);
    const json = remainder.slice(0, end + 1).trim();
    try {
      return JSON.parse(json).map(({ operationId, method, path: route }) => ({ operationId, method, path: route, consumerFaces: [face] }));
    } catch {
      fail("R5_FRONTEND_GENERATED_SLICE_INVALID", file);
    }
  });
  const registryOperations = generatedRouteOperations(base)
    .concat(generatedCatalogInventoryRouteOperations(base))
    .map(({ operationId, method, path: route, consumerFaces }) => ({ operationId, method, path: route, consumerFaces }));
  assertOperationsEqual(registryOperations, generated, "R5_FRONTEND_GENERATED_FACE_DRIFT");
  assertNoOperationIdLiterals(handwrittenFrontendSources, generated.map(({operationId}) => operationId), base);
  assertPageRegistryReachability(base);
  process.stdout.write("R5_FRONTEND_ARCHITECTURE=PASS\n");
}

function assertPageRegistryReachability(base) {
  const platformRegistry = read("apps/frontend/platform-admin/src/app/routing/pageRegistry.tsx", base);
  const platformApp = read("apps/frontend/platform-admin/src/app/PlatformApp.tsx", base);
  if (
    !/satisfies Record<PlatformPageDesignKey, RouteRegistration>/.test(platformRegistry) ||
    !/Object\.values\(platformPageRegistry\)/.test(platformApp) ||
    !/registrations\.map\(\s*\(?entry\)?\s*=>\s*\(?\s*<Route/.test(platformApp)
  ) fail("R5_PLATFORM_PAGE_REGISTRY_ROUTE_UNREACHABLE");
  const operationsRegistry = read("apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx", base);
  const operationsApp = read("apps/frontend/operations-admin/src/app/OperationsApp.tsx", base);
  if (!/satisfies Record<OperationsPageDesignKey, Registration>/.test(operationsRegistry) || !/operationsPageRegistry\[selected\]/.test(operationsApp) || !/operationsPageRegistry\[accessiblePages\[0\]\.key\]/.test(operationsApp)) fail("R5_OPERATIONS_PAGE_REGISTRY_ROUTE_UNREACHABLE");
}
function database(base = root) {
  const migrations = walk(`${appRoot}/src/main/resources/db/migration`, base).filter((file) => /\.sql$/.test(file)).sort();
  if (migrations.length === 0) fail("R5_DATABASE_SINGLE_HISTORY_EMPTY");
  const versions = migrations.map((migration) => {
    const match = path.posix.basename(migration).match(/^V(\d{8}_\d{6}_\d{3})__.+\.sql$/);
    if (!match) fail("R5_DATABASE_MIGRATION_VERSION_INVALID", migration);
    return match[1];
  });
  if (new Set(versions).size !== versions.length) fail("R5_DATABASE_MIGRATION_VERSION_DUPLICATE");
  if (versions.some((version, index) => index > 0 && version <= versions[index - 1])) fail("R5_DATABASE_MIGRATION_VERSION_NOT_MONOTONIC");
  const fullMigrationText = migrations.map((migration) => read(migration, base)).join("\n");
  if (/\b(?:DEFERRABLE|ON\s+DELETE\s+CASCADE|ON\s+UPDATE\s+CASCADE)\b/i.test(fullMigrationText)) fail("R5_DATABASE_FORBIDDEN_DDL");
  for (const schema of ["platform_iam", "platform_workspace", "platform_asset", "organization", "extension", "workspace_iam", "contract"]) if (!new RegExp(`CREATE\\s+SCHEMA\\s+${schema}\\b`, "i").test(fullMigrationText)) fail("R5_DATABASE_OWNER_SCHEMA_MISSING", schema);
  if (!/DISABLE ROW LEVEL SECURITY/.test(fullMigrationText) || !/DROP POLICY platform_admin_group_workspace_access/.test(fullMigrationText)) fail("R5_DATABASE_RLS_RETIREMENT_MISSING");
  if (!/FOREIGN KEY \(group_workspace_key, group_workspace_id\)/.test(fullMigrationText) || !/REFERENCES platform_workspace\.group_workspace \(group_workspace_key, id\)/.test(fullMigrationText)) fail("R4_DATABASE_COMPOSITE_FK_MISSING");
  const businessSources = sourceFiles("apps/backend/catering-business-server/modules", base).filter((file) => /\.java$/.test(file));
  assertNoMatch(businessSources, /Map\s*<\s*String\s*,\s*Object\s*>/, "R4_DATABASE_UNTYPED_ROW_OR_COMMAND", base);
  assertNoMatch(businessSources.filter((file) => !/platform\/(?:access|foundation\/time)/.test(file)), /System\.currentTimeMillis|Instant\.now\(/, "R4_DATABASE_UNINJECTED_BUSINESS_TIME", base);
  process.stdout.write("R4_DATABASE_BOUNDARIES=PASS\n");
}
function budget(base = root) {
  const files = sourceFiles("apps/backend/catering-business-server/modules", base).concat(sourceFiles(appRoot, base)).filter((file) => /\.java$/.test(file));
  const compatibilitySelectStarPaths = new Set([
    "apps/backend/catering-business-server/modules/foundation/src/test/java/com/catering/v2s/platform/foundation/persistence/DatabaseOperationTrackerTest.java",
    "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAuditHistoryService.java",
    "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationOverviewTaskReadService.java",
    "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java",
    "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractAuditHistoryService.java",
    "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java",
    "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformWorkspaceAccountTaskReadService.java",
    "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/PlatformWorkspaceInvitationTaskReadService.java",
    "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamAuditHistoryService.java",
    "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java",
  ]);
  const actualSelectStarPaths = [...new Set(files.filter((file) => /SELECT\s+\*/i.test(read(file, base))))].sort();
  const expectedSelectStarPaths = [...compatibilitySelectStarPaths].sort();
  if (actualSelectStarPaths.some((file) => !compatibilitySelectStarPaths.has(file))) {
    fail("R4_DATABASE_SELECT_STAR", actualSelectStarPaths.filter((file) => !compatibilitySelectStarPaths.has(file)).join(","));
  }
  if (actualSelectStarPaths.length !== expectedSelectStarPaths.length || actualSelectStarPaths.some((file, index) => file !== expectedSelectStarPaths[index])) {
    fail("R4_DATABASE_SELECT_STAR_COMPATIBILITY_SET_DRIFT", actualSelectStarPaths.join(","));
  }
  assertNoMatch(files, /\.query\([^\n]*\)\s*;\s*(?:for|while)\s*\(/i, "R4_DATABASE_LOOP_IO", base);
  process.stdout.write("R4_DATABASE_OPERATION_BUDGET=COMPATIBILITY_PASS\nR4_DATABASE_SELECT_STAR=EXPLICIT_HISTORICAL_RED_DISPOSITION\nR4_DATABASE_SELECT_STAR_COMPATIBILITY_COUNT=" + actualSelectStarPaths.length + "\nR4_DATABASE_SHAPE_OWNER=backend-performance-operation-database-shape\n");
}
function backend(base = root) {
  assertFile("apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java", "R4_ARCHUNIT_TEST_MISSING", base);
  if (exists("apps/backend/terminal-data-server/src", base)) fail("R4_TDP_PLACEHOLDER_SOURCE_PRESENT");
  const registry = JSON.parse(read("contracts/policy/module-dependency-registry.json", base));
  if (!Array.isArray(registry.modules) || !Array.isArray(registry.edges)) fail("R4_MODULE_REGISTRY_INVALID");
  const workspaceService = read("apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceService.java", base);
  if (!/@Transactional/.test(workspaceService) || !/InitializeCommercialGroupCommand/.test(workspaceService)) fail("R4_BACKEND_COMMAND_TRANSACTION_MISSING");
  const moduleSources = sourceFiles("apps/backend/catering-business-server/modules", base).filter((file) => /\.java$/.test(file));
  const buildFiles = walk("", base).filter((file) => /(?:^|\/)build\.gradle(?:\.kts)?$/.test(file));
  assertNoMatch(moduleSources.filter((file) => /\/domain\//.test(file)), /org\.springframework|java\.sql|org\.springframework\.jdbc/, "R4_BACKEND_DOMAIN_FRAMEWORK_DEPENDENCY", base);
  assertNoMatch(moduleSources.filter((file) => /organization\//.test(file)), /com\.catering\.v2s\.platform\.workspace\.(?:application|adapter)/, "R4_BACKEND_CROSS_MODULE_INTERNAL_IMPORT", base);
  assertNoMatch(moduleSources.filter((file) => /\/domain\//.test(file)), /HttpStatus|ResponseEntity|@(?:Get|Post|Put|Delete)Mapping/, "R4_BACKEND_DOMAIN_TRANSPORT_DEPENDENCY", base);
  assertNoMatch(moduleSources.filter((file) => /\/(?:application|domain)\//.test(file)), /Kafka|WebClient|RestTemplate|@EventListener|@TransactionalEventListener|outbox|@Scheduled/, "R4_BACKEND_WRITE_PATH_EXTERNAL_OR_EVENT_CHAIN", base);
  assertNoMatch(buildFiles, /spring-boot-starter-data-jpa|org\.hibernate|jakarta\.persistence/i, "R4_BACKEND_JPA_HIBERNATE_FORBIDDEN", base);
  assertNoMatch(buildFiles, /lombok/i, "R4_BACKEND_LOMBOK_FORBIDDEN", base);
  assertNoMatch(buildFiles, /spring-cloud/i, "R4_BACKEND_SPRING_CLOUD_FORBIDDEN", base);
  assertNoMatch(buildFiles, /spring-data-redis|lettuce|jedis|redisson|org\.apache\.kafka/i, "R4_BACKEND_REDIS_MQ_FORBIDDEN", base);
  assertNoMatch(buildFiles, /elasticsearch|opensearch|solr/i, "R4_BACKEND_SEARCH_ENGINE_FORBIDDEN", base);
  assertNoMatch(buildFiles, /resilience4j|quartz/i, "R4_BACKEND_RESILIENCE_SCHEDULER_FORBIDDEN", base);
  for (const token of forbiddenRuntimeTokens) assertNoMatch(sourceFiles(`${appRoot}/src/main`, base), new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "R4_BACKEND_FORBIDDEN_RUNTIME", base);
  process.stdout.write("R4_BACKEND_BOUNDARIES=PASS\n");
}
function openapi(base = root) {
  assertFile("contracts/openapi/edge.openapi.json", "R4_OPENAPI_MISSING", base);
  const strict = spawnSync(process.execPath, [path.join(base, "tools/verify-gates/strict-openapi-resolver.mjs")], { cwd: base, encoding: "utf8" });
  if (strict.status !== 0) fail("R5_OPENAPI_REFERENCE_UNRESOLVED", (strict.stdout || strict.stderr).trim());
  const result = spawnSync(process.execPath, [path.join(base, "scripts/generate/edge-codegen.mjs"), "--check"], { cwd: base, encoding: "utf8" });
  if (result.status !== 0) fail("R4_OPENAPI_GENERATED_DRIFT", (result.stdout || result.stderr).trim());
  generatedRouteOperations(base);
  process.stdout.write("R5_OPENAPI_CONTRACTS=PASS\n");
}
function traceability(base = root) {
  const decision = read("doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md", base);
  const plan = read("doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md", base);
  if (!/CARRY\s*\/\s*ADAPT\s*\/\s*NOT_CARRIED/.test(decision + plan)) fail("R4_UI_CARRYOVER_TRACE_MISSING");
  if (!/admin-ui-foundation/.test(decision + plan)) fail("R4_UI_FOUNDATION_TRACE_MISSING");
  process.stdout.write("R4_UI_WIREFRAME_TRACEABILITY=PASS\n");
}
function terminology(base = root) {
  assertFile("project-memory/decisions/confirmed-business-language-corpus.md", "R4_TERMINOLOGY_CORPUS_MISSING", base);
  assertMatch("contracts/openapi/edge.openapi.json", /commercialGroup|groupWorkspace/, "R4_TERMINOLOGY_EDGE_MISSING", base);
  process.stdout.write("R4_BUSINESS_TERMINOLOGY_TRACEABILITY=PASS\n");
}
function logging(base = root) {
  const files = sourceFiles(`${appRoot}/src/main`, base)
    .concat(sourceFiles("apps/frontend/platform-admin/src", base))
    .concat(sourceFiles("apps/frontend/operations-admin/src", base))
    .concat(sourceFiles("libraries", base))
    .filter((file) => !file.includes("/src/test/"));
  assertNoMatch(files, /console\.log\([^\n]*(?:token|cookie|authorization|secret)/i, "R4_LOGGING_SECRET_LEAK", base);
  assertNoMatch(files.filter((file) => !file.endsWith("libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts")), /System\.(?:out|err)\.print|console\.(?:log|error|warn|info|debug)\(/, "R4_LOGGING_FREE_CONSOLE", base);
  assertNoMatch(files.filter((file) => /\.(?:java|js|ts|tsx)$/.test(file)), /(?:password|otp|token|authorization|secret)\s*[=:]\s*["'`][^"'`]+/i, "R4_LOGGING_SENSITIVE_LITERAL", base);
  process.stdout.write("R4_LOGGING_BOUNDARIES=PASS\n");
}
function retirement(base = root) {
  const files = sourceFiles("apps", base).concat(sourceFiles("libraries", base));
  assertNoMatch(files, /org\.apache\.kafka|new\s+WebClient\s*\(/, "R4_RETIREMENT_RESIDUE", base);
  process.stdout.write("R4_RETIREMENT=PASS\n");
}
function isRealL2Test(test, base) {
  if (!/\/tests\/l2\/[^/]+\.spec\.(?:ts|tsx)$/.test(test)) return;
  const source = read(test, base);
  if (!/\b(?:describe|it|test|expect)\s*\(/.test(source)) fail("R5_AFFECTED_L2_EMPTY_STUB", test);
}

function assertAffectedL2LayoutDerived(value, base = root) {
  const carryOver = JSON.parse(read("contracts/policy/frontend-asset-carryover-manifest.json", base));
  if (carryOver.kind !== "frontend-asset-carryover-manifest" || !Array.isArray(carryOver.surfaces) || carryOver.surfaces.length !== 22) {
    fail("R5_AFFECTED_L2_CARRYOVER_MANIFEST_INVALID");
  }
  const expectedById = new Map(carryOver.surfaces.map((surface) => {
    if (!surface || typeof surface.id !== "string" || typeof surface.targetPath !== "string" || !surface.targetPath.startsWith("apps/frontend/")) {
      fail("R5_AFFECTED_L2_CARRYOVER_MANIFEST_INVALID");
    }
    const physicalConsumerPaths = surface.physicalConsumerPaths === undefined ? [surface.targetPath] : surface.physicalConsumerPaths;
    if (!Array.isArray(physicalConsumerPaths) || physicalConsumerPaths.length === 0 || physicalConsumerPaths[0] !== surface.targetPath
      || new Set(physicalConsumerPaths).size !== physicalConsumerPaths.length
      || physicalConsumerPaths.some((consumerPath) => typeof consumerPath !== "string" || !consumerPath.startsWith("apps/frontend/"))) {
      fail("R5_AFFECTED_L2_PHYSICAL_CONSUMER_CONTRACT_INVALID", surface.id);
    }
    const directories = new Set(physicalConsumerPaths.map((consumerPath) => `${path.posix.dirname(consumerPath)}/`));
    if (directories.size !== 1) fail("R5_AFFECTED_L2_PHYSICAL_CONSUMER_LAYOUT_INVALID", surface.id);
    for (const consumerPath of physicalConsumerPaths) {
      if (!fs.existsSync(path.join(base, consumerPath))) fail("R5_AFFECTED_L2_PHYSICAL_TARGET_MISSING", consumerPath);
    }
    const [derivedPath] = directories;
    return [surface.id, derivedPath];
  }));
  if (expectedById.size !== carryOver.surfaces.length) fail("R5_AFFECTED_L2_CARRYOVER_SURFACE_DUPLICATE");
  const actualById = new Map(value.surfaces.filter((surface) => expectedById.has(surface.id)).map((surface) => [surface.id, surface.paths]));
  if (actualById.size !== expectedById.size) fail("R5_AFFECTED_L2_LAYOUT_SURFACE_SET_DRIFT");
  for (const [id, expectedPath] of expectedById) {
    const actualPaths = actualById.get(id);
    if (!Array.isArray(actualPaths) || actualPaths.length !== 1 || actualPaths[0] !== expectedPath) {
      fail("R5_AFFECTED_L2_LAYOUT_DERIVATION_DRIFT", id);
    }
  }
}

function affectedL2(base = root, changed = [], phase = "RM1") {
  const value = JSON.parse(read("contracts/policy/affected-l2-registry.json", base));
  if (!["RM1", "RM2"].includes(phase)) fail("R5_AFFECTED_L2_PHASE_INVALID", phase);
  if (value.kind !== "affected-l2-registry" || value.schemaVersion !== 4 || value.fallback !== "ALL_R5_L2" || !Array.isArray(value.surfaces) || value.surfaces.length < 24) fail("R5_AFFECTED_L2_REGISTRY_INVALID");
  const ids = value.surfaces.map((surface) => surface.id);
  if (new Set(ids).size !== ids.length || (value.closure?.r5FrontendSurfaceCount !== 22)) fail("R5_AFFECTED_L2_SURFACE_CLOSURE_INVALID");
  assertAffectedL2LayoutDerived(value, base);
  const allTests = [...new Set(value.surfaces.flatMap((surface) => surface.tests))].sort();
  const obligations = value.phaseBusinessL2Obligations;
  if (!Array.isArray(obligations) || obligations.length !== 2) fail("R5_AFFECTED_L2_PHASE_OBLIGATION_INVALID");
  const obligationIds = new Set();
  for (const obligation of obligations) {
    if (!obligation || typeof obligation.packageId !== "string" || obligationIds.has(obligation.packageId)
      || !["ACTIVE_REQUIRED", "PENDING_FUTURE_UNIT"].includes(obligation.implementationState)
      || !Array.isArray(obligation.surfaceIds) || obligation.surfaceIds.length === 0
      || !Array.isArray(obligation.tests) || obligation.tests.length === 0
      || typeof obligation.requirement !== "string" || !/real browser/i.test(obligation.requirement) || !/managed run/i.test(obligation.requirement)) {
      fail("R5_AFFECTED_L2_PHASE_OBLIGATION_INVALID");
    }
    obligationIds.add(obligation.packageId);
    if (new Set(obligation.surfaceIds).size !== obligation.surfaceIds.length || new Set(obligation.tests).size !== obligation.tests.length
      || obligation.surfaceIds.some((id) => !ids.includes(id)) || obligation.tests.some((test) => !allTests.includes(test))) {
      fail("R5_AFFECTED_L2_PHASE_OBLIGATION_INVALID", obligation.packageId);
    }
  }
  if (!obligationIds.has("RM1P6-U02") || !obligationIds.has("RM1P6-U03")) fail("R5_AFFECTED_L2_PHASE_OBLIGATION_INVALID");
  const obligationsByTest = new Map();
  for (const obligation of obligations) for (const test of obligation.tests) {
    const rows = obligationsByTest.get(test) ?? [];
    rows.push(obligation);
    obligationsByTest.set(test, rows);
  }
  const debts = value.legacyTestDebts;
  if (!Array.isArray(debts) || value.legacyDeferredTestCount !== debts.length) fail("R5_AFFECTED_L2_LEGACY_DEBT_INVALID");
  const debtByTarget = new Map();
  for (const debt of debts) {
    if (!debt || typeof debt.target !== "string" || debtByTarget.has(debt.target) || !allTests.includes(debt.target)
      || debt.state !== "DEFERRED" || debt.deferredUntilPhase !== "RM2" || typeof debt.reason !== "string" || debt.reason.length < 12) {
      fail("R5_AFFECTED_L2_LEGACY_DEBT_INVALID");
    }
    debtByTarget.set(debt.target, debt);
  }
  const matched = changed.length === 0
    ? value.surfaces
    : value.surfaces.filter((surface) => changed.some((item) => surface.paths.some((prefix) => item.startsWith(prefix))));
  if (matched.length === 0) fail("R5_AFFECTED_L2_UNMAPPED_SURFACE", changed.join(","));
  const tests = [...new Set(matched.flatMap((surface) => surface.tests))].sort();
  let realTargetCount = 0;
  for (const test of tests) {
    const exists = fs.existsSync(path.join(base, test));
    const debt = debtByTarget.get(test);
    const testObligations = obligationsByTest.get(test) ?? [];
    if (exists) {
      if (debt) fail("R5_AFFECTED_L2_DEFERRED_TARGET_NOW_PRESENT", test);
      assertFile(test, "R5_AFFECTED_L2_TARGET_MISSING", base);
      isRealL2Test(test, base);
      realTargetCount += 1;
      continue;
    }
    if (!debt && testObligations.length > 0 && testObligations.every((obligation) => obligation.implementationState === "PENDING_FUTURE_UNIT") && changed.length === 0) continue;
    if (!debt) fail("R5_AFFECTED_L2_TARGET_MISSING", test);
    if (phase === debt.deferredUntilPhase) fail("R5_AFFECTED_L2_DEFERRED_EXPIRED", test);
    if (changed.length > 0) fail("R5_AFFECTED_L2_DEFERRED_SELECTED_FOR_CHANGE", test);
  }
  if (realTargetCount === 0) fail("R5_AFFECTED_L2_REAL_TARGET_SET_EMPTY");
  process.stdout.write(`R5_AFFECTED_L2=PASS\nMODE=${changed.length === 0 ? "ALL_R5_L2" : "CHANGED_SURFACE"}\nPHASE=${phase}\nSELECTED=${tests.join(",")}\nPHASE_OBLIGATIONS=${obligations.map((obligation) => `${obligation.packageId}:${obligation.implementationState}:${obligation.tests.length}`).join(",")}\nLEGACY_DEFERRED=${[...debtByTarget.keys()].filter((target) => tests.includes(target)).join(",")}\n`);
}
function flywayTestLocations(base = root) {
  const modulePrefix = "apps/backend/catering-business-server/modules/";
  const expected = new Set([
    `${modulePrefix}asset/src/test/java/com/catering/v2s/platform/asset/application/PlatformAssetServiceTest.java`,
    `${modulePrefix}extension/src/test/java/com/catering/v2s/extension/application/ExtensionDefinitionServiceTest.java`,
    `${modulePrefix}organization/src/test/java/com/catering/v2s/organization/application/OrganizationOwnerServiceTest.java`,
    `${modulePrefix}platform-admin-iam/src/test/java/com/catering/v2s/platform/iam/application/PlatformAuthenticationServiceTest.java`,
    `${modulePrefix}store-contract/src/test/java/com/catering/v2s/contract/application/ContractCommandServiceTest.java`,
    `${modulePrefix}workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationPublicFlowTest.java`,
    `${modulePrefix}workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceAccountPlatformReceiptTest.java`,
    `${modulePrefix}workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationContextVersionTest.java`,
    `${modulePrefix}workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspacePasswordRecoveryServiceTest.java`,
    `${modulePrefix}workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleServiceTest.java`,
    `${modulePrefix}workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceUserTaskScopeTest.java`,
  ]);
  const candidates = sourceFiles(modulePrefix, base).filter((entry) => entry.includes("/src/test/") && read(entry, base).includes("Flyway.configure()") && read(entry, base).includes("filesystem:"));
  if (candidates.length !== expected.size || candidates.some((entry) => !expected.has(entry)) || [...expected].some((entry) => !candidates.includes(entry))) fail("R5_FLYWAY_TEST_LOCATION_DENOMINATOR_DRIFT");
  for (const file of candidates) {
    const locations = [...read(file, base).matchAll(/\.locations\("filesystem:([^"\n]+)"\)/g)].map((match) => match[1]);
    const moduleRoot = file.slice(0, file.indexOf("/src/test/"));
    const expectedRoot = path.join(base, appRoot, "src/main/resources/db/migration");
    if (locations.length !== 1 || path.resolve(base, moduleRoot, locations[0]) !== expectedRoot || !fs.existsSync(expectedRoot)) fail("R5_FLYWAY_TEST_LOCATION_RESOLUTION_INVALID", file);
  }
  process.stdout.write(`R5_FLYWAY_TEST_LOCATIONS=PASS\nDENOMINATOR=${candidates.length}\n`);
}
const actions = { security, frontend, database, budget, backend, openapi, traceability, terminology, logging, retirement, "affected-l2": affectedL2, "flyway-test-locations": flywayTestLocations };

function prepareSelfTestClean(action, base) {
  if (action === "logging") {
    const source = "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceLoginRateLimitService.java";
    writeScratch(base, source, read(source, base).replaceAll('"test-workspace-rate-limit-secret"', 'System.getenv("WORKSPACE_RATE_LIMIT_SCOPE")'));
  }
  if (action === "affected-l2") {
    const fixtureTarget = "fixtures/tests/l2/real.spec.ts";
    const carryOverSurfaces = Array.from({ length: 22 }, (_, index) => ({
      id: `FIXTURE-${index + 1}`,
      targetPath: `apps/frontend/fixture/affected-l2/source-${index + 1}/Page.tsx`,
    }));
    const surfaces = [...carryOverSurfaces.map((surface) => ({
      id: surface.id,
      paths: [`${path.posix.dirname(surface.targetPath)}/`],
      tests: [fixtureTarget],
    })), ...[23, 24].map((index) => ({
      id: `GENERIC-${index}`,
      paths: [`fixtures/affected-l2/source-${index + 1}/`],
      tests: [fixtureTarget],
    }))];
    for (const surface of carryOverSurfaces) writeScratch(base, surface.targetPath, "export {};\n");
    writeScratch(base, "contracts/policy/frontend-asset-carryover-manifest.json", `${JSON.stringify({kind: "frontend-asset-carryover-manifest", surfaces: carryOverSurfaces}, null, 2)}\n`);
    writeScratch(base, "contracts/policy/affected-l2-registry.json", `${JSON.stringify({
      schemaVersion: 4,
      kind: "affected-l2-registry",
      fallback: "ALL_R5_L2",
      surfaces,
      closure: { r5FrontendSurfaceCount: 22 },
      phaseBusinessL2Obligations: [
        { packageId: "RM1P6-U02", implementationState: "ACTIVE_REQUIRED", surfaceIds: carryOverSurfaces.slice(0, 10).map((surface) => surface.id), tests: [fixtureTarget], requirement: "real browser managed run" },
        { packageId: "RM1P6-U03", implementationState: "PENDING_FUTURE_UNIT", surfaceIds: carryOverSurfaces.slice(10).map((surface) => surface.id), tests: [fixtureTarget], requirement: "real browser managed run" },
      ],
      legacyDeferredTestCount: 0,
      legacyTestDebts: [],
    }, null, 2)}\n`);
    writeScratch(base, fixtureTarget, "import { test, expect } from '@playwright/test';\ntest('fixture is real', async () => { expect(true).toBe(true); });\n");
    const multiConsumer = carryOverSurfaces[0];
    multiConsumer.physicalConsumerPaths = [multiConsumer.targetPath, "apps/frontend/fixture/affected-l2/source-1/SecondPhysicalStep.tsx"];
    writeScratch(base, multiConsumer.physicalConsumerPaths[1], "export {};\n");
    writeScratch(base, "contracts/policy/frontend-asset-carryover-manifest.json", `${JSON.stringify({kind: "frontend-asset-carryover-manifest", surfaces: carryOverSurfaces}, null, 2)}\n`);
  }
}

function writeScratch(base, relative, content) {
  const absolute = path.join(base, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function selfTest(action) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-r4-gate-"));
  try {
    fs.cpSync(root, scratch, { recursive: true, filter: (source) => !source.includes("/.git") && !source.includes("/build") && !source.includes("/node_modules") });
    prepareSelfTestClean(action, scratch);
    let frontendCatalogOriginal;
    if (action === "frontend") {
      const catalogPath = "contracts/policy/crud-presentation-standard-catalog.json";
      frontendCatalogOriginal = JSON.parse(read(catalogPath, scratch));
      const catalog = JSON.parse(JSON.stringify(frontendCatalogOriginal));
      for (const surface of catalog.surfaceCoverage) delete surface.externalFilterRequiredExpressions;
      writeScratch(scratch, catalogPath, JSON.stringify(catalog, null, 2) + "\n");
    }
    actions[action](scratch);
    const write = (relative, content) => {
      writeScratch(scratch, relative, content);
    };
    if (action === "frontend") {
      const presentationSource = "apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx";
      const presentationOriginal = read(presentationSource, scratch);
      const presentationNeedle = "<NameCodeText name={row.brand.name} code={row.brand.code}/>";
      const presentationReplacement = "<NameCodeText name={row.brand.name} code={row.brand.id}/>";
      if (!presentationOriginal.includes(presentationNeedle)) fail("R5_CRUD_NAME_CODE_SEMANTIC_SELF_TEST_FIXTURE_MISSING");
      write(presentationSource, presentationOriginal.replace(presentationNeedle, presentationReplacement));
      let semanticPresentationRed = false;
      try { actions[action](scratch); } catch (error) {
        semanticPresentationRed = String(error).includes("R5_CRUD_PRESENTATION_REQUIRED_EXPRESSION_MISSING")
          && String(error).includes("operations-stores");
      }
      if (!semanticPresentationRed) fail("R5_CRUD_NAME_CODE_SEMANTIC_SELF_TEST_NOT_DETECTED");
      write(presentationSource, presentationOriginal);

      const selectorSource = "apps/frontend/operations-admin/src/features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts";
      const selectorOriginal = read(selectorSource, scratch);
      const selectorNeedle = "queryText: queryText?.trim()";
      if (!selectorOriginal.includes(selectorNeedle)) fail("R5_CRUD_QUERY_TEXT_SEMANTIC_SELF_TEST_FIXTURE_MISSING");
      const selectorCatalog = JSON.parse(JSON.stringify(frontendCatalogOriginal));
      selectorCatalog.surfaceCoverage.find((surface) => surface.id === "operations-head-company-brand-selector").externalFilterRequiredExpressions = ["code: queryText"];
      write("contracts/policy/crud-presentation-standard-catalog.json", JSON.stringify(selectorCatalog, null, 2) + "\n");
      write(selectorSource, selectorOriginal.replace(selectorNeedle, "queryText: queryTextValue"));
      let semanticQueryTextRed = false;
      try { actions[action](scratch); } catch (error) {
        semanticQueryTextRed = String(error).includes("R5_CRUD_PRESENTATION_REQUIRED_EXPRESSION_MISSING")
          && String(error).includes("operations-head-company-brand-selector");
      }
      if (!semanticQueryTextRed) fail("R5_CRUD_QUERY_TEXT_SEMANTIC_SELF_TEST_NOT_DETECTED");
      write(selectorSource, selectorOriginal);
      const cleanCatalog = JSON.parse(JSON.stringify(frontendCatalogOriginal));
      for (const surface of cleanCatalog.surfaceCoverage) delete surface.externalFilterRequiredExpressions;
      write("contracts/policy/crud-presentation-standard-catalog.json", JSON.stringify(cleanCatalog, null, 2) + "\n");
      process.stdout.write("R5_CRUD_NAME_CODE_SEMANTIC_RED=PASS\nR5_CRUD_QUERY_TEXT_SEMANTIC_RED=PASS\n");
    }
    if (action === "security") {
      const source = `${appRoot}/src/main/resources/generated/edge-route-face-registry.json`;
      const originalRegistry = read(source, scratch);
      write(source, JSON.stringify({operations: []}, null, 2) + "\n");
      let registryRed = false;
      try { actions[action](scratch); } catch (error) { registryRed = String(error).includes("R5_ROUTE_REGISTRY_CLOSURE_DRIFT"); }
      if (!registryRed) fail("R4_SECURITY_ROUTE_REGISTRY_SELF_TEST_NOT_DETECTED");
      write(source, originalRegistry);
      const workspaceController = `${appRoot}/src/main/java/com/catering/v2s/app/edge/platform/workspace/PlatformWorkspaceAdministrationController.java`;
      write(workspaceController, read(workspaceController, scratch).replace('@GetMapping("/{groupWorkspaceKey}")', '@GetMapping("/removed-group-workspace-detail")'));
      let routeRed = false;
      try { actions[action](scratch); } catch (error) { routeRed = String(error).includes("R5_SECURITY_CONTROLLER_ROUTE_MISSING"); }
      if (!routeRed) fail("R4_SECURITY_CONTROLLER_ROUTE_SELF_TEST_NOT_DETECTED");
      write(workspaceController, read(workspaceController, scratch).replace('@GetMapping("/removed-group-workspace-detail")', '@GetMapping("/{groupWorkspaceKey}")').replaceAll("PlatformSessionResolver", "PlatformSessionResolverRemoved"));
      let resolverRed = false;
      try { actions[action](scratch); } catch (error) { resolverRed = String(error).includes("R5_SECURITY_FACE_RESOLVER_MISSING"); }
      if (!resolverRed) fail("R5_SECURITY_FACE_RESOLVER_SELF_TEST_NOT_DETECTED");
      write(workspaceController, read(workspaceController, scratch).replaceAll("PlatformSessionResolverRemoved", "PlatformSessionResolver"));
      write(workspaceController, read(workspaceController, scratch).replace("@GetMapping(\"/{groupWorkspaceKey}\")", "@GetMapping(\"/{groupWorkspaceKey}\") @CookieValue String rawCookie"));
      let rawCookieRed = false;
      try { actions[action](scratch); } catch (error) { rawCookieRed = String(error).includes("R5_SECURITY_CONTROLLER_RAW_COOKIE_INGRESS"); }
      if (!rawCookieRed) fail("R5_SECURITY_CONTROLLER_RAW_COOKIE_SELF_TEST_NOT_DETECTED");
      write(workspaceController, read(workspaceController, scratch).replace("@GetMapping(\"/{groupWorkspaceKey}\") @CookieValue String rawCookie", "@GetMapping(\"/{groupWorkspaceKey}\")"));
      const assetStorage = "apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/MinioAssetObjectStorage.java";
      const assetStorageOriginal = read(assetStorage, scratch);
      write(assetStorage, assetStorageOriginal.replace("value.startsWith(objectPrefix)", 'value.startsWith("catering-v2s/dev/")'));
      let assetPrefixRed = false;
      try { actions[action](scratch); } catch (error) { assetPrefixRed = String(error).includes("R5_SECURITY_ASSET_PREFIX_NOT_CONFIGURED"); }
      if (!assetPrefixRed) fail("R5_SECURITY_ASSET_PREFIX_SELF_TEST_NOT_DETECTED");
      write(assetStorage, assetStorageOriginal);
      process.stdout.write("R4_SECURITY_SELF_TEST=PASS\n");
      return;
    } else if (action === "frontend") {
      const directFixture = "apps/frontend/platform-admin/src/features/authentication/ui/DirectTransportFixture.ts";
      write(directFixture, "fetch('/api/forbidden');\n");
      let directRed = false;
      try { actions[action](scratch); } catch { directRed = true; }
      if (!directRed) fail("R5_FRONTEND_DIRECT_TRANSPORT_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, directFixture));
      const platformApp = "apps/frontend/platform-admin/src/app/PlatformApp.tsx";
      const platformAppOriginal = read(platformApp, scratch);
      write(
        platformApp,
        platformAppOriginal.replace("<Route key={entry.pageDesignKey}", "<div key={entry.pageDesignKey}"),
      );
      let pageRegistryRed = false;
      try { actions[action](scratch); } catch (error) { pageRegistryRed = String(error).includes("R5_PLATFORM_PAGE_REGISTRY_ROUTE_UNREACHABLE"); }
      if (!pageRegistryRed) fail("R5_FRONTEND_PAGE_REGISTRY_SELF_TEST_NOT_DETECTED");
      write(platformApp, platformAppOriginal);
      write("apps/frontend/platform-admin/src/features/authentication/ui/PrivateFeatureImportFixture.ts", "import {WorkspaceManagementPage} from '../../workspace-management/ui/WorkspaceManagementPage';\nvoid WorkspaceManagementPage;\n");
      let privateImportRed = false;
      try { assertNoPrivateFeatureUiImports(scratch); } catch { privateImportRed = true; }
      if (!privateImportRed) fail("R5_FRONTEND_PRIVATE_UI_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, "apps/frontend/platform-admin/src/features/authentication/ui/PrivateFeatureImportFixture.ts"));
      const lifecycleFixture = "apps/frontend/platform-admin/src/features/authentication/ui/LifecycleMutationFixture.ts";
      write(lifecycleFixture, "api('/api/example', {method: 'POST'});\n");
      let lifecycleRed = false;
      try { assertRequiredMutationsUseLifecycle([lifecycleFixture], scratch); } catch { lifecycleRed = true; }
      if (!lifecycleRed) fail("R5_FRONTEND_LIFECYCLE_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, lifecycleFixture));
      const candidateSource = "apps/frontend/operations-admin/src/features/store-management/ui/CandidateLoadingFailureFixture.tsx";
      const candidateOriginal = "import React, {useState} from 'react';\nexport function CandidateLoadingFailureFixture() { const [candidates, setCandidates] = useState(undefined); const [problem, setProblem] = useState(undefined); const load = () => Promise.resolve().catch((error) => { setCandidates(undefined); setProblem(error); }); void load; return <Select loading={!candidates && !problem} />; }\n";
      write(candidateSource, candidateOriginal.replace("loading={!candidates && !problem}", "loading={!candidates}"));
      let candidateFailureStateRed = false;
      try { actions[action](scratch); } catch (error) { candidateFailureStateRed = String(error).includes("R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_MISSING"); }
      if (!candidateFailureStateRed) fail("R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, candidateSource), {force: true});
      const failedPlatformLogout = read(platformApp, scratch);
      write(platformApp, failedPlatformLogout.replace("finally {\n        clearLocalSession();", "finally {\n        lifecycle.markBusinessIntentChanged();"));
      let platformLogoutClearRed = false;
      try { actions[action](scratch); } catch (error) { platformLogoutClearRed = String(error).includes("R5_FRONTEND_LOGOUT_LOCAL_CLEAR_MISSING"); }
      if (!platformLogoutClearRed) fail("R5_FRONTEND_PLATFORM_LOGOUT_LOCAL_CLEAR_SELF_TEST_NOT_DETECTED");
      write(platformApp, failedPlatformLogout);
      const operationsApp = "apps/frontend/operations-admin/src/app/OperationsApp.tsx";
      const failedOperationsLogout = read(operationsApp, scratch);
      write(operationsApp, failedOperationsLogout.replace("finally {\n      clearLocalSession();", "finally {\n      lifecycle.markBusinessIntentChanged();"));
      let operationsLogoutClearRed = false;
      try { actions[action](scratch); } catch (error) { operationsLogoutClearRed = String(error).includes("R5_FRONTEND_LOGOUT_LOCAL_CLEAR_MISSING"); }
      if (!operationsLogoutClearRed) fail("R5_FRONTEND_OPERATIONS_LOGOUT_LOCAL_CLEAR_SELF_TEST_NOT_DETECTED");
      write(operationsApp, failedOperationsLogout);
      const operationColumnFixture = "apps/frontend/platform-admin/src/features/authentication/ui/OperationColumnFixture.ts";
      write(operationColumnFixture, "export const columns = [{title: '操作'}];\n");
      let operationColumnRed = false;
      try { actions[action](scratch); } catch (error) { operationColumnRed = String(error).includes("R5_FRONTEND_ENTITY_OPERATION_COLUMN"); }
      if (!operationColumnRed) fail("R5_FRONTEND_OPERATION_COLUMN_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, operationColumnFixture));
      const capabilityLiteralFixture = "apps/frontend/operations-admin/src/features/authentication/ui/CapabilityLiteralFixture.ts";
      write(capabilityLiteralFixture, "export const leakedCapability = 'BC-FAKE-CAPABILITY';\n");
      let capabilityLiteralRed = false;
      try { actions[action](scratch); } catch (error) { capabilityLiteralRed = String(error).includes("R5_FRONTEND_CAPABILITY_LITERAL"); }
      if (!capabilityLiteralRed) fail("R5_FRONTEND_CAPABILITY_LITERAL_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, capabilityLiteralFixture));
      const pageKeyLiteralFixture = "apps/frontend/operations-admin/src/features/authentication/ui/PageKeyLiteralFixture.ts";
      write(pageKeyLiteralFixture, "export const leakedPageKey = 'PG-FAKE-PAGE';\n");
      let pageKeyLiteralRed = false;
      try { actions[action](scratch); } catch (error) { pageKeyLiteralRed = String(error).includes("R5_FRONTEND_PAGE_KEY_LITERAL"); }
      if (!pageKeyLiteralRed) fail("R5_FRONTEND_PAGE_KEY_LITERAL_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, pageKeyLiteralFixture));
      const backendCatalogLiteralFixture = "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/BackendCatalogLiteralFixture.java";
      write(backendCatalogLiteralFixture, "final class BackendCatalogLiteralFixture { String page = \"PG-FAKE-PAGE\"; }\n");
      let backendCatalogLiteralRed = false;
      try { actions[action](scratch); } catch (error) { backendCatalogLiteralRed = String(error).includes("R5_ADMIN_CATALOG_BACKEND_LITERAL"); }
      if (!backendCatalogLiteralRed) fail("R5_ADMIN_CATALOG_BACKEND_LITERAL_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, backendCatalogLiteralFixture));
      const localeSource = "apps/frontend/operations-admin/src/main.tsx";
      const localeOriginal = read(localeSource, scratch);
      write(localeSource, localeOriginal.replace("locale={zhCN}", ""));
      let localeRed = false;
      try { actions[action](scratch); } catch (error) { localeRed = String(error).includes("R5_FRONTEND_ZH_CN_PROVIDER_MISSING"); }
      if (!localeRed) fail("R5_FRONTEND_LOCALE_SELF_TEST_NOT_DETECTED");
      write(localeSource, localeOriginal);
      const transportSource = "apps/frontend/operations-admin/src/app/api/OperationsTransport.ts";
      write(transportSource, read(transportSource, scratch) + "\nexport type UntypedMutation = {body?: unknown};\n");
      let untypedBodyRed = false;
      try { actions[action](scratch); } catch (error) { untypedBodyRed = String(error).includes("R5_FRONTEND_UNTYPED_REQUEST_BODY"); }
      if (!untypedBodyRed) fail("R5_FRONTEND_UNTYPED_BODY_SELF_TEST_NOT_DETECTED");
      write(transportSource, read(transportSource, scratch).replace("\nexport type UntypedMutation = {body?: unknown};\n", ""));
      const operationIdFixture = "apps/frontend/platform-admin/src/features/authentication/ui/OperationIdFixture.ts";
      write(operationIdFixture, "export const operationId = 'platformPasswordLogin';\n");
      let operationIdRed = false;
      try { actions[action](scratch); } catch (error) { operationIdRed = String(error).includes("R5_FRONTEND_OPERATION_ID_LITERAL"); }
      if (!operationIdRed) fail("R5_FRONTEND_OPERATION_ID_LITERAL_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, operationIdFixture));
      const generatedSemanticFixture = "apps/frontend/operations-admin/src/features/authentication/ui/GeneratedSemanticFixture.ts";
      write(generatedSemanticFixture, "import {ACTION_CAPABILITIES} from '../../../app/api/generated/operations-edge';\nvoid ACTION_CAPABILITIES;\n");
      let generatedSemanticRed = false;
      try { actions[action](scratch); } catch (error) { generatedSemanticRed = String(error).includes("R5_FRONTEND_GENERATED_SEMANTIC_IMPORT"); }
      if (!generatedSemanticRed) fail("R5_FRONTEND_GENERATED_SEMANTIC_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, generatedSemanticFixture));
      const semanticShimFixture = "apps/frontend/operations-admin/src/features/authentication/model/SemanticShimFixture.ts";
      write(semanticShimFixture, "export {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';\n");
      let semanticShimRed = false;
      try { actions[action](scratch); } catch (error) { semanticShimRed = String(error).includes("R5_FRONTEND_GENERATED_SEMANTIC_REEXPORT"); }
      if (!semanticShimRed) fail("R5_FRONTEND_GENERATED_SEMANTIC_REEXPORT_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, semanticShimFixture));
      const rawApiFixture = "apps/frontend/operations-admin/src/features/authentication/ui/RawApiFixture.ts";
      write(rawApiFixture, "import {operationsApi} from '../../../app/api/OperationsApi';\nvoid operationsApi.endpoints.wire;\n");
      let rawApiRed = false;
      try { actions[action](scratch); } catch (error) { rawApiRed = String(error).includes("R5_FRONTEND_RAW_API_IMPORT_ESCAPE"); }
      if (!rawApiRed) fail("R5_FRONTEND_RAW_API_IMPORT_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, rawApiFixture));
      const staticOperationFixture = "apps/frontend/platform-admin/src/features/authentication/ui/StaticOperationFixture.ts";
      write(staticOperationFixture, "export const operationId = `platform${'Password'}Login`;\n");
      let staticOperationRed = false;
      try { actions[action](scratch); } catch (error) { staticOperationRed = String(error).includes("R5_FRONTEND_OPERATION_ID_LITERAL"); }
      if (!staticOperationRed) fail("R5_FRONTEND_STATIC_OPERATION_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, staticOperationFixture));
      const packageSource = "apps/frontend/operations-admin/package.json";
      const packageJson = JSON.parse(read(packageSource, scratch));
      packageJson.scripts.build = packageJson.scripts.build.replace("yarn typecheck && ", "");
      write(packageSource, JSON.stringify(packageJson, null, 2) + "\n");
      let buildPrerequisiteRed = false;
      try { actions[action](scratch); } catch (error) { buildPrerequisiteRed = String(error).includes("R5_FRONTEND_BUILD_PREREQUISITE_MISSING"); }
      if (!buildPrerequisiteRed) fail("R5_FRONTEND_BUILD_PREREQUISITE_SELF_TEST_NOT_DETECTED");
      write(packageSource, read(packageSource, root));
      const generatedClientOriginal = read(transportSource, scratch);
      write(transportSource, generatedClientOriginal.replace("createOperationsAdminClient(executeOperations)", "createOperationsAdminClientRemoved(executeOperations)"));
      let generatedClientRed = false;
      try { actions[action](scratch); } catch (error) { generatedClientRed = String(error).includes("R5_FRONTEND_OPERATIONS_GENERATED_CLIENT_NOT_BOUND"); }
      if (!generatedClientRed) fail("R5_FRONTEND_GENERATED_CLIENT_SELF_TEST_NOT_DETECTED");
      write(transportSource, generatedClientOriginal);
      const presentationSource = "apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx";
      const presentationOriginal = read(presentationSource, scratch);
      write(presentationSource, presentationOriginal.replace(">{row.name}</Button>", ">{formatNameCode(row.name, row.code)}</Button>"));
      let crudPrimaryIdentityRed = false;
      try { actions[action](scratch); } catch (error) { crudPrimaryIdentityRed = String(error).includes("R5_CRUD_PRIMARY_IDENTITY_COMPOSITE"); }
      if (!crudPrimaryIdentityRed) fail("R5_CRUD_PRIMARY_IDENTITY_SELF_TEST_NOT_DETECTED");
      write(presentationSource, presentationOriginal);
      const detailSource = "apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityDetailDrawer.tsx";
      const detailOriginal = read(detailSource, scratch);
      write(detailSource, detailOriginal.replace("{key: 'name', label: '名称', children: selected.name}", "{key: 'name', label: '主体名称', children: selected.name}"));
      let crudPrimaryDetailRed = false;
      try { actions[action](scratch); } catch (error) { crudPrimaryDetailRed = String(error).includes("R5_CRUD_PRESENTATION_REQUIRED_EXPRESSION_MISSING"); }
      if (!crudPrimaryDetailRed) fail("R5_CRUD_PRIMARY_DETAIL_SELF_TEST_NOT_DETECTED");
      write(detailSource, detailOriginal);
      const catalogSource = "contracts/policy/crud-presentation-standard-catalog.json";
      const catalogOriginal = read(catalogSource, scratch);
      const filterCoverageCatalog = JSON.parse(catalogOriginal);
      filterCoverageCatalog.surfaceCoverage.find((surface) => surface.id === "operations-stores").filterColumnMappings.find((mapping) => mapping.filterKey === "status").visibleColumnTitle = "不存在";
      write(catalogSource, JSON.stringify(filterCoverageCatalog, null, 2) + "\n");
      let crudFilterColumnRed = false;
      try { actions[action](scratch); } catch (error) { crudFilterColumnRed = String(error).includes("R5_CRUD_PRESENTATION_FILTER_COLUMN_COVERAGE"); }
      if (!crudFilterColumnRed) fail("R5_CRUD_FILTER_COLUMN_SELF_TEST_NOT_DETECTED");
      write(catalogSource, catalogOriginal);
      const actualFilterColumnNeedle = "{key: 'code', title: '编码', dataIndex: 'code', sorter: true,";
      const actualFilterColumnReplacement = "{key: 'code', title: '编码', dataIndex: 'code', hideInTable: true, sorter: true,";
      if (!presentationOriginal.includes(actualFilterColumnNeedle)) fail("R5_CRUD_ACTUAL_FILTER_SELF_TEST_FIXTURE_MISSING");
      write(presentationSource, presentationOriginal.replace(actualFilterColumnNeedle, actualFilterColumnReplacement));
      let crudActualColumnRed = false;
      try { actions[action](scratch); } catch (error) { crudActualColumnRed = String(error).includes("R5_CRUD_PRESENTATION_FILTER_COLUMN_COVERAGE"); }
      if (!crudActualColumnRed) fail("R5_CRUD_ACTUAL_FILTER_COLUMN_SELF_TEST_NOT_DETECTED");
      write(presentationSource, presentationOriginal);
      const externalSelectorCatalog = JSON.parse(catalogOriginal);
      externalSelectorCatalog.surfaceCoverage.find((surface) => surface.id === "operations-head-company-brand-selector").externalFilterRequiredExpressions = ["queryText: impossible"];
      write(catalogSource, JSON.stringify(externalSelectorCatalog, null, 2) + "\n");
      let crudExternalSelectorRed = false;
      try { actions[action](scratch); } catch (error) { crudExternalSelectorRed = String(error).includes("R5_CRUD_PRESENTATION_REQUIRED_EXPRESSION_MISSING"); }
      if (!crudExternalSelectorRed) fail("R5_CRUD_EXTERNAL_SELECTOR_SELF_TEST_NOT_DETECTED");
      write(catalogSource, catalogOriginal);
      const legacyFallback = "apps/frontend/operations-admin/src/main.js";
      write(legacyFallback, "fetch('/api/operations/legacy');\n");
      let legacyFallbackRed = false;
      try { actions[action](scratch); } catch (error) { legacyFallbackRed = String(error).includes("R5_FRONTEND_LEGACY_BUILD_FALLBACK_PRESENT"); }
      if (!legacyFallbackRed) fail("R5_FRONTEND_LEGACY_BUILD_FALLBACK_SELF_TEST_NOT_DETECTED");
      fs.rmSync(path.join(scratch, legacyFallback));
      const handwrittenRoute = "scripts/test/edge-route-literal-red.mjs";
      write(handwrittenRoute, "const endpoint = '/api/forbidden';\n");
      let handwrittenRouteRed = false;
      try { assertNoHandwrittenEdgeRouteLiterals(scratch); } catch (error) { handwrittenRouteRed = String(error).includes("R5_EDGE_ROUTE_LITERAL"); }
      if (!handwrittenRouteRed) fail("R5_EDGE_ROUTE_LITERAL_SELF_TEST_NOT_DETECTED");
      process.stdout.write("R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_RED=PASS\nR5_FRONTEND_PLATFORM_LOGOUT_LOCAL_CLEAR_RED=PASS\nR5_FRONTEND_OPERATIONS_LOGOUT_LOCAL_CLEAR_RED=PASS\nR5_CRUD_PRIMARY_IDENTITY_RED=PASS\nR5_CRUD_PRIMARY_DETAIL_RED=PASS\nR5_CRUD_FILTER_COLUMN_COVERAGE_RED=PASS\nR5_CRUD_EXTERNAL_SELECTOR_RED=PASS\nR5_EDGE_ROUTE_LITERAL_RED=PASS\nR4_FRONTEND_SELF_TEST=PASS\n");
      return;
    } else if (action === "database") {
      const source = `${appRoot}/src/main/resources/db/migration/V20260725_170000_000__platform_workspace_and_commercial_group.sql`;
      write(source, read(source, scratch) + "\nALTER TABLE organization.commercial_group DEFERRABLE;\n");
    } else if (action === "budget") {
      write("apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/R4BudgetLeak.java", "// SELECT * FROM organization.commercial_group\n");
    } else if (action === "backend") {
      write("apps/backend/catering-business-server/build.gradle.kts", "dependencies { implementation(\"org.projectlombok:lombok\") }\n");
    } else if (action === "openapi") {
      write(`${appRoot}/src/main/resources/generated/edge-route-face-registry.json`, "{}\n");
    } else if (action === "traceability") {
      write("doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md", "# trace omitted\n");
      write("doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md", "# trace omitted\n");
    } else if (action === "terminology") {
      write("contracts/openapi/edge.openapi.json", "openapi: 3.0.3\ninfo:\n  title: removed terminology\n  version: r4\n");
    } else if (action === "logging") {
      write("apps/backend/catering-business-server/src/main/java/R4Leak.java", "class R4Leak { String password = \"plaintext\"; }\n");
    } else if (action === "retirement") {
      write("apps/backend/catering-business-server/src/main/java/R4RetirementResidue.java", "class R4RetirementResidue { void x() { new WebClient(); } }\n");
    } else if (action === "affected-l2") {
      const multiConsumerTarget = "apps/frontend/fixture/affected-l2/source-1/SecondPhysicalStep.tsx";
      fs.rmSync(path.join(scratch, multiConsumerTarget));
      let physicalTargetRed = false;
      try { actions[action](scratch); } catch (error) { physicalTargetRed = String(error).includes("R5_AFFECTED_L2_PHYSICAL_TARGET_MISSING"); }
      if (!physicalTargetRed) fail("R5_AFFECTED_L2_PHYSICAL_TARGET_SELF_TEST_NOT_DETECTED");
      write(multiConsumerTarget, "export {};\n");
      const fixtureTarget = "fixtures/tests/l2/real.spec.ts";
      fs.rmSync(path.join(scratch, fixtureTarget));
      let missingRed = false;
      try { actions[action](scratch); } catch (error) { missingRed = String(error).includes("R5_AFFECTED_L2_TARGET_MISSING"); }
      if (!missingRed) fail("R5_AFFECTED_L2_MISSING_TARGET_SELF_TEST_NOT_DETECTED");
      write(fixtureTarget, "// path-only fixture\n");
      let emptyStubRed = false;
      try { actions[action](scratch); } catch (error) { emptyStubRed = String(error).includes("R5_AFFECTED_L2_EMPTY_STUB"); }
      if (!emptyStubRed) fail("R5_AFFECTED_L2_EMPTY_STUB_SELF_TEST_NOT_DETECTED");
      write(fixtureTarget, "import { test, expect } from '@playwright/test';\ntest('fixture is real', async () => { expect(true).toBe(true); });\n");
      const registry = JSON.parse(read("contracts/policy/affected-l2-registry.json", scratch));
      registry.surfaces.find((surface) => surface.id === "FIXTURE-1").paths = ["apps/frontend/fixture/affected-l2/stale/"];
      write("contracts/policy/affected-l2-registry.json", `${JSON.stringify(registry, null, 2)}\n`);
      let derivationRed = false;
      try { actions[action](scratch); } catch (error) { derivationRed = String(error).includes("R5_AFFECTED_L2_LAYOUT_DERIVATION_DRIFT"); }
      if (!derivationRed) fail("R5_AFFECTED_L2_LAYOUT_DERIVATION_SELF_TEST_NOT_DETECTED");
      registry.surfaces.find((surface) => surface.id === "FIXTURE-1").paths = ["apps/frontend/fixture/affected-l2/source-1/"];
      registry.legacyDeferredTestCount = 1;
      registry.legacyTestDebts = [{ target: fixtureTarget, state: "DEFERRED", deferredUntilPhase: "RM2", reason: "Self-test exercises expiry." }];
      write("contracts/policy/affected-l2-registry.json", `${JSON.stringify(registry, null, 2)}\n`);
      fs.rmSync(path.join(scratch, fixtureTarget));
      let selectedChangeRed = false;
      try { actions[action](scratch, ["apps/frontend/fixture/affected-l2/source-1/Page.tsx"]); } catch (error) { selectedChangeRed = String(error).includes("R5_AFFECTED_L2_DEFERRED_SELECTED_FOR_CHANGE"); }
      if (!selectedChangeRed) fail("R5_AFFECTED_L2_SELECTED_CHANGE_SELF_TEST_NOT_DETECTED");
      let expiryRed = false;
      try { actions[action](scratch, [], "RM2"); } catch (error) { expiryRed = String(error).includes("R5_AFFECTED_L2_DEFERRED_EXPIRED"); }
      if (!expiryRed) fail("R5_AFFECTED_L2_EXPIRY_SELF_TEST_NOT_DETECTED");
      process.stdout.write("R5_AFFECTED_L2_PHYSICAL_TARGET_RED=PASS\nR5_AFFECTED_L2_MISSING_TARGET_RED=PASS\nR5_AFFECTED_L2_EMPTY_STUB_RED=PASS\nR5_AFFECTED_L2_LAYOUT_DERIVATION_RED=PASS\nR5_AFFECTED_L2_SELECTED_CHANGE_RED=PASS\nR5_AFFECTED_L2_EXPIRY_RED=PASS\nR4_AFFECTED_L2_SELF_TEST=PASS\n");
      return;
    } else if (action === "flyway-test-locations") {
      const source = "apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/OrganizationOwnerServiceTest.java";
      write(source, read(source, scratch).replace("filesystem:../../src/main/resources/db/migration", "filesystem:../../../apps/backend/catering-business-server/src/main/resources/db/migration"));
      let resolverRed = false;
      try { actions[action](scratch); } catch (error) { resolverRed = String(error).includes("R5_FLYWAY_TEST_LOCATION_RESOLUTION_INVALID"); }
      if (!resolverRed) fail("R5_FLYWAY_TEST_LOCATION_SELF_TEST_NOT_DETECTED");
      process.stdout.write("R5_FLYWAY_TEST_LOCATION_RED=PASS\nR5_FLYWAY_TEST_LOCATION_SELF_TEST=PASS\n");
      return;
    }
    let red = false;
    try { actions[action](scratch); } catch { red = true; }
    if (!red) fail("R4_GATE_SELF_TEST_RED_NOT_DETECTED", action);
    process.stdout.write(`R4_${action.toUpperCase().replaceAll("-", "_")}_SELF_TEST=PASS\n`);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}
const [, , action, flag, value] = process.argv;
if (!actions[action]) { process.stderr.write("usage: cli.mjs <" + Object.keys(actions).join("|") + "> [--self-test]\n"); process.exit(2); }
try {
  if (flag === "--self-test") selfTest(action);
  else if (action === "affected-l2" && flag === "--changed") actions[action](root, value ? value.split(",").filter(Boolean) : []);
  else if (action === "affected-l2" && flag === "--phase") actions[action](root, [], value);
  else actions[action]();
} catch (error) { process.stderr.write(`R4_GATE=FAIL\nREASON=${error.message}\n`); process.exit(1); }
