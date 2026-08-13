#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = process.env.BACKEND_ACCEPTANCE_ROOT
  ? path.resolve(process.env.BACKEND_ACCEPTANCE_ROOT)
  : DEFAULT_ROOT;
const ACTIVE_PACKAGE_PATH = ".runtime/compliance-control/active-package.json";
const PACKAGE_ID = "BACKEND-ACCEPTANCE-IMPLEMENTATION-20260813";
const ROUTE_REGISTRY_PATHS = Object.freeze([
  "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
  "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json",
]);
const BINDING_PATH = "contracts/registry/operation-handler-bindings.json";
const SOURCE_INVENTORY_PATH = "contracts/registry/backend-performance-operation-source-inventory.json";
const EXECUTION_CONTRACT_PATH = "contracts/policy/backend-acceptance-execution-contract.json";
const DERIVATION_CONTRACT_PATH = "contracts/policy/backend-acceptance-production-surface-derivation.json";
const HISTORICAL_CATALOG_PATH = "doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json";
const P4_PATH = "doc/evidence/platform/rm1/p4/canonical-performance-ledger.json";
const PREDECESSOR_BASELINE_PATH = "contracts/registry/performance-refactor-command-baselines.json";
const DEFAULT_OUTPUTS = Object.freeze({
  packageInput: "doc/evidence/platform/backend-acceptance/implementation-package-input.json",
  manifest: "doc/evidence/platform/backend-acceptance/implementation-manifest.json",
  entryImpact: "doc/evidence/platform/backend-acceptance/entry-impact-snapshot.json",
  knownUncovered: "contracts/registry/backend-acceptance-known-uncovered.json",
  scenarios: "contracts/registry/backend-acceptance-scenarios.json",
  acceptedBaseline: "contracts/registry/backend-acceptance-accepted-baseline.json",
  historicalDisposition: "doc/evidence/platform/backend-acceptance-historical-seed-dispositions.json",
  dynamicReport: "doc/evidence/platform/backend-acceptance/dynamic-acceptance-report.json",
});
const SCENARIO_FIELDS = Object.freeze([
  "identity",
  "fixture",
  "request",
  "businessOracle",
  "performanceCriterion",
  "cleanup",
]);
const SOURCE_DENOMINATORS = Object.freeze([
  "AUTHORITY_AND_REQUIREMENT",
  "TERMINOLOGY_AND_STANDARD_LANDING",
  "OPERATION_SCENARIO_AND_FOUR_DIMENSIONS",
  "RUNNER_MIGRATION_AND_RETIREMENT",
  "CHANGE_IMPACT_AND_BUG_RED_PROOF",
  "PREVENTION_ACCEPTANCE_AND_HANDOFF",
]);
const OWNER_MODULE_FIELDS = Object.freeze(["owner", "moduleRoot", "providerRoot", "providerPackage"]);
const SOURCE_INVENTORY_PATH_FIELDS = Object.freeze([
  "edge",
  "adapter",
  "transaction",
  "ownerBoundary",
]);
const BASELINE_METRICS = Object.freeze([
  "LOGICAL_SQL",
  "QUERY",
  "UPDATE",
  "CONNECTION",
  "TRANSACTION",
  "BATCH",
]);
const RETAINED_OWNER_LOGIC_PATH = "contracts/policy/backend-acceptance-retained-owner-logic.json";
const ROUTE_UNEXPRESSIBLE_PATH = "contracts/policy/backend-acceptance-route-unexpressible-regressions.json";
const ASSERTION_MIGRATION_PATH = "doc/evidence/platform/backend-acceptance/assertion-migration.json";
const PREDECESSOR_DISPOSITIONS_PATH = "doc/evidence/platform/backend-acceptance/predecessor-asset-dispositions.json";
const STATIC_SCENARIO_STATUS = "STATIC_ADMITTED_AWAITING_OWNER_PROVIDER_MIGRATION";
const STATIC_BASELINE_STATUS = "ENTRY_BASELINE_REGISTRY";
const STATIC_HISTORICAL_STATUS = "ENTRY_REPLAY_DENOMINATOR";
const STATIC_ASSET_DISPOSITION_STATUS = "ACTIVE_AWAITING_BACKEND_ACCEPTANCE_DYNAMIC";
const CLOSED_UNCOVERED_STATUS = "CLOSED_WITH_FRESH_FULL_RUN";

function fail(code, detail = "") {
  const error = new Error(code + (detail ? ":" + detail : ""));
  error.code = code;
  throw error;
}

function absolute(relative) {
  return path.join(ROOT, relative);
}

function hashBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hashFile(relative) {
  const file = absolute(relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return "ABSENT";
  return hashBytes(fs.readFileSync(file));
}

function readJson(relative, code = "BACKEND_ACCEPTANCE_SOURCE_MISSING") {
  const file = absolute(relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(code, relative);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(code + "_INVALID_JSON", relative + ":" + error.message);
  }
}

function writeAtomicNoReplace(relative, value) {
  const file = absolute(relative);
  if (fs.existsSync(file)) fail("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_ALREADY_EXISTS", relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function writeAtomicReplace(relative, value) {
  const file = absolute(relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function stableDigest(value) {
  return hashBytes(Buffer.from(JSON.stringify(value)));
}

function serializedHash(value) {
  return hashBytes(Buffer.from(JSON.stringify(value, null, 2) + "\n"));
}

function normalizePath(value) {
  if (typeof value !== "string" || value.length === 0) fail("BACKEND_ACCEPTANCE_ROUTE_PATH_INVALID", "EMPTY");
  const normalized = value.replace(/\/+/g, "/");
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function identityKey(row) {
  return JSON.stringify([
    row.operationId,
    String(row.method).toUpperCase(),
    normalizePath(row.path),
    row.consumerFace || row.face,
    row.owner,
  ]);
}

function routeMetadata(relative, value) {
  return {
    path: relative,
    schemaVersion: value.schemaVersion ?? null,
    revision: value.revision ?? null,
    generatedFrom: value.generatedFrom ?? null,
    contractDigest: value.contractDigest ?? null,
    contentSha256: hashFile(relative),
  };
}

function loadRoutes() {
  const rows = [];
  const metadata = [];
  for (const relative of ROUTE_REGISTRY_PATHS) {
    const registry = readJson(relative, "BACKEND_ACCEPTANCE_ROUTE_REGISTRY_MISSING");
    if (!Array.isArray(registry.operations)) fail("BACKEND_ACCEPTANCE_ROUTE_REGISTRY_OPERATIONS_INVALID", relative);
    metadata.push(routeMetadata(relative, registry));
    for (const operation of registry.operations) {
      if (!operation || typeof operation !== "object"
        || typeof operation.operationId !== "string"
        || typeof operation.method !== "string"
        || typeof operation.path !== "string"
        || typeof operation.owner !== "string"
        || !Array.isArray(operation.consumerFaces)
        || operation.consumerFaces.length !== 1
        || typeof operation.consumerFaces[0] !== "string") {
        fail("BACKEND_ACCEPTANCE_ROUTE_OPERATION_INVALID", relative + ":" + (operation?.operationId || "UNKNOWN"));
      }
      rows.push({
        operationId: operation.operationId,
        method: operation.method.toUpperCase(),
        path: operation.path,
        normalizedPath: normalizePath(operation.path),
        consumerFace: operation.consumerFaces[0],
        owner: operation.owner,
        routeRegistry: relative,
      });
    }
  }
  const keys = rows.map(identityKey);
  if (new Set(keys).size !== keys.length) fail("BACKEND_ACCEPTANCE_ROUTE_OPERATION_DUPLICATE");
  return { rows, metadata };
}

function loadBindings() {
  const binding = readJson(BINDING_PATH, "BACKEND_ACCEPTANCE_BINDING_MISSING");
  if (!Array.isArray(binding.operations)) fail("BACKEND_ACCEPTANCE_BINDING_OPERATIONS_INVALID");
  return binding;
}

function bindingIdentityRows(binding, routeRows) {
  const routeById = new Map(routeRows.map((row) => [row.operationId, row]));
  return binding.operations.map((row) => {
    const route = routeById.get(row.operationId);
    if (!route) fail("BACKEND_ACCEPTANCE_BINDING_OPERATION_UNKNOWN", row.operationId);
    return {
      operationId: row.operationId,
      method: route.method,
      path: row.path,
      normalizedPath: row.normalizedPath,
      consumerFace: row.face,
      owner: row.owner,
      routeRegistry: route.routeRegistry,
      mode: row.mode,
      adapter: row.adapter,
      wireRequest: row.wireRequest,
      wireResponse: row.wireResponse,
      contextKind: row.contextKind,
      transactionMode: row.transactionMode,
      copyRole: row.copyRole,
      commandBoundary: row.commandBoundary,
    };
  });
}

function compareOperationIdentity(routeRows, bindingRows) {
  const routeKeys = routeRows.map(identityKey).sort();
  const bindingKeys = bindingRows.map(identityKey).sort();
  if (routeKeys.length !== bindingKeys.length || routeKeys.some((key, index) => key !== bindingKeys[index])) {
    fail("BACKEND_ACCEPTANCE_OPERATION_IDENTITY_EXACT_SET_DRIFT", "routes=" + routeKeys.length + ":bindings=" + bindingKeys.length);
  }
}

function compareProjectionFreshness(binding, metadata) {
  const expected = Object.fromEntries(metadata.map((entry) => [entry.path.includes("catalog-inventory") ? "catalog-inventory" : "edge-face", {
    schemaVersion: entry.schemaVersion,
    revision: entry.revision,
    generatedFrom: entry.generatedFrom,
    contractDigest: entry.contractDigest,
    contentSha256: entry.contentSha256,
  }]));
  const canonical = (value) => Object.fromEntries(Object.keys(value || {}).sort()
    .map((key) => [key, value[key]]));
  if (JSON.stringify(canonical(binding.routeSources)) !== JSON.stringify(canonical(expected))) {
    fail("STALE_ROUTE_OR_BINDING", "projection metadata does not match current producer bytes");
  }
}

function operationState() {
  const routes = loadRoutes();
  const binding = loadBindings();
  const bindingRows = bindingIdentityRows(binding, routes.rows);
  compareOperationIdentity(routes.rows, bindingRows);
  let fresh = true;
  try {
    compareProjectionFreshness(binding, routes.metadata);
  } catch (error) {
    if (error.code === "STALE_ROUTE_OR_BINDING") fresh = false;
    else throw error;
  }
  return {
    routes: routes.rows,
    binding,
    bindingRows,
    routeMetadata: routes.metadata,
    routeIdentityDigest: stableDigest(routes.rows.map((row) => ({
      operationId: row.operationId,
      method: row.method,
      normalizedPath: row.normalizedPath,
      consumerFace: row.consumerFace,
      owner: row.owner,
    }))),
    bindingSha256: hashFile(BINDING_PATH),
    fresh,
  };
}

function walkFiles(relativeRoot, predicate = () => true) {
  const root = absolute(relativeRoot);
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "build" || entry.name === ".gradle" || entry.name.startsWith(".")) continue;
      const file = path.join(directory, entry.name);
      const relative = path.relative(ROOT, file).split(path.sep).join("/");
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && predicate(relative)) result.push(relative);
    }
  };
  visit(root);
  return result.sort();
}

function productionSurface() {
  const paths = new Map();
  const add = (relative, owner) => {
    if (!fs.existsSync(absolute(relative)) || !fs.statSync(absolute(relative)).isFile()) return;
    paths.set(relative, {
      path: relative,
      exists: true,
      sha256: hashFile(relative),
      derivationOwner: owner,
    });
  };
  for (const relative of walkFiles("apps/backend/catering-business-server/src/main/java")) add(relative, "app.main.java");
  for (const relative of walkFiles("apps/backend/catering-business-server/src/main/resources")) add(relative, "app.main.resources");
  for (const relative of walkFiles("apps/backend/catering-business-server/modules", (entry) =>
    /\/src\/main\/(?:java|resources)\//.test(entry))) add(relative, "module.main.source_or_resource");
  add("apps/backend/catering-business-server/build.gradle.kts", "app.gradle.main_inputs");
  for (const relative of walkFiles("apps/backend/catering-business-server/modules", (entry) =>
    /\/build\.gradle\.kts$/.test(entry))) add(relative, "module.gradle.main_inputs");
  for (const relative of ROUTE_REGISTRY_PATHS) add(relative, "generated.route_projection_task_input");
  return [...paths.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function anchorPath(anchor) {
  if (typeof anchor !== "string" || anchor.length === 0) return null;
  return anchor.split("#", 1)[0];
}

function entryAnchors(p0) {
  const p0ByPath = new Map(p0.map((entry) => [entry.path, entry]));
  const inventory = readJson(SOURCE_INVENTORY_PATH, "BACKEND_ACCEPTANCE_SOURCE_INVENTORY_MISSING");
  if (!Array.isArray(inventory.rows)) fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_INVALID");
  const anchors = new Map();
  const add = (rowId, field, anchor) => {
    const relative = anchorPath(anchor);
    if (!relative || !p0ByPath.has(relative)) return;
    const key = relative + "|" + rowId + "|" + field;
    const row = inventory.rows.find((entry) => entry.rowId === rowId);
    anchors.set(key, {
      path: relative,
      sha256: p0ByPath.get(relative).sha256,
      operationId: row?.operationId || null,
      sourceAnchor: anchor,
      sourceField: field,
    });
  };
  for (const row of inventory.rows) {
    add(row.rowId, "edge.sourceAnchor", row.edge?.sourceAnchor);
    add(row.rowId, "adapter.sourceAnchor", row.adapter?.sourceAnchor);
    add(row.rowId, "transaction.sourceAnchor", row.transaction?.sourceAnchor);
    add(row.rowId, "ownerBoundary.sourceAnchor", row.ownerBoundary?.sourceAnchor);
    for (const binding of row.ownerApiBindings || []) add(row.rowId, "ownerApiBindings.sourceAnchor", binding.sourceAnchor);
  }
  return [...anchors.values()].sort((left, right) =>
    (left.path + "|" + left.sourceAnchor).localeCompare(right.path + "|" + right.sourceAnchor));
}

function assetSnapshot() {
  const assets = new Set([
    "scripts/test/r5-remote-testcontainers.mjs",
    "scripts/test/r5-testcontainers-daemon-lanes.mjs",
    "scripts/test/r5-remote-testcontainers.test.mjs",
    "apps/backend/catering-business-server/src/test/java/dynamic/BackendPerformanceTestcontainers196Test.java",
    "apps/backend/catering-business-server/src/test/java/edge/EdgeRouteRegistryCoverageTest.java",
    "apps/backend/catering-business-server/src/test/java/database/P4SqlOperationBudgetTest.java",
  ]);
  for (const relative of walkFiles("apps/backend/catering-business-server/src/test/java", (entry) =>
    entry.endsWith(".java"))) assets.add(relative);
  const entries = [...assets].filter((relative) => fs.existsSync(absolute(relative)))
    .sort()
    .map((relative) => ({ path: relative, sha256: hashFile(relative) }));
  return {
    paths: entries,
    sha256: stableDigest(entries),
  };
}

function readOwnerMappings() {
  const contract = readJson(EXECUTION_CONTRACT_PATH, "BACKEND_ACCEPTANCE_EXECUTION_CONTRACT_MISSING");
  if (!Array.isArray(contract.ownerModuleMappings)) fail("BACKEND_ACCEPTANCE_OWNER_MAPPING_INVALID");
  const result = new Map();
  for (const entry of contract.ownerModuleMappings) {
    if (!entry || OWNER_MODULE_FIELDS.some((field) => typeof entry[field] !== "string" || entry[field].length === 0)) {
      fail("BACKEND_ACCEPTANCE_OWNER_MAPPING_INVALID");
    }
    if (result.has(entry.owner)) fail("BACKEND_ACCEPTANCE_OWNER_MAPPING_DUPLICATE", entry.owner);
    result.set(entry.owner, entry);
  }
  return { contract, mappings: result };
}

function providerPath(operationId, owner, mappings) {
  const mapping = mappings.get(owner);
  if (!mapping) fail("BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED", owner);
  const upperCamel = operationId.split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  return mapping.providerRoot + "/" + upperCamel + "BackendAcceptanceScenarioProvider.java";
}

function sourceInventoryState(state) {
  const inventory = readJson(SOURCE_INVENTORY_PATH, "BACKEND_ACCEPTANCE_SOURCE_INVENTORY_MISSING");
  if (!Array.isArray(inventory.rows)) fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_INVALID");
  const routeByKey = new Map(state.routes.map((row) => [identityKey(row), row]));
  const byKey = new Map();
  for (const row of inventory.rows) {
    if (!row || typeof row.operationId !== "string" || typeof row.owner !== "string"
      || typeof row.consumerFace !== "string" || !row.route || typeof row.route !== "object") {
      fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_ROW_INVALID", row?.rowId || "UNKNOWN");
    }
    const candidate = {
      operationId: row.operationId,
      method: String(row.route.method || "").toUpperCase(),
      path: row.route.path,
      consumerFace: row.consumerFace,
      owner: row.owner,
    };
    const key = identityKey(candidate);
    const route = routeByKey.get(key);
    if (!route || route.owner !== row.owner || route.consumerFace !== row.consumerFace
      || route.routeRegistry !== row.route.routeRegistry
      || String(row.route.routeOwner || row.owner) !== row.owner
      || JSON.stringify(row.route.routeConsumerFaces || [row.consumerFace]) !== JSON.stringify([row.consumerFace])) {
      fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_IDENTITY_DRIFT", row.rowId || row.operationId);
    }
    if (byKey.has(key)) fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_DUPLICATE", row.rowId || row.operationId);
    byKey.set(key, row);
  }
  if (byKey.size !== state.routes.length || state.routes.some((row) => !byKey.has(identityKey(row)))) {
    fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_EXACT_SET_DRIFT", "routes=" + state.routes.length + ":inventory=" + byKey.size);
  }
  return {
    path: SOURCE_INVENTORY_PATH,
    sha256: hashFile(SOURCE_INVENTORY_PATH),
    rows: inventory.rows,
    byKey,
  };
}

function sourceInventoryRefs(row) {
  const refs = [];
  const unresolved = [];
  for (const field of SOURCE_INVENTORY_PATH_FIELDS) {
    const value = row[field];
    if (typeof value?.sourceAnchor === "string" && value.sourceAnchor.length > 0) {
      refs.push({
        field,
        sourceAnchor: value.sourceAnchor,
        sourcePath: anchorPath(value.sourceAnchor),
        sourceSha256: value.sourceSha256 || null,
        sourceStatus: value.sourceStatus || value.reachabilityStatus || null,
      });
    } else {
      unresolved.push({ field, status: value?.reachabilityStatus || "SOURCE_ANCHOR_NOT_DECLARED" });
    }
  }
  for (const [index, value] of (row.ownerApiBindings || []).entries()) {
    if (typeof value?.sourceAnchor === "string" && value.sourceAnchor.length > 0) {
      refs.push({
        field: "ownerApiBindings[" + index + "]",
        sourceAnchor: value.sourceAnchor,
        sourcePath: anchorPath(value.sourceAnchor),
        sourceSha256: value.sourceSha256 || null,
        sourceStatus: value.sourceStatus || value.reachabilityStatus || null,
      });
    } else {
      unresolved.push({ field: "ownerApiBindings[" + index + "]", status: value?.reachabilityStatus || "SOURCE_ANCHOR_NOT_DECLARED" });
    }
  }
  return { refs, unresolved };
}

function ownerProviderLocator(operation, mappings) {
  const mapping = mappings.get(operation.owner);
  if (!mapping) fail("BACKEND_ACCEPTANCE_OWNER_MODULE_UNMAPPED", operation.owner);
  const filePath = providerPath(operation.operationId, operation.owner, mappings);
  return {
    owner: mapping.owner,
    gradleProject: mapping.gradleProject,
    moduleRoot: mapping.moduleRoot,
    providerRoot: mapping.providerRoot,
    providerPackage: mapping.providerPackage,
    providerPath: filePath,
    providerClass: path.basename(filePath, ".java"),
  };
}

function baselineLocator(identity) {
  return DEFAULT_OUTPUTS.acceptedBaseline + "#operations[identityKey=" + identityKey(identity) + "]";
}

function buildScenarioRegistry(state, inventoryState, mappings) {
  const bindingByOperationId = new Map(state.binding.operations.map((row) => [row.operationId, row]));
  const operations = [...state.routes]
    .sort((left, right) => identityKey(left).localeCompare(identityKey(right)))
    .map((route) => {
      const key = identityKey(route);
      const source = inventoryState.byKey.get(key);
      const binding = bindingByOperationId.get(route.operationId);
      if (!binding) fail("BACKEND_ACCEPTANCE_BINDING_OPERATION_UNKNOWN", route.operationId);
      const locator = ownerProviderLocator(route, mappings);
      const sourceRefs = sourceInventoryRefs(source);
      const identity = {
        operationId: route.operationId,
        method: route.method,
        path: route.path,
        normalizedPath: route.normalizedPath,
        consumerFace: route.consumerFace,
        owner: route.owner,
        owningUnit: locator,
      };
      const correctnessCasesEmptyReason = route.method === "GET"
        ? "Read operation has no mutation replay semantics; owner provider still declares authorization and rejection applicability before dynamic execution."
        : "Static registry does not invent command-specific authorization, rejection, idempotency, CAS, replay, or scope cases; the owner provider must declare them from owning source during BA-U05 migration.";
      return {
        identity,
        providerPath: locator.providerPath,
        providerLocator: locator,
        fixture: {
          provider: locator.providerPath + "#fixture",
          ownerLifecycle: "OWNER_PUBLIC_LIFECYCLE",
          namespaceOwnership: "RUN_SCOPED",
          namespaceKinds: ["DATABASE_OR_SCHEMA_NAMESPACE", "OBJECT_STORAGE_NAMESPACE"],
          sourceInventoryRef: {
            path: inventoryState.path,
            sha256: inventoryState.sha256,
            rowId: source.rowId,
          },
          sourceRefs,
        },
        request: {
          builder: "GENERATED_OPERATION_REQUEST_BUILDER",
          operationId: route.operationId,
          method: route.method,
          path: route.path,
          wireRequest: binding.wireRequest || null,
          wireResponse: binding.wireResponse || null,
          contextKind: binding.contextKind || null,
          transactionMode: binding.transactionMode || null,
          commandBoundary: binding.commandBoundary || null,
          copyRole: binding.copyRole || null,
          secretHandlesOnly: true,
          shapeSource: BINDING_PATH,
        },
        businessOracle: {
          provider: locator.providerPath + "#businessOracle",
          contractOracle: "UNIFIED_OPENAPI_ENVELOPE_AND_PROBLEM_VALIDATOR",
          ownerReadback: "OWNER_PUBLIC_API_READBACK",
          sourceRefs,
        },
        performanceCriterion: {
          baselineRef: baselineLocator(route),
          metrics: [...BASELINE_METRICS],
          shapeInput: source.shapeInput || null,
          sourceInventoryRef: {
            path: inventoryState.path,
            sha256: inventoryState.sha256,
            rowId: source.rowId,
          },
          sourceRefs,
        },
        cleanup: {
          provider: locator.providerPath + "#cleanup",
          readback: "RUN_SCOPED_MANIFEST_AND_NAMESPACE_READBACK",
          requiredNamespaces: [
            "DATABASE_OR_SCHEMA_NAMESPACE",
            "OBJECT_STORAGE_NAMESPACE",
            "MANAGED_CONTAINER_AND_PROCESS",
          ],
          sourceInventoryRef: {
            path: inventoryState.path,
            sha256: inventoryState.sha256,
            rowId: source.rowId,
          },
        },
        correctnessCases: [],
        correctnessCasesEmptyReason,
        sourceInventory: {
          path: inventoryState.path,
          sha256: inventoryState.sha256,
          rowId: source.rowId,
          identityDigest: stableDigest(source),
        },
        binding: {
          path: BINDING_PATH,
          sha256: state.bindingSha256,
          operationDigest: stableDigest(binding),
        },
      };
    });
  return {
    schemaVersion: 1,
    kind: "backend-acceptance-scenarios",
    packageId: PACKAGE_ID,
    status: STATIC_SCENARIO_STATUS,
    operationIdentitySource: "CURRENT_ENTRY_OPERATION_DENOMINATOR",
    exactSet: "CURRENT_SEMANTIC_OPERATION_IDENTITY",
    requiredFields: [...SCENARIO_FIELDS],
    routeSources: state.routeMetadata,
    bindingSource: { path: BINDING_PATH, sha256: state.bindingSha256 },
    sourceInventory: { path: inventoryState.path, sha256: inventoryState.sha256 },
    currentOperationIdentityDigest: state.routeIdentityDigest,
    operations,
  };
}

function buildBaselineRegistry(state) {
  const operations = [...state.routes]
    .sort((left, right) => identityKey(left).localeCompare(identityKey(right)))
    .map((route) => ({
      identityKey: identityKey(route),
      operationId: route.operationId,
      method: route.method,
      path: route.path,
      normalizedPath: route.normalizedPath,
      consumerFace: route.consumerFace,
      owner: route.owner,
      identityDigest: stableDigest({
        operationId: route.operationId,
        method: route.method,
        normalizedPath: route.normalizedPath,
        consumerFace: route.consumerFace,
        owner: route.owner,
      }),
      metrics: [...BASELINE_METRICS],
      baselineState: "NOT_MEASURED",
      latest: null,
      history: [],
      firstMeasurementRule: "FIRST_VALUE_MUST_BE_FRESH_ROUTE_MEASUREMENT_AFTER_KNOWN_COST_CALIBRATION",
    }));
  return {
    schemaVersion: 1,
    kind: "backend-acceptance-accepted-baseline",
    packageId: PACKAGE_ID,
    status: STATIC_BASELINE_STATUS,
    operationIdentitySource: "CURRENT_ENTRY_OPERATION_DENOMINATOR",
    exactSet: "CURRENT_SEMANTIC_OPERATION_IDENTITY",
    metrics: [...BASELINE_METRICS],
    routeSources: state.routeMetadata,
    bindingSource: { path: BINDING_PATH, sha256: state.bindingSha256 },
    currentOperationIdentityDigest: state.routeIdentityDigest,
    operations,
  };
}

function buildHistoricalDispositionEntry(catalogEntry, category, allowedDispositions, requiredEvidence, catalogHash) {
  return {
    findingId: catalogEntry.findingId,
    category,
    source: HISTORICAL_CATALOG_PATH + "#" + category + "[findingId=" + catalogEntry.findingId + "]",
    sourceCatalogSha256: catalogHash,
    sourceEntryDigest: stableDigest(catalogEntry),
    operationId: catalogEntry.operationId || null,
    allowedDispositions: [...allowedDispositions],
    requiredEvidence,
    requiredDisposition: catalogEntry.requiredDisposition || null,
  };
}

function buildHistoricalDisposition() {
  const catalog = readJson(HISTORICAL_CATALOG_PATH, "BACKEND_ACCEPTANCE_HISTORICAL_CATALOG_MISSING");
  const contract = catalog.implementationDispositionContract;
  if (!contract || typeof contract !== "object") fail("BACKEND_ACCEPTANCE_HISTORICAL_DISPOSITION_CONTRACT_MISSING");
  const catalogHash = hashFile(HISTORICAL_CATALOG_PATH);
  const entries = [];
  for (const item of catalog.requiredPerformanceRegressions || []) {
    entries.push(buildHistoricalDispositionEntry(
      item,
      "PERFORMANCE",
      contract.requiredPerformanceRegressions.allowed,
      contract.requiredPerformanceRegressions.requiredEvidence,
      catalogHash,
    ));
  }
  const httpContract = contract.historicalHttpFailureFamilies;
  for (const item of catalog.historicalHttpFailureFamilies || []) {
    entries.push(buildHistoricalDispositionEntry(
      item,
      "HTTP",
      httpContract.allowed,
      {
        REGRESSION_ADDED: [...httpContract.requiredCommonEvidence, ...httpContract.regressionAddedExtraEvidence],
        ALREADY_COVERED_WITH_FRESH_ROUTE_PROOF: [...httpContract.requiredCommonEvidence],
        SEED_CLIENT_OR_FIXTURE_ONLY_WITH_ROUTE_PROOF: [...httpContract.requiredCommonEvidence, ...httpContract.seedOnlyExtraEvidence],
      },
      catalogHash,
    ));
  }
  const nonRouteContract = contract.nonRouteSeedFailureFamilies;
  for (const item of catalog.nonRouteSeedFailureFamilies || []) {
    entries.push(buildHistoricalDispositionEntry(
      item,
      "NON_ROUTE",
      nonRouteContract.allowed,
      nonRouteContract.requiredEvidence,
      catalogHash,
    ));
  }
  return {
    schemaVersion: 1,
    kind: "backend-acceptance-historical-seed-dispositions",
    packageId: PACKAGE_ID,
    status: STATIC_HISTORICAL_STATUS,
    catalog: { path: HISTORICAL_CATALOG_PATH, sha256: catalogHash },
    exactSetRequired: true,
    pendingForbidden: true,
    freeTextOnlyForbidden: true,
    entries: entries.sort((left, right) => left.findingId.localeCompare(right.findingId)),
  };
}

function buildClosedPolicy(pathname, kind, allowedEntryReasons, rule) {
  return {
    schemaVersion: 1,
    kind,
    packageId: PACKAGE_ID,
    status: "ACTIVE_CLOSED_FINITE_SET",
    exactSetRequired: true,
    entries: [],
    entryShape: {
      required: ["operationId", "reasonCode", "owningSource", "evidenceRefs"],
      allowedReasonCodes: allowedEntryReasons,
    },
    rule,
    source: pathname,
  };
}

function buildManifest(state, mappings) {
  const providerPaths = state.routes.map((row) => providerPath(row.operationId, row.owner, mappings));
  if (new Set(providerPaths).size !== providerPaths.length) fail("BACKEND_ACCEPTANCE_PROVIDER_PATH_COLLISION");
  const sources = [
    "scripts/generate/operation-handler-bindings.mjs",
    BINDING_PATH,
    "tools/implementation-design-granularity/cli.mjs",
    "scripts/check/implementation-design-granularity",
    EXECUTION_CONTRACT_PATH,
    DEFAULT_OUTPUTS.scenarios,
    DEFAULT_OUTPUTS.knownUncovered,
    DEFAULT_OUTPUTS.acceptedBaseline,
    "contracts/policy/backend-acceptance-retained-owner-logic.json",
    "contracts/policy/backend-acceptance-route-unexpressible-regressions.json",
    HISTORICAL_CATALOG_PATH,
    DEFAULT_OUTPUTS.historicalDisposition,
    "tools/backend-acceptance/cli.mjs",
    "scripts/test/backend-acceptance",
    "scripts/test/backend-acceptance.test.mjs",
    "tools/backend-acceptance/impact.mjs",
    "tools/compliance-control/cli.mjs",
    "scripts/check/backend-acceptance-change-impact",
    "scripts/check/backend-acceptance-change-impact.test.mjs",
    DERIVATION_CONTRACT_PATH,
    "doc/evidence/platform/backend-acceptance/change-dispositions.schema.json",
    "doc/evidence/platform/backend-acceptance/assertion-migration.json",
    "doc/evidence/platform/backend-acceptance/predecessor-asset-dispositions.json",
    "doc/evidence/platform/rm1/p4/canonical-performance-ledger.json",
    ...providerPaths,
  ];
  const deliveryUnits = [
    { id: "BA-U01", status: "ACTIVE", changeSurfaces: sources.slice(0, 5) },
    { id: "BA-U02", status: "ACTIVE", changeSurfaces: sources.slice(5, 17) },
    { id: "BA-U03", status: "ACTIVE", changeSurfaces: sources.slice(17, 31) },
    { id: "BA-U04", status: "ACTIVE", changeSurfaces: sources.slice(31, 39) },
    { id: "BA-U05", status: "ACTIVE", changeSurfaces: sources.slice(39) },
    { id: "BA-U06", status: "ACTIVE", changeSurfaces: [
      "doc/evidence/platform/backend-acceptance/predecessor-asset-dispositions.json",
      "scripts/test/backend-acceptance",
      DEFAULT_OUTPUTS.knownUncovered,
      "doc/evidence/platform/backend-acceptance/implementation-exit.json",
      "doc/review/platform/backend-acceptance/implementation-review-request.md",
    ] },
  ];
  return {
    schemaVersion: 1,
    kind: "backend-acceptance-implementation-manifest",
    packageId: PACKAGE_ID,
    status: "IMPLEMENTATION_ACTIVE",
    machineId: "backend-acceptance",
    deliveryUnits,
    providerPaths,
    sourceComplianceDenominators: SOURCE_DENOMINATORS.map((id) => ({ id, status: "ENTRY_CAPTURED" })),
    authorityBinding: {
      designPath: "doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md",
      designSha256: "11d88e9cf5f1ce9063293cff1f2067816982aaecdbd1ccf4c453999adb1f3a56",
      designReviewPath: "doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-round2-claude.md",
      designReviewSha256: "1d1fc0ef26eae133fb3661d76622fb67570ce3959d0cb531ee150f3d6213becb",
    },
  };
}

function captureEntry() {
  const active = readJson(ACTIVE_PACKAGE_PATH, "BACKEND_ACCEPTANCE_ACTIVE_PACKAGE_INVALID");
  if (active.packageId !== PACKAGE_ID || active.implementationAuthority !== true
    || active.runtimeAuthority !== true || active.seedResetAuthority !== false
    || active.packageArchetype !== "backend-source") {
    fail("BACKEND_ACCEPTANCE_IMPLEMENTATION_PACKAGE_NOT_ACTIVE");
  }
  const outputPaths = [
    active.packageInputPath || DEFAULT_OUTPUTS.packageInput,
    active.implementationManifestPath || DEFAULT_OUTPUTS.manifest,
    active.entryImpactSnapshotPath || DEFAULT_OUTPUTS.entryImpact,
    active.packageExitPath || "doc/evidence/platform/backend-acceptance/implementation-exit.json",
    DEFAULT_OUTPUTS.knownUncovered,
  ];
  for (const relative of outputPaths) if (fs.existsSync(absolute(relative))) {
    fail("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_ALREADY_EXISTS", relative);
  }
  if (!fs.existsSync(absolute(DERIVATION_CONTRACT_PATH))) fail("BACKEND_ACCEPTANCE_DERIVATION_CONTRACT_MISSING");
  const state = operationState();
  const { mappings } = readOwnerMappings();
  const p0 = productionSurface();
  const w0 = entryAnchors(p0);
  const assets = assetSnapshot();
  const historical = readJson(HISTORICAL_CATALOG_PATH, "BACKEND_ACCEPTANCE_HISTORICAL_CATALOG_MISSING");
  const p4 = readJson(P4_PATH, "BACKEND_ACCEPTANCE_P4_LEDGER_MISSING");
  const baseline = readJson(PREDECESSOR_BASELINE_PATH, "BACKEND_ACCEPTANCE_PREDECESSOR_BASELINE_MISSING");
  const operations = state.routes.map((row) => ({
    ...row,
    identityKey: identityKey(row),
    identityDigest: stableDigest(row),
  }));
  const knownRows = operations.map((row) => ({
    identityKey: row.identityKey,
    operationId: row.operationId,
    status: "OPEN",
    entryIdentityDigest: row.identityDigest,
  }));
  const manifest = buildManifest(state, mappings);
  const packageEntry = {
    capturedAt: new Date().toISOString(),
    packageId: PACKAGE_ID,
    activePackage: { path: ACTIVE_PACKAGE_PATH, sha256: hashFile(ACTIVE_PACKAGE_PATH) },
    operationDenominator: {
      identitySource: "CURRENT_ROUTE_REGISTRY_UNION_AND_OPERATION_HANDLER_BINDINGS",
      rows: operations,
      routeIdentityDigest: state.routeIdentityDigest,
      binding: { path: BINDING_PATH, sha256: state.bindingSha256 },
      routeMetadata: state.routeMetadata,
      bindingFreshnessAtEntry: state.fresh ? "PASS" : "STALE_ROUTE_OR_BINDING_RECORDED_FOR_BA_U01",
    },
    sourceSurface: {
      p0,
      w0,
      p0Digest: stableDigest(p0),
      w0Digest: stableDigest(w0),
      derivationContract: { path: DERIVATION_CONTRACT_PATH, sha256: hashFile(DERIVATION_CONTRACT_PATH) },
    },
    semanticO0: {
      operationsDigest: stableDigest(operations),
      routeMetadata: state.routeMetadata,
      bindingSha256: state.bindingSha256,
      sourceInventory: { path: SOURCE_INVENTORY_PATH, sha256: hashFile(SOURCE_INVENTORY_PATH) },
    },
    knownUncovered: { path: DEFAULT_OUTPUTS.knownUncovered, rowCount: knownRows.length, status: "ENTRY_CAPTURED" },
    acceptedBaselineSources: [
      { path: PREDECESSOR_BASELINE_PATH, sha256: hashFile(PREDECESSOR_BASELINE_PATH), digest: stableDigest(baseline) },
      { path: P4_PATH, sha256: hashFile(P4_PATH), digest: stableDigest(p4) },
    ],
    behaviorAssertionsAndPredecessors: assets,
    historicalCatalog: { path: HISTORICAL_CATALOG_PATH, sha256: hashFile(HISTORICAL_CATALOG_PATH), digest: stableDigest(historical) },
    ownerModuleMappings: {
      path: EXECUTION_CONTRACT_PATH,
      sha256: hashFile(EXECUTION_CONTRACT_PATH),
      owners: [...mappings.keys()].sort(),
      mappingDigest: stableDigest([...mappings.values()].sort((left, right) => left.owner.localeCompare(right.owner))),
    },
  };
  const entryImpact = {
    schemaVersion: 1,
    kind: "backend-acceptance-entry-impact-snapshot",
    packageId: PACKAGE_ID,
    status: "ACTIVE_ENTRY_SNAPSHOT",
    capturedAt: packageEntry.capturedAt,
    derivationContract: { path: DERIVATION_CONTRACT_PATH, sha256: hashFile(DERIVATION_CONTRACT_PATH) },
    p0,
    w0,
    o0: packageEntry.semanticO0,
    p0Digest: packageEntry.sourceSurface.p0Digest,
    w0Digest: packageEntry.sourceSurface.w0Digest,
    o0Digest: stableDigest(packageEntry.semanticO0),
    semantics: "P0_W0_O0_IMMUTABLE_PACKAGE_ENTRY_BYTES",
  };
  const knownUncovered = {
    schemaVersion: 1,
    kind: "backend-acceptance-known-uncovered",
    packageId: PACKAGE_ID,
    status: "ACTIVE_MIGRATION_LEDGER",
    entryOperationKeys: knownRows.map((row) => row.identityKey).sort(),
    rows: knownRows.sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
    monotonicity: "CURRENT_MUST_BE_ENTRY_SUBSET; NEW_OPERATION_IS_FAIL_CLOSED",
  };
  const manifestHash = serializedHash(manifest);
  const entryImpactHash = serializedHash(entryImpact);
  const knownUncoveredHash = serializedHash(knownUncovered);
  const packageInput = {
    schemaVersion: 1,
    kind: "backend-acceptance-implementation-package-input",
    packageId: PACKAGE_ID,
    status: "ACTIVE_NOT_EXIT",
    programId: "V2S_W0_W4_EXECUTION",
    roadmapStep: "BACKEND_ACCEPTANCE_IMPLEMENTATION",
    machineId: "backend-acceptance",
    implementationAuthority: true,
    runtimeAuthority: true,
    runtimeAuthorityScope: "MANAGED_BACKEND_ACCEPTANCE_TESTCONTAINERS_ONLY",
    seedResetAuthority: false,
    designBinding: {
      path: "doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md",
      sha256: "11d88e9cf5f1ce9063293cff1f2067816982aaecdbd1ccf4c453999adb1f3a56",
    },
    requirementBinding: {
      path: "doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md",
      sha256: "12e8f75cdf267eae2fa3c5d7a2bb0ba061d8cf95202677423cbb95133a3738bb",
    },
    designReviewBinding: {
      path: "doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-round2-claude.md",
      sha256: "1d1fc0ef26eae133fb3661d76622fb67570ce3959d0cb531ee150f3d6213becb",
    },
    authorizationBinding: {
      instruction: "DEXTER_EXPLICIT_BACKEND_ACCEPTANCE_IMPLEMENTATION_AUTHORIZATION_20260813",
      path: "doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-authorization.md",
      sha256: "715e6078dec350e5ef0a4fa8c3b97901140645495ef0486f33633bc029190aee",
      excluded: ["DEV", "L2", "reset", "seed", "browser", "UAT", "deployment", "manual SQL", "Git"],
    },
    entrySnapshot: {
      capturedAt: packageEntry.capturedAt,
      packageInputPath: active.packageInputPath || DEFAULT_OUTPUTS.packageInput,
      implementationManifestPath: active.implementationManifestPath || DEFAULT_OUTPUTS.manifest,
      implementationManifestSha256: manifestHash,
      entryImpactSnapshotPath: active.entryImpactSnapshotPath || DEFAULT_OUTPUTS.entryImpact,
      entryImpactSnapshotSha256: entryImpactHash,
      knownUncoveredPath: DEFAULT_OUTPUTS.knownUncovered,
      knownUncoveredSha256: knownUncoveredHash,
      packageEntry,
    },
    sourceComplianceDenominators: SOURCE_DENOMINATORS.map((id) => ({
      id,
      capturedAt: "PACKAGE_ENTRY",
      owner: {
        AUTHORITY_AND_REQUIREMENT: "Dexter authorization and hash-bound requirement/design/review",
        TERMINOLOGY_AND_STANDARD_LANDING: "AGENTS, CLAUDE, blueprint, scripts README, standards and project memory",
        OPERATION_SCENARIO_AND_FOUR_DIMENSIONS: "route union, bindings, scenario registry and acceptance contract",
        RUNNER_MIGRATION_AND_RETIREMENT: "existing runner, P4, behavior tests and predecessor assets",
        CHANGE_IMPACT_AND_BUG_RED_PROOF: "entry P0/W0/O0, exit P1, dispositions and regression receipts",
        PREVENTION_ACCEPTANCE_AND_HANDOFF: "production validators, red mutations, review and authorization boundary",
      }[id],
    })),
    dynamicEvidence: "NOT_RUN_UNTIL_BA_U03_MANAGED_TESTCONTAINERS",
  };
  writeAtomicNoReplace(active.implementationManifestPath || DEFAULT_OUTPUTS.manifest, manifest);
  writeAtomicNoReplace(active.entryImpactSnapshotPath || DEFAULT_OUTPUTS.entryImpact, entryImpact);
  writeAtomicNoReplace(DEFAULT_OUTPUTS.knownUncovered, knownUncovered);
  writeAtomicNoReplace(active.packageInputPath || DEFAULT_OUTPUTS.packageInput, packageInput);
  process.stdout.write("BACKEND_ACCEPTANCE_ENTRY_CAPTURE=PASS\n"
    + "PACKAGE_ID=" + PACKAGE_ID + "\n"
    + "OPERATIONS=" + operations.length + "\n"
    + "P0=" + p0.length + "\n"
    + "W0=" + w0.length + "\n"
    + "KNOWN_UNCOVERED=" + knownRows.length + "\n"
    + "ROUTE_FRESHNESS_AT_ENTRY=" + (state.fresh ? "PASS" : "STALE_RECORDED_FOR_BA_U01") + "\n"
    + "CLEANUP=PASS\n");
}

function validateEntrySnapshot() {
  const active = readJson(ACTIVE_PACKAGE_PATH, "BACKEND_ACCEPTANCE_ACTIVE_PACKAGE_INVALID");
  if (active.packageId !== PACKAGE_ID) fail("BACKEND_ACCEPTANCE_IMPLEMENTATION_PACKAGE_NOT_ACTIVE");
  const input = readJson(active.packageInputPath || DEFAULT_OUTPUTS.packageInput, "BACKEND_ACCEPTANCE_PACKAGE_INPUT_MISSING");
  const impact = readJson(active.entryImpactSnapshotPath || DEFAULT_OUTPUTS.entryImpact, "BACKEND_ACCEPTANCE_ENTRY_IMPACT_MISSING");
  const ledger = readJson(DEFAULT_OUTPUTS.knownUncovered, "BACKEND_ACCEPTANCE_KNOWN_UNCOVERED_MISSING");
  if (input.packageId !== PACKAGE_ID || input.status !== "ACTIVE_NOT_EXIT"
    || input.entrySnapshot?.entryImpactSnapshotSha256 !== serializedHash(impact)
    || impact.packageId !== PACKAGE_ID
    || impact.status !== "ACTIVE_ENTRY_SNAPSHOT"
    || ledger.packageId !== PACKAGE_ID) {
    fail("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_BINDING_INVALID");
  }
  if (hashFile(active.entryImpactSnapshotPath || DEFAULT_OUTPUTS.entryImpact) !== input.entrySnapshot.entryImpactSnapshotSha256) {
    fail("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_HASH_DRIFT");
  }
  const currentKnownUncoveredHash = hashFile(DEFAULT_OUTPUTS.knownUncovered);
  if (ledger.status === "ACTIVE_MIGRATION_LEDGER" && currentKnownUncoveredHash !== input.entrySnapshot.knownUncoveredSha256) {
    fail("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_HASH_DRIFT", DEFAULT_OUTPUTS.knownUncovered);
  }
  if (ledger.status === CLOSED_UNCOVERED_STATUS
    && ledger.entryLedgerSha256BeforeClosure !== input.entrySnapshot.knownUncoveredSha256) {
    fail("BACKEND_ACCEPTANCE_ENTRY_LEDGER_CLOSURE_BINDING_INVALID");
  }
  const entryRows = input.entrySnapshot?.packageEntry?.operationDenominator?.rows;
  if (!Array.isArray(entryRows) || entryRows.length === 0) {
    fail("BACKEND_ACCEPTANCE_ENTRY_OPERATION_DENOMINATOR_MISSING");
  }
  const entryKeys = entryRows.map((row) => row.identityKey);
  if (entryKeys.some((key) => typeof key !== "string") || new Set(entryKeys).size !== entryKeys.length) {
    fail("BACKEND_ACCEPTANCE_ENTRY_OPERATION_DENOMINATOR_INVALID");
  }
  return { active, input, impact, ledger, entryKeys };
}

function validateKnownUncovered(state, ledger, entryKeys) {
  if (!Array.isArray(ledger.rows) || !Array.isArray(ledger.entryOperationKeys)) {
    fail("BACKEND_ACCEPTANCE_KNOWN_UNCOVERED_INVALID");
  }
  if (!["ACTIVE_MIGRATION_LEDGER", CLOSED_UNCOVERED_STATUS].includes(ledger.status)) {
    fail("BACKEND_ACCEPTANCE_KNOWN_UNCOVERED_STATUS_INVALID");
  }
  const entrySet = new Set(entryKeys);
  const currentSet = new Set(state.routes.map(identityKey));
  const ledgerEntryKeys = [...new Set(ledger.entryOperationKeys)].sort();
  const expectedEntryKeys = [...entrySet].sort();
  if (ledgerEntryKeys.length !== expectedEntryKeys.length
    || ledgerEntryKeys.some((key, index) => key !== expectedEntryKeys[index])) {
    fail("KNOWN_UNCOVERED_ENTRY_SET_INVALID");
  }
  for (const key of currentSet) if (!entrySet.has(key)) fail("UNCOVERED_OPERATION", key);
  const rowKeys = ledger.rows.map((row) => row.identityKey);
  if (new Set(rowKeys).size !== rowKeys.length || rowKeys.some((key) => !entrySet.has(key))) {
    fail("KNOWN_UNCOVERED_MONOTONICITY_VIOLATION");
  }
  if (ledger.status === CLOSED_UNCOVERED_STATUS) {
    if (ledger.rows.length !== 0 || typeof ledger.closureEvidenceRef !== "string"
      || typeof ledger.closureEvidenceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(ledger.closureEvidenceSha256)
      || typeof ledger.runId !== "string" || ledger.runId.length === 0) {
      fail("BACKEND_ACCEPTANCE_KNOWN_UNCOVERED_CLOSURE_INVALID");
    }
  }
  return {
    entryCount: entrySet.size,
    currentCount: currentSet.size,
    open: ledger.rows.filter((row) => row.status === "OPEN").map((row) => row.identityKey),
    covered: ledger.rows.filter((row) => row.status === "COVERED").map((row) => row.identityKey),
  };
}

function validateScenarios(state) {
  const scenarios = readJson(DEFAULT_OUTPUTS.scenarios, "BACKEND_ACCEPTANCE_SCENARIO_REGISTRY_MISSING");
  if (scenarios.schemaVersion !== 1 || scenarios.kind !== "backend-acceptance-scenarios"
    || scenarios.packageId !== PACKAGE_ID || ![STATIC_SCENARIO_STATUS, "ACTIVE"].includes(scenarios.status)
    || !Array.isArray(scenarios.operations) || scenarios.operationIdentitySource !== "CURRENT_ENTRY_OPERATION_DENOMINATOR"
    || scenarios.exactSet !== "CURRENT_SEMANTIC_OPERATION_IDENTITY"
    || JSON.stringify(scenarios.requiredFields) !== JSON.stringify(SCENARIO_FIELDS)) {
    fail("BACKEND_ACCEPTANCE_SCENARIO_REGISTRY_INVALID");
  }
  if (JSON.stringify(scenarios.routeSources) !== JSON.stringify(state.routeMetadata)
    || scenarios.bindingSource?.path !== BINDING_PATH
    || scenarios.bindingSource?.sha256 !== state.bindingSha256
    || scenarios.currentOperationIdentityDigest !== state.routeIdentityDigest) {
    fail("BACKEND_ACCEPTANCE_SCENARIO_SOURCE_DRIFT");
  }
  const inventoryState = sourceInventoryState(state);
  const stateByKey = new Map(state.routes.map((row) => [identityKey(row), row]));
  const seen = new Set();
  const mappings = readOwnerMappings().mappings;
  for (const scenario of scenarios.operations) {
    if (!scenario || typeof scenario !== "object" || !scenario.identity || typeof scenario.identity !== "object") {
      fail("BACKEND_ACCEPTANCE_SCENARIO_FIELD_MISSING", "identity");
    }
    const key = identityKey(scenario.identity);
    const route = stateByKey.get(key);
    if (!route) fail("BACKEND_ACCEPTANCE_SCENARIO_OPERATION_UNKNOWN", key);
    if (seen.has(key)) fail("BACKEND_ACCEPTANCE_SCENARIO_DUPLICATE", key);
    seen.add(key);
    const locator = ownerProviderLocator(route, mappings);
    if (JSON.stringify({
      operationId: scenario.identity.operationId,
      method: scenario.identity.method,
      path: scenario.identity.path,
      normalizedPath: scenario.identity.normalizedPath,
      consumerFace: scenario.identity.consumerFace,
      owner: scenario.identity.owner,
    }) !== JSON.stringify({
      operationId: route.operationId,
      method: route.method,
      path: route.path,
      normalizedPath: route.normalizedPath,
      consumerFace: route.consumerFace,
      owner: route.owner,
    })) {
      fail("BACKEND_ACCEPTANCE_SCENARIO_IDENTITY_DRIFT", route.operationId);
    }
    if (JSON.stringify(scenario.identity.owningUnit) !== JSON.stringify(locator)
      || scenario.providerPath !== locator.providerPath
      || JSON.stringify(scenario.providerLocator) !== JSON.stringify(locator)) {
      fail("BACKEND_ACCEPTANCE_PROVIDER_PATH_DRIFT", route.operationId);
    }
    for (const field of SCENARIO_FIELDS) {
      if (!scenario[field] || typeof scenario[field] !== "object"
        || (Array.isArray(scenario[field]) && scenario[field].length === 0)
        || (!Array.isArray(scenario[field]) && Object.keys(scenario[field]).length === 0)) {
        fail("BACKEND_ACCEPTANCE_SCENARIO_FIELD_MISSING", route.operationId + ":" + field);
      }
    }
    if (scenario.fixture.namespaceOwnership !== "RUN_SCOPED"
      || scenario.fixture.provider !== locator.providerPath + "#fixture") {
      fail("BACKEND_ACCEPTANCE_SCENARIO_FIXTURE_INVALID", route.operationId);
    }
    if (scenario.request.secretHandlesOnly !== true
      || scenario.request.operationId !== route.operationId
      || scenario.request.shapeSource !== BINDING_PATH) {
      fail("BACKEND_ACCEPTANCE_SCENARIO_REQUEST_INVALID", route.operationId);
    }
    if (scenario.businessOracle.contractOracle !== "UNIFIED_OPENAPI_ENVELOPE_AND_PROBLEM_VALIDATOR"
      || scenario.businessOracle.ownerReadback !== "OWNER_PUBLIC_API_READBACK"
      || scenario.businessOracle.provider !== locator.providerPath + "#businessOracle") {
      fail("BACKEND_ACCEPTANCE_SCENARIO_BUSINESS_ORACLE_INVALID", route.operationId);
    }
    if (scenario.performanceCriterion.baselineRef !== baselineLocator(route)
      || JSON.stringify(scenario.performanceCriterion.metrics) !== JSON.stringify(BASELINE_METRICS)) {
      fail("BACKEND_ACCEPTANCE_SCENARIO_PERFORMANCE_CRITERION_INVALID", route.operationId);
    }
    if (scenario.cleanup.provider !== locator.providerPath + "#cleanup"
      || scenario.cleanup.readback !== "RUN_SCOPED_MANIFEST_AND_NAMESPACE_READBACK"
      || !Array.isArray(scenario.cleanup.requiredNamespaces)
      || !BASELINE_METRICS.every((metric) => typeof metric === "string")) {
      fail("BACKEND_ACCEPTANCE_SCENARIO_CLEANUP_INVALID", route.operationId);
    }
    if (!Array.isArray(scenario.correctnessCases)) {
      fail("BACKEND_ACCEPTANCE_CORRECTNESS_CASES_INVALID", route.operationId);
    }
    if (scenario.correctnessCases.length === 0) {
      if (typeof scenario.correctnessCasesEmptyReason !== "string" || scenario.correctnessCasesEmptyReason.length === 0) {
        fail("BACKEND_ACCEPTANCE_CORRECTNESS_CASES_REASON_REQUIRED", route.operationId);
      }
    } else if (scenario.correctnessCasesEmptyReason !== undefined) {
      fail("BACKEND_ACCEPTANCE_CORRECTNESS_CASES_REASON_UNEXPECTED", route.operationId);
    }
    const source = inventoryState.byKey.get(key);
    if (scenario.sourceInventory?.path !== inventoryState.path
      || scenario.sourceInventory?.sha256 !== inventoryState.sha256
      || scenario.sourceInventory?.rowId !== source.rowId
      || scenario.sourceInventory?.identityDigest !== stableDigest(source)) {
      fail("BACKEND_ACCEPTANCE_SCENARIO_SOURCE_INVENTORY_DRIFT", route.operationId);
    }
  }
  if (seen.size !== state.routes.length || state.routes.some((row) => !seen.has(identityKey(row)))) {
    fail("BACKEND_ACCEPTANCE_SCENARIO_EXACT_SET_DRIFT", "routes=" + state.routes.length + ":scenarios=" + seen.size);
  }
  return { count: seen.size, status: scenarios.status };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateProviderMaterialization(state) {
  const mappings = readOwnerMappings().mappings;
  const scenarios = readJson(DEFAULT_OUTPUTS.scenarios, "BACKEND_ACCEPTANCE_SCENARIO_REGISTRY_MISSING");
  const expected = new Set();
  for (const route of state.routes) {
    const locator = ownerProviderLocator(route, mappings);
    if (expected.has(locator.providerPath)) fail("BACKEND_ACCEPTANCE_PROVIDER_PATH_COLLISION", locator.providerPath);
    expected.add(locator.providerPath);
    const file = absolute(locator.providerPath);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      fail("BACKEND_ACCEPTANCE_PROVIDER_MISSING", locator.providerPath);
    }
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes(`package ${locator.providerPackage};`)) {
      fail("BACKEND_ACCEPTANCE_PROVIDER_PACKAGE_INVALID", route.operationId);
    }
    const declaration = new RegExp(
      `public\\s+final\\s+class\\s+${escapeRegExp(locator.providerClass)}\\s+implements\\s+BackendAcceptanceScenarioProvider\\b`,
    );
    if (!declaration.test(source)) {
      fail("BACKEND_ACCEPTANCE_PROVIDER_CLASS_INVALID", route.operationId);
    }
    const scenario = scenarios.operations.find((entry) => identityKey(entry.identity) === identityKey(route));
    if (!scenario || scenario.providerPath !== locator.providerPath) {
      fail("BACKEND_ACCEPTANCE_PROVIDER_SCENARIO_LOCATOR_INVALID", route.operationId);
    }
  }
  return { count: expected.size };
}

function validateBaseline(state) {
  const baseline = readJson(DEFAULT_OUTPUTS.acceptedBaseline, "BACKEND_ACCEPTANCE_BASELINE_REGISTRY_MISSING");
  if (baseline.schemaVersion !== 1 || baseline.kind !== "backend-acceptance-accepted-baseline"
    || baseline.packageId !== PACKAGE_ID || ![STATIC_BASELINE_STATUS, "ACTIVE"].includes(baseline.status)
    || baseline.operationIdentitySource !== "CURRENT_ENTRY_OPERATION_DENOMINATOR"
    || baseline.exactSet !== "CURRENT_SEMANTIC_OPERATION_IDENTITY"
    || JSON.stringify(baseline.metrics) !== JSON.stringify(BASELINE_METRICS)
    || JSON.stringify(baseline.routeSources) !== JSON.stringify(state.routeMetadata)
    || baseline.bindingSource?.path !== BINDING_PATH
    || baseline.bindingSource?.sha256 !== state.bindingSha256
    || baseline.currentOperationIdentityDigest !== state.routeIdentityDigest
    || !Array.isArray(baseline.operations)) {
    fail("BACKEND_ACCEPTANCE_BASELINE_REGISTRY_INVALID");
  }
  const stateByKey = new Map(state.routes.map((row) => [identityKey(row), row]));
  const seen = new Set();
  let measured = 0;
  for (const row of baseline.operations) {
    const route = stateByKey.get(row.identityKey);
    if (!route) fail("BACKEND_ACCEPTANCE_BASELINE_OPERATION_UNKNOWN", row.identityKey || "UNKNOWN");
    if (seen.has(row.identityKey)) fail("BACKEND_ACCEPTANCE_BASELINE_DUPLICATE", row.identityKey);
    seen.add(row.identityKey);
    if (row.operationId !== route.operationId || row.method !== route.method || row.path !== route.path
      || row.normalizedPath !== route.normalizedPath || row.consumerFace !== route.consumerFace || row.owner !== route.owner
      || JSON.stringify(row.metrics) !== JSON.stringify(BASELINE_METRICS)) {
      fail("BACKEND_ACCEPTANCE_BASELINE_IDENTITY_DRIFT", route.operationId);
    }
    if (row.baselineState === "NOT_MEASURED") {
      if (row.latest !== null || !Array.isArray(row.history) || row.history.length !== 0) {
        fail("BACKEND_ACCEPTANCE_BASELINE_UNEXPECTED_MEASUREMENT", route.operationId);
      }
    } else {
      measured += 1;
      if (!row.latest || !Array.isArray(row.history)) fail("BACKEND_ACCEPTANCE_BASELINE_MEASUREMENT_INVALID", route.operationId);
    }
  }
  if (seen.size !== state.routes.length || state.routes.some((row) => !seen.has(identityKey(row)))) {
    fail("BACKEND_ACCEPTANCE_BASELINE_EXACT_SET_DRIFT", "routes=" + state.routes.length + ":baseline=" + seen.size);
  }
  return { count: seen.size, measured };
}

function validateEvidenceReference(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || typeof value.path !== "string" || typeof value.sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(value.sha256)
    || path.isAbsolute(value.path) || value.path.split(/[\\/]/).includes("..")) {
    fail(code);
  }
  if (hashFile(value.path) !== value.sha256) fail(code + "_STALE", value.path);
  return value;
}

function validateSourceReference(value, code) {
  const reference = validateEvidenceReference(value, code);
  if (reference.path.startsWith(".runtime/") || reference.path.startsWith("doc/evidence/platform/backend-acceptance/")) {
    fail(code + "_NOT_OWNING_SOURCE", reference.path);
  }
  return reference;
}

function validateHistoricalRouteReceipt(value, dynamicState, operationId, expected, code) {
  const reference = validateEvidenceReference(value, code);
  if (!reference.path.startsWith(".runtime/backend-acceptance/")) fail(code + "_SCOPE", reference.path);
  const receipt = readJson(reference.path, code + "_INVALID");
  if (receipt.operationId !== operationId || !receipt.runId || !receipt.metrics) {
    fail(code + "_IDENTITY", operationId);
  }
  const runManifestPath = path.posix.join(path.posix.dirname(reference.path), "run-manifest.json");
  const runManifest = readJson(runManifestPath, code + "_RUN_MANIFEST_MISSING");
  if (runManifest.runId !== receipt.runId) fail(code + "_RUN_BINDING", operationId);
  if (expected === "PASS"
    && ![receipt.contract, receipt.business, receipt.performance, receipt.cleanup].every((status) => status === "PASS")) {
    fail(code + "_NOT_PASS", operationId);
  }
  if (expected === "FAIL"
    && ![receipt.contract, receipt.business, receipt.performance, receipt.cleanup].some((status) => status === "FAIL")) {
    fail(code + "_NOT_FAILURE", operationId);
  }
  if (expected === "PASS" && dynamicState && receipt.runId !== dynamicState.run.runId) {
    fail(code + "_STALE_FINAL_RUN", operationId);
  }
  return receipt;
}

function validateHistoricalClosure(dispositions, expected, catalog, dynamicState) {
  if (dispositions.status !== CLOSED_UNCOVERED_STATUS || !dynamicState) {
    fail("BACKEND_ACCEPTANCE_HISTORICAL_EVIDENCE_MISSING");
  }
  const catalogById = new Map([...catalog.requiredPerformanceRegressions, ...catalog.historicalHttpFailureFamilies, ...catalog.nonRouteSeedFailureFamilies]
    .map((entry) => [entry.findingId, entry]));
  const routeKeys = new Set(dynamicState.run.receiptIndex.map((receipt) => receipt.identityKey));
  const baselineSha256 = hashFile(DEFAULT_OUTPUTS.acceptedBaseline);
  const catalogSha256 = hashFile(HISTORICAL_CATALOG_PATH);
  for (const entry of dispositions.entries) {
    const required = expected.get(entry.findingId);
    const catalogEntry = catalogById.get(entry.findingId);
    const evidence = entry.evidence;
    if (!required || !catalogEntry || !evidence || typeof evidence !== "object" || Array.isArray(evidence)
      || entry.disposition === undefined || !required.allowedDispositions.includes(entry.disposition)) {
      fail("BACKEND_ACCEPTANCE_HISTORICAL_EVIDENCE_MISSING", entry.findingId || "UNKNOWN");
    }
    if (entry.category === "PERFORMANCE") {
      if (entry.disposition !== "REGRESSION_ADDED") fail("BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_REGRESSION_NOT_ADDED", entry.findingId);
      if (entry.operationId !== catalogEntry.operationId || typeof evidence.scenarioCaseId !== "string") {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_EVIDENCE_MISSING", entry.findingId);
      }
      const comparison = validateEvidenceReference(evidence.historicalMetricComparisonRef, "BACKEND_ACCEPTANCE_HISTORICAL_METRIC_COMPARISON_INVALID");
      if (comparison.path !== HISTORICAL_CATALOG_PATH || comparison.sha256 !== catalogSha256) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_METRIC_COMPARISON_INVALID", entry.findingId);
      }
      const calibration = validateEvidenceReference(evidence.knownCostCalibrationReceipt, "BACKEND_ACCEPTANCE_HISTORICAL_CALIBRATION_INVALID");
      const expectedCalibrationPath = path.posix.join(dynamicState.run.directory.relative, "calibration-receipt.json");
      if (calibration.path !== expectedCalibrationPath) fail("BACKEND_ACCEPTANCE_HISTORICAL_CALIBRATION_INVALID", entry.findingId);
      const calibrationPayload = readJson(calibration.path, "BACKEND_ACCEPTANCE_HISTORICAL_CALIBRATION_INVALID");
      if (calibrationPayload.scenarioId !== "backendAcceptanceMeasurementSinkIntegrity") {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_CALIBRATION_INVALID", entry.findingId);
      }
      const before = validateHistoricalRouteReceipt(evidence.freshBeforeFailureReceipt, dynamicState, entry.operationId, "FAIL", "BACKEND_ACCEPTANCE_HISTORICAL_BEFORE_FAILURE_INVALID");
      const after = validateHistoricalRouteReceipt(evidence.freshAfterPassReceipt, dynamicState, entry.operationId, "PASS", "BACKEND_ACCEPTANCE_HISTORICAL_AFTER_PASS_INVALID");
      if (before.runId === after.runId) fail("BACKEND_ACCEPTANCE_HISTORICAL_RED_GREEN_RUN_NOT_DISTINCT", entry.findingId);
      const baseline = validateEvidenceReference(evidence.acceptedBaselineRef, "BACKEND_ACCEPTANCE_HISTORICAL_BASELINE_INVALID");
      if (baseline.path !== DEFAULT_OUTPUTS.acceptedBaseline || baseline.sha256 !== baselineSha256) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_BASELINE_INVALID", entry.findingId);
      }
      validateSourceReference(evidence.rootCauseRef, "BACKEND_ACCEPTANCE_HISTORICAL_ROOT_CAUSE_INVALID");
      const triple = evidence.tripleMetricClosureReceipt;
      if (!triple || typeof triple !== "object" || !triple.receiptRef || !triple.metrics) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_TRIPLE_METRIC_CLOSURE_FAILED", entry.findingId);
      }
      const tripleReceipt = validateHistoricalRouteReceipt(triple.receiptRef, dynamicState, entry.operationId, "PASS", "BACKEND_ACCEPTANCE_HISTORICAL_TRIPLE_RECEIPT_INVALID");
      for (const metric of ["QUERY", "CONNECTION", "TRANSACTION"]) {
        const ceiling = catalogEntry.perCallBefore?.[metric];
        if (!Number.isFinite(ceiling) || !Number.isFinite(triple.metrics[metric])
          || triple.metrics[metric] !== tripleReceipt.metrics[metric]
          || triple.metrics[metric] > ceiling) {
          fail("BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_TRIPLE_METRIC_CLOSURE_FAILED", entry.findingId + ":" + metric);
        }
      }
      const transaction = evidence.transactionBoundaryDisposition;
      if (!transaction || typeof transaction !== "object"
        || !["TRANSACTION_BOUNDARY_NOT_RESTORED", "READ_ONLY_TRANSACTION_RESTORED_FOR_CONNECTION_ECONOMY"].includes(transaction.value)
        || typeof transaction.reason !== "string") {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_TRANSACTION_REASON_INVALID", entry.findingId);
      }
      if (transaction.value === "READ_ONLY_TRANSACTION_RESTORED_FOR_CONNECTION_ECONOMY"
        && transaction.reason !== "CONNECTION_ECONOMY_ONLY") {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_TRANSACTION_REASON_INVALID", entry.findingId);
      }
      validateSourceReference(transaction.owningSource, "BACKEND_ACCEPTANCE_HISTORICAL_TRANSACTION_SOURCE_INVALID");
      const query = evidence.queryDisposition;
      const queryPattern = /^(QUERY_REDUCED_TO_[0-9]+(?:\\.[0-9]+)?|QUERY_ALREADY_MINIMAL)$/;
      if (!query || typeof query !== "object" || typeof query.value !== "string" || !queryPattern.test(query.value)
        || !Number.isFinite(query.freshQueriesPerCall)) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_QUERY_DISPOSITION_INVALID", entry.findingId);
      }
      const queryValue = query.value === "QUERY_ALREADY_MINIMAL" ? null : Number(query.value.replace("QUERY_REDUCED_TO_", ""));
      if (queryValue !== null && queryValue !== query.freshQueriesPerCall) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_QUERY_DISPOSITION_INVALID", entry.findingId);
      }
      if (queryValue !== null && queryValue >= catalogEntry.perCallBefore.QUERY) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_QUERY_DISPOSITION_INVALID", entry.findingId);
      }
      validateSourceReference(query.owningSource, "BACKEND_ACCEPTANCE_HISTORICAL_QUERY_SOURCE_INVALID");
      if (queryValue === null) {
        if (!Number.isSafeInteger(query.freshQueriesPerCall) || !Array.isArray(query.queryNecessityByStatement)
          || query.queryNecessityByStatement.length !== query.freshQueriesPerCall
          || query.queryNecessityByStatement.some((statement) => !statement || typeof statement.purpose !== "string")) {
          fail("BACKEND_ACCEPTANCE_HISTORICAL_QUERY_DISPOSITION_INVALID", entry.findingId);
        }
        for (const statement of query.queryNecessityByStatement) validateSourceReference(statement.owningSource, "BACKEND_ACCEPTANCE_HISTORICAL_QUERY_SOURCE_INVALID");
      } else if (typeof query.mergeMethod !== "string" || query.mergeMethod.length === 0) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_QUERY_DISPOSITION_INVALID", entry.findingId);
      }
    } else if (entry.category === "HTTP") {
      if (entry.operationId !== catalogEntry.operationId || typeof evidence.operationId !== "string"
        || evidence.operationId !== entry.operationId || typeof evidence.scenarioCaseId !== "string") {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_EVIDENCE_MISSING", entry.findingId);
      }
      validateHistoricalRouteReceipt(evidence.currentContractOracleReceipt, dynamicState, entry.operationId, "PASS", "BACKEND_ACCEPTANCE_HISTORICAL_CONTRACT_RECEIPT_INVALID");
      validateHistoricalRouteReceipt(evidence.businessOracleReceipt, dynamicState, entry.operationId, "PASS", "BACKEND_ACCEPTANCE_HISTORICAL_BUSINESS_RECEIPT_INVALID");
      validateHistoricalRouteReceipt(evidence.cleanupReceipt, dynamicState, entry.operationId, "PASS", "BACKEND_ACCEPTANCE_HISTORICAL_CLEANUP_RECEIPT_INVALID");
      validateSourceReference(evidence.rootCauseRef, "BACKEND_ACCEPTANCE_HISTORICAL_ROOT_CAUSE_INVALID");
      if (entry.disposition === "REGRESSION_ADDED") {
        if (!["preByteHash", "postByteHash", "sameFixtureDigest"].every((key) => typeof evidence[key] === "string" && /^[a-f0-9]{64}$/.test(evidence[key]))) {
          fail("BACKEND_ACCEPTANCE_HISTORICAL_EVIDENCE_MISSING", entry.findingId);
        }
        validateHistoricalRouteReceipt(evidence.preFailureReceipt, dynamicState, entry.operationId, "FAIL", "BACKEND_ACCEPTANCE_HISTORICAL_BEFORE_FAILURE_INVALID");
        validateHistoricalRouteReceipt(evidence.postPassReceipt, dynamicState, entry.operationId, "PASS", "BACKEND_ACCEPTANCE_HISTORICAL_AFTER_PASS_INVALID");
      }
      if (entry.disposition === "SEED_CLIENT_OR_FIXTURE_ONLY_WITH_ROUTE_PROOF") {
        validateSourceReference(evidence.seedOrFixtureOwningSource, "BACKEND_ACCEPTANCE_HISTORICAL_SEED_SOURCE_INVALID");
        validateEvidenceReference(evidence.routeBehaviorUnaffectedProof, "BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_UNAFFECTED_PROOF_INVALID");
      }
    } else if (entry.category === "NON_ROUTE") {
      validateSourceReference(evidence.rootCauseRef, "BACKEND_ACCEPTANCE_HISTORICAL_ROOT_CAUSE_INVALID");
      validateSourceReference(evidence.owningSource, "BACKEND_ACCEPTANCE_HISTORICAL_OWNING_SOURCE_INVALID");
      const methods = contractMethods(catalog.implementationDispositionContract.nonRouteSeedFailureFamilies);
      if (!methods.includes(evidence.affectedRouteDerivationMethod)
        || !Array.isArray(evidence.affectedRouteSet)
        || new Set(evidence.affectedRouteSet).size !== evidence.affectedRouteSet.length
        || evidence.affectedRouteSet.some((key) => !routeKeys.has(key))) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_AFFECTED_ROUTE_DERIVATION_INVALID", entry.findingId);
      }
      validateSourceReference(evidence.affectedRouteDerivationOwningSource, "BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_DERIVATION_SOURCE_INVALID");
      if (evidence.affectedRouteDerivationMethod === "NO_ROUTE_IMPACT_WITH_SOURCE_PROOF" && evidence.affectedRouteSet.length !== 0) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_AFFECTED_ROUTE_DERIVATION_INVALID", entry.findingId);
      }
      if (evidence.affectedRouteDerivationMethod !== "NO_ROUTE_IMPACT_WITH_SOURCE_PROOF"
        && (!Array.isArray(evidence.freshRouteProofRefs) || evidence.freshRouteProofRefs.length !== evidence.affectedRouteSet.length)) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_PROOF_STALE", entry.findingId);
      }
      for (const reference of evidence.freshRouteProofRefs || []) {
        const validatedReference = validateEvidenceReference(reference, "BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_PROOF_INVALID");
        const operationId = readJson(validatedReference.path, "BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_PROOF_INVALID").operationId;
        validateHistoricalRouteReceipt(validatedReference, dynamicState, operationId, "PASS", "BACKEND_ACCEPTANCE_HISTORICAL_ROUTE_PROOF_INVALID");
      }
    }
  }
  return { status: "CLOSED", count: dispositions.entries.length };
}

