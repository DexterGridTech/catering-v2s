#!/usr/bin/env node
/**
 * Final performance fixtures are a closed, source-bound request materializer.
 *
 * This module deliberately has no fallback identifiers, route inference or
 * caller-provided materializer callback.  The managed final adapter owns the
 * private state assembly; this module only turns a catalog-bound recipe into
 * one request after checking every declared prerequisite.
 */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {normalizeEdgePath} from "./seed-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const fixtureCatalogPath = "contracts/policy/backend-performance-final-fixture-catalog.json";
export const fixtureCatalogKinds = new Set([
  "FINAL_PLATFORM_READ",
  "FINAL_OPERATIONS_READ",
  "FINAL_PUBLIC_READ",
  "FINAL_PLATFORM_COMMAND",
  "FINAL_OPERATIONS_COMMAND",
  "FINAL_PUBLIC_COMMAND",
]);
const fail = (code, detail = "") => { throw new Error(detail ? `${code}:${detail}` : code); };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const keyOf = (recipe) => `${recipe.area}\u0000${recipe.fixtureId}`;

export function loadFinalFixtureCatalog(relative = fixtureCatalogPath) {
  return readJson(relative);
}

export function validateFinalFixtureCatalog(catalog = loadFinalFixtureCatalog(), {sourceBytes} = {}) {
  if (catalog?.schemaVersion !== 1 || catalog.kind !== "backend-performance-final-fixture-catalog" || catalog.status !== "STATIC_SOURCE_BOUND") fail("BP_FINAL_FIXTURE_CATALOG_IDENTITY_INVALID");
  if (!Array.isArray(catalog.rows) || catalog.rows.length !== 396) fail("BP_FINAL_FIXTURE_CATALOG_DENOMINATOR_DRIFT");
  if (!Array.isArray(catalog.materializerKinds) || JSON.stringify([...catalog.materializerKinds].sort()) !== JSON.stringify([...fixtureCatalogKinds].sort())) fail("BP_FINAL_FIXTURE_MATERIALIZER_VOCABULARY_DRIFT");
  if (catalog.sourceProcedure?.path !== "scripts/test/backend-performance-workload.mjs" || catalog.sourceProcedure?.exportedProcedure !== "createFinalWorkloadRecipes") fail("BP_FINAL_FIXTURE_SOURCE_PROCEDURE_INVALID");
  const bytes = sourceBytes ?? readFileSync(path.join(root, catalog.sourceProcedure.path));
  if (catalog.sourceProcedure.sha256 !== sha256(bytes)) fail("BP_FINAL_FIXTURE_SOURCE_HASH_DRIFT");
  const seen = new Set();
  for (const row of catalog.rows) {
    if (!row || typeof row.area !== "string" || typeof row.fixtureId !== "string" || typeof row.operationId !== "string" || typeof row.method !== "string" || typeof row.routeTemplate !== "string") fail("BP_FINAL_FIXTURE_ROW_INVALID");
    const key = keyOf(row); if (seen.has(key)) fail("BP_FINAL_FIXTURE_DUPLICATE", key); seen.add(key);
    if (row.sourceAnchor?.path !== catalog.sourceProcedure.path || row.sourceAnchor?.exportedProcedure !== catalog.sourceProcedure.exportedProcedure || row.sourceAnchor?.sha256 !== catalog.sourceProcedure.sha256 || typeof row.sourceAnchor?.selector !== "string") fail("BP_FINAL_FIXTURE_SOURCE_ANCHOR_INVALID", key);
    if (typeof row.preparationProcedure !== "string" || !/^prepare[A-Z][A-Za-z0-9]+$/.test(row.preparationProcedure)) fail("BP_FINAL_FIXTURE_PREPARATION_INVALID", key);
    if (!fixtureCatalogKinds.has(row.materializerKind) || typeof row.materializerId !== "string" || !/^final:[A-Za-z0-9:_-]+$/.test(row.materializerId) || !Array.isArray(row.pathParameters) || typeof row.prerequisiteReadback !== "string" || !row.prerequisiteReadback.startsWith("readback.")) fail("BP_FINAL_FIXTURE_BINDING_INVALID", key);
    for (const parameter of row.pathParameters) {
      if (!parameter || typeof parameter.name !== "string" || parameter.type !== "OPAQUE_IDENTIFIER" || typeof parameter.stateKey !== "string" || !parameter.stateKey.startsWith("path.")) fail("BP_FINAL_FIXTURE_PATH_PARAMETER_INVALID", key);
    }
    if (typeof row.requestBodyRequired !== "boolean" || typeof row.sessionScope !== "string") fail("BP_FINAL_FIXTURE_REQUEST_CONTRACT_INVALID", key);
  }
  return catalog;
}

