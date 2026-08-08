#!/usr/bin/env node
/**
 * Mechanical boundary check for the catalog/inventory acceptance layers.
 *
 * This is intentionally a small source-shape gate.  It does not claim that an
 * HTTP or browser run passed; it only prevents a runner from silently reading
 * another layer's runtime report or from reintroducing the catalog seed into
 * API/L2 acceptance.  Runtime business assertions remain in the API and L2
 * runners themselves.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const sources = {
  parent: path.join(root, 'scripts/test/r5-joint-remote-l2.mjs'),
  fixture: path.join(root, 'scripts/test/r5-joint-remote-l2-fixture.mjs'),
  api: path.join(root, 'scripts/test/catalog-inventory-api.mjs'),
  backendUnit: path.join(root, 'scripts/test/catalog-inventory-backend-unit.mjs'),
  l2Fixture: path.join(root, 'scripts/test/catalog-inventory-l2-test-fixture.mjs'),
  l2Spec: path.join(root, 'apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts'),
};

const read = (file) => fs.readFileSync(file, 'utf8');
const fail = (code) => { throw new Error(`CATALOG_INVENTORY_TEST_INDEPENDENCE=${code}`); };
const requireText = (source, text, code) => { if (!source.includes(text)) fail(code); };
const forbidText = (source, text, code) => { if (source.includes(text)) fail(code); };

export function checkIndependence(input = Object.fromEntries(Object.entries(sources).map(([name, file]) => [name, read(file)]))) {
  const {parent, fixture, api, backendUnit, l2Fixture, l2Spec} = input;

  // The two acceptance runners may share static contracts and generated route
  // helpers, but no runtime report or seed executor crosses the boundary.
  forbidText(api, 'catalog-inventory-l2-test-fixture.json', 'API_READS_L2_REPORT');
  forbidText(api, 'catalog-inventory-seed-executor.mjs', 'API_READS_CATALOG_SEED_EXECUTOR');
  forbidText(backendUnit, 'catalog-inventory-seed-executor.mjs', 'BACKEND_UNIT_CALLS_CATALOG_SEED');
  forbidText(backendUnit, 'scripts/dev/seed', 'BACKEND_UNIT_CALLS_SEED');
  forbidText(l2Fixture, 'catalog-inventory-api-runtime-report.json', 'L2_FIXTURE_READS_API_REPORT');
  forbidText(l2Fixture, 'catalog-inventory-seed-executor.mjs', 'L2_FIXTURE_READS_CATALOG_SEED_EXECUTOR');
  forbidText(l2Spec, 'catalog-inventory-api-runtime-report.json', 'L2_SPEC_READS_API_REPORT');
  forbidText(l2Spec, 'seed-report.json', 'L2_SPEC_READS_SEED_REPORT');
  forbidText(fixture, 'catalog-inventory-seed-executor.mjs', 'JOINT_FIXTURE_CALLS_CATALOG_SEED');

  // Standalone stage selectors must be present and must terminate before the
  // legacy all-domain fixture continues.  This is the command-level proof
  // that API and L2 can be launched independently in fresh namespaces.
  requireText(parent, "process.argv.includes('--catalog-api-only')", 'API_ONLY_ENTRY_MISSING');
  requireText(parent, "process.argv.includes('--catalog-l2-only')", 'L2_ONLY_ENTRY_MISSING');
  requireText(fixture, "if (catalogStage === 'API') process.exit(0);", 'API_ONLY_TERMINATION_MISSING');
  requireText(fixture, "if (catalogStage === 'L2') {", 'L2_ONLY_TERMINATION_MISSING');

  const apiCall = fixture.indexOf("label: 'CATALOG_INVENTORY_API'");
  // The combined compatibility mode is still ordered API -> L2.  The check
  // uses the executable labels, not a prose comment, so a future reorder is
  // mechanically visible.
  const l2Call = fixture.indexOf("label: 'CATALOG_INVENTORY_L2_TEST_FIXTURE'");
  if (apiCall < 0 || l2Call < 0 || apiCall >= l2Call) fail('COMBINED_STAGE_ORDER_NOT_API_THEN_L2');

  // L2-only must skip the API child entirely.  Checking the guard position
  // relative to the executable API label catches a deleted or inverted
  // guard; comments and the post-API exit are not sufficient proof.
  const apiGuard = fixture.lastIndexOf("if (catalogStage !== 'L2') {", apiCall);
  if (apiGuard < 0 || apiGuard >= apiCall) fail('L2_API_CALL_NOT_STAGE_GUARDED');

  return {status: 'PASS', apiRuntimeInputs: 'OWN_FIXTURE_AND_MANAGED_MANIFEST', l2RuntimeInputs: 'OWN_FIXTURE_SIDECAR_AND_PRIVATE_ENV', seedRuntimeInput: false, combinedOrder: 'API_THEN_L2'};
}

if (process.argv.includes('--self-test')) {
  const baseline = checkIndependence();
  const fixture = read(sources.fixture);
  const mutatedFixture = fixture.replace("label: 'CATALOG_INVENTORY_API'", "label: 'CATALOG_INVENTORY_L2_TEST_FIXTURE'");
  try { checkIndependence({...Object.fromEntries(Object.entries(sources).map(([name, file]) => [name, read(file)])), fixture: mutatedFixture}); fail('RED_MUTATION_NOT_REJECTED'); }
  catch (error) { if (!String(error.message).startsWith('CATALOG_INVENTORY_TEST_INDEPENDENCE=COMBINED_STAGE_ORDER_NOT_API_THEN_L2')) throw error; }
  const guardRemoved = fixture.replace("if (catalogStage !== 'L2') {\n", '');
  try { checkIndependence({...Object.fromEntries(Object.entries(sources).map(([name, file]) => [name, read(file)])), fixture: guardRemoved}); fail('L2_GUARD_RED_MUTATION_NOT_REJECTED'); }
  catch (error) { if (!String(error.message).startsWith('CATALOG_INVENTORY_TEST_INDEPENDENCE=L2_API_CALL_NOT_STAGE_GUARDED')) throw error; }
  process.stdout.write(`CATALOG_INVENTORY_TEST_INDEPENDENCE_SELF_TEST=PASS\nBASELINE=${baseline.status}\nRED_MUTATION=ORDER_AND_L2_GUARD_REJECTED\n`);
} else {
  try {
    process.stdout.write(`${JSON.stringify(checkIndependence())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