function contractMethods(contract) {
  return Array.isArray(contract?.allowedAffectedRouteDerivationMethods) ? contract.allowedAffectedRouteDerivationMethods : [];
}

function validateHistorical(dynamicState = null) {
  const catalog = readJson(HISTORICAL_CATALOG_PATH, "BACKEND_ACCEPTANCE_HISTORICAL_CATALOG_MISSING");
  const contract = catalog.implementationDispositionContract;
  const performance = catalog.requiredPerformanceRegressions;
  const http = catalog.historicalHttpFailureFamilies;
  const nonRoute = catalog.nonRouteSeedFailureFamilies;
  if (!contract || !Array.isArray(performance) || !Array.isArray(http) || !Array.isArray(nonRoute)) {
    fail("BACKEND_ACCEPTANCE_HISTORICAL_CATALOG_INVALID");
  }
  const all = [...performance, ...http, ...nonRoute];
  const ids = all.map((entry) => entry.findingId);
  if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
    fail("BACKEND_ACCEPTANCE_HISTORICAL_FINDING_SET_INVALID");
  }
  const dispositions = readJson(DEFAULT_OUTPUTS.historicalDisposition, "BACKEND_ACCEPTANCE_HISTORICAL_DISPOSITION_MISSING");
  if (dispositions.schemaVersion !== 1 || dispositions.kind !== "backend-acceptance-historical-seed-dispositions"
    || dispositions.packageId !== PACKAGE_ID || ![STATIC_HISTORICAL_STATUS, CLOSED_UNCOVERED_STATUS].includes(dispositions.status)
    || dispositions.catalog?.path !== HISTORICAL_CATALOG_PATH
    || dispositions.catalog?.sha256 !== hashFile(HISTORICAL_CATALOG_PATH)
    || dispositions.exactSetRequired !== true || dispositions.pendingForbidden !== true
    || dispositions.freeTextOnlyForbidden !== true || !Array.isArray(dispositions.entries)) {
    fail("BACKEND_ACCEPTANCE_HISTORICAL_DISPOSITION_INVALID");
  }
  const expected = new Map();
  for (const entry of performance) expected.set(entry.findingId, {
    category: "PERFORMANCE",
    allowedDispositions: contract.requiredPerformanceRegressions.allowed,
    requiredEvidence: contract.requiredPerformanceRegressions.requiredEvidence,
    requiredDisposition: entry.requiredDisposition,
  });
  const httpContract = contract.historicalHttpFailureFamilies;
  for (const entry of http) expected.set(entry.findingId, {
    category: "HTTP",
    allowedDispositions: httpContract.allowed,
    requiredEvidence: {
      REGRESSION_ADDED: [...httpContract.requiredCommonEvidence, ...httpContract.regressionAddedExtraEvidence],
      ALREADY_COVERED_WITH_FRESH_ROUTE_PROOF: [...httpContract.requiredCommonEvidence],
      SEED_CLIENT_OR_FIXTURE_ONLY_WITH_ROUTE_PROOF: [...httpContract.requiredCommonEvidence, ...httpContract.seedOnlyExtraEvidence],
    },
    requiredDisposition: null,
  });
  const nonRouteContract = contract.nonRouteSeedFailureFamilies;
  for (const entry of nonRoute) expected.set(entry.findingId, {
    category: "NON_ROUTE",
    allowedDispositions: nonRouteContract.allowed,
    requiredEvidence: nonRouteContract.requiredEvidence,
    requiredDisposition: null,
  });
  const seen = new Set();
  for (const entry of dispositions.entries) {
    const required = expected.get(entry.findingId);
    if (!required) fail("BACKEND_ACCEPTANCE_HISTORICAL_FINDING_EXTRA", entry.findingId || "UNKNOWN");
    if (seen.has(entry.findingId)) fail("BACKEND_ACCEPTANCE_HISTORICAL_FINDING_EXTRA", entry.findingId);
    seen.add(entry.findingId);
    if (entry.category !== required.category
      || JSON.stringify(entry.allowedDispositions) !== JSON.stringify(required.allowedDispositions)
      || JSON.stringify(entry.requiredEvidence) !== JSON.stringify(required.requiredEvidence)
      || entry.requiredDisposition !== required.requiredDisposition
      || entry.sourceCatalogSha256 !== hashFile(HISTORICAL_CATALOG_PATH)) {
      fail("BACKEND_ACCEPTANCE_HISTORICAL_DISPOSITION_INVALID", entry.findingId);
    }
  }
  if (seen.size !== expected.size || ids.some((id) => !seen.has(id))) {
    fail("BACKEND_ACCEPTANCE_HISTORICAL_FINDING_MISSING");
  }
  let closureState = null;
  if (dispositions.status === CLOSED_UNCOVERED_STATUS) {
    if (!dynamicState) {
      const entry = validateEntrySnapshot();
      const state = operationState();
      compareProjectionFreshness(state.binding, state.routeMetadata);
      const scenarios = readJson(DEFAULT_OUTPUTS.scenarios, "BACKEND_ACCEPTANCE_SCENARIO_REGISTRY_MISSING");
      const baseline = readJson(DEFAULT_OUTPUTS.acceptedBaseline, "BACKEND_ACCEPTANCE_BASELINE_REGISTRY_MISSING");
      dynamicState = validateDynamicAcceptance(state, scenarios, baseline, entry.ledger, entry);
    }
    closureState = validateHistoricalClosure(dispositions, expected, catalog, dynamicState);
  }
  return { performance: performance.length, http: http.length, nonRoute: nonRoute.length, dispositionCount: seen.size, closureState };
}

