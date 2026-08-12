#!/usr/bin/env node
/** Static recipe catalogue for the later managed performance run. */
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {loadFinalFixtureCatalog, materializeFinalFixtureRequest, validateFixtureCatalogAgainstRecipes} from "./backend-performance-final-fixtures.mjs";
import {normalizeEdgePath} from "./seed-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyPath = "contracts/policy/backend-performance-final-workload.json";
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const fail = (code) => { throw new Error(code); };

export function createFinalWorkloadRecipes(policy = readJson(policyPath)) {
  const taskPolicy = readJson(policy.sourcePolicies.taskReadSurface);
  const baselines = readJson(policy.sourcePolicies.commandBaselines);
  const sql = readJson(policy.sourcePolicies.sqlMergeApplicability);
  const routeOperations = ["apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json", "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json"].flatMap((source) => readJson(source).operations ?? []);
  const routeByOperation = new Map(routeOperations.map((operation) => [operation.operationId, operation]));
  const withRoute = (recipe) => {
    const route = routeByOperation.get(recipe.operationId);
    if (!route || typeof route.method !== "string" || typeof route.path !== "string") fail("BP_FINAL_WORKLOAD_ROUTE_MISSING");
    return {...recipe, method: route.method, routeTemplate: normalizeEdgePath(route.path)};
  };
  const task = (taskPolicy.rows ?? []).filter((row) => row.disposition === "TASK_READ").map((row) => withRoute({area: "U05_TASK_READ", operationId: row.operationId, fixtureId: `BP-U05-TASK:${row.operationId}`, logicalStatementCap: Number(row.primaryQueryCap) + Number(row.optionalCountCap ?? 0)}));
  const protocol = (taskPolicy.rows ?? []).filter((row) => row.disposition === "PROTOCOL_READ_EXEMPT").map((row) => withRoute({area: "U05_PROTOCOL", operationId: row.operationId, fixtureId: `BP-U05-PROTOCOL:${row.operationId}`}));
  const numeric = (baselines.numericBaselines ?? []).map((row) => withRoute({area: "U04_NUMERIC", operationId: row.operationId, fixtureId: `${row.fixtureId}:${row.branch}`, branch: row.branch}));
  const parity = (baselines.contextParity ?? []).map((row) => withRoute({area: "U04_CONTEXT_PARITY", operationId: row.operationId, fixtureId: `BP-U04-PARITY:${row.operationId}`}));
  const routes = (sql.operationApplicability ?? []).map((row) => withRoute({area: "U07_ROUTE", operationId: row.operationId, fixtureId: `BP-U07-ROUTE:${row.operationId}`}));
  const recipes = [...task, ...protocol, ...numeric, ...parity, ...routes];
  validateFinalWorkloadRecipes(recipes, policy);
  return recipes;
}

export function validateFinalWorkloadRecipes(recipes, policy = readJson(policyPath)) {
  if (!Array.isArray(recipes)) fail("BP_FINAL_WORKLOAD_RECIPES_INVALID");
  const expected = {U05_TASK_READ: policy.denominators.u05TaskReads, U05_PROTOCOL: policy.denominators.u05ProtocolCompletions, U04_NUMERIC: policy.denominators.u04NumericBaselines, U04_CONTEXT_PARITY: policy.denominators.u04ContextParity, U07_ROUTE: policy.denominators.u07RouteCompletions};
  const keys = new Set();
  for (const recipe of recipes) {
    if (!expected[recipe?.area] || typeof recipe.operationId !== "string" || typeof recipe.fixtureId !== "string" || typeof recipe.method !== "string" || typeof recipe.routeTemplate !== "string") fail("BP_FINAL_WORKLOAD_RECIPE_INVALID");
    const key = `${recipe.area}\u0000${recipe.fixtureId}`;
    if (keys.has(key)) fail("BP_FINAL_WORKLOAD_FIXTURE_DUPLICATE");
    keys.add(key);
    if (recipe.area === "U05_TASK_READ" && (!Number.isInteger(recipe.logicalStatementCap) || recipe.logicalStatementCap < 1)) fail("BP_FINAL_WORKLOAD_TASK_CAP_INVALID");
    if (recipe.area === "U05_PROTOCOL" && Object.hasOwn(recipe, "logicalStatementCap")) fail("BP_FINAL_WORKLOAD_PROTOCOL_CAP_FORBIDDEN");
  }
  for (const [area, denominator] of Object.entries(expected)) if (recipes.filter((recipe) => recipe.area === area).length !== denominator) fail("BP_FINAL_WORKLOAD_DENOMINATOR_DRIFT");
  if (recipes.length !== 396) fail("BP_FINAL_WORKLOAD_TOTAL_DENOMINATOR_DRIFT");
  return recipes;
}

/**
 * Executes only requests materialized by the closed final fixture catalog.
 * The managed adapter supplies private fixture state, never a callback that
 * could infer arbitrary ids/routes/bodies or redirect the workload.
 */
export async function executeFinalWorkload({baseUrl, runId, secret, fixtureState, catalog = loadFinalFixtureCatalog(), recipes = createFinalWorkloadRecipes(), fetcher = fetch}) {
  if (typeof baseUrl !== "string" || !/^https?:\/\/127\.0\.0\.1:\d+$/.test(baseUrl) || typeof runId !== "string" || typeof secret !== "string" || secret.length < 24 || !fixtureState || typeof fixtureState !== "object") fail("BP_FINAL_WORKLOAD_EXECUTION_INPUT_INVALID");
  validateFixtureCatalogAgainstRecipes(catalog, recipes);
  const observations = [];
  for (const recipe of recipes) {
    const request = materializeFinalFixtureRequest(recipe, {catalog, state: fixtureState});
    if (!request || typeof request.path !== "string" || normalizeEdgePath(request.path) !== request.path || request.method !== recipe.method) fail("BP_FINAL_WORKLOAD_FIXTURE_MATERIALIZATION_INVALID");
    const response = await fetcher(`${baseUrl}${request.path}`, {method: request.method, headers: {"X-Backend-Performance-Run-Id": runId, "X-Backend-Performance-Secret": secret, "X-Backend-Performance-Operation-Id": recipe.operationId, "X-Backend-Performance-Route-Template": recipe.routeTemplate, "X-Backend-Performance-Fixture-Id": recipe.fixtureId, "X-Backend-Performance-Area": recipe.area, ...(request.headers ?? {}), ...(request.body === undefined ? {} : {"Content-Type": "application/json"})}, ...(request.body === undefined ? {} : {body: JSON.stringify(request.body)})});
    if (!response?.ok) fail("BP_FINAL_WORKLOAD_HTTP_FAILURE");
    observations.push({operationId: recipe.operationId, fixtureId: recipe.fixtureId, area: recipe.area, status: response.status});
  }
  return observations;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.slice(2).join(" ") !== "--plan") fail("BP_FINAL_WORKLOAD_ARGUMENT_INVALID");
    const recipes = createFinalWorkloadRecipes();
    process.stdout.write(`BP_FINAL_WORKLOAD_PLAN=PASS\nRECIPES=${recipes.length}\nU05=78+5\nU04=79+38\nU07=196\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