function scopedMaterializerKind(recipe) {
  const routeSegments = normalizeEdgePath(recipe.routeTemplate).split("/").filter(Boolean);
  const routeFace = routeSegments[1];
  const command = recipe.method !== "GET";
  if (routeFace === "platform") return command ? "FINAL_PLATFORM_COMMAND" : "FINAL_PLATFORM_READ";
  if (routeFace === "operations") return command ? "FINAL_OPERATIONS_COMMAND" : "FINAL_OPERATIONS_READ";
  if (routeFace === "public") return command ? "FINAL_PUBLIC_COMMAND" : "FINAL_PUBLIC_READ";
  fail("BP_FINAL_FIXTURE_ROUTE_SCOPE_INVALID", recipe.operationId);
}

export function validateFixtureCatalogAgainstRecipes(catalog, recipes) {
  validateFinalFixtureCatalog(catalog);
  if (!Array.isArray(recipes)) fail("BP_FINAL_FIXTURE_RECIPES_INVALID");
  const expected = new Map(recipes.map((recipe) => [keyOf(recipe), recipe]));
  const actual = new Map(catalog.rows.map((row) => [keyOf(row), row]));
  if (expected.size !== recipes.length || actual.size !== catalog.rows.length || expected.size !== actual.size) fail("BP_FINAL_FIXTURE_EXACT_SET_DRIFT");
  for (const [key, recipe] of expected) {
    const row = actual.get(key);
    if (!row || row.operationId !== recipe.operationId || row.method !== recipe.method || row.routeTemplate !== recipe.routeTemplate || row.materializerKind !== scopedMaterializerKind(recipe)) fail("BP_FINAL_FIXTURE_RECIPE_DRIFT", key);
    if (recipe.branch !== undefined && row.branch !== recipe.branch) fail("BP_FINAL_FIXTURE_BRANCH_DRIFT", key);
    if (recipe.branch === undefined && Object.hasOwn(row, "branch")) fail("BP_FINAL_FIXTURE_BRANCH_DRIFT", key);
  }
  return catalog;
}

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
}

/**
 * Assemble the one closed fixture state accepted by the final workload.  The
 * adapter may obtain these values only through its own fixed owner-HTTP
 * preparation phases; no route/default/callback inference occurs here.
 */
export function createFinalFixtureState({catalog = loadFinalFixtureCatalog(), path: pathValues, readbacks, sessions, requestBodies} = {}) {
  validateFinalFixtureCatalog(catalog);
  if (!pathValues || !readbacks || !sessions || !requestBodies || typeof pathValues !== "object" || typeof readbacks !== "object" || typeof sessions !== "object" || typeof requestBodies !== "object") fail("BP_FINAL_FIXTURE_STATE_INVALID");
  for (const row of catalog.rows) {
    if (readbacks[row.prerequisiteReadback] !== true) fail("BP_FINAL_FIXTURE_PREREQUISITE_READBACK_MISSING", row.prerequisiteReadback);
    for (const parameter of row.pathParameters) requiredString(pathValues[parameter.stateKey], "BP_FINAL_FIXTURE_PATH_VALUE_MISSING");
    if (row.sessionScope !== "NONE") requiredString(sessions[row.sessionScope], "BP_FINAL_FIXTURE_SESSION_MISSING");
    if (row.requestBodyRequired && (!requestBodies[row.fixtureId] || typeof requestBodies[row.fixtureId] !== "object" || Array.isArray(requestBodies[row.fixtureId]))) fail("BP_FINAL_FIXTURE_BODY_MISSING", row.fixtureId);
  }
  return Object.freeze({kind: "backend-performance-final-fixture-state", path: Object.freeze({...pathValues}), readbacks: Object.freeze({...readbacks}), sessions: Object.freeze({...sessions}), requestBodies: Object.freeze({...requestBodies})});
}