function validateAssetPath(value, code) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)
    || value.split(/[\\/]/).includes("..") || value.includes("\\")) {
    fail(code);
  }
  return value;
}

function backendAcceptanceEntryAssets() {
  const input = readJson(DEFAULT_OUTPUTS.packageInput, "BACKEND_ACCEPTANCE_PACKAGE_INPUT_MISSING");
  const inventory = input.entrySnapshot?.packageEntry?.behaviorAssertionsAndPredecessors;
  if (!inventory || !Array.isArray(inventory.paths) || typeof inventory.sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(inventory.sha256)) {
    fail("BACKEND_ACCEPTANCE_ENTRY_ASSET_INVENTORY_INVALID");
  }
  const paths = inventory.paths.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail("BACKEND_ACCEPTANCE_ENTRY_ASSET_INVENTORY_INVALID");
    }
    const assetPath = validateAssetPath(entry.path, "BACKEND_ACCEPTANCE_ENTRY_ASSET_PATH_INVALID");
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail("BACKEND_ACCEPTANCE_ENTRY_ASSET_HASH_INVALID", assetPath);
    }
    return { path: assetPath, sha256: entry.sha256 };
  });
  if (new Set(paths.map((entry) => entry.path)).size !== paths.length
    || stableDigest(paths) !== inventory.sha256) {
    fail("BACKEND_ACCEPTANCE_ENTRY_ASSET_INVENTORY_INVALID");
  }
  return {
    packageInputSha256: hashFile(DEFAULT_OUTPUTS.packageInput),
    digest: inventory.sha256,
    count: paths.length,
    paths,
    byPath: new Map(paths.map((entry) => [entry.path, entry])),
  };
}

