#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ledgerPath = "doc/evidence/platform/rm1/p1/authority-ledger.json";
const frozenIds = ["ST-2", "ST-3", "ST-4", "ST-6", "ST-8", "ST-9", "ST-11"];
const closureById = {
  "ST-2": "P6",
  "ST-3": "P1",
  "ST-4": "P1",
  "ST-6": "P6",
  "ST-8": "P1",
  "ST-9": "P5",
  "ST-11": "P6",
};
const authorityContractById = {
  "ST-2": {kind: "PLANNED_P6_AUTHORITY", path: "doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md", selector: "P6 ST-2 closure", reason: "No current single feedback authority exists; P6 must materialize one per app."},
  "ST-3": {kind: "CURRENT_CATALOG", path: "contracts/catalog/admin-catalog.json", selector: "platformPages[PLATFORM-WORKSPACE-OVERVIEW].title"},
  "ST-4": {kind: "CURRENT_CATALOG", path: "contracts/catalog/admin-catalog.json", selector: "platformPages array order"},
  "ST-6": {kind: "PLANNED_P6_AUTHORITY", path: "doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md", selector: "P6 ST-6 closure", reason: "No shared field-label authority exists; P6 must materialize the foundation injection contract."},
  "ST-8": {kind: "CURRENT_CARRY_OVER_MANIFEST", path: "contracts/policy/frontend-asset-carryover-manifest.json", selector: "surfaces[*].physicalConsumerPaths (or targetPath for a single physical consumer)"},
  "ST-9": {kind: "PLANNED_P5_AUTHORITY", path: "doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md", selector: "P5 ST-9 closure", reason: "No current refresh authority exists; P5 must materialize RTK tag invalidation policy."},
  "ST-11": {kind: "CURRENT_CARRY_OVER_MANIFEST", path: "contracts/policy/frontend-asset-carryover-manifest.json", selector: "surfaces[*].focusedEvidence"},
};
const relationContractById = {
  "ST-2": {kind: "NONE", reason: "Generated edge clients expose wire error codes, not user feedback semantics."},
  "ST-3": {kind: "EDGE_CODEGEN_CATALOG_PROJECTION", path: "scripts/generate/edge-codegen.mjs", selector: "tsAdminCatalog platformPages projection"},
  "ST-4": {kind: "EDGE_CODEGEN_CATALOG_PROJECTION", path: "scripts/generate/edge-codegen.mjs", selector: "tsAdminCatalog platformPages projection"},
  "ST-6": {kind: "NONE", reason: "Field labels are presentation semantics and not generated from an edge contract."},
  "ST-8": {kind: "CARRYOVER_TARGET_PATH_DERIVATION", path: "tools/verify-gates/cli.mjs", selector: "assertAffectedL2LayoutDerived"},
  "ST-9": {kind: "NONE", reason: "Generated edge clients define HTTP operations, not client cache invalidation policy."},
  "ST-11": {kind: "NONE", reason: "Focused evidence is frozen carry-over metadata and not an edge-codegen output."},
};

