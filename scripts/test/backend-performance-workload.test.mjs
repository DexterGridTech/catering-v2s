import assert from "node:assert/strict";
import test from "node:test";
import {createFinalWorkloadRecipes, executeFinalWorkload, validateFinalWorkloadRecipes} from "./backend-performance-workload.mjs";
import {createFinalFixtureState, loadFinalFixtureCatalog} from "./backend-performance-final-fixtures.mjs";

function fixtureStateFor(rows) {
  return createFinalFixtureState({
    path: Object.fromEntries(rows.flatMap((row) => row.pathParameters.map((parameter) => [parameter.stateKey, `fixture-${parameter.name}`]))),
    readbacks: Object.fromEntries(rows.map((row) => [row.prerequisiteReadback, true])),
    sessions: Object.fromEntries(rows.filter((row) => row.sessionScope !== "NONE").map((row) => [row.sessionScope, "session=private"])),
    requestBodies: Object.fromEntries(rows.filter((row) => row.requestBodyRequired).map((row) => [row.fixtureId, {fixture: row.fixtureId}])),
  });
}

test("final workload is a finite exact 78+5 / 79+38 / 196 recipe set", () => {
  const recipes = createFinalWorkloadRecipes();
  assert.equal(recipes.length, 396);
  assert.equal(recipes.filter((recipe) => recipe.area === "U05_TASK_READ").length, 78);
  assert.equal(recipes.filter((recipe) => recipe.area === "U05_PROTOCOL").length, 5);
  assert.equal(recipes.filter((recipe) => recipe.area === "U04_NUMERIC").length, 79);
  assert.equal(recipes.filter((recipe) => recipe.area === "U04_CONTEXT_PARITY").length, 38);
  assert.equal(recipes.filter((recipe) => recipe.area === "U07_ROUTE").length, 196);
});

test("final workload refuses a duplicate fixture", () => {
  const recipes = createFinalWorkloadRecipes();
  assert.throws(() => validateFinalWorkloadRecipes([...recipes, recipes[0]]), /BP_FINAL_WORKLOAD_FIXTURE_DUPLICATE/);
});

test("final workload performs only fixture-materialized HTTP requests with final attribution", async () => {
  const requested = [];
  const recipes = createFinalWorkloadRecipes();
  const catalog = loadFinalFixtureCatalog();
  const rows = catalog.rows;
  const observations = await executeFinalWorkload({
    baseUrl: "http://127.0.0.1:18080", runId: "backend-performance-final-static-abcdef12", secret: "012345678901234567890123",
    recipes, catalog, fixtureState: fixtureStateFor(rows),
    fetcher: async (url, options) => { requested.push({url, options}); return {ok: true, status: 200}; },
  });
  assert.equal(observations.length, 396);
  assert.equal(requested[0].options.headers["X-Backend-Performance-Fixture-Id"], recipes[0].fixtureId);
  assert.equal(requested[0].options.headers["X-Backend-Performance-Area"], recipes[0].area);
  const bodyRow = rows.find((row) => row.operationId === "createOperationsCatalogCategory" && row.requestBodyRequired);
  const noBodyRow = rows.find((row) => row.operationId === "getOperationsCatalogItems" && !row.requestBodyRequired);
  assert.ok(bodyRow);
  assert.ok(noBodyRow);
  const bodyRequest = requested.find(({options}) => options.headers["X-Backend-Performance-Fixture-Id"] === bodyRow.fixtureId);
  const noBodyRequest = requested.find(({options}) => options.headers["X-Backend-Performance-Fixture-Id"] === noBodyRow.fixtureId);
  assert.ok(bodyRequest);
  assert.ok(noBodyRequest);
  assert.equal(bodyRequest.options.headers.Cookie, "session=private");
  assert.equal(bodyRequest.options.headers["Content-Type"], "application/json");
  assert.equal(bodyRequest.options.body, JSON.stringify({fixture: bodyRow.fixtureId}));
  assert.equal(Object.hasOwn(noBodyRequest.options.headers, "Content-Type"), false);
  assert.equal(Object.hasOwn(noBodyRequest.options, "body"), false);
});

test("final workload rejects a catalog that changes a generated request method", async () => {
  const recipes = createFinalWorkloadRecipes();
  const recipe = recipes[0];
  const catalog = structuredClone(loadFinalFixtureCatalog());
  const row = catalog.rows.find((candidate) => candidate.area === recipe.area && candidate.fixtureId === recipe.fixtureId);
  row.method = row.method === "GET" ? "POST" : "GET";
  await assert.rejects(() => executeFinalWorkload({
    baseUrl: "http://127.0.0.1:18080", runId: "backend-performance-final-static-abcdef12", secret: "012345678901234567890123", recipes, catalog,
    fixtureState: fixtureStateFor(loadFinalFixtureCatalog().rows), fetcher: async () => ({ok: true, status: 200}),
  }), /BP_FINAL_FIXTURE_RECIPE_DRIFT/);
});