function validateAssetDispositionDocument(relative, kind, assets) {
  const document = readJson(relative, "BACKEND_ACCEPTANCE_ASSET_DISPOSITION_MISSING");
  const expectedKind = kind === "assertion"
    ? "backend-acceptance-assertion-migration"
    : "backend-acceptance-predecessor-asset-dispositions";
  const expectedAllowed = kind === "assertion"
    ? ["MIGRATED_TO_BACKEND_ACCEPTANCE", "RETAIN_DIFFERENT_DUTY", "HISTORICAL_HASH_BOUND"]
    : ["DELETE", "RETAIN_DIFFERENT_DUTY", "HISTORICAL_HASH_BOUND"];
  const inventory = document.entryInventory;
  if (document.schemaVersion !== 1
    || document.kind !== expectedKind
    || document.packageId !== PACKAGE_ID
    || document.exactSetRequired !== true
    || ![STATIC_ASSET_DISPOSITION_STATUS, CLOSED_UNCOVERED_STATUS].includes(document.status)
    || JSON.stringify(document.allowedDispositions) !== JSON.stringify(expectedAllowed)
    || inventory?.path !== DEFAULT_OUTPUTS.packageInput
    || inventory?.sha256 !== assets.packageInputSha256
    || inventory?.entryAssetDigest !== assets.digest
    || inventory?.count !== assets.count
    || !Array.isArray(document.rows)) {
    fail("BACKEND_ACCEPTANCE_ASSET_DISPOSITION_INVALID", relative);
  }
  const rowPaths = document.rows.map((row) => kind === "assertion" ? row?.sourcePath : row?.path);
  const expectedPaths = assets.paths.map((entry) => entry.path);
  if (rowPaths.some((value) => typeof value !== "string")
    || new Set(rowPaths).size !== rowPaths.length
    || rowPaths.slice().sort().some((value, index) => value !== expectedPaths.slice().sort()[index])) {
    fail("BACKEND_ACCEPTANCE_ASSET_DISPOSITION_EXACT_SET_INVALID", relative);
  }
  const rowsByPath = new Map();
  for (const row of document.rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      fail("BACKEND_ACCEPTANCE_ASSET_DISPOSITION_INVALID", "UNKNOWN");
    }
    const assetPath = kind === "assertion" ? row.sourcePath : row.path;
    const entry = assets.byPath.get(assetPath);
    if (!entry) {
      fail("BACKEND_ACCEPTANCE_ASSET_DISPOSITION_INVALID", assetPath || "UNKNOWN");
    }
    if (!expectedAllowed.includes(row.disposition)) {
      fail("BACKEND_ACCEPTANCE_ASSET_DISPOSITION_INVALID", assetPath);
    }
    const entryHash = kind === "assertion" ? row.sourceSha256 : row.entrySha256;
    if (entryHash !== entry.sha256) fail("BACKEND_ACCEPTANCE_ASSET_ENTRY_HASH_INVALID", assetPath);
    if (kind === "assertion" && (typeof row.assertionKey !== "string" || row.assertionKey.length === 0)) {
      fail("BACKEND_ACCEPTANCE_ASSERTION_MIGRATION_ROW_INVALID", assetPath);
    }
    rowsByPath.set(assetPath, row);
  }
  return { document, rowsByPath, count: rowsByPath.size };
}

