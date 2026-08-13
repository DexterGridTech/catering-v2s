import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = process.env.BACKEND_ACCEPTANCE_ROOT
  ? path.resolve(process.env.BACKEND_ACCEPTANCE_ROOT)
  : DEFAULT_ROOT;
const PACKAGE_ID = "BACKEND-ACCEPTANCE-IMPLEMENTATION-20260813";
const ACTIVE_PACKAGE_PATH = ".runtime/compliance-control/active-package.json";
const DEFAULT_PACKAGE_INPUT = "doc/evidence/platform/backend-acceptance/implementation-package-input.json";
const DEFAULT_ENTRY_IMPACT = "doc/evidence/platform/backend-acceptance/entry-impact-snapshot.json";
const DERIVATION_CONTRACT_PATH = "contracts/policy/backend-acceptance-production-surface-derivation.json";
const BINDING_PATH = "contracts/registry/operation-handler-bindings.json";
const SOURCE_INVENTORY_PATH = "contracts/registry/backend-performance-operation-source-inventory.json";
const ROUTE_REGISTRY_PATHS = Object.freeze([
  "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
  "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json",
]);
const PRODUCTION_ROOTS = Object.freeze([
  "apps/backend/catering-business-server/src/main/java",
  "apps/backend/catering-business-server/src/main/resources",
  "apps/backend/catering-business-server/modules",
]);
const ANCHOR_FIELDS = Object.freeze([
  "edge",
  "adapter",
  "transaction",
  "ownerBoundary",
]);
const COMPATIBILITY_CLASSES = Object.freeze([
  "OPTIONAL_FIELD_ADDED",
  "NON_BREAKING_CONSTRAINT_WIDENED",
  "ADDITIVE_ERROR_NOT_MATCHING_EXISTING_FLOW",
]);
const CONSUMER_DISPOSITIONS = Object.freeze([
  "CONSUMER_CONTRACT_REGENERATED",
  "CONSUMER_UNAFFECTED",
  "CONSUMER_BREAKING_ACKNOWLEDGED",
]);
const OPERATION_DISPOSITIONS = Object.freeze([
  "SCENARIO_UPDATED",
  "REGRESSION_ADDED",
  "BEHAVIOR_UNCHANGED",
]);

function fail(code, detail = "") {
  const error = new Error(code + (detail ? ":" + detail : ""));
  error.code = code;
  throw error;
}

function absolute(root, relative) {
  return path.join(root, relative);
}

function hashBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hashFile(root, relative) {
  const file = absolute(root, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return "ABSENT";
  return hashBytes(fs.readFileSync(file));
}

function readJson(root, relative, errorCode = "BACKEND_ACCEPTANCE_SOURCE_MISSING") {
  const file = absolute(root, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(errorCode, relative);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(errorCode + "_INVALID_JSON", relative + ":" + error.message);
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableDigest(value) {
  return hashBytes(Buffer.from(JSON.stringify(value)));
}

function serializedHash(value) {
  return hashBytes(Buffer.from(JSON.stringify(value, null, 2) + "\n"));
}

function normalizeRelative(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) {
    fail("BACKEND_ACCEPTANCE_PRODUCTION_PATH_INVALID", String(value));
  }
  const normalized = value.replace(/\\/g, "/").replace(/\/+/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.includes("..")) fail("BACKEND_ACCEPTANCE_PRODUCTION_PATH_ESCAPE", value);
  return parts.join("/");
}

function normalizeRoutePath(value) {
  if (typeof value !== "string" || value.length === 0) fail("BACKEND_ACCEPTANCE_ROUTE_PATH_INVALID", "EMPTY");
  const normalized = value.replace(/\/+/g, "/");
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function identityKey(row) {
  return JSON.stringify([
    row.operationId,
    String(row.method).toUpperCase(),
    normalizeRoutePath(row.path || row.normalizedPath),
    row.consumerFace || row.face,
    row.owner,
  ]);
}

function anchorPath(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.split("#", 1)[0];
}

function relativeFromAbsolute(root, file) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (!relative || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    fail("BACKEND_ACCEPTANCE_PRODUCTION_PATH_ESCAPE", file);
  }
  return normalizeRelative(relative);
}

function walkFiles(root, relativeRoot, predicate = () => true) {
  const start = absolute(root, relativeRoot);
  if (!fs.existsSync(start)) return [];
  if (!fs.statSync(start).isDirectory()) fail("BACKEND_ACCEPTANCE_PRODUCTION_ROOT_INVALID", relativeRoot);
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "build" || entry.name === ".gradle" || entry.name.startsWith(".")) continue;
      const file = path.join(directory, entry.name);
      const relative = relativeFromAbsolute(root, file);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && predicate(relative)) result.push(relative);
    }
  };
  visit(start);
  return result.sort();
}

