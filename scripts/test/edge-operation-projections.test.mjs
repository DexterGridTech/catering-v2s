import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
import {projectEdgeCatalog} from "../generate/edge-operation-projections.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

test("materialized edge projection rejects a missing terminal face count", () => {
  const mutated = structuredClone(catalog);
  delete mutated.projectionState.faceCounts.terminal;

  assert.throws(
    () => projectEdgeCatalog(mutated),
    /R5_EDGE_MATERIALIZED_FACE_DENOMINATOR_INVALID/,
  );
});

test("edge projection rejects an operation outside the four declared consumer faces", () => {
  const mutated = structuredClone(catalog);
  const unknownOperation = structuredClone(mutated.operations[0]);
  unknownOperation.operationId = "testUnknownFifthFace";
  unknownOperation.face = "terminal-data";
  mutated.operations.push(unknownOperation);

  assert.throws(
    () => projectEdgeCatalog(mutated),
    /R5_EDGE_OPERATION_PROJECTION_FACE_INVALID:testUnknownFifthFace/,
  );
});