function validateFreshAssetEvidence(value, dynamicState, code) {
  if (!Array.isArray(value) || value.length === 0) fail(code);
  const references = value.map((reference) => validateEvidenceReference(reference, code));
  const runPrefix = dynamicState.run.directory.relative + "/";
  if (!references.some((reference) => reference.path === DEFAULT_OUTPUTS.dynamicReport
    || reference.path.startsWith(runPrefix))) {
    fail(code + "_NOT_FRESH");
  }
  return references;
}

function validateClosedAssetRow(row, kind, entry, dynamicState) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    fail("BACKEND_ACCEPTANCE_ASSET_CLOSED_ROW_INVALID", entry.path);
  }
  const disposition = row.disposition;
  if (typeof row.reasonCode !== "string" || row.reasonCode.length === 0
    || disposition === undefined || disposition === null) {
    fail("BACKEND_ACCEPTANCE_ASSET_CLOSED_ROW_INVALID", entry.path);
  }
  if (["FRESH_ROUTE_PROOF_REQUIRED_BEFORE_ASSERTION_RETIREMENT", "PREDECESSOR_RETIREMENT_REQUIRES_FRESH_ROUTE_REPLACEMENT_PROOF"].includes(row.reasonCode)) {
    fail("BACKEND_ACCEPTANCE_ASSET_CLOSED_ROW_STILL_PENDING", entry.path);
  }
  if (kind === "assertion") {
    if (disposition === "MIGRATED_TO_BACKEND_ACCEPTANCE") {
      validateFreshAssetEvidence(row.evidenceRefs, dynamicState, "BACKEND_ACCEPTANCE_ASSERTION_REPLACEMENT_PROOF_INVALID");
      return;
    }
    if (disposition === "RETAIN_DIFFERENT_DUTY") {
      if (hashFile(row.sourcePath) === "ABSENT" || typeof row.currentSha256 !== "string"
        || !/^[a-f0-9]{64}$/.test(row.currentSha256) || row.currentSha256 !== hashFile(row.sourcePath)) {
        fail("BACKEND_ACCEPTANCE_ASSERTION_RETAINED_SOURCE_INVALID", row.sourcePath);
      }
      validateFreshAssetEvidence(row.evidenceRefs, dynamicState, "BACKEND_ACCEPTANCE_ASSERTION_REPLACEMENT_PROOF_INVALID");
      return;
    }
    if (disposition === "HISTORICAL_HASH_BOUND") {
      if (hashFile(row.sourcePath) !== entry.sha256) fail("BACKEND_ACCEPTANCE_ASSERTION_HASH_BOUND_SOURCE_INVALID", row.sourcePath);
      validateFreshAssetEvidence(row.evidenceRefs, dynamicState, "BACKEND_ACCEPTANCE_ASSERTION_REPLACEMENT_PROOF_INVALID");
      return;
    }
    fail("BACKEND_ACCEPTANCE_ASSERTION_DISPOSITION_INVALID", row.sourcePath);
  }
  if (disposition === "DELETE") {
    if (hashFile(row.path) !== "ABSENT" || !row.replacementProofRef) {
      fail("BACKEND_ACCEPTANCE_PREDECESSOR_DELETE_NOT_PROVEN", row.path);
    }
    validateFreshAssetEvidence([row.replacementProofRef], dynamicState, "BACKEND_ACCEPTANCE_PREDECESSOR_REPLACEMENT_PROOF_INVALID");
    return;
  }
  if (disposition === "RETAIN_DIFFERENT_DUTY") {
    if (hashFile(row.path) === "ABSENT" || typeof row.currentSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(row.currentSha256) || row.currentSha256 !== hashFile(row.path)
      || !row.replacementProofRef) {
      fail("BACKEND_ACCEPTANCE_PREDECESSOR_RETAINED_SOURCE_INVALID", row.path);
    }
    validateFreshAssetEvidence([row.replacementProofRef], dynamicState, "BACKEND_ACCEPTANCE_PREDECESSOR_REPLACEMENT_PROOF_INVALID");
    return;
  }
  if (disposition === "HISTORICAL_HASH_BOUND") {
    if (hashFile(row.path) !== entry.sha256 || !row.replacementProofRef) {
      fail("BACKEND_ACCEPTANCE_PREDECESSOR_HASH_BOUND_SOURCE_INVALID", row.path);
    }
    validateFreshAssetEvidence([row.replacementProofRef], dynamicState, "BACKEND_ACCEPTANCE_PREDECESSOR_REPLACEMENT_PROOF_INVALID");
    return;
  }
  fail("BACKEND_ACCEPTANCE_PREDECESSOR_DISPOSITION_INVALID", row.path);
}

function validateP4Retirement() {
  const ledger = readJson(P4_PATH, "BACKEND_ACCEPTANCE_P4_LEDGER_MISSING");
  if (ledger.schemaVersion !== 2 || ledger.kind !== "canonical-performance-ledger" || !Array.isArray(ledger.rows)) {
    fail("BACKEND_ACCEPTANCE_P4_LEDGER_INVALID");
  }
  if (ledger.rows.length !== 0) fail("BACKEND_ACCEPTANCE_P4_NOT_RETIRED", String(ledger.rows.length));
  return { count: 0 };
}

function validateBackendAcceptanceRetirement(dynamicState, historicalState) {
  if (!dynamicState) fail("BACKEND_ACCEPTANCE_RETIREMENT_DYNAMIC_EVIDENCE_MISSING");
  if (!historicalState?.closureState) fail("BACKEND_ACCEPTANCE_RETIREMENT_HISTORY_NOT_CLOSED");
  const assets = backendAcceptanceEntryAssets();
  const assertionState = validateAssetDispositionDocument(ASSERTION_MIGRATION_PATH, "assertion", assets);
  const predecessorState = validateAssetDispositionDocument(PREDECESSOR_DISPOSITIONS_PATH, "predecessor", assets);
  if (assertionState.document.status !== CLOSED_UNCOVERED_STATUS) {
    fail("BACKEND_ACCEPTANCE_ASSERTION_MIGRATION_NOT_CLOSED");
  }
  if (predecessorState.document.status !== CLOSED_UNCOVERED_STATUS) {
    fail("BACKEND_ACCEPTANCE_PREDECESSOR_DISPOSITIONS_NOT_CLOSED");
  }
  for (const entry of assets.paths) validateClosedAssetRow(assertionState.rowsByPath.get(entry.path), "assertion", entry, dynamicState);
  for (const entry of assets.paths) validateClosedAssetRow(predecessorState.rowsByPath.get(entry.path), "predecessor", entry, dynamicState);
  const p4State = validateP4Retirement();
  return { assertions: assertionState.count, predecessors: predecessorState.count, p4: p4State.count };
}

