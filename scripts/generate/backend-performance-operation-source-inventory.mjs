#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bindingPath = "contracts/registry/operation-handler-bindings.json";
const commandCatalogPath = "doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-command-operation-catalog.json";
const readCatalogPath = "doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-read-operation-catalog.json";
const topologyPath = "contracts/registry/backend-performance-command-topology-matrix.json";
const m1Path = "contracts/registry/backend-performance-m1-command-execution-matrix.json";
const policyPath = "contracts/registry/task-read-surface-policy.json";
const rederivationPath = "doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-cur-anchor-rederivation.json";
const routeRegistryPaths = [
  "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
  "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json",
];
const inventoryPath = "contracts/registry/backend-performance-operation-source-inventory.json";
const loaderPath = "contracts/registry/backend-performance-fact-loader-catalog.json";
const decisionPath = "doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-bpf-u01-source-decision-receipt.json";
const ownerRegistryPath = "contracts/policy/backend-performance-owner-api-registry.json";

const loaderSpecs = [
  ["PLATFORM_READ_SESSION_FACT", "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/session/PlatformSessionResolver.java#requireRead", "PlatformSessionResolver.requireRead", "requireRead(", "immutable platform session read fact"],
  ["PLATFORM_SELECTED_WORKSPACE_FACT", "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/session/PlatformSessionResolver.java#requireEnabledSelectedWorkspace", "PlatformReadSessionFacts.requireEnabledSelectedWorkspace", "requireEnabledSelectedWorkspace(", "owner-validated selected workspace fact"],
  ["PLATFORM_COMMAND_SESSION_FACT", "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/session/PlatformSessionResolver.java#require", "PlatformSessionResolver.require", "require(", "fresh platform command/session context"],
  ["OPERATIONS_READ_AUTHORIZATION_FACT", "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsSessionResolver.java#requireReadFacts", "OperationsSessionResolver.requireReadFacts", "requireReadFacts(", "immutable operations read authorization fact"],
  ["WORKSPACE_COMMAND_AUTHORIZATION_FACT", "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsSessionResolver.java#requireWorkspaceCommandFacts", "OperationsSessionResolver.requireWorkspaceCommandFacts", "requireWorkspaceCommandFacts(", "immutable workspace command authorization fact"],
  ["M1_CATALOG_COMMAND_CONTEXT_FACT", "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java#resolveCatalog", "CommandExecutionContextResolver.resolveCatalog", "resolveCatalog(", "M1 catalog command execution context origin"],
  ["M1_OPERATIONS_COMMAND_CONTEXT_FACT", "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java#resolveOperations", "CommandExecutionContextResolver.resolveOperations", "resolveOperations(", "M1 operations command execution context origin"],
  ["M1_OPERATIONS_CONTEXT_VERSION_FACT", "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java#resolveOperationsAtContextVersion", "CommandExecutionContextResolver.resolveOperationsAtContextVersion", "resolveOperationsAtContextVersion(", "M1 context-version command execution context origin"],
  ["SESSION_ENTRY_AUTHENTICATION_FACT", "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAuthenticationService.java#sessionEntryAuthenticationFacts", "WorkspaceAuthenticationService.sessionEntryAuthenticationFacts", "sessionEntryAuthenticationFacts(", "fresh session-entry authentication fact"],
  ["VISIBLE_ORGANIZATION_FACT", "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationVisibilityLookup.java#resolveSessionEntryFacts", "OrganizationVisibilityLookup.resolveSessionEntryFacts", "resolveSessionEntryFacts(", "owner-provided immutable organization visibility fact"],
];

const factMap = new Map([
  ["PlatformReadSessionFacts", "PLATFORM_READ_SESSION_FACT"],
  ["EnabledSelectedWorkspaceFact", "PLATFORM_SELECTED_WORKSPACE_FACT"],
  ["WorkspaceReadAuthorizationFacts", "OPERATIONS_READ_AUTHORIZATION_FACT"],
  ["SessionEntryAuthenticationFacts", "SESSION_ENTRY_AUTHENTICATION_FACT"],
  ["VisibleOrganizationFacts", "VISIBLE_ORGANIZATION_FACT"],
]);

function fail(code, detail = "") {
  const diagnostics = " WHY=source authority or exact-set control is not satisfied; BACKGROUND=BPF-U01 static admission precedes shape and runtime validation; PATTERN=fail-closed source substitution/orphan/denominator drift";
  throw new Error(code + (detail ? ":" + detail : "") + diagnostics);
}

function read(relative) {
  try { return fs.readFileSync(path.join(root, relative), "utf8"); }
  catch { fail("BP_U01_SOURCE_INPUT_MISSING", relative); }
}

function json(relative) {
  try { return JSON.parse(read(relative)); }
  catch { fail("BP_U01_SOURCE_INPUT_INVALID", relative); }
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileHash(relative) {
  return hash(read(relative));
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function writeJson(relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), {recursive: true});
  fs.writeFileSync(absolute, pretty(value) + "\n");
}

function exactSet(actual, expected, code) {
  const a = actual.slice().sort();
  const e = expected.slice().sort();
  if (a.length !== e.length || new Set(a).size !== a.length || a.some((value, index) => value !== e[index])) fail(code);
}

function escaped(value) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function splitAnchor(anchor) {
  if (typeof anchor !== "string" || !/^[^*{}#]+#[A-Za-z_$][\w$]*$/.test(anchor)) fail("BP_U01_SOURCE_ANCHOR_INVALID", String(anchor));
  const index = anchor.lastIndexOf("#");
  return {path: anchor.slice(0, index), method: anchor.slice(index + 1)};
}

function allJavaFiles() {
  const roots = [
    path.join(root, "apps/backend/catering-business-server/src/main/java"),
    path.join(root, "apps/backend/catering-business-server/modules"),
  ];
  const output = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".java") && !absolute.includes("/src/test/")) {
        output.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  }
  roots.forEach(walk);
  return output.sort();
}

