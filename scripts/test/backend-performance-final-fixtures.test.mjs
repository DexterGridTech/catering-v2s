import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {createFinalWorkloadRecipes} from "./backend-performance-workload.mjs";
import {createFinalFixtureState, loadFinalFixtureCatalog, materializeFinalFixtureRequest, validateFinalFixtureCatalog, validateFixtureCatalogAgainstRecipes} from "./backend-performance-final-fixtures.mjs";

const root = path.resolve(import.meta.dirname, "../..");

function completeState() {
  const rows = loadFinalFixtureCatalog().rows;
  return createFinalFixtureState({
    path: Object.fromEntries(rows.flatMap((row) => row.pathParameters.map((parameter) => [parameter.stateKey, `fixture-${parameter.name}`]))),
    readbacks: Object.fromEntries(rows.map((row) => [row.prerequisiteReadback, true])),
    sessions: Object.fromEntries(rows.filter((row) => row.sessionScope !== "NONE").map((row) => [row.sessionScope, "session=private"])),
    requestBodies: Object.fromEntries(rows.filter((row) => row.requestBodyRequired).map((row) => [row.fixtureId, {fixture: row.fixtureId}])),
  });
}

test("fixture catalog is the exact 396 recipe set with source-bound materializers", () => {
  const catalog = validateFinalFixtureCatalog();
  assert.equal(catalog.rows.length, 396);
  assert.doesNotThrow(() => validateFixtureCatalogAgainstRecipes(catalog, createFinalWorkloadRecipes()));
});

test("fixture catalog rejects a stale source procedure hash", () => {
  const catalog = structuredClone(loadFinalFixtureCatalog());
  catalog.sourceProcedure.sha256 = "0".repeat(64);
  assert.throws(() => validateFinalFixtureCatalog(catalog), /BP_FINAL_FIXTURE_SOURCE_HASH_DRIFT/);
});

test("fixture materialization never infers path/session/body defaults", () => {
  const row = loadFinalFixtureCatalog().rows.find((candidate) => candidate.pathParameters.length && candidate.sessionScope !== "NONE");
  const recipe = createFinalWorkloadRecipes().find((candidate) => candidate.area === row.area && candidate.fixtureId === row.fixtureId);
  const state = completeState();
  const request = materializeFinalFixtureRequest(recipe, {state});
  assert.equal(request.method, row.method);
  assert.match(request.path, /^\/api\//);
  const invalid = structuredClone(state); invalid.path[row.pathParameters[0].stateKey] = "";
  assert.throws(() => materializeFinalFixtureRequest(recipe, {state: invalid}), /BP_FINAL_FIXTURE_PATH_VALUE_MISSING/);
});

test("fixture catalog has no generic materializer and no unbound prerequisite", () => {
  const catalog = structuredClone(loadFinalFixtureCatalog());
  catalog.rows[0].materializerKind = "GENERIC";
  assert.throws(() => validateFinalFixtureCatalog(catalog), /BP_FINAL_FIXTURE_BINDING_INVALID/);
  const pristine = JSON.parse(readFileSync(path.join(root, "contracts/policy/backend-performance-final-fixture-catalog.json"), "utf8"));
  pristine.rows[0].prerequisiteReadback = "unbound";
  assert.throws(() => validateFinalFixtureCatalog(pristine), /BP_FINAL_FIXTURE_BINDING_INVALID/);
});