function validateClosedPolicies() {
  const policies = [
    [RETAINED_OWNER_LOGIC_PATH, "backend-acceptance-retained-owner-logic"],
    [ROUTE_UNEXPRESSIBLE_PATH, "backend-acceptance-route-unexpressible-regressions"],
  ];
  for (const [relative, kind] of policies) {
    const policy = readJson(relative, "BACKEND_ACCEPTANCE_CLOSED_POLICY_MISSING");
    if (policy.schemaVersion !== 1 || policy.kind !== kind || policy.packageId !== PACKAGE_ID
      || policy.status !== "ACTIVE_CLOSED_FINITE_SET" || policy.exactSetRequired !== true
      || !Array.isArray(policy.entries) || !policy.entryShape || !Array.isArray(policy.entryShape.required)
      || !Array.isArray(policy.entryShape.allowedReasonCodes)) {
      fail("BACKEND_ACCEPTANCE_CLOSED_POLICY_INVALID", relative);
    }
    const ids = policy.entries.map((entry) => entry.operationId || entry.findingId);
    if (new Set(ids).size !== ids.length) fail("BACKEND_ACCEPTANCE_CLOSED_POLICY_DUPLICATE", relative);
    for (const entry of policy.entries) {
      if (typeof entry.reasonCode !== "string" || !policy.entryShape.allowedReasonCodes.includes(entry.reasonCode)
        || typeof entry.owningSource !== "object" || !Array.isArray(entry.evidenceRefs)) {
        fail("BACKEND_ACCEPTANCE_CLOSED_POLICY_ENTRY_INVALID", relative);
      }
    }
  }
  return { count: policies.length };
}

function runDirectory(relative) {
  if (typeof relative !== "string" || relative.length === 0 || path.isAbsolute(relative)
    || relative.split(/[\\/]/).includes("..") || !relative.startsWith(".runtime/backend-acceptance/")) {
    fail("BACKEND_ACCEPTANCE_RUN_DIRECTORY_INVALID");
  }
  const normalized = relative.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  const directory = absolute(normalized);
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    fail("BACKEND_ACCEPTANCE_RUN_DIRECTORY_MISSING", normalized);
  }
  return { relative: normalized, absolute: directory };
}

function readRunJson(directory, name, errorCode) {
  const file = path.join(directory.absolute, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(errorCode, name);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(errorCode + "_INVALID", name + ":" + error.message);
  }
}

function validateFreshFullRun(relativeRunDirectory, state, scenarios) {
  const directory = runDirectory(relativeRunDirectory);
  const manifest = readRunJson(directory, "run-manifest.json", "BACKEND_ACCEPTANCE_DYNAMIC_MANIFEST_MISSING");
  const child = readRunJson(directory, "managed-child-result.json", "BACKEND_ACCEPTANCE_DYNAMIC_CHILD_RESULT_MISSING");
  const workload = readRunJson(directory, "workload-result.json", "BACKEND_ACCEPTANCE_DYNAMIC_WORKLOAD_RESULT_MISSING");
  const performance = readRunJson(directory, "performance-evidence.json", "BACKEND_ACCEPTANCE_DYNAMIC_PERFORMANCE_EVIDENCE_MISSING");
  const calibration = readRunJson(directory, "calibration-receipt.json", "BACKEND_ACCEPTANCE_DYNAMIC_CALIBRATION_MISSING");
  const calls = readRunJson(directory, "calls.json", "BACKEND_ACCEPTANCE_DYNAMIC_CALLS_MISSING");
  const runId = manifest.runId;
  const operationCount = state.routes.length;
  if (typeof runId !== "string" || runId.length === 0
    || child.runId !== runId || workload.runId !== runId || calls.runId !== runId
    || manifest.operationCount !== operationCount || workload.expectedOperations !== operationCount
    || workload.completedOperations !== operationCount || workload.discoveredOperations !== operationCount
    || workload.status !== "PASS" || workload.contractStatus !== "PASS"
    || workload.businessStatus !== "PASS" || workload.performanceStatus !== "PASS" || workload.cleanupStatus !== "PASS"
    || child.status !== "PASS" || child.contractStatus !== "PASS" || child.businessStatus !== "PASS"
    || child.performanceStatus !== "PASS" || child.cleanupStatus !== "PASS"
    || manifest.business?.status !== "PASS" || manifest.cleanup?.status !== "PASS"
    || manifest.dynamic?.status !== "PASS" || performance.status !== "PASS"
    || performance.operationCount !== operationCount || performance.baselineComparison?.status !== "PASS"
    || !Array.isArray(calls.calls)) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_FOUR_DIMENSION_NOT_PASS", runId || "UNKNOWN");
  }
  const expectedByKey = new Map(state.routes.map((row) => [identityKey(row), row]));
  const scenarioByKey = new Map(scenarios.operations.map((row) => [identityKey(row.identity), row]));
  const receipts = workload.operationReceipts;
  if (!Array.isArray(receipts) || receipts.length !== operationCount) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_RECEIPT_EXACT_SET_INVALID");
  }
  const receiptByKey = new Map();
  const receiptIndex = [];
  for (const receipt of receipts) {
    const key = identityKey(receipt);
    if (!expectedByKey.has(key) || receiptByKey.has(key)
      || !scenarioByKey.has(key)
      || receipt.contract !== "PASS" || receipt.business !== "PASS"
      || receipt.performance !== "PASS" || receipt.cleanup !== "PASS"
      || !receipt.metrics || typeof receipt.metrics !== "object") {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_RECEIPT_INVALID", receipt?.operationId || "UNKNOWN");
    }
    for (const metric of BASELINE_METRICS) {
      if (!Number.isSafeInteger(receipt.metrics[metric]) || receipt.metrics[metric] < 0) {
        fail("BACKEND_ACCEPTANCE_DYNAMIC_RECEIPT_METRICS_INVALID", receipt.operationId);
      }
    }
    const receiptName = `${receipt.operationId}.json`;
    if (!/^[A-Za-z][A-Za-z0-9._:-]{2,127}\.json$/.test(receiptName)) {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_RECEIPT_PATH_INVALID", receipt.operationId);
    }
    const receiptAbsolute = path.join(directory.absolute, "operation-receipts", receiptName);
    if (!fs.existsSync(receiptAbsolute) || !fs.statSync(receiptAbsolute).isFile()) {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_OPERATION_RECEIPT_MISSING", receipt.operationId);
    }
    const persisted = readJsonAbsolute(receiptAbsolute, "BACKEND_ACCEPTANCE_DYNAMIC_OPERATION_RECEIPT_INVALID");
    if (stableDigest(persisted) !== stableDigest(receipt)) {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_OPERATION_RECEIPT_DRIFT", receipt.operationId);
    }
    const operationScenario = scenarioByKey.get(key);
    const receiptRef = path.relative(ROOT, receiptAbsolute).split(path.sep).join("/");
    receiptByKey.set(key, receipt);
    receiptIndex.push({
      operationId: receipt.operationId,
      identityKey: key,
      receiptRef,
      receiptSha256: hashFile(receiptRef),
      receiptDigest: stableDigest(receipt),
      fourDimension: { CONTRACT: "PASS", BUSINESS: "PASS", PERFORMANCE: "PASS", CLEANUP: "PASS" },
      metrics: receipt.metrics,
      businessOracleRef: operationScenario.businessOracle?.provider,
      ownerReadback: operationScenario.businessOracle?.ownerReadback,
    });
  }
  if (receiptByKey.size !== expectedByKey.size || [...expectedByKey.keys()].some((key) => !receiptByKey.has(key))) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_RECEIPT_EXACT_SET_INVALID");
  }
  const callKeys = new Set(calls.calls.map((call) => identityKey(call)));
  if (callKeys.size !== operationCount || [...expectedByKey.keys()].some((key) => !callKeys.has(key))) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_CALL_EXACT_SET_INVALID");
  }
  const eventPath = path.join(directory.absolute, "events.jsonl");
  if (!fs.existsSync(eventPath) || !fs.statSync(eventPath).isFile() || fs.statSync(eventPath).size === 0) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_EVENTS_MISSING");
  }
  return {
    directory,
    manifest,
    child,
    workload,
    performance,
    calibration,
    calls,
    runId,
    operationCount,
    receiptIndex: receiptIndex.sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
  };
}

function readJsonAbsolute(file, errorCode) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { fail(errorCode, path.relative(ROOT, file) + ":" + error.message); }
}

function validateHistoricalPerformanceRouteClosure(receiptIndex) {
  const catalog = readJson(HISTORICAL_CATALOG_PATH, "BACKEND_ACCEPTANCE_HISTORICAL_CATALOG_MISSING");
  const rows = catalog.requiredPerformanceRegressions;
  if (!Array.isArray(rows) || rows.length !== 6) {
    fail("BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_CATALOG_INVALID");
  }
  const receiptsByOperationId = new Map();
  for (const receipt of receiptIndex) {
    if (receiptsByOperationId.has(receipt.operationId)) {
      fail("BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_OPERATION_AMBIGUOUS", receipt.operationId);
    }
    receiptsByOperationId.set(receipt.operationId, receipt);
  }
  for (const row of rows) {
    const receipt = receiptsByOperationId.get(row.operationId);
    const ceilings = row.perCallBefore;
    if (!receipt || !ceilings || typeof ceilings !== "object") {
      fail("BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_ROUTE_RECEIPT_MISSING", row.findingId);
    }
    for (const metric of ["QUERY", "CONNECTION", "TRANSACTION"]) {
      if (!Number.isSafeInteger(receipt.metrics?.[metric]) || !Number.isFinite(ceilings[metric])
        || receipt.metrics[metric] > ceilings[metric]) {
        fail("BACKEND_ACCEPTANCE_HISTORICAL_PERFORMANCE_TRIPLE_METRIC_CLOSURE_FAILED", row.findingId + ":" + metric);
      }
    }
  }
  return { count: rows.length };
}

function validateDynamicAcceptance(state, scenarios, baseline, ledger, entry) {
  if (ledger.status !== CLOSED_UNCOVERED_STATUS
    || ledger.rows.length !== 0
    || typeof ledger.runId !== "string"
    || ledger.entryLedgerSha256BeforeClosure !== entry.input.entrySnapshot.knownUncoveredSha256
    || ledger.closureEvidenceRef !== DEFAULT_OUTPUTS.dynamicReport
    || ledger.closureEvidenceSha256 !== hashFile(DEFAULT_OUTPUTS.dynamicReport)) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_LEDGER_CLOSURE_INVALID");
  }
  const report = readJson(DEFAULT_OUTPUTS.dynamicReport, "BACKEND_ACCEPTANCE_DYNAMIC_REPORT_MISSING");
  const reportSha256 = hashFile(DEFAULT_OUTPUTS.dynamicReport);
  if (report.schemaVersion !== 1 || report.kind !== "backend-acceptance-dynamic-acceptance-report"
    || report.packageId !== PACKAGE_ID || report.machineId !== "backend-acceptance"
    || report.status !== "PASS" || report.runId !== ledger.runId
    || report.denominator?.operationCount !== state.routes.length
    || report.denominator?.routeIdentityDigest !== state.routeIdentityDigest
    || report.denominator?.bindingSha256 !== state.bindingSha256
    || JSON.stringify(report.fourDimensionVerdict) !== JSON.stringify({
      CONTRACT: "PASS", BUSINESS: "PASS", PERFORMANCE: "PASS", CLEANUP: "PASS", OVERALL: "PASS",
    })
    || !Array.isArray(report.operationReceipts)) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_REPORT_INVALID");
  }
  const run = validateFreshFullRun(report.runDirectory, state, scenarios);
  if (run.runId !== report.runId || run.operationCount !== report.denominator.operationCount) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_REPORT_RUN_BINDING_INVALID");
  }
  const runByKey = new Map(run.receiptIndex.map((receipt) => [receipt.identityKey, receipt]));
  const reportKeys = new Set();
  if (report.operationReceipts.length !== state.routes.length) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_REPORT_RECEIPT_EXACT_SET_INVALID");
  }
  for (const receipt of report.operationReceipts) {
    if (!receipt || typeof receipt.identityKey !== "string" || reportKeys.has(receipt.identityKey)) {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_REPORT_RECEIPT_EXACT_SET_INVALID");
    }
    reportKeys.add(receipt.identityKey);
    const current = runByKey.get(receipt.identityKey);
    if (!current || receipt.receiptRef !== current.receiptRef
      || receipt.receiptSha256 !== current.receiptSha256
      || receipt.receiptDigest !== current.receiptDigest
      || JSON.stringify(receipt.fourDimension) !== JSON.stringify(current.fourDimension)) {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_REPORT_RECEIPT_BINDING_INVALID", receipt.operationId || "UNKNOWN");
    }
  }
  if (reportKeys.size !== runByKey.size || [...runByKey.keys()].some((key) => !reportKeys.has(key))) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_REPORT_RECEIPT_EXACT_SET_INVALID");
  }
  if (scenarios.status !== "ACTIVE"
    || scenarios.dynamicEvidenceIndex?.path !== DEFAULT_OUTPUTS.dynamicReport
    || scenarios.dynamicEvidenceIndex?.sha256 !== reportSha256
    || scenarios.dynamicEvidenceIndex?.runId !== report.runId) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_SCENARIO_INDEX_INVALID");
  }
  for (const scenario of scenarios.operations) {
    const evidence = runByKey.get(identityKey(scenario.identity));
    const dynamic = scenario.dynamicAcceptance;
    if (!evidence || !dynamic || dynamic.runId !== report.runId
      || dynamic.reportRef !== DEFAULT_OUTPUTS.dynamicReport
      || dynamic.reportSha256 !== reportSha256
      || dynamic.receiptRef !== evidence.receiptRef
      || dynamic.receiptSha256 !== evidence.receiptSha256
      || JSON.stringify(dynamic.fourDimension) !== JSON.stringify(evidence.fourDimension)) {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_SCENARIO_INDEX_INVALID", scenario.identity.operationId);
    }
  }
  if (baseline.status !== "ACTIVE"
    || baseline.freshAcceptance?.path !== DEFAULT_OUTPUTS.dynamicReport
    || baseline.freshAcceptance?.sha256 !== reportSha256
    || baseline.freshAcceptance?.runId !== report.runId) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_BASELINE_INDEX_INVALID");
  }
  for (const row of baseline.operations) {
    if (row.baselineState !== "ACTIVE" || !row.latest || !Array.isArray(row.history)
      || row.history.length === 0 || row.latest.runId !== report.runId
      || row.history[row.history.length - 1].runId !== report.runId
      || JSON.stringify(row.latest.metrics) !== JSON.stringify(row.history[row.history.length - 1].metrics)) {
      fail("BACKEND_ACCEPTANCE_DYNAMIC_BASELINE_INDEX_INVALID", row.operationId);
    }
  }
  validateHistoricalPerformanceRouteClosure(run.receiptIndex);
  return { report, reportSha256, run };
}

