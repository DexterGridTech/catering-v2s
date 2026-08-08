#!/usr/bin/env node
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fixturePath = path.join(root, "contracts/policy/catalog-inventory-fixture-catalog.json");
const scenariosPath = path.join(root, "contracts/policy/catalog-inventory-l2-scenarios.json");
const expectedFixtureSha = "58eca1deb9eb1e8f784b04b7f9100e5140d4340fb33355938a89889520cde890";
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));
const actualFixtureSha = sha256(fs.readFileSync(fixturePath));
if (actualFixtureSha !== expectedFixtureSha) throw new Error(`CATALOG_INVENTORY_FIXTURE_SHA_DRIFT:${actualFixtureSha}`);
if (scenarios.caseCount !== 43 || scenarios.scenarioCount !== 18) throw new Error("CATALOG_INVENTORY_L2_SCENARIO_DENOMINATOR_DRIFT");

const runtimeDir = process.env.V2S_RUNTIME_DIR;
const output = runtimeDir ? path.join(runtimeDir, "results/catalog-inventory-l2-fixture.json") : undefined;
const result = {
  schemaVersion: 1,
  kind: "catalog-inventory-l2-fixture-consumer",
  fixtureRevision: fixture.revision ?? "CATALOG_INVENTORY_P1_20260806",
  fixtureSha256: actualFixtureSha,
  seedDatasetRefs: Object.keys(fixture.seedDatasets ?? {}),
  testDatasetRefs: Object.keys(fixture.testDatasets ?? {}),
  scenarioCount: scenarios.scenarioCount,
  caseCount: scenarios.caseCount,
  source: "contracts/policy/catalog-inventory-fixture-catalog.json",
  noStaticCopy: true,
};
if (output) {
  fs.mkdirSync(path.dirname(output), {recursive: true, mode: 0o700});
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, {mode: 0o600});
}
process.stdout.write(`${JSON.stringify(result)}\n`);
