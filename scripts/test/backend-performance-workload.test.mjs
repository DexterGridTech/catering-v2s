import assert from "node:assert/strict";
import test from "node:test";
import {createFinalWorkloadRecipes, validateFinalWorkloadRecipes} from "./backend-performance-workload.mjs";

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