function closeDynamic() {
  const relativeRunDirectory = process.argv[3];
  if (typeof relativeRunDirectory !== "string" || relativeRunDirectory.length === 0) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_RUN_REQUIRED");
  }
  const entry = validateEntrySnapshot();
  const state = operationState();
  compareProjectionFreshness(state.binding, state.routeMetadata);
  const scenarios = readJson(DEFAULT_OUTPUTS.scenarios, "BACKEND_ACCEPTANCE_SCENARIO_REGISTRY_MISSING");
  const baseline = readJson(DEFAULT_OUTPUTS.acceptedBaseline, "BACKEND_ACCEPTANCE_BASELINE_REGISTRY_MISSING");
  if (scenarios.status !== STATIC_SCENARIO_STATUS || baseline.status !== STATIC_BASELINE_STATUS) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_CLOSURE_ALREADY_APPLIED");
  }
  const entryLedgerSha256 = entry.input.entrySnapshot.knownUncoveredSha256;
  if (hashFile(DEFAULT_OUTPUTS.knownUncovered) !== entryLedgerSha256) {
    fail("BACKEND_ACCEPTANCE_ENTRY_LEDGER_CHANGED_BEFORE_DYNAMIC_CLOSURE");
  }
  const run = validateFreshFullRun(relativeRunDirectory, state, scenarios);
  validateHistoricalPerformanceRouteClosure(run.receiptIndex);
  if (fs.existsSync(absolute(DEFAULT_OUTPUTS.dynamicReport))) {
    fail("BACKEND_ACCEPTANCE_DYNAMIC_REPORT_ALREADY_EXISTS");
  }
  const measuredAt = new Date().toISOString();
  const calibrationRef = path.relative(ROOT, path.join(run.directory.absolute, "calibration-receipt.json")).split(path.sep).join("/");
  const calibrationSha256 = hashFile(calibrationRef);
  const report = {
    schemaVersion: 1,
    kind: "backend-acceptance-dynamic-acceptance-report",
    packageId: PACKAGE_ID,
    machineId: "backend-acceptance",
    status: "PASS",
    runId: run.runId,
    runDirectory: run.directory.relative,
    measuredAt,
    denominator: {
      identitySource: "CURRENT_SEMANTIC_ROUTE_BINDING_SCENARIO_RECEIPT_EXACT_SET",
      operationCount: run.operationCount,
      operationIds: state.routes.map((row) => row.operationId).sort(),
      routeIdentityDigest: state.routeIdentityDigest,
      bindingSha256: state.bindingSha256,
      scenarioRegistrySha256BeforeClosure: hashFile(DEFAULT_OUTPUTS.scenarios),
      baselineRegistrySha256BeforeClosure: hashFile(DEFAULT_OUTPUTS.acceptedBaseline),
    },
    fourDimensionVerdict: {
      CONTRACT: "PASS",
      BUSINESS: "PASS",
      PERFORMANCE: "PASS",
      CLEANUP: "PASS",
      OVERALL: "PASS",
    },
    calibration: {
      path: calibrationRef,
      sha256: calibrationSha256,
      scenarioId: run.calibration.scenarioId,
      expected: run.calibration.expected,
      actual: run.calibration.actual,
    },
    runtimeEvidence: {
      manifestRef: `${run.directory.relative}/run-manifest.json`,
      childResultRef: `${run.directory.relative}/managed-child-result.json`,
      workloadResultRef: `${run.directory.relative}/workload-result.json`,
      performanceEvidenceRef: `${run.directory.relative}/performance-evidence.json`,
      callsRef: `${run.directory.relative}/calls.json`,
      eventsRef: `${run.directory.relative}/events.jsonl`,
      cleanup: run.child.cleanup,
    },
    operationReceipts: run.receiptIndex,
    entryLedgerSha256: entryLedgerSha256,
  };
  writeAtomicReplace(DEFAULT_OUTPUTS.dynamicReport, report);
  const reportSha256 = hashFile(DEFAULT_OUTPUTS.dynamicReport);
  const reportRef = DEFAULT_OUTPUTS.dynamicReport;
  const receiptByKey = new Map(run.receiptIndex.map((receipt) => [receipt.identityKey, receipt]));
  const dynamicEvidenceIndex = { path: reportRef, sha256: reportSha256, runId: run.runId };
  const updatedScenarios = {
    ...scenarios,
    status: "ACTIVE",
    dynamicEvidenceIndex,
    operations: scenarios.operations.map((scenario) => {
      const evidence = receiptByKey.get(identityKey(scenario.identity));
      if (!evidence) fail("BACKEND_ACCEPTANCE_DYNAMIC_SCENARIO_RECEIPT_MISSING", scenario.identity.operationId);
      return {
        ...scenario,
        dynamicAcceptance: {
          runId: run.runId,
          reportRef,
          reportSha256,
          receiptRef: evidence.receiptRef,
          receiptSha256: evidence.receiptSha256,
          receiptDigest: evidence.receiptDigest,
          fourDimension: evidence.fourDimension,
          businessOracleRef: evidence.businessOracleRef,
          ownerReadback: evidence.ownerReadback,
        },
      };
    }),
  };
  const baselineByKey = new Map(baseline.operations.map((row) => [row.identityKey, row]));
  const updatedBaseline = {
    ...baseline,
    status: "ACTIVE",
    freshAcceptance: dynamicEvidenceIndex,
    operations: baseline.operations.map((row) => {
      const evidence = receiptByKey.get(row.identityKey);
      if (!evidence || !baselineByKey.has(row.identityKey)) fail("BACKEND_ACCEPTANCE_DYNAMIC_BASELINE_RECEIPT_MISSING", row.operationId);
      if (row.baselineState !== "NOT_MEASURED" || row.latest !== null || row.history.length !== 0) {
        fail("BACKEND_ACCEPTANCE_BASELINE_NOT_ENTRY_STATE", row.operationId);
      }
      const measurement = {
        metrics: evidence.metrics,
        runId: run.runId,
        measuredAt,
        receiptRef: evidence.receiptRef,
        receiptSha256: evidence.receiptSha256,
        calibrationReceiptRef: calibrationRef,
        calibrationReceiptSha256: calibrationSha256,
        mode: "FIRST_FRESH_ROUTE_MEASUREMENT_AFTER_KNOWN_COST_CALIBRATION",
      };
      return {
        ...row,
        baselineState: "ACTIVE",
        latest: measurement,
        history: [measurement],
      };
    }),
  };
  const updatedLedger = {
    ...entry.ledger,
    status: CLOSED_UNCOVERED_STATUS,
    rows: [],
    runId: run.runId,
    closedAt: measuredAt,
    entryLedgerSha256BeforeClosure: entryLedgerSha256,
    closureEvidenceRef: reportRef,
    closureEvidenceSha256: reportSha256,
  };
  writeAtomicReplace(DEFAULT_OUTPUTS.scenarios, updatedScenarios);
  writeAtomicReplace(DEFAULT_OUTPUTS.acceptedBaseline, updatedBaseline);
  writeAtomicReplace(DEFAULT_OUTPUTS.knownUncovered, updatedLedger);
  process.stdout.write("BACKEND_ACCEPTANCE_DYNAMIC_CLOSURE=PASS\n"
    + "RUN_ID=" + run.runId + "\n"
    + "OPERATIONS=" + run.operationCount + "\n"
    + "KNOWN_UNCOVERED_OPEN=0\n"
    + "BASELINE_MEASURED=" + run.operationCount + "\n"
    + "REPORT=" + reportRef + "\n"
    + "CLEANUP=PASS\n");
}

function captureU02Static() {
  const outputPaths = [
    DEFAULT_OUTPUTS.scenarios,
    DEFAULT_OUTPUTS.acceptedBaseline,
    DEFAULT_OUTPUTS.historicalDisposition,
    RETAINED_OWNER_LOGIC_PATH,
    ROUTE_UNEXPRESSIBLE_PATH,
  ];
  for (const relative of outputPaths) if (fs.existsSync(absolute(relative))) {
    fail("BACKEND_ACCEPTANCE_U02_STATIC_OUTPUT_ALREADY_EXISTS", relative);
  }
  const entry = validateEntrySnapshot();
  const state = operationState();
  compareProjectionFreshness(state.binding, state.routeMetadata);
  const ledger = validateKnownUncovered(state, entry.ledger, entry.entryKeys);
  const { mappings } = readOwnerMappings();
  const inventory = sourceInventoryState(state);
  const scenarios = buildScenarioRegistry(state, inventory, mappings);
  const baseline = buildBaselineRegistry(state);
  const historical = buildHistoricalDisposition();
  const retainedOwnerLogic = buildClosedPolicy(
    RETAINED_OWNER_LOGIC_PATH,
    "backend-acceptance-retained-owner-logic",
    ["PURE_ALGORITHM", "PURE_MAPPER", "PURE_PARSER"],
    {
      routeScenarioRequiredWhen: ["DATABASE_ACCESS", "TRANSACTION", "CROSS_OWNER_WRITE"],
      routeScenarioNotProducedByException: true,
    },
  );
  const routeUnexpressible = buildClosedPolicy(
    ROUTE_UNEXPRESSIBLE_PATH,
    "backend-acceptance-route-unexpressible-regressions",
    ["ROUTE_UNEXPRESSIBLE_WITH_SOURCE_PROOF"],
    {
      affectedRouteExactSetRequired: true,
      freshRouteProofRequired: true,
      noSilentSuppression: true,
    },
  );
  writeAtomicNoReplace(DEFAULT_OUTPUTS.scenarios, scenarios);
  writeAtomicNoReplace(DEFAULT_OUTPUTS.acceptedBaseline, baseline);
  writeAtomicNoReplace(DEFAULT_OUTPUTS.historicalDisposition, historical);
  writeAtomicNoReplace(RETAINED_OWNER_LOGIC_PATH, retainedOwnerLogic);
  writeAtomicNoReplace(ROUTE_UNEXPRESSIBLE_PATH, routeUnexpressible);
  const scenarioState = validateScenarios(state);
  const baselineState = validateBaseline(state);
  const historicalState = validateHistorical();
  const policyState = validateClosedPolicies();
  process.stdout.write("BACKEND_ACCEPTANCE_U02_STATIC=PASS\n"
    + "DISCOVERED_OPERATIONS=" + scenarioState.count + "\n"
    + "BASELINE_MEASURED=" + baselineState.measured + "\n"
    + "KNOWN_UNCOVERED_OPEN=" + ledger.open.length + "\n"
    + "HISTORICAL_PERFORMANCE=" + historicalState.performance + "\n"
    + "HISTORICAL_HTTP=" + historicalState.http + "\n"
    + "HISTORICAL_NON_ROUTE=" + historicalState.nonRoute + "\n"
    + "CLOSED_POLICIES=" + policyState.count + "\n"
    + "DYNAMIC=NOT_RUN_UNTIL_BA_U03\n"
    + "CLEANUP=PASS\n");
}

function preflight() {
  const entry = validateEntrySnapshot();
  const state = operationState();
  compareProjectionFreshness(state.binding, state.routeMetadata);
  const ledgerState = validateKnownUncovered(state, entry.ledger, entry.entryKeys);
  const scenarioState = validateScenarios(state);
  const providerState = validateProviderMaterialization(state);
  const baselineState = validateBaseline(state);
  const policyState = validateClosedPolicies();
  let dynamicState = null;
  if (entry.ledger.status === CLOSED_UNCOVERED_STATUS) {
    const scenarios = readJson(DEFAULT_OUTPUTS.scenarios, "BACKEND_ACCEPTANCE_SCENARIO_REGISTRY_MISSING");
    const baseline = readJson(DEFAULT_OUTPUTS.acceptedBaseline, "BACKEND_ACCEPTANCE_BASELINE_REGISTRY_MISSING");
    dynamicState = validateDynamicAcceptance(state, scenarios, baseline, entry.ledger, entry);
  }
  const historicalState = validateHistorical(dynamicState);
  if (dynamicState) validateBackendAcceptanceRetirement(dynamicState, historicalState);
  process.stdout.write("BACKEND_ACCEPTANCE_PREFLIGHT=PASS\n"
    + "OPERATIONS=" + scenarioState.count + "\n"
    + "PROVIDERS=" + providerState.count + "\n"
    + "KNOWN_UNCOVERED_OPEN=" + ledgerState.open.length + "\n"
    + "KNOWN_UNCOVERED_COVERED=" + ledgerState.covered.length + "\n"
    + "BASELINE_MEASURED=" + baselineState.measured + "\n"
    + "HISTORICAL_PERFORMANCE=" + historicalState.performance + "\n"
    + "HISTORICAL_HTTP=" + historicalState.http + "\n"
    + "HISTORICAL_NON_ROUTE=" + historicalState.nonRoute + "\n"
    + "CLOSED_POLICIES=" + policyState.count + "\n"
    + "DYNAMIC=" + (dynamicState ? "PASS" : "NOT_CLOSED") + "\n"
    + "ROUTE_FRESHNESS=PASS\n"
    + "CLEANUP=PASS\n");
}

function entryCheck() {
  const entry = validateEntrySnapshot();
  const state = operationState();
  compareOperationIdentity(state.routes, state.bindingRows);
  validateKnownUncovered(state, entry.ledger, entry.entryKeys);
  process.stdout.write("BACKEND_ACCEPTANCE_ENTRY_CHECK=PASS\n"
    + "CURRENT_OPERATIONS=" + state.routes.length + "\n"
    + "ROUTE_FRESHNESS=" + (state.fresh ? "PASS" : "FAIL_STALE_ROUTE_OR_BINDING") + "\n"
    + "P0=" + entry.impact.p0.length + "\n"
    + "W0=" + entry.impact.w0.length + "\n"
    + "CLEANUP=PASS\n");
}

function usage() {
  process.stderr.write("USAGE: backend-acceptance <capture-entry|capture-u02-static|entry-check|preflight|historical|close-dynamic <repo-relative-run-directory>>\n");
  process.exitCode = 2;
}

const command = process.argv[2];
try {
  if (command === "capture-entry") captureEntry();
  else if (command === "capture-u02-static") captureU02Static();
  else if (command === "entry-check") entryCheck();
  else if (command === "preflight") preflight();
  else if (command === "historical") {
    const result = validateHistorical();
    process.stdout.write("BACKEND_ACCEPTANCE_HISTORICAL=PASS\n"
      + "PERFORMANCE=" + result.performance + "\n"
      + "HTTP=" + result.http + "\n"
      + "NON_ROUTE=" + result.nonRoute + "\n"
      + "CLEANUP=PASS\n");
  } else if (command === "close-dynamic") closeDynamic();
  else usage();
} catch (error) {
  process.stderr.write((error.code || "BACKEND_ACCEPTANCE_FAIL") + ": " + error.message + "\n");
  process.exitCode = 1;
}

export {
  compareOperationIdentity,
  compareProjectionFreshness,
  entryAnchors,
  identityKey,
  loadRoutes,
  operationState,
  productionSurface,
  sourceInventoryState,
  validateBaseline,
  validateClosedPolicies,
  validateHistorical,
  validateKnownUncovered,
  validateScenarios,
  validateProviderMaterialization,
};