function validateDerivationContract(contract) {
  if (!contract || contract.schemaVersion !== 1
    || contract.kind !== "backend-acceptance-production-surface-derivation"
    || contract.packageId !== PACKAGE_ID
    || contract.algorithmVersion !== "V1_MAIN_SOURCE_AND_TASK_INPUTS_WITH_SOURCE_INVENTORY_ANCHORS") {
    fail("BACKEND_ACCEPTANCE_DERIVATION_RULE_DRIFT");
  }
  const roots = (contract.productionRoots || []).map(normalizeRelative).sort();
  if (JSON.stringify(roots) !== JSON.stringify([...PRODUCTION_ROOTS].sort())) {
    fail("BACKEND_ACCEPTANCE_DERIVATION_RULE_DRIFT", "productionRoots");
  }
  if (!Array.isArray(contract.productionFileRules)
    || !contract.productionFileRules.some((rule) => String(rule).includes("hash full bytes"))
    || !contract.productionFileRules.some((rule) => String(rule).includes("exclude build outputs"))) {
    fail("BACKEND_ACCEPTANCE_DERIVATION_RULE_DRIFT", "productionFileRules");
  }
  return contract;
}

function addSurfaceEntry(root, map, relative, derivationOwner) {
  const normalized = normalizeRelative(relative);
  const file = absolute(root, normalized);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    fail("BACKEND_ACCEPTANCE_PRODUCTION_INPUT_MISSING", normalized);
  }
  const entry = {
    path: normalized,
    exists: true,
    sha256: hashFile(root, normalized),
    derivationOwner,
  };
  const previous = map.get(normalized);
  if (previous && previous.derivationOwner !== derivationOwner) {
    map.set(normalized, entry);
    return;
  }
  if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) {
    fail("BACKEND_ACCEPTANCE_PRODUCTION_SURFACE_DUPLICATE", normalized);
  }
  map.set(normalized, entry);
}

/**
 * The only production-surface owner for BA-U04. Route projection files are
 * explicit generator task inputs because the entry snapshot already binds
 * them as generated projection inputs.
 */