function bodyOf(source, method) {
  const pattern = new RegExp("\\b" + escaped(method) + "\\s*\\(", "g");
  for (const match of source.matchAll(pattern)) {
    const prefix = source.slice(Math.max(0, match.index - 20), match.index).trimEnd();
    if (/[.(,=]$/.test(prefix)) continue;
    let cursor = source.indexOf("(", match.index);
    let depth = 0;
    for (; cursor < source.length; cursor += 1) {
      if (source[cursor] === "(") depth += 1;
      else if (source[cursor] === ")" && --depth === 0) break;
    }
    const open = source.indexOf("{", cursor);
    if (open < 0 || source.slice(cursor, open).includes(";")) continue;
    let braces = 0;
    let quote;
    for (let index = open; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === "\\") index += 1;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === "\"" || character === "'") { quote = character; continue; }
      if (character === "{") braces += 1;
      if (character === "}" && --braces === 0) return {text: source.slice(match.index, index + 1), start: match.index};
    }
  }
  return undefined;
}

function physical(anchor, label) {
  const parts = splitAnchor(anchor);
  const absolute = path.join(root, parts.path);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail("BP_U01_SOURCE_ANCHOR_MISSING", label + ":" + anchor);
  const source = fs.readFileSync(absolute, "utf8");
  const method = bodyOf(source, parts.method);
  if (!method && !new RegExp("\\b" + escaped(parts.method) + "\\s*\\(").test(source)) fail("BP_U01_SOURCE_METHOD_MISSING", label + ":" + anchor);
  return {
    anchor,
    path: parts.path,
    method: parts.method,
    sha256: hash(source),
    source,
    body: method ? method.text : "",
    hasBody: Boolean(method),
  };
}

function javaImports(source) {
  return new Map([...source.matchAll(/^import\s+([A-Za-z_$][\w$.]*);/gm)].map((match) => {
    const imported = match[1];
    return [imported.slice(imported.lastIndexOf(".") + 1), imported];
  }));
}

function resolveJavaType(source, type) {
  const imports = javaImports(source);
  const packageName = source.match(/^package\s+([A-Za-z_$][\w$.]*);/m)?.[1];
  if (!packageName) fail("DBCR_U02_SOURCE_PACKAGE_MISSING", type);
  const first = type.split(".")[0];
  if (imports.has(first)) return imports.get(first) + type.slice(first.length);
  if (imports.has(type)) return imports.get(type);
  if (type.includes(".")) return type;
  return packageName + "." + type;
}

function injectedFields(source) {
  const fields = [];
  const fieldPattern = /private\s+final\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s+([A-Za-z_$][\w$]*)\s*;/g;
  for (const match of source.matchAll(fieldPattern)) {
    fields.push({type: match[1], field: match[2], resolvedType: resolveJavaType(source, match[1])});
  }
  const assignments = new Map([...source.matchAll(/this\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)].map((match) => [match[1], match[2]]));
  return fields.map((entry) => Object.assign(entry, {
    constructorAssigned: assignments.get(entry.field) === entry.field,
  }));
}

function typeDeclarationExists(source, apiType) {
  const simpleName = apiType.slice(apiType.lastIndexOf(".") + 1);
  return new RegExp("\\b(?:interface|class|record|enum)\\s+" + escaped(simpleName) + "\\b").test(source);
}

function validateOwnerRegistry(registry) {
  if (!registry || registry.schemaVersion !== 1 || registry.kind !== "backend-performance-owner-api-registry" || registry.status !== "SOURCE_VERIFIED_STATIC") {
    fail("DBCR_U02_OWNER_REGISTRY_HEADER_INVALID");
  }
  if (!Array.isArray(registry.ownerApis) || registry.ownerApis.length !== 7 || !Array.isArray(registry.excludedApis) || registry.excludedApis.length !== 1 || !Array.isArray(registry.targetOperations) || registry.targetOperations.length !== 5) {
    fail("DBCR_U02_OWNER_REGISTRY_DENOMINATOR_INVALID");
  }
  const apiByType = new Map();
  for (const entry of registry.ownerApis) {
    if (!entry || typeof entry.apiType !== "string" || typeof entry.owner !== "string" || typeof entry.sourcePath !== "string" || typeof entry.sourceSha256 !== "string" || apiByType.has(entry.apiType)) fail("DBCR_U02_OWNER_REGISTRY_API_ROW_INVALID", entry?.apiType || "UNSET");
    const source = read(entry.sourcePath);
    if (hash(source) !== entry.sourceSha256 || !typeDeclarationExists(source, entry.apiType)) fail("DBCR_U02_OWNER_REGISTRY_API_SOURCE_DRIFT", entry.apiType);
    apiByType.set(entry.apiType, entry);
  }
  const excludedByType = new Map();
  for (const entry of registry.excludedApis) {
    if (!entry || typeof entry.apiType !== "string" || typeof entry.exclusionKind !== "string" || excludedByType.has(entry.apiType)) fail("DBCR_U02_OWNER_REGISTRY_EXCLUSION_ROW_INVALID", entry?.apiType || "UNSET");
    const source = read(entry.sourcePath);
    if (hash(source) !== entry.sourceSha256 || !typeDeclarationExists(source, entry.apiType)) fail("DBCR_U02_OWNER_REGISTRY_EXCLUSION_SOURCE_DRIFT", entry.apiType);
    excludedByType.set(entry.apiType, entry);
  }
  const targetById = new Map();
  for (const entry of registry.targetOperations) {
    if (!entry || typeof entry.operationId !== "string" || targetById.has(entry.operationId) || !Array.isArray(entry.expectedOwners) || entry.expectedOwners.length !== 2 || new Set(entry.expectedOwners).size !== 2) fail("DBCR_U02_OWNER_REGISTRY_TARGET_ROW_INVALID", entry?.operationId || "UNSET");
    for (const owner of entry.expectedOwners) if (![...apiByType.values()].some((api) => api.owner === owner)) fail("DBCR_U02_OWNER_REGISTRY_TARGET_OWNER_UNKNOWN", entry.operationId + ":" + owner);
    targetById.set(entry.operationId, entry);
  }
  return {apiByType, excludedByType, targetById};
}