function fail(code, detail = "") { throw new Error(`${code}${detail ? `:${detail}` : ""}`); }
function read(relative, base = root) { return fs.readFileSync(path.join(base, relative), "utf8"); }
function readJson(relative, base = root) { return JSON.parse(read(relative, base)); }
function exists(relative, base = root) { return fs.existsSync(path.join(base, relative)); }
function sha256(relative, base = root) { return crypto.createHash("sha256").update(read(relative, base)).digest("hex"); }
function exactSet(actual, expected, code) {
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) fail(code);
}
function exactObject(actual, expected) {
  const actualKeys = Object.keys(actual || {}).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && expectedKeys.every((key) => actual[key] === expected[key]);
}
function rgPaths(trace, base) {
  const result = spawnSync("rg", ["-l", "--glob", trace.glob, trace.pattern, trace.root], {cwd: base, encoding: "utf8"});
  if (result.status !== 0 && result.status !== 1) fail("P1_LEDGER_CONSUMER_QUERY_FAILED", trace.id);
  return result.stdout.trim() === "" ? [] : result.stdout.trim().split("\n").sort();
}
function validateConsumerTrace(trace, row, base) {
  if (!trace || typeof trace.root !== "string" || typeof trace.glob !== "string" || typeof trace.pattern !== "string" || !Array.isArray(trace.expectedPaths)) {
    fail("P1_LEDGER_CONSUMER_TRACE_INVALID", row.id);
  }
  const actual = rgPaths(trace, base);
  const expected = [...trace.expectedPaths].sort();
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) {
    fail("P1_LEDGER_CONSUMER_SET_DRIFT", trace.id);
  }
}
function validateDirectClosures(base) {
  const titleSource = read("apps/frontend/platform-admin/src/features/workspace-administration/ui/WorkspaceAdministrationPage.tsx", base);
  if (!titleSource.includes("adminCatalog.platformPages.find") || !titleSource.includes("platformPageDesignKeys.PlatformWorkspaceOverview") || !titleSource.includes("title={workspaceOverviewPage.title}") || titleSource.includes('title="集团空间管理"')) {
    fail("P1_ST3_TITLE_NOT_CATALOG_DERIVED");
  }
  const registrySource = read("apps/frontend/platform-admin/src/app/routing/pageRegistry.tsx", base);
  if (!registrySource.includes("adminCatalog.platformPages.map") || !registrySource.includes("routeByPageDesignKey[pageDesignKey]") || registrySource.includes("Object.entries(routes)")) {
    fail("P1_ST4_ORDER_NOT_CATALOG_DERIVED");
  }
  const catalog = readJson("contracts/catalog/admin-catalog.json", base);
  const routeKeys = registrySource.match(/\[platformPageDesignKeys\.[A-Za-z]+\]/g) || [];
  if (routeKeys.length !== catalog.nodes.filter((node) => node.kind === "PAGE" && node.consumerFace === "platform-admin").length) fail("P1_ST4_ROUTE_COVERAGE_DRIFT");
}
function validate(base = root, selectedIds = frozenIds) {
  const ledger = readJson(ledgerPath, base);
  if (ledger.schemaVersion !== 1 || ledger.kind !== "rm1-authority-source-ledger" || ledger.status !== "PASS" || !Array.isArray(ledger.rows)) fail("P1_LEDGER_INVALID");
  const rows = [...ledger.rows].sort((left, right) => left.id.localeCompare(right.id));
  exactSet(rows.map((row) => row.id), [...frozenIds].sort(), "P1_LEDGER_ID_SET_DRIFT");
  const selected = [...new Set(selectedIds)].sort();
  if (selected.length === 0 || selected.some((id) => !frozenIds.includes(id))) fail("P1_LEDGER_SELECTED_ROW_SET_INVALID");
  for (const row of rows.filter((entry) => selected.includes(entry.id))) {
    const authority = authorityContractById[row.id];
    const relation = relationContractById[row.id];
    const expectedAuthority = {...authority, sha256: sha256(authority.path, base)};
    if (row.closurePackage !== closureById[row.id] || !exactObject(row.authority, expectedAuthority)
      || !exactObject(row.generatorRelation, relation)
      || !Array.isArray(row.consumers) || row.consumers.length === 0 || !Array.isArray(row.consumerTraces) || row.consumerTraces.length === 0) {
      fail("P1_LEDGER_ROW_INVALID", row.id);
    }
    for (const consumer of row.consumers) if (!consumer || typeof consumer.path !== "string" || !exists(consumer.path, base)) fail("P1_LEDGER_CONSUMER_MISSING", consumer?.path);
    for (const trace of row.consumerTraces) validateConsumerTrace(trace, row, base);
  }
  if (selected.includes("ST-3") || selected.includes("ST-4")) validateDirectClosures(base);
  const selectedCheck = selected.length !== frozenIds.length;
  process.stdout.write(`${selectedCheck ? "P1_AUTHORITY_SOURCE_LEDGER_ROWS" : "P1_AUTHORITY_SOURCE_LEDGER"}=PASS\nIDS=${selected.join(",")}\nDIRECT_CLOSURES=ST-3,ST-4,ST-8\nDEFERRED_CLOSURES=ST-2:P6,ST-6:P6,ST-9:P5,ST-11:P6\n`);
}
function copyForSelfTest(destination) {
  fs.cpSync(root, destination, {recursive: true, filter: (source) => !source.includes("/.git") && !source.includes("/.claude") && !source.includes("/build") && !source.includes("/node_modules")});
}
function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-p1-ledger-"));
  try {
    copyForSelfTest(scratch);
    validate(scratch);
    const ledger = readJson(ledgerPath, scratch);
    ledger.rows.pop();
    fs.writeFileSync(path.join(scratch, ledgerPath), `${JSON.stringify(ledger, null, 2)}\n`);
    let idRed = false;
    try { validate(scratch); } catch (error) { idRed = String(error).includes("P1_LEDGER_ID_SET_DRIFT"); }
    if (!idRed) fail("P1_LEDGER_ID_SET_SELF_TEST_NOT_DETECTED");
    copyForSelfTest(scratch);
    const titlePath = "apps/frontend/platform-admin/src/features/workspace-administration/ui/WorkspaceAdministrationPage.tsx";
    fs.writeFileSync(path.join(scratch, titlePath), read(titlePath, scratch).replace("title={workspaceOverviewPage.title}", 'title="集团空间管理"'));
    let titleRed = false;
    try { validate(scratch); } catch (error) { titleRed = String(error).includes("P1_ST3_TITLE_NOT_CATALOG_DERIVED"); }
    if (!titleRed) fail("P1_LEDGER_TITLE_SELF_TEST_NOT_DETECTED");
    copyForSelfTest(scratch);
    const row = readJson(ledgerPath, scratch).rows.find((entry) => entry.id === "ST-6");
    row.consumerTraces[0].expectedPaths.pop();
    const changed = readJson(ledgerPath, scratch);
    changed.rows = changed.rows.map((entry) => entry.id === "ST-6" ? row : entry);
    fs.writeFileSync(path.join(scratch, ledgerPath), `${JSON.stringify(changed, null, 2)}\n`);
    let consumerRed = false;
    try { validate(scratch); } catch (error) { consumerRed = String(error).includes("P1_LEDGER_CONSUMER_SET_DRIFT"); }
    if (!consumerRed) fail("P1_LEDGER_CONSUMER_SELF_TEST_NOT_DETECTED");
    copyForSelfTest(scratch);
    const authorityDrift = readJson(ledgerPath, scratch);
    const st3 = authorityDrift.rows.find((entry) => entry.id === "ST-3");
    st3.authority.path = "contracts/policy/frontend-asset-carryover-manifest.json";
    st3.authority.sha256 = sha256(st3.authority.path, scratch);
    fs.writeFileSync(path.join(scratch, ledgerPath), `${JSON.stringify(authorityDrift, null, 2)}\n`);
    let authorityRed = false;
    try { validate(scratch); } catch (error) { authorityRed = String(error).includes("P1_LEDGER_ROW_INVALID:ST-3"); }
    if (!authorityRed) fail("P1_LEDGER_AUTHORITY_SELF_TEST_NOT_DETECTED");
    copyForSelfTest(scratch);
    const relationDrift = readJson(ledgerPath, scratch);
    relationDrift.rows.find((entry) => entry.id === "ST-3").generatorRelation.selector = "arbitrary relation";
    fs.writeFileSync(path.join(scratch, ledgerPath), `${JSON.stringify(relationDrift, null, 2)}\n`);
    let relationRed = false;
    try { validate(scratch); } catch (error) { relationRed = String(error).includes("P1_LEDGER_ROW_INVALID:ST-3"); }
    if (!relationRed) fail("P1_LEDGER_RELATION_SELF_TEST_NOT_DETECTED");
    copyForSelfTest(scratch);
    const selectedRowDrift = readJson(ledgerPath, scratch);
    selectedRowDrift.rows.find((entry) => entry.id === "ST-11").authority.sha256 = "0".repeat(64);
    fs.writeFileSync(path.join(scratch, ledgerPath), `${JSON.stringify(selectedRowDrift, null, 2)}\n`);
    let selectedRowRed = false;
    try { validate(scratch, ["ST-11"]); } catch (error) { selectedRowRed = String(error).includes("P1_LEDGER_ROW_INVALID:ST-11"); }
    if (!selectedRowRed) fail("P1_LEDGER_SELECTED_ROW_SELF_TEST_NOT_DETECTED");
    process.stdout.write("P1_LEDGER_ID_SET_RED=PASS\nP1_LEDGER_TITLE_RED=PASS\nP1_LEDGER_CONSUMER_SET_RED=PASS\nP1_LEDGER_AUTHORITY_RED=PASS\nP1_LEDGER_RELATION_RED=PASS\nP1_LEDGER_SELECTED_ROW_RED=PASS\nP1_AUTHORITY_SOURCE_LEDGER_SELF_TEST=PASS\n");
  } finally { fs.rmSync(scratch, {recursive: true, force: true}); }
}
function selectedRowSelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-p1-ledger-selected-"));
  try {
    copyForSelfTest(scratch);
    const selected = ["ST-11"];
    validate(scratch, selected);
    const drift = readJson(ledgerPath, scratch);
    drift.rows.find((entry) => entry.id === "ST-11").authority.sha256 = "0".repeat(64);
    fs.writeFileSync(path.join(scratch, ledgerPath), `${JSON.stringify(drift, null, 2)}\n`);
    let red = false;
    try { validate(scratch, selected); } catch (error) { red = String(error).includes("P1_LEDGER_ROW_INVALID:ST-11"); }
    if (!red) fail("P1_LEDGER_SELECTED_ROW_SELF_TEST_NOT_DETECTED");
    process.stdout.write("P1_LEDGER_SELECTED_ROWS_SELF_TEST=PASS\nP1_LEDGER_SELECTED_ROW_RED=PASS\nCLEANUP=PASS\n");
  } finally { fs.rmSync(scratch, {recursive: true, force: true}); }
}

try {
  if (process.argv[2] === "check") validate();
  else if (process.argv[2] === "check-rows") validate(root, process.argv.slice(3).flatMap((value) => value.split(",")).filter(Boolean));
  else if (process.argv[2] === "self-test") selfTest();
  else if (process.argv[2] === "self-test-rows") selectedRowSelfTest();
  else fail("P1_LEDGER_USAGE", "check|check-rows <ST-ID[,ST-ID]>|self-test|self-test-rows");
} catch (error) {
  process.stderr.write(`P1_AUTHORITY_SOURCE_LEDGER=FAIL\nREASON=${error.message}\n`);
  process.exitCode = 1;
}