function deriveProductionSurface({ repositoryRoot = ROOT } = {}) {
  const contract = validateDerivationContract(readJson(
    repositoryRoot,
    DERIVATION_CONTRACT_PATH,
    "BACKEND_ACCEPTANCE_DERIVATION_CONTRACT_MISSING",
  ));
  const entries = new Map();
  for (const relative of walkFiles(repositoryRoot, PRODUCTION_ROOTS[0])) {
    addSurfaceEntry(repositoryRoot, entries, relative, "app.main.java");
  }
  for (const relative of walkFiles(repositoryRoot, PRODUCTION_ROOTS[1])) {
    addSurfaceEntry(repositoryRoot, entries, relative, "app.main.resources");
  }
  for (const relative of walkFiles(repositoryRoot, PRODUCTION_ROOTS[2], (candidate) =>
    /\/src\/main\/(?:java|resources)\//.test(candidate))) {
    addSurfaceEntry(repositoryRoot, entries, relative, "module.main.source_or_resource");
  }
  addSurfaceEntry(repositoryRoot, entries, "apps/backend/catering-business-server/build.gradle.kts", "app.gradle.main_inputs");
  for (const relative of walkFiles(repositoryRoot, PRODUCTION_ROOTS[2], (candidate) =>
    /\/build\.gradle\.kts$/.test(candidate))) {
    addSurfaceEntry(repositoryRoot, entries, relative, "module.gradle.main_inputs");
  }
  for (const relative of ROUTE_REGISTRY_PATHS) {
    addSurfaceEntry(repositoryRoot, entries, relative, "generated.route_projection_task_input");
  }
  if (contract.anchorSource?.path !== SOURCE_INVENTORY_PATH
    || !Array.isArray(contract.anchorSource?.fields)
    || contract.anchorSource.fields.length === 0) {
    fail("BACKEND_ACCEPTANCE_DERIVATION_RULE_DRIFT", "anchorSource");
  }
  return [...entries.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function loadRoutes(repositoryRoot) {
  const rows = [];
  const metadata = [];
  for (const relative of ROUTE_REGISTRY_PATHS) {
    const registry = readJson(repositoryRoot, relative, "BACKEND_ACCEPTANCE_ROUTE_REGISTRY_MISSING");
    if (!Array.isArray(registry.operations)) fail("BACKEND_ACCEPTANCE_ROUTE_REGISTRY_OPERATIONS_INVALID", relative);
    metadata.push({
      path: relative,
      schemaVersion: registry.schemaVersion ?? null,
      revision: registry.revision ?? null,
      generatedFrom: registry.generatedFrom ?? null,
      contractDigest: registry.contractDigest ?? null,
      contentSha256: hashFile(repositoryRoot, relative),
    });
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
        normalizedPath: normalizeRoutePath(operation.path),
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

function loadBindings(repositoryRoot) {
  const binding = readJson(repositoryRoot, BINDING_PATH, "BACKEND_ACCEPTANCE_BINDING_MISSING");
  if (!Array.isArray(binding.operations)) fail("BACKEND_ACCEPTANCE_BINDING_OPERATIONS_INVALID");
  return binding;
}

function loadSourceInventory(repositoryRoot, routes) {
  const inventory = readJson(repositoryRoot, SOURCE_INVENTORY_PATH, "BACKEND_ACCEPTANCE_SOURCE_INVENTORY_MISSING");
  if (!Array.isArray(inventory.rows)) fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_INVALID");
  const routeByKey = new Map(routes.rows.map((row) => [identityKey(row), row]));
  const byKey = new Map();
  for (const row of inventory.rows) {
    const candidate = {
      operationId: row.operationId,
      method: String(row.route?.method || "").toUpperCase(),
      path: row.route?.path,
      consumerFace: row.consumerFace,
      owner: row.owner,
    };
    if (!row || !row.route || typeof row.operationId !== "string"
      || typeof row.owner !== "string" || typeof row.consumerFace !== "string"
      || !routeByKey.has(identityKey(candidate))) {
      fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_IDENTITY_DRIFT", row?.rowId || row?.operationId || "UNKNOWN");
    }
    const key = identityKey(candidate);
    if (byKey.has(key)) fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_DUPLICATE", row.rowId || row.operationId);
    byKey.set(key, row);
  }
  if (byKey.size !== routeByKey.size || [...routeByKey.keys()].some((key) => !byKey.has(key))) {
    fail("BACKEND_ACCEPTANCE_SOURCE_INVENTORY_EXACT_SET_DRIFT", "routes=" + routeByKey.size + ":inventory=" + byKey.size);
  }
  return {
    path: SOURCE_INVENTORY_PATH,
    sha256: hashFile(repositoryRoot, SOURCE_INVENTORY_PATH),
    rows: inventory.rows,
    byKey,
  };
}

function loadSemanticState({ repositoryRoot = ROOT } = {}) {
  const routes = loadRoutes(repositoryRoot);
  const binding = loadBindings(repositoryRoot);
  const bindingByOperationId = new Map();
  for (const row of binding.operations) {
    if (!row || typeof row.operationId !== "string" || bindingByOperationId.has(row.operationId)) {
      fail("BACKEND_ACCEPTANCE_BINDING_OPERATION_INVALID", row?.operationId || "UNKNOWN");
    }
    bindingByOperationId.set(row.operationId, row);
  }
  const routeKeys = routes.rows.map(identityKey).sort();
  const bindingKeys = routes.rows.map((route) => {
    const candidate = bindingByOperationId.get(route.operationId);
    if (!candidate) fail("BACKEND_ACCEPTANCE_BINDING_OPERATION_UNKNOWN", route.operationId);
    if (normalizeRoutePath(candidate.path) !== route.normalizedPath
      || String(candidate.method || route.method).toUpperCase() !== route.method
      || candidate.face !== route.consumerFace || candidate.owner !== route.owner) {
      fail("BACKEND_ACCEPTANCE_OPERATION_IDENTITY_EXACT_SET_DRIFT", route.operationId);
    }
    return identityKey({
      operationId: route.operationId,
      method: route.method,
      path: candidate.path,
      consumerFace: candidate.face,
      owner: candidate.owner,
    });
  }).sort();
  if (JSON.stringify(routeKeys) !== JSON.stringify(bindingKeys)) {
    fail("BACKEND_ACCEPTANCE_OPERATION_IDENTITY_EXACT_SET_DRIFT");
  }
  const sourceInventory = loadSourceInventory(repositoryRoot, routes);
  const operations = routes.rows.map((route) => ({
    ...route,
    identityKey: identityKey(route),
    identityDigest: stableDigest(route),
  }));
  const semanticOperations = operations.map((operation) => ({
    identityKey: operation.identityKey,
    identityDigest: operation.identityDigest,
    routeDigest: stableDigest(operation),
    bindingDigest: stableDigest(bindingByOperationId.get(operation.operationId)),
    sourceDigest: stableDigest(sourceInventory.byKey.get(operation.identityKey)),
    consumerFace: operation.consumerFace,
  }));
  return {
    routes,
    binding,
    bindingSha256: hashFile(repositoryRoot, BINDING_PATH),
    sourceInventory,
    operations,
    operationsDigest: stableDigest(operations),
    semanticOperations,
  };
}

function assertDigest(value, errorCode, detail) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(errorCode, detail);
}

function validateSurfaceEntries(surface, errorCode = "BACKEND_ACCEPTANCE_PRODUCTION_SURFACE_INVALID", {
  uniquePaths = true,
  requireSurfaceMetadata = true,
} = {}) {
  if (!Array.isArray(surface) || surface.length === 0) fail(errorCode);
  const paths = new Set();
  for (const entry of surface) {
    if (!entry || typeof entry.path !== "string" || (uniquePaths && paths.has(entry.path))
      || (requireSurfaceMetadata && (entry.exists !== true || typeof entry.derivationOwner !== "string"))) {
      fail(errorCode, entry?.path || "UNKNOWN");
    }
    assertDigest(entry.sha256, errorCode, entry.path);
    paths.add(entry.path);
  }
  return paths;
}

function validateEntryAnchors({ repositoryRoot = ROOT, entrySnapshot, entryRows, sourceInventory } = {}) {
  if (!entrySnapshot || entrySnapshot.packageId !== PACKAGE_ID
    || entrySnapshot.status !== "ACTIVE_ENTRY_SNAPSHOT") {
    fail("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_BINDING_INVALID");
  }
  const p0Paths = validateSurfaceEntries(entrySnapshot.p0, "BACKEND_ACCEPTANCE_ENTRY_P0_INVALID");
  validateSurfaceEntries(entrySnapshot.w0, "BACKEND_ACCEPTANCE_ENTRY_W0_INVALID", {
    uniquePaths: false,
    requireSurfaceMetadata: false,
  });
  const p0ByPath = new Map(entrySnapshot.p0.map((entry) => [entry.path, entry]));
  const operationIds = new Set((entryRows || []).map((row) => row.operationId));
  if (!Array.isArray(entryRows) || operationIds.size !== entryRows.length || operationIds.size === 0) {
    fail("BACKEND_ACCEPTANCE_ENTRY_OPERATION_DENOMINATOR_INVALID");
  }
  const sourceRows = sourceInventory?.rows || [];
  const sourceAnchorMatches = (w0) => sourceRows.flatMap((row) => {
    const matches = [];
    for (const field of ANCHOR_FIELDS) {
      if (row[field]?.sourceAnchor === w0.sourceAnchor) matches.push({ operationId: row.operationId, field: field + ".sourceAnchor" });
    }
    for (const value of row.ownerApiBindings || []) {
      if (value?.sourceAnchor === w0.sourceAnchor) matches.push({ operationId: row.operationId, field: "ownerApiBindings.sourceAnchor" });
    }
    return matches;
  });
  const seen = new Set();
  for (const anchor of entrySnapshot.w0) {
    if (!p0Paths.has(anchor.path) || p0ByPath.get(anchor.path)?.sha256 !== anchor.sha256
      || typeof anchor.operationId !== "string" || !operationIds.has(anchor.operationId)
      || typeof anchor.sourceAnchor !== "string" || anchorPath(anchor.sourceAnchor) !== anchor.path
      || typeof anchor.sourceField !== "string") {
      fail("BACKEND_ACCEPTANCE_ENTRY_ANCHOR_INVALID", anchor.path || "UNKNOWN");
    }
    const key = JSON.stringify([anchor.path, anchor.operationId, anchor.sourceAnchor, anchor.sourceField]);
    if (seen.has(key)) fail("BACKEND_ACCEPTANCE_ENTRY_ANCHOR_DUPLICATE", anchor.path);
    seen.add(key);
    if (sourceRows.length > 0) {
      const matches = [...new Map(sourceAnchorMatches(anchor)
        .filter((match) => match.operationId === anchor.operationId && match.field === anchor.sourceField)
        .map((match) => [match.operationId + "|" + match.field, match])).values()];
      if (matches.length !== 1) fail("BACKEND_ACCEPTANCE_ENTRY_ANCHOR_OPERATION_REVERSE_MAP_INVALID", anchor.sourceAnchor);
    }
  }
  if (entrySnapshot.p0Digest && entrySnapshot.p0Digest !== stableDigest(entrySnapshot.p0)) {
    fail("BACKEND_ACCEPTANCE_ENTRY_P0_DIGEST_INVALID");
  }
  if (entrySnapshot.w0Digest && entrySnapshot.w0Digest !== stableDigest(entrySnapshot.w0)) {
    fail("BACKEND_ACCEPTANCE_ENTRY_W0_DIGEST_INVALID");
  }
  if (!entrySnapshot.o0 || typeof entrySnapshot.o0 !== "object") fail("BACKEND_ACCEPTANCE_ENTRY_O0_INVALID");
  return { p0ByPath, w0Paths: new Set(entrySnapshot.w0.map((entry) => entry.path)) };
}

function loadEntrySnapshot({ repositoryRoot = ROOT } = {}) {
  const active = readJson(repositoryRoot, ACTIVE_PACKAGE_PATH, "BACKEND_ACCEPTANCE_ACTIVE_PACKAGE_INVALID");
  if (active.packageId !== PACKAGE_ID || active.implementationAuthority !== true
    || active.runtimeAuthority !== true || active.seedResetAuthority !== false) {
    fail("BACKEND_ACCEPTANCE_IMPLEMENTATION_PACKAGE_NOT_ACTIVE");
  }
  const packageInputPath = active.packageInputPath || DEFAULT_PACKAGE_INPUT;
  const entryImpactPath = active.entryImpactSnapshotPath || DEFAULT_ENTRY_IMPACT;
  const input = readJson(repositoryRoot, packageInputPath, "BACKEND_ACCEPTANCE_PACKAGE_INPUT_MISSING");
  const snapshot = readJson(repositoryRoot, entryImpactPath, "BACKEND_ACCEPTANCE_ENTRY_IMPACT_MISSING");
  if (input.packageId !== PACKAGE_ID || input.status !== "ACTIVE_NOT_EXIT"
    || snapshot.packageId !== PACKAGE_ID || snapshot.status !== "ACTIVE_ENTRY_SNAPSHOT"
    || input.entrySnapshot?.entryImpactSnapshotSha256 !== serializedHash(snapshot)
    || hashFile(repositoryRoot, entryImpactPath) !== input.entrySnapshot?.entryImpactSnapshotSha256) {
    fail("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_BINDING_INVALID");
  }
  const entryRows = input.entrySnapshot?.packageEntry?.operationDenominator?.rows;
  if (!Array.isArray(entryRows) || entryRows.length === 0) fail("BACKEND_ACCEPTANCE_ENTRY_OPERATION_DENOMINATOR_MISSING");
  validateEntryAnchors({
    repositoryRoot,
    entrySnapshot: snapshot,
    entryRows,
    sourceInventory: readJson(repositoryRoot, SOURCE_INVENTORY_PATH, "BACKEND_ACCEPTANCE_SOURCE_INVENTORY_MISSING"),
  });
  return { active, input, snapshot, entryRows };
}

function changedSurfacePaths(p0, p1) {
  const before = new Map(p0.map((entry) => [entry.path, entry]));
  const after = new Map(p1.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return paths.flatMap((relative) => {
    const left = before.get(relative);
    const right = after.get(relative);
    if (left && right && left.exists === right.exists && left.sha256 === right.sha256) return [];
    return [{
      path: relative,
      changeType: !left ? "ADDED" : !right ? "REMOVED" : "MODIFIED",
      before: left || { path: relative, exists: false, sha256: "ABSENT" },
      after: right || { path: relative, exists: false, sha256: "ABSENT" },
    }];
  });
}

function semanticImpact({ entry, currentSemantic }) {
  const entryRows = entry.entryRows;
  const currentRows = currentSemantic.operations;
  const entryByKey = new Map(entryRows.map((row) => [row.identityKey, row]));
  const currentByKey = new Map(currentRows.map((row) => [row.identityKey, row]));
  const entryKeys = [...entryByKey.keys()].sort();
  const currentKeys = [...currentByKey.keys()].sort();
  const changedOperationIds = new Set();
  const exactSetChanged = JSON.stringify(entryKeys) !== JSON.stringify(currentKeys);
  if (exactSetChanged) currentRows.forEach((row) => changedOperationIds.add(row.operationId));
  for (const [key, row] of currentByKey) {
    const before = entryByKey.get(key);
    if (!before || before.identityDigest !== row.identityDigest) changedOperationIds.add(row.operationId);
  }
  const o0 = entry.snapshot.o0 || {};
  const routeMetadataChanged = JSON.stringify(o0.routeMetadata || []) !== JSON.stringify(currentSemantic.routes.metadata);
  const bindingChanged = o0.bindingSha256 !== currentSemantic.bindingSha256;
  const sourceInventoryChanged = o0.sourceInventory?.sha256 !== currentSemantic.sourceInventory.sha256;
  const operationDigestChanged = o0.operationsDigest !== currentSemantic.operationsDigest;
  const producerChanged = routeMetadataChanged || bindingChanged || sourceInventoryChanged || operationDigestChanged;
  if (producerChanged) currentRows.forEach((row) => changedOperationIds.add(row.operationId));
  return {
    changedOperationIds,
    exactSetChanged,
    routeMetadataChanged,
    bindingChanged,
    sourceInventoryChanged,
    operationDigestChanged,
  };
}

function deriveImpact({ repositoryRoot = ROOT, entry: suppliedEntry, currentSurface, currentSemantic } = {}) {
  const entry = suppliedEntry || loadEntrySnapshot({ repositoryRoot });
  const p0 = entry.snapshot.p0;
  const w0 = entry.snapshot.w0;
  const p1 = currentSurface || deriveProductionSurface({ repositoryRoot });
  const semantic = currentSemantic || loadSemanticState({ repositoryRoot });
  const { w0Paths } = validateEntryAnchors({
    repositoryRoot,
    entrySnapshot: entry.snapshot,
    entryRows: entry.entryRows,
    sourceInventory: semantic.sourceInventory,
  });
  validateSurfaceEntries(p1, "BACKEND_ACCEPTANCE_EXIT_P1_INVALID");
  const changedPaths = changedSurfacePaths(p0, p1);
  const unanchoredChangedPaths = changedPaths.filter((change) => !w0Paths.has(change.path));
  const semanticState = semanticImpact({ entry, currentSemantic: semantic });
  const allRequired = unanchoredChangedPaths.length > 0 || semanticState.exactSetChanged
    || semanticState.routeMetadataChanged || semanticState.bindingChanged
    || semanticState.sourceInventoryChanged || semanticState.operationDigestChanged;
  const currentOperationIds = semantic.operations.map((row) => row.operationId);
  const impacted = new Set();
  if (allRequired) {
    currentOperationIds.forEach((operationId) => impacted.add(operationId));
  } else {
    const changedAnchors = new Set(changedPaths.filter((change) => w0Paths.has(change.path)).map((change) => change.path));
    for (const anchor of w0) if (changedAnchors.has(anchor.path)) impacted.add(anchor.operationId);
  }
  for (const operationId of semanticState.changedOperationIds) impacted.add(operationId);
  const currentById = new Map(semantic.operations.map((row) => [row.operationId, row]));
  const changedConsumerFaces = [];
  for (const operationId of impacted) {
    const row = currentById.get(operationId);
    if (row && row.consumerFace) changedConsumerFaces.push({ operationId, consumerFace: row.consumerFace });
  }
  const impactMode = impacted.size === 0 ? "NONE" : allRequired ? "ALL" : "SUBSET";
  return {
    schemaVersion: 1,
    kind: "backend-acceptance-change-impact",
    status: "PASS",
    packageId: PACKAGE_ID,
    impactMode,
    entryP0Digest: stableDigest(p0),
    exitP1Digest: stableDigest(p1),
    entryW0Digest: stableDigest(w0),
    changedPaths,
    unanchoredChangedPaths,
    semanticChanges: {
      exactSetChanged: semanticState.exactSetChanged,
      routeMetadataChanged: semanticState.routeMetadataChanged,
      bindingChanged: semanticState.bindingChanged,
      sourceInventoryChanged: semanticState.sourceInventoryChanged,
      operationDigestChanged: semanticState.operationDigestChanged,
    },
    currentOperationIds: [...currentOperationIds].sort(),
    impactedOperationIds: [...impacted].sort(),
    changedConsumerFaces: changedConsumerFaces.sort((left, right) =>
      (left.operationId + "|" + left.consumerFace).localeCompare(right.operationId + "|" + right.consumerFace)),
    derivation: {
      productionSurface: DERIVATION_CONTRACT_PATH,
      entrySnapshot: DEFAULT_ENTRY_IMPACT,
      sourceInventory: SOURCE_INVENTORY_PATH,
    },
  };
}

function requiredString(value, code, detail) {
  if (typeof value !== "string" || value.length === 0) fail(code, detail);
  return value;
}

function validateConsumerDisposition(row) {
  if (!row || !CONSUMER_DISPOSITIONS.includes(row.disposition)) {
    fail("CONSUMER_FACE_DISPOSITION_INVALID", row?.disposition || "UNKNOWN");
  }
  if (row.disposition === "CONSUMER_CONTRACT_REGENERATED") {
    for (const field of ["producerContractDigestBefore", "producerContractDigestAfter", "generatedArtifactPath",
      "generatedArtifactDigestBefore", "generatedArtifactDigestAfter", "consumerContractProofRef"]) {
      requiredString(row[field], "CONSUMER_FACE_EVIDENCE_MISSING", field);
    }
  } else if (row.disposition === "CONSUMER_UNAFFECTED") {
    if (!COMPATIBILITY_CLASSES.includes(row.wireCompatibilityClass)) {
      fail("CONSUMER_FACE_DISPOSITION_INVALID", row.wireCompatibilityClass || "UNKNOWN");
    }
    for (const field of ["wireCompatibilityProofRef", "consumerArtifactDigest"]) {
      requiredString(row[field], "CONSUMER_FACE_EVIDENCE_MISSING", field);
    }
  } else {
    for (const field of ["authorityRef", "breakingChangeRef", "remediationOwner", "remediationTarget"]) {
      requiredString(row[field], "CONSUMER_FACE_EVIDENCE_MISSING", field);
    }
    if (!["RESOLVED_IN_PACKAGE", "DEXTER_APPROVED_EXTERNAL_BLOCKER"].includes(row.resolutionStatus)) {
      if (row.resolutionStatus === "PENDING") fail("CONSUMER_FACE_PENDING_FORBIDDEN");
      fail("CONSUMER_FACE_DISPOSITION_INVALID", row.resolutionStatus || "UNKNOWN");
    }
  }
}

function validateBugFixRedProof(receipts, packageKind) {
  if (packageKind !== "BUG_FIX") return;
  if (!Array.isArray(receipts) || receipts.length === 0) fail("BACKEND_ACCEPTANCE_BUG_FIX_RED_PROOF_MISSING");
  const protectedReceipt = receipts.find((receipt) => receipt
    && typeof receipt.preByteHash === "string" && typeof receipt.postByteHash === "string"
    && receipt.preByteHash !== receipt.postByteHash
    && typeof receipt.fixtureId === "string" && typeof receipt.scenarioCaseId === "string"
    && receipt.preVerdict === "FAIL" && receipt.postVerdict === "PASS");
  const unprotected = receipts.find((receipt) => receipt?.disposition === "UNPROTECTED_FIX");
  if (!protectedReceipt && !unprotected) fail("BACKEND_ACCEPTANCE_BUG_FIX_RED_PROOF_INVALID");
}

function validateChangeDispositions({ impact, dispositions, packageKind = "BACKEND_SOURCE" } = {}) {
  if (!impact || impact.status !== "PASS") fail("BACKEND_ACCEPTANCE_CHANGE_IMPACT_MISSING");
  if (!dispositions || dispositions.packageId !== PACKAGE_ID
    || dispositions.status !== "PASS") fail("BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_INVALID");
  const expected = [...impact.impactedOperationIds].sort();
  const rows = dispositions.operations;
  if (!Array.isArray(rows)) fail("BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_INVALID");
  const actual = rows.map((row) => row?.operationId).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)
    || new Set(actual).size !== actual.length) {
    fail("BACKEND_ACCEPTANCE_CHANGE_DISPOSITION_EXACT_SET_DRIFT");
  }
  for (const row of rows) {
    if (!OPERATION_DISPOSITIONS.includes(row.disposition)) {
      fail("BACKEND_ACCEPTANCE_CHANGE_DISPOSITION_INVALID", row.operationId || "UNKNOWN");
    }
    if (row.disposition === "SCENARIO_UPDATED") {
      for (const field of ["beforeDigest", "afterDigest", "direction", "sourceRef"]) {
        requiredString(row[field], "BACKEND_ACCEPTANCE_CHANGE_DISPOSITION_EVIDENCE_MISSING", field);
      }
    } else if (row.disposition === "REGRESSION_ADDED") {
      for (const field of ["scenarioCaseId", "scenarioDigest", "sourceRef"]) {
        requiredString(row[field], "BACKEND_ACCEPTANCE_CHANGE_DISPOSITION_EVIDENCE_MISSING", field);
      }
    } else {
      for (const field of ["unchangedContractDigest", "fourDimensionReceiptRef", "fourDimensionReceiptDigest"]) {
        requiredString(row[field], "BACKEND_ACCEPTANCE_CHANGE_DISPOSITION_EVIDENCE_MISSING", field);
      }
    }
  }
  const expectedFaces = (impact.changedConsumerFaces || [])
    .map((row) => JSON.stringify([row.operationId, row.consumerFace])).sort();
  const consumerRows = dispositions.consumerFaces;
  if (!Array.isArray(consumerRows)) fail("CONSUMER_FACE_DISPOSITION_MISSING");
  const actualFaces = consumerRows.map((row) => JSON.stringify([row?.operationId, row?.consumerFace])).sort();
  if (JSON.stringify(actualFaces) !== JSON.stringify(expectedFaces)
    || new Set(actualFaces).size !== actualFaces.length) {
    fail("CONSUMER_FACE_DISPOSITION_MISSING");
  }
  for (const row of consumerRows) validateConsumerDisposition(row);
  validateBugFixRedProof(dispositions.regressionReceipts, packageKind);
  return {
    status: "PASS",
    operationCount: rows.length,
    consumerFaceCount: consumerRows.length,
    packageKind,
  };
}

function assert(condition, code) {
  if (!condition) fail(code);
}

function selfTest() {
  const p0 = [
    { path: "src/a.java", exists: true, sha256: "a".repeat(64), derivationOwner: "main" },
    { path: "src/b.java", exists: true, sha256: "b".repeat(64), derivationOwner: "main" },
  ];
  const w0 = [{
    path: "src/a.java", exists: true, sha256: "a".repeat(64), derivationOwner: "main",
    operationId: "opA", sourceAnchor: "src/a.java#run", sourceField: "edge.sourceAnchor",
  }];
  const sourceInventory = { rows: [{ operationId: "opA", edge: { sourceAnchor: "src/a.java#run" } }] };
  const entry = {
    entryRows: [{ operationId: "opA", identityKey: "opA", identityDigest: "same" }],
    snapshot: {
      packageId: PACKAGE_ID,
      status: "ACTIVE_ENTRY_SNAPSHOT",
      p0,
      w0,
      p0Digest: stableDigest(p0),
      w0Digest: stableDigest(w0),
      o0: { operationsDigest: "same", routeMetadata: [], bindingSha256: "binding", sourceInventory: { sha256: "source" } },
    },
  };
  const semantic = {
    operations: [{ operationId: "opA", identityKey: "opA", identityDigest: "same", consumerFace: "public" }],
    routes: { metadata: [] }, bindingSha256: "binding", sourceInventory: { sha256: "source" },
    operationsDigest: "same",
  };
  const unchanged = deriveImpact({ entry, currentSurface: p0, currentSemantic: semantic });
  assert(unchanged.impactMode === "NONE" && unchanged.impactedOperationIds.length === 0, "RED_NONE_BASELINE");
  const outside = deriveImpact({
    entry,
    currentSurface: [...p0, { path: "src/unowned.java", exists: true, sha256: "c".repeat(64), derivationOwner: "main" }],
    currentSemantic: semantic,
  });
  assert(outside.impactMode === "ALL" && outside.impactedOperationIds[0] === "opA", "RED_UNANCHORED_NOT_ALL");
  const anchored = deriveImpact({
    entry,
    currentSurface: p0.map((row) => row.path === "src/a.java" ? { ...row, sha256: "d".repeat(64) } : row),
    currentSemantic: semantic,
  });
  assert(anchored.impactMode === "SUBSET" && anchored.impactedOperationIds[0] === "opA", "RED_ANCHOR_SUBSET");
  let duplicateError = false;
  try {
    validateEntryAnchors({ entrySnapshot: { ...entry.snapshot, w0: [...w0, ...w0] }, entryRows: entry.entryRows, sourceInventory });
  } catch (error) {
    duplicateError = error.code === "BACKEND_ACCEPTANCE_ENTRY_ANCHOR_DUPLICATE";
  }
  assert(duplicateError, "RED_DUPLICATE_W0_NOT_REJECTED");
  process.stdout.write("BACKEND_ACCEPTANCE_IMPACT_SELF_TEST=PASS\n"
    + "RED_UNANCHORED_NOT_ALL=PASS\n"
    + "RED_ANCHOR_SUBSET=PASS\n"
    + "RED_DUPLICATE_W0_NOT_REJECTED=PASS\n"
    + "CLEANUP=PASS\n");
}

function packageExit() {
  const entry = loadEntrySnapshot({ repositoryRoot: ROOT });
  const impact = deriveImpact({
    repositoryRoot: ROOT,
    entry,
    currentSurface: deriveProductionSurface({ repositoryRoot: ROOT }),
    currentSemantic: loadSemanticState({ repositoryRoot: ROOT }),
  });
  const dispositionPath = process.env.V2S_BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS;
  if (dispositionPath) {
    const relative = path.isAbsolute(dispositionPath) ? null : dispositionPath;
    const dispositions = relative ? readJson(ROOT, relative, "BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_MISSING")
      : JSON.parse(fs.readFileSync(dispositionPath, "utf8"));
    validateChangeDispositions({ impact, dispositions, packageKind: process.env.V2S_BACKEND_ACCEPTANCE_PACKAGE_KIND || "BACKEND_SOURCE" });
  } else if (impact.impactedOperationIds.length > 0) {
    fail("BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_MISSING");
  }
  process.stdout.write("BACKEND_ACCEPTANCE_CHANGE_IMPACT=PASS\n"
    + "IMPACT_MODE=" + impact.impactMode + "\n"
    + "CHANGED_PATHS=" + impact.changedPaths.length + "\n"
    + "UNANCHORED_CHANGED_PATHS=" + impact.unanchoredChangedPaths.length + "\n"
    + "CURRENT_OPERATIONS=" + impact.currentOperationIds.length + "\n"
    + "IMPACTED_OPERATIONS=" + impact.impactedOperationIds.length + "\n"
    + "CLEANUP=PASS\n");
}

function usage() {
  process.stderr.write("USAGE: impact.mjs --self-test|--package-exit\n");
  process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    if (process.argv[2] === "--self-test") selfTest();
    else if (process.argv[2] === "--package-exit") packageExit();
    else usage();
  } catch (error) {
    process.stderr.write((error.code || "BACKEND_ACCEPTANCE_CHANGE_IMPACT_FAIL") + ": " + error.message + "\n");
    process.exitCode = 1;
  }
}

export {
  deriveProductionSurface,
  deriveImpact,
  loadEntrySnapshot,
  loadSemanticState,
  validateEntryAnchors,
  validateChangeDispositions,
  validateBugFixRedProof,
  stableDigest,
};