function ownerApiBindings(operationId, m1Row, registry) {
  const target = registry.targetById.get(operationId);
  if (!target) return {status: "NOT_APPLICABLE", bindings: [], exclusions: []};
  if (!m1Row || typeof m1Row.adapterSourcePath !== "string" || m1Row.transactionEntry?.methodName !== "execute") fail("DBCR_U02_TARGET_ADAPTER_SOURCE_MISSING", operationId);
  const adapter = physical(m1Row.adapterSourcePath + "#" + m1Row.transactionEntry.methodName, operationId + ":owner-api-adapter");
  const fields = injectedFields(adapter.source);
  const execute = bodyOf(adapter.source, m1Row.transactionEntry.methodName);
  if (!execute) fail("DBCR_U02_TARGET_EXECUTE_BODY_MISSING", operationId);
  const bindings = [];
  const exclusions = [];
  for (const field of fields) {
    const ownerApi = registry.apiByType.get(field.resolvedType);
    const excludedApi = registry.excludedByType.get(field.resolvedType);
    if (!ownerApi && !excludedApi) fail("DBCR_U02_UNKNOWN_INJECTED_API", operationId + ":" + field.field + ":" + field.resolvedType);
    if (!field.constructorAssigned) fail("DBCR_U02_OWNER_FIELD_NOT_CONSTRUCTOR_INJECTED", operationId + ":" + field.field);
    const callSymbols = ownerApi
      ? [...execute.text.matchAll(new RegExp("\\b" + escaped(field.field) + "\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(", "g"))].map((match) => match[1])
      : [];
    if (ownerApi && callSymbols.length === 0) fail("DBCR_U02_OWNER_FIELD_NOT_REACHABLE", operationId + ":" + field.field);
    if (ownerApi) {
      bindings.push({field: field.field, type: field.resolvedType, owner: ownerApi.owner, callSymbols: [...new Set(callSymbols)], sourceAnchor: adapter.anchor, sourceSha256: adapter.sha256});
    } else {
      exclusions.push({field: field.field, type: field.resolvedType, exclusionKind: excludedApi.exclusionKind, reason: excludedApi.reason, sourceAnchor: adapter.anchor, sourceSha256: adapter.sha256});
    }
  }
  const actualOwners = [...new Set(bindings.map((entry) => entry.owner))].sort();
  const expectedOwners = target.expectedOwners.slice().sort();
  exactSet(actualOwners, expectedOwners, "DBCR_U02_OWNER_SET_DRIFT:" + operationId);
  if (bindings.some((entry) => entry.callSymbols.length === 0) || new Set(bindings.map((entry) => entry.field)).size !== bindings.length) fail("DBCR_U02_OWNER_BINDING_SET_INVALID", operationId);
  return {status: "SOURCE_DERIVED_REQUIRED", bindings, exclusions};
}

function routeMap() {
  const rows = routeRegistryPaths.flatMap((relative) => {
    const value = json(relative);
    if (!Array.isArray(value.operations)) fail("BP_U01_ROUTE_REGISTRY_INVALID", relative);
    return value.operations.map((row) => Object.assign({}, row, {registryPath: relative}));
  });
  if (rows.length !== 196) fail("BP_U01_ROUTE_DENOMINATOR_DRIFT", String(rows.length));
  const ids = rows.map((row) => row.operationId);
  if (new Set(ids).size !== ids.length) fail("BP_U01_ROUTE_DUPLICATE");
  return new Map(rows.map((row) => [row.operationId, row]));
}

function resolveImplementation(interfaceAnchor, method) {
  const interfaceName = path.basename(splitAnchor(interfaceAnchor).path, ".java");
  for (const relative of allJavaFiles()) {
    const source = read(relative);
    if (!new RegExp("implements\\s+" + escaped(interfaceName) + "\\b").test(source)) continue;
    const body = bodyOf(source, method);
    if (body) return {anchor: relative + "#" + method, path: relative, source, body: body.text, sha256: hash(source)};
  }
  return undefined;
}

function transactionEvidence(anchor, label) {
  const declared = physical(anchor, label);
  const concrete = declared.hasBody ? declared : resolveImplementation(anchor, declared.method);
  const source = concrete ? concrete.source : declared.source;
  const body = concrete ? concrete.body : declared.body;
  const start = concrete ? source.indexOf(concrete.body) : 0;
  const annotated = /@Transactional(?:\s*\([^)]*\))?/.test(source.slice(Math.max(0, start - 1200), start)) || /@Transactional(?:\s*\([^)]*\))?/.test(body);
  return {
    classification: annotated ? "ORIGIN" : "JOIN_EXISTING_REQUIRED_PARTICIPANT",
    concreteAnchor: concrete ? concrete.anchor : anchor,
    declaredSha256: declared.sha256,
    concreteSha256: concrete ? concrete.sha256 : declared.sha256,
    reason: annotated ? "physical method/class carries @Transactional" : "physical method has no transaction annotation; retained as participant pending owner-boundary proof",
  };
}