/**
 * `state` is built privately by the managed adapter from owner-HTTP readbacks.
 * It cannot infer an id/body/session from a route, so missing fixture facts
 * remain an explicit, operation-attributed failure instead of a pseudo run.
 */
export function materializeFinalFixtureRequest(recipe, {catalog = loadFinalFixtureCatalog(), state} = {}) {
  validateFinalFixtureCatalog(catalog);
  if (!recipe || typeof recipe.area !== "string" || typeof recipe.fixtureId !== "string") fail("BP_FINAL_FIXTURE_RECIPE_INVALID");
  const row = catalog.rows.find((candidate) => keyOf(candidate) === keyOf(recipe));
  if (!row || row.operationId !== recipe.operationId || row.method !== recipe.method || row.routeTemplate !== recipe.routeTemplate) fail("BP_FINAL_FIXTURE_RECIPE_DRIFT", keyOf(recipe));
  if (!state || state.kind !== "backend-performance-final-fixture-state" || !state.path || !state.readbacks || !state.sessions || !state.requestBodies) fail("BP_FINAL_FIXTURE_STATE_INVALID");
  const readback = state.readbacks[row.prerequisiteReadback];
  if (readback !== true) fail("BP_FINAL_FIXTURE_PREREQUISITE_READBACK_MISSING", row.prerequisiteReadback);
  let requestPath = row.routeTemplate;
  for (const parameter of row.pathParameters) {
    const value = requiredString(state.path[parameter.stateKey], "BP_FINAL_FIXTURE_PATH_VALUE_MISSING");
    requestPath = requestPath.replace(`{${parameter.name}}`, encodeURIComponent(value));
  }
  if (/\{[^}]+\}/.test(requestPath) || normalizeEdgePath(requestPath) !== requestPath) fail("BP_FINAL_FIXTURE_PATH_MATERIALIZATION_INVALID", row.fixtureId);
  const headers = {};
  if (row.sessionScope !== "NONE") headers.Cookie = requiredString(state.sessions[row.sessionScope], "BP_FINAL_FIXTURE_SESSION_MISSING");
  const body = row.requestBodyRequired ? state.requestBodies[row.fixtureId] : undefined;
  if (row.requestBodyRequired && (!body || typeof body !== "object" || Array.isArray(body))) fail("BP_FINAL_FIXTURE_BODY_MISSING", row.fixtureId);
  return {method: row.method, path: requestPath, headers, ...(body === undefined ? {} : {body})};
}

export function createFinalFixtureReport({runId, catalog = loadFinalFixtureCatalog(), prepared = []} = {}) {
  validateFinalFixtureCatalog(catalog);
  requiredString(runId, "BP_FINAL_FIXTURE_RUN_ID_INVALID");
  if (!Array.isArray(prepared)) fail("BP_FINAL_FIXTURE_REPORT_INVALID");
  return {
    schemaVersion: 1,
    kind: "backend-performance-final-fixture-report",
    runId,
    catalogSha256: sha256(readFileSync(path.join(root, fixtureCatalogPath))),
    fixtureCallGroups: prepared.map(({owner, operationId, routeTemplate, correlationId}) => ({owner, operationId, routeTemplate, correlationId})),
  };
}