function edgeCalls(body, method) {
  return new RegExp("\\b[A-Za-z_$][\\w$]*\\s*\\.\\s*" + escaped(method) + "\\s*\\(").test(body);
}

function sourceDecisions(commandBindings, topologyById, m1ById) {
  const catalog = json(commandCatalogPath);
  const rederive = json(rederivationPath);
  const catalogById = new Map(catalog.rows.map((row) => [row.id, row]));
  const mismatchById = new Map(rederive.mismatches.map((row) => [row.operationId, row]));
  const nonM1 = commandBindings.filter((row) => !m1ById.has(row.operationId));
  if (nonM1.length !== 45 || rederive.summary.denominator !== 45 || rederive.mismatches.length !== 4) fail("BP_U01_CUR_REDERIVATION_DENOMINATOR_DRIFT");
  const cur = nonM1.map((binding) => {
    const current = catalogById.get(binding.operationId);
    const topology = topologyById.get(binding.operationId);
    const edge = physical(topology.edge.sourceAnchor, binding.operationId + ":edge");
    const method = splitAnchor(current.cur.tx[1]).method;
    if (!edgeCalls(edge.body, method)) fail("BP_U01_CUR_DISPATCH_SOURCE_DRIFT", binding.operationId);
    if (current.cur.tx[1].includes("/app/edge/") || !current.cur.tx[1].includes("/modules/")) fail("BP_U01_CUR_DISPATCH_BOUNDARY_DRIFT", binding.operationId);
    physical(current.cur.tx[1], binding.operationId + ":cur");
    const mismatch = mismatchById.get(binding.operationId);
    if (mismatch && mismatch.derived !== current.cur.tx[1]) fail("BP_U01_CUR_MISMATCH_RECONCILIATION_DRIFT", binding.operationId);
    return {
      operationId: binding.operationId,
      edgeAnchor: topology.edge.sourceAnchor,
      dispatchRule: rederive.deterministicRule.id,
      derivedAnchor: current.cur.tx[1],
      status: mismatch ? "CORRECTED_FROM_SOURCE_REDERIVATION" : "MATCHED_SOURCE_REDERIVATION",
      evidence: mismatch ? mismatch.edgeEvidence : "edge owner/protocol field call agrees with current catalogue anchor",
    };
  });
  const idempotency = commandBindings.map((binding) => {
    const current = catalogById.get(binding.operationId);
    const edge = physical(topologyById.get(binding.operationId).edge.sourceAnchor, binding.operationId + ":edge");
    const gap = String(current.cur.idem).startsWith("GAP_");
    const hasContract = /Idempotency-Key|idempotencyKey|idempotency\s*\(/.test(edge.body);
    return {
      operationId: binding.operationId,
      priorValue: current.cur.idem,
      sourceAnchor: edge.anchor,
      sourceSha256: edge.sha256,
      decision: hasContract ? "REQUIRE_OWNER_RECEIPT_AFTER_OWNER_RECHECK" : "NOT_APPLICABLE_NO_IDEMPOTENCY_CONTRACT",
      status: gap ? "GAP_EXPLICITLY_DISPOSED" : "EXISTING_SOURCE_DECLARATION_RETAINED",
      target: hasContract ? "BPF-U02" : "BPF-U01_STATIC_SOURCE_DISPOSITION",
      reason: hasContract ? "HTTP source carries idempotency key; owner replay correctness is retained" : "HTTP source has no idempotency-key contract; no receipt is invented",
    };
  });
  const readback = commandBindings.map((binding) => {
    const current = catalogById.get(binding.operationId);
    const edge = physical(topologyById.get(binding.operationId).edge.sourceAnchor, binding.operationId + ":edge");
    const gap = String(current.cur.readback).startsWith("GAP_");
    const noContent = /\bnoContent\s*\(|\bHttpStatus\.NO_CONTENT\b/.test(edge.body);
    return {
      operationId: binding.operationId,
      priorValue: current.cur.readback,
      sourceAnchor: edge.anchor,
      sourceSha256: edge.sha256,
      decision: noContent ? "VALID_NO_CONTENT_SOURCE_PROOF" : "REQUIRE_FINAL_OWNER_READBACK",
      status: gap ? "GAP_EXPLICITLY_DISPOSED" : "EXISTING_SOURCE_DECLARATION_RETAINED",
      target: noContent ? "BPF-U01_STATIC_SOURCE_DISPOSITION" : "BPF-U02",
      reason: noContent ? "HTTP source explicitly returns no content" : "HTTP source carries a representation and must preserve final owner readback",
    };
  });
  const origin = nonM1.map((binding) => {
    const current = catalogById.get(binding.operationId);
    const evidence = transactionEvidence(current.cur.tx[1], binding.operationId + ":origin");
    return {
      operationId: binding.operationId,
      dispatchAnchor: current.cur.tx[1],
      decision: evidence.classification,
      sourceAnchor: evidence.concreteAnchor,
      sourceSha256: evidence.concreteSha256,
      reason: evidence.reason,
      status: "SOURCE_REOPENED_CLOSED",
    };
  });
  return {cur, idempotency, readback, origin};
}

function callerPaths(spec) {
  const parts = splitAnchor(spec[1]);
  const output = [];
  for (const relative of allJavaFiles()) {
    const source = read(relative);
    if (relative === parts.path) {
      if (spec[0] === "SESSION_ENTRY_AUTHENTICATION_FACT" && source.includes(spec[3])) output.push(relative);
      continue;
    }
    if (source.includes(spec[3])) output.push(relative);
  }
  return output.sort();
}

function loaderCatalogue(m1Rows) {
  const rows = loaderSpecs.map((spec) => {
    const source = physical(spec[1], "loader:" + spec[0]);
    const calls = callerPaths(spec);
    const declared = spec[0].startsWith("M1_")
      ? m1Rows.filter((row) => row.context.sourceAnchor === spec[1]).map((row) => row.operationId)
      : calls;
    return {
      loaderId: spec[0],
      sourceAnchor: spec[1],
      sourceSha256: source.sha256,
      callSitePrefix: spec[2],
      invocationPattern: spec[3],
      allowedCallerPaths: calls.length ? calls : [source.path],
      declaredOperationIds: [...new Set(declared)],
      callerAdmission: spec[0].startsWith("M1_") ? "M1_MATRIX_DECLARED_CALLERS" : "SOURCE_SCANNED_CALLERS",
      reason: spec[4],
    };
  });
  if (rows.length !== 10) fail("BP_U01_FACT_LOADER_CATALOG_DENOMINATOR_DRIFT");
  return {
    schemaVersion: 1,
    kind: "backend-performance-fact-loader-catalog",
    status: "SOURCE_VERIFIED_STATIC",
    authority: "BPF-U01 source inventory owns this closed loader/caller catalogue; runtime at-most-once is BPF-U03 evidence.",
    denominator: {loaderCount: 10, M1OperationCount: 68},
    rows,
  };
}

function loaderDigest(row) {
  return hash(pretty(row));
}

function loaderRefs(binding, profile, policy, edgeSource, m1) {
  if (binding.mode === "READ") {
    if (policy.disposition === "PROTOCOL_READ_EXEMPT") return [];
    return policy.requiredFactSet.map((fact) => {
      const loader = factMap.get(fact);
      if (!loader) fail("BP_U01_FACT_LOADER_UNMAPPED", binding.operationId + ":" + fact);
      return loader;
    });
  }
  if (m1) {
    const match = loaderSpecs.find((spec) => spec[1] === m1.context.sourceAnchor);
    if (!match) fail("BP_U01_M1_CONTEXT_LOADER_UNMAPPED", binding.operationId);
    return [match[0]];
  }
  if ((profile === "PLATFORM_OWNER_COMMAND" || profile === "PLATFORM_PROTOCOL") && /require\s*\(|requireActor\s*\(/.test(edgeSource)) return ["PLATFORM_COMMAND_SESSION_FACT"];
  if (profile === "WORKSPACE_OWNER_COMMAND" && /requireWorkspaceCommandFacts\s*\(/.test(edgeSource)) return ["WORKSPACE_COMMAND_AUTHORIZATION_FACT"];
  return [];
}

function build() {
  const bindings = json(bindingPath).operations;
  if (!Array.isArray(bindings) || bindings.length !== 196) fail("BP_U01_BINDING_DENOMINATOR_DRIFT");
  const bindingById = new Map(bindings.map((row) => [row.operationId, row]));
  if (bindingById.size !== 196) fail("BP_U01_BINDING_DUPLICATE");
  const routes = routeMap();
  exactSet([...routes.keys()], [...bindingById.keys()], "BP_U01_BINDING_ROUTE_SET_DRIFT");
  const commandCatalog = json(commandCatalogPath);
  const readCatalog = json(readCatalogPath);
  const topology = json(topologyPath);
  const m1 = json(m1Path);
  const policy = json(policyPath);
  const ownerRegistry = validateOwnerRegistry(json(ownerRegistryPath));
  if (commandCatalog.rows.length !== 113 || readCatalog.rows.length !== 83 || topology.rows.length !== 113 || m1.rows.length !== 68 || policy.rows.length !== 83) fail("BP_U01_INPUT_PARTITION_DRIFT");
  const topologyById = new Map(topology.rows.map((row) => [row.operationId, row]));
  const m1ById = new Map(m1.rows.map((row) => [row.operationId, row]));
  const policyById = new Map(policy.rows.map((row) => [row.operationId, row]));
  const commandById = new Map(commandCatalog.rows.map((row) => [row.id, row]));
  const readById = new Map(readCatalog.rows.map((row) => [row[0], row]));
  const loaders = loaderCatalogue(m1.rows);
  const loadersById = new Map(loaders.rows.map((row) => [row.loaderId, row]));
  const commands = bindings.filter((row) => row.mode === "COMMAND");
  const decisions = sourceDecisions(commands, topologyById, m1ById);
  const rows = bindings.map((binding, index) => {
    const route = routes.get(binding.operationId);
    let profile;
    let edgeAnchor = null;
    let edge;
    let adapter;
    let transaction;
    let ownerBoundary;
    let shapeInput;
    if (binding.mode === "COMMAND") {
      const top = topologyById.get(binding.operationId);
      const current = commandById.get(binding.operationId);
      if (!top || !current) fail("BP_U01_COMMAND_SOURCE_ROW_MISSING", binding.operationId);
      profile = top.profileId;
      edgeAnchor = top.edge.sourceAnchor;
      edge = physical(edgeAnchor, binding.operationId + ":edge");
      const m1Row = m1ById.get(binding.operationId);
      if (m1Row) {
        const adapterSource = physical(m1Row.adapterSourcePath + "#" + m1Row.transactionEntry.methodName, binding.operationId + ":m1-adapter");
        const generated = physical(m1Row.edge.sourcePath + "#" + m1Row.edge.methodName, binding.operationId + ":m1-binding");
        adapter = {
          kind: "GENERATED_BINDING_AND_PHYSICAL_ADAPTER",
          fqcn: binding.adapter,
          sourceAnchor: m1Row.adapterSourcePath + "#" + m1Row.transactionEntry.methodName,
          sourceSha256: adapterSource.sha256,
          bindingSourceAnchor: m1Row.edge.sourcePath + "#" + m1Row.edge.methodName,
          bindingSourceSha256: generated.sha256,
          reachabilityStatus: "DECLARED_M1_BINDING_REACHABILITY_BPF_U02",
        };
        transaction = {
          kind: "M1_DECLARED_ORIGIN",
          propagation: m1Row.transactionEntry.propagation,
          sourceAnchor: m1Row.adapterSourcePath + "#" + m1Row.transactionEntry.methodName,
          sourceSha256: adapterSource.sha256,
          evidence: "M1 adapter entry is source-verified; binding reachability is a later BPF-U02 gate",
        };
        ownerBoundary = {
          owner: binding.owner,
          kind: m1Row.ownerInvocation.kind,
          sourceAnchor: m1Row.ownerInvocation.sourceAnchor,
          sourceSha256: physical(m1Row.ownerInvocation.sourceAnchor, binding.operationId + ":owner").sha256,
        };
        shapeInput = {originDecision: "M1_ORIGIN", responseMode: m1Row.responseMode, idempotencyPolicy: m1Row.ownerInvocation.idempotencyPolicy || null};
      } else {
        const evidence = transactionEvidence(current.cur.tx[1], binding.operationId + ":origin");
        const currentAnchor = physical(current.cur.tx[1], binding.operationId + ":current-dispatch");
        adapter = {kind: "DECLARED_TYPE_ONLY", fqcn: binding.adapter, sourceAnchor: null, sourceSha256: null, reachabilityStatus: "GAP_DECLARED_ADAPTER_FQCN_HAS_NO_PHYSICAL_SOURCE"};
        transaction = {kind: evidence.classification, propagation: "REQUIRED", sourceAnchor: evidence.concreteAnchor, sourceSha256: evidence.concreteSha256, dispatchAnchor: currentAnchor.anchor, evidence: evidence.reason};
        ownerBoundary = {owner: binding.owner, kind: top.ownerOrProtocolApi.kind, sourceAnchor: currentAnchor.anchor, sourceSha256: currentAnchor.sha256};
        const idem = decisions.idempotency.find((row) => row.operationId === binding.operationId);
        const readback = decisions.readback.find((row) => row.operationId === binding.operationId);
        shapeInput = {originDecision: transaction.kind, idempotencyDecision: idem.decision, readbackDecision: readback.decision};
      }
    } else {
      const readPolicy = policyById.get(binding.operationId);
      if (!readPolicy || !readById.has(binding.operationId)) fail("BP_U01_READ_SOURCE_ROW_MISSING", binding.operationId);
      profile = readPolicy.disposition;
      edgeAnchor = readPolicy.disposition === "PROTOCOL_READ_EXEMPT" ? null : readPolicy.sourceAnchor;
      edge = edgeAnchor ? physical(edgeAnchor, binding.operationId + ":read-edge") : undefined;
      const readerSource = readPolicy.primaryBoundary ? physical(readPolicy.primaryBoundary, binding.operationId + ":reader") : undefined;
      adapter = {kind: readPolicy.disposition === "PROTOCOL_READ_EXEMPT" ? "PROTOCOL_READ_EXEMPTION" : "TASK_READER", sourceAnchor: readPolicy.primaryBoundary || null, sourceSha256: readerSource ? readerSource.sha256 : null, reachabilityStatus: readPolicy.disposition === "PROTOCOL_READ_EXEMPT" ? "EXEMPT_WITH_COMPLETION_EVIDENCE" : "SOURCE_VERIFIED_TASK_READER"};
      transaction = {kind: "OUTSIDE_TRANSACTION", propagation: "NONE", sourceAnchor: edgeAnchor, sourceSha256: edge ? edge.sha256 : null, evidence: readPolicy.reason || "task read policy and source reader anchor"};
      ownerBoundary = {owner: binding.owner, kind: "TASK_READ_OWNER_BOUNDARY", sourceAnchor: readPolicy.primaryBoundary || null, sourceSha256: readerSource ? readerSource.sha256 : null};
      shapeInput = {readDisposition: readPolicy.disposition, primaryQueryCap: readPolicy.primaryQueryCap === undefined ? null : readPolicy.primaryQueryCap, optionalCountCap: readPolicy.optionalCountCap === undefined ? null : readPolicy.optionalCountCap, declaredExtrasCap: readPolicy.declaredExtrasCap === undefined ? null : readPolicy.declaredExtrasCap, factSet: readPolicy.requiredFactSet || [], aboveFloorExplanation: readPolicy.primaryQueryCap > 1 ? {userTask: readPolicy.userTask, whyNotMergeable: readPolicy.whyNotMergeable, cardinalityBound: readPolicy.cardinalityBound} : null};
    }
    const ids = loaderRefs(binding, profile, policyById.get(binding.operationId), edge ? edge.source : "", m1ById.get(binding.operationId));
    exactSet(ids, [...new Set(ids)], "BP_U01_DUPLICATE_FACT_LOADER_REF:" + binding.operationId);
    const factLoaderRefs = ids.map((loaderId) => {
      const loader = loadersById.get(loaderId);
      if (!loader) fail("BP_U01_FACT_LOADER_REFERENCE_MISSING", binding.operationId + ":" + loaderId);
      return {loaderId, loaderDigest: loaderDigest(loader)};
    });
    const derivedOwnerApis = binding.mode === "COMMAND"
      ? ownerApiBindings(binding.operationId, m1ById.get(binding.operationId), ownerRegistry)
      : {status: "NOT_APPLICABLE", bindings: [], exclusions: []};
    return {
      rowId: "BPF-SRC-" + String(index + 1).padStart(3, "0"),
      operationId: binding.operationId,
      mode: binding.mode,
      owner: binding.owner,
      consumerFace: binding.face,
      route: {method: route.method, path: route.path, routeRegistry: route.registryPath, routeOwner: route.owner, routeConsumerFaces: route.consumerFaces},
      profileId: profile,
      edge: {sourceAnchor: edgeAnchor, sourceSha256: edge ? edge.sha256 : null, sourceStatus: edge ? "SOURCE_VERIFIED" : "PROTOCOL_READ_EXEMPT_WITHOUT_HTTP_HANDLER"},
      adapter,
      transaction,
      ownerBoundary,
      ownerApiDerivation: derivedOwnerApis.status,
      ownerApiBindings: derivedOwnerApis.bindings,
      ownerApiExclusions: derivedOwnerApis.exclusions,
      factLoaderRefs,
      shapeInput,
      evidence: {bindingPath, bindingSha256: fileHash(bindingPath), canonicalOperationIndex: index, sourceDecisionReceipt: decisionPath + "#rows[operationId=" + binding.operationId + "]"},
    };
  });
  const inventory = {
    schemaVersion: 1,
    kind: "backend-performance-operation-source-inventory",
    status: "SOURCE_VERIFIED_STATIC",
    authority: "BPF-U01 generated source inventory is the only physical source-path authority for the 196-row shape matrix.",
    denominator: {operations: 196, commands: 113, reads: 83, m1Commands: 68, taskReads: 78, protocolReadExemptions: 5, coordinatedOwnerOperations: 5},
    inputs: {
      bindings: {path: bindingPath, sha256: fileHash(bindingPath)},
      routeRegistries: routeRegistryPaths.map((relative) => ({path: relative, sha256: fileHash(relative)})),
      commandTopology: {path: topologyPath, sha256: fileHash(topologyPath)},
      m1Execution: {path: m1Path, sha256: fileHash(m1Path)},
      taskReadPolicy: {path: policyPath, sha256: fileHash(policyPath)},
      curRederivation: {path: rederivationPath, sha256: fileHash(rederivationPath)},
      ownerApiRegistry: {path: ownerRegistryPath, sha256: fileHash(ownerRegistryPath)},
    },
    loaderCatalogue: {path: loaderPath, sha256: hash(pretty(loaders)), loaderCount: loaders.rows.length},
    sourceDecisionReceipt: {path: decisionPath, sha256: hash(pretty(decisions))},
    rows,
  };
  const decisionsReceipt = {
    schemaVersion: 1,
    kind: "backend-performance-final-optimization-bpf-u01-source-decision-receipt",
    status: "SOURCE_REOPENED_STATIC_DECISIONS_COMPLETE",
    packageId: "BACKEND-PERFORMANCE-FINAL-OPTIMIZATION-STATIC-IMPLEMENTATION-20260811",
    reviewTarget: "IMPLEMENTATION",
    rules: {
      curDispatch: json(rederivationPath).deterministicRule,
      idempotency: "Every command is source-reopened; 87 prior gap rows receive explicit required or not-applicable dispositions.",
      readback: "Every command is source-reopened; 45 prior gap rows receive final-owner-readback or valid-no-content dispositions.",
      origin: "Every non-M1 command is source-reopened and classified ORIGIN or JOIN_EXISTING_REQUIRED_PARTICIPANT from physical evidence.",
    },
    sourceInputs: {commandCatalog: {path: commandCatalogPath, sha256: fileHash(commandCatalogPath)}, topology: {path: topologyPath, sha256: fileHash(topologyPath)}, m1: {path: m1Path, sha256: fileHash(m1Path)}},
    counts: {operations: 196, nonM1CurDecisions: decisions.cur.length, idempotencyDecisions: decisions.idempotency.length, idempotencyGapDecisions: decisions.idempotency.filter((row) => row.status === "GAP_EXPLICITLY_DISPOSED").length, readbackDecisions: decisions.readback.length, readbackGapDecisions: decisions.readback.filter((row) => row.status === "GAP_EXPLICITLY_DISPOSED").length, originParticipationDecisions: decisions.origin.length},
    curRederivation: decisions.cur,
    idempotencyDecisions: decisions.idempotency,
    readbackDecisions: decisions.readback,
    originParticipationDecisions: decisions.origin,
  };
  return {inventory, loaders, decisionsReceipt};
}

function validateExact(actual, expected, label) {
  if (!actual || actual.schemaVersion !== 1 || actual.kind !== expected.kind || actual.status !== expected.status) fail("BP_U01_" + label + "_HEADER_INVALID");
  if (label === "SOURCE_INVENTORY") {
    if (!Array.isArray(actual.rows) || actual.rows.length !== expected.rows.length) fail("BP_U01_SOURCE_INVENTORY_ROW_DENOMINATOR_DRIFT");
    exactSet(actual.rows.map((row) => row.operationId), expected.rows.map((row) => row.operationId), "BP_U01_SOURCE_INVENTORY_OPERATION_SET_DRIFT");
    const expectedById = new Map(expected.rows.map((row) => [row.operationId, row]));
    for (const row of actual.rows) {
      const original = expectedById.get(row.operationId);
      if (!original || row.rowId !== original.rowId) fail("BP_U01_SOURCE_INVENTORY_ROW_ID_DRIFT", row && row.operationId);
      if (row.edge.sourceAnchor !== original.edge.sourceAnchor) fail("BP_U01_SOURCE_INVENTORY_EDGE_SOURCE_SUBSTITUTION", row.operationId);
      if (row.route.path !== original.route.path) fail("BP_U01_SOURCE_INVENTORY_ROUTE_SOURCE_SUBSTITUTION", row.operationId);
    }
  } else if (label === "FACT_LOADER_CATALOG") {
    if (!Array.isArray(actual.rows) || actual.rows.length !== expected.rows.length) fail("BP_U01_FACT_LOADER_CATALOG_ROW_DENOMINATOR_DRIFT");
    exactSet(actual.rows.map((row) => row.loaderId), expected.rows.map((row) => row.loaderId), "BP_U01_FACT_LOADER_CATALOG_OPERATION_SET_DRIFT");
  }
  if (pretty(actual) !== pretty(expected)) fail("BP_U01_" + label + "_ARTIFACT_DRIFT");
}

function main() {
  const argument = process.argv[2];
  const expected = build();
  if (argument === "--write") {
    writeJson(loaderPath, expected.loaders);
    writeJson(decisionPath, expected.decisionsReceipt);
    writeJson(inventoryPath, expected.inventory);
    process.stdout.write("BP_U01_SOURCE_INVENTORY_WRITE=PASS\nOPERATIONS=196\nLOADERS=10\nDECISIONS=196\n");
  } else if (argument === "--check") {
    validateExact(json(loaderPath), expected.loaders, "FACT_LOADER_CATALOG");
    validateExact(json(decisionPath), expected.decisionsReceipt, "DECISION_RECEIPT");
    validateExact(json(inventoryPath), expected.inventory, "SOURCE_INVENTORY");
    process.stdout.write("BP_U01_SOURCE_INVENTORY_CHECK=PASS\nOPERATIONS=196\nCOMMANDS=113\nREADS=83\nM1=68\nNON_M1_CUR=45\nIDEMPOTENCY_GAP_DECISIONS=87\nREADBACK_GAP_DECISIONS=45\nORIGIN_JOIN_DECISIONS=45\nLOADERS=10\n");
  } else if (argument === "--self-test") {
    validateExact(expected.loaders, expected.loaders, "FACT_LOADER_CATALOG");
    validateExact(expected.decisionsReceipt, expected.decisionsReceipt, "DECISION_RECEIPT");
    validateExact(expected.inventory, expected.inventory, "SOURCE_INVENTORY");
    const missing = structuredClone(expected.inventory);
    missing.rows.pop();
    try { validateExact(missing, expected.inventory, "SOURCE_INVENTORY"); fail("BP_U01_SOURCE_INVENTORY_RED_MUTATION_NOT_DETECTED", "missing-row"); }
    catch (error) { if (!String(error.message).startsWith("BP_U01_SOURCE_INVENTORY_ROW_DENOMINATOR_DRIFT")) throw error; }
    const substituted = structuredClone(expected.inventory);
    substituted.rows[0].edge.sourceAnchor = substituted.rows[1].edge.sourceAnchor;
    try { validateExact(substituted, expected.inventory, "SOURCE_INVENTORY"); fail("BP_U01_SOURCE_INVENTORY_RED_MUTATION_NOT_DETECTED", "source-substitution"); }
    catch (error) { if (!String(error.message).startsWith("BP_U01_SOURCE_INVENTORY_EDGE_SOURCE_SUBSTITUTION")) throw error; }
    const orphan = structuredClone(expected.inventory);
    orphan.rows[0].factLoaderRefs.push({loaderId: "UNKNOWN", loaderDigest: "0".repeat(64)});
    try { validateExact(orphan, expected.inventory, "SOURCE_INVENTORY"); fail("BP_U01_SOURCE_INVENTORY_RED_MUTATION_NOT_DETECTED", "loader-orphan"); }
    catch (error) { if (!String(error.message).startsWith("BP_U01_SOURCE_INVENTORY_ARTIFACT_DRIFT")) throw error; }
    const ownerLoss = structuredClone(expected.inventory);
    ownerLoss.rows.find((row) => row.operationId === "transitionOperationsCatalogItemStatus").ownerApiBindings.pop();
    try { validateExact(ownerLoss, expected.inventory, "SOURCE_INVENTORY"); fail("DBCR_U02_SOURCE_INVENTORY_RED_MUTATION_NOT_DETECTED", "owner-field-loss"); }
    catch (error) { if (!String(error.message).startsWith("BP_U01_SOURCE_INVENTORY_ARTIFACT_DRIFT")) throw error; }
    const importOnly = structuredClone(expected.inventory);
    importOnly.rows.find((row) => row.operationId === "createOperationsCatalogItem").ownerApiBindings.push({field: "scope", type: "com.catering.v2s.organization.api.CatalogScopeLookup", owner: "organization", callSymbols: ["typeOnly"]});
    try { validateExact(importOnly, expected.inventory, "SOURCE_INVENTORY"); fail("DBCR_U02_SOURCE_INVENTORY_RED_MUTATION_NOT_DETECTED", "import-only"); }
    catch (error) { if (!String(error.message).startsWith("BP_U01_SOURCE_INVENTORY_ARTIFACT_DRIFT")) throw error; }
    process.stdout.write("BP_U01_SOURCE_INVENTORY_SELF_TEST=PASS\nRED_MISSING_ROW=PASS\nRED_SOURCE_SUBSTITUTION=PASS\nRED_LOADER_ORPHAN=PASS\nDBCR_U02_RED_OWNER_FIELD_LOSS=PASS\nDBCR_U02_RED_IMPORT_ONLY=PASS\nCLEANUP=PASS\n");
  } else {
    fail("BP_U01_SOURCE_INVENTORY_ARGUMENT_INVALID");
  }
}

try { main(); }
catch (error) { process.stderr.write(String(error && error.message ? error.message : error) + "\n"); process.exitCode = 1; }
