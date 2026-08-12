#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const fail = (code, detail = "") => { const error = new Error(`${code}${detail ? `:${detail}` : ""}`); error.code = code; throw error; };
const requiredPages = ["PG-CATALOG-STORE-ITEMS", "PG-INVENTORY-STORE-STATUS", "PG-CATALOG-BRAND-ITEMS"];
const scenarios = read("contracts/policy/catalog-inventory-l2-scenarios.json");
const bindings = read("contracts/policy/catalog-inventory-l2-locator-bindings.json");
const iaReconciliation = read("doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json");

function check() {
  const active = read(".runtime/compliance-control/active-package.json");
  // P4 is the authorized successor package and intentionally supersedes the
  // P3 active-package record before the pre-L2 gate is rerun.  Keep the P3
  // check fail-closed: only the original P3 package or the explicitly named
  // P4 successor may satisfy the authority precondition.
  const acceptedPackages = new Set(["CATALOG-INVENTORY-P3-FRONTEND-L2-20260806", "CATALOG-INVENTORY-P4-FULL-20260807"]);
  if (!acceptedPackages.has(active.packageId) || active.implementationAuthority !== true || active.runtimeAuthority !== true) fail("P3_ACTIVE_PACKAGE_INVALID");
  const catalog = read("contracts/catalog/admin-catalog.json");
  const pages = catalog.nodes.filter((node) => node.kind === "PAGE" && node.consumerFace === "operations-admin");
  const selected = requiredPages.map((key) => pages.find((page) => page.key === key));
  if (selected.some((page) => !page) || selected.some((page) => page.navigation.groupKey !== "NAV-CATALOG-SERVICES")) fail("P3_ADMIN_PAGE_SET_INVALID");
  if (JSON.stringify(selected.map((page) => page.navigation.order)) !== JSON.stringify([510, 520, 530])) fail("P3_ADMIN_PAGE_ORDER_INVALID");
  const caseIds = scenarios.scenarios.flatMap((scenario) => scenario.cases.map((entry) => entry.caseId));
  const boundIds = bindings.bindings.map((entry) => entry.caseId);
  if (scenarios.scenarioCount !== 18 || scenarios.caseCount !== 41 || caseIds.length !== 41 || new Set(caseIds).size !== 41) fail("P3_L2_SCENARIO_DENOMINATOR_INVALID");
  assertLocatorExactSet(caseIds, boundIds);
  assertLocatorBindingsPresent(bindings);
  assertIaControlExactSet(iaReconciliation);
  assertIaStatusLedger(iaReconciliation);
  for (const required of [
    "apps/frontend/operations-admin/src/features/catalog-management",
    "apps/frontend/operations-admin/src/features/inventory-management",
    "apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts",
    "apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts",
  ]) if (!fs.existsSync(path.join(root, required))) fail("P3_REQUIRED_SURFACE_MISSING", required);
  const generated = fs.readFileSync(path.join(root, "apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts"), "utf8");
  const rtk = fs.readFileSync(path.join(root, "apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts"), "utf8");
  if (!generated.includes("CATALOG_INVENTORY_P1_20260806") || !generated.includes("createCatalogInventoryClient") || !rtk.includes("createCatalogInventoryRtkEndpoints")) fail("P3_GENERATED_CLIENT_INVALID");
  assertGeneratedClientTyped(generated);
  const foundation = fs.readFileSync(path.join(root, "libraries/frontend/admin-ui-foundation/src/overlay/drawerSurface.ts"), "utf8");
  if (!foundation.includes("adminWideDrawerSurfaceProps") || !foundation.includes("adminWideDetailDescriptionsProps")) fail("P3_FOUNDATION_WIDE_SURFACE_MISSING");
  const collectFiles = (directory) => fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
  const featureFiles = [
    ...collectFiles(path.join(root, "apps/frontend/operations-admin/src/features/catalog-management")),
    ...collectFiles(path.join(root, "apps/frontend/operations-admin/src/features/inventory-management")),
  ];
  if (!featureFiles.some((name) => name.endsWith(".tsx"))) fail("P3_FEATURE_UI_MISSING");
  return {pages: requiredPages.length, scenarios: scenarios.scenarioCount, cases: scenarios.caseCount, locatorBindings: bindings.caseCount};
}

function assertLocatorExactSet(caseIds, boundIds) {
  if (boundIds.length !== caseIds.length || new Set(boundIds).size !== boundIds.length || [...caseIds].sort().join("\n") !== [...boundIds].sort().join("\n")) {
    fail("P3_L2_LOCATOR_EXACT_SET_INVALID");
  }
}

function assertLocatorBindingsPresent(locatorPolicy) {
  const sourceRoot = path.join(root, "apps/frontend/operations-admin/src");
  const collect = (directory) => fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(entryPath) : [entryPath];
  });
  const source = collect(sourceRoot)
    .filter((file) => /\.(tsx?|json)$/.test(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  for (const binding of locatorPolicy.bindings) {
    if (typeof binding.locator !== "string" || !binding.locator || !source.includes(binding.locator)) {
      fail("P3_L2_LOCATOR_SOURCE_MISSING", binding.caseId);
    }
    if (typeof binding.position !== "string" || !binding.position || typeof binding.wireframe !== "string" || !binding.wireframe || typeof binding.fixtureRef !== "string" || !binding.fixtureRef || typeof binding.expectedBusinessResult !== "string" || !binding.expectedBusinessResult || typeof binding.activation !== "string" || !binding.activation) {
      fail("P3_L2_LOCATOR_METADATA_MISSING", binding.caseId);
    }
  }
}

function assertGeneratedClientTyped(generated) {
  if (generated.includes("owner: undefined") || generated.includes("initiatingOwner")) fail("P3_GENERATED_OWNER_UNRESOLVED");
  for (const typeName of ["CatalogItemCreateRequest", "CatalogItemSaveRequest", "InventoryTargetPage", "InventoryCountRequest", "BrandCatalogCopyPreflight"]) {
    if (!generated.includes(`export type ${typeName} =`)) fail("P3_GENERATED_TYPED_SCHEMA_MISSING", typeName);
  }
  if (/request: JsonValue;\s*response: CatalogInventoryEnvelope;/.test(generated)) fail("P3_GENERATED_UNTYPED_OPERATION_CONTRACT");
  if (/"getOperationsCatalogItems"[^\n]*query: Record<string, JsonValue>/.test(generated) || /"getOperationsInventoryTargets"[^\n]*query: Record<string, JsonValue>/.test(generated)) fail("P3_GENERATED_QUERY_TYPE_UNRESOLVED");
}

function assertIaControlExactSet(reconciliation) {
  const iaSource = fs.readFileSync(path.join(root, reconciliation.iaSource), "utf8");
  const expected = [...new Set([...iaSource.matchAll(/`(IA-[A-Z0-9-]+)`/g)].map((match) => match[1]))].sort();
  const controls = Array.isArray(reconciliation.controls) ? reconciliation.controls : [];
  const actual = controls.map((entry) => entry.id);
  if (reconciliation.iaIdCount !== 89 || actual.length !== expected.length || new Set(actual).size !== actual.length || expected.join("\n") !== [...actual].sort().join("\n")) fail("P3_IA_CONTROL_EXACT_SET_INVALID");
  if (controls.some((entry) => typeof entry.control !== "string" || !entry.control || typeof entry.position !== "string" || !entry.position || typeof entry.wireframe !== "string" || !entry.wireframe || typeof entry.locator !== "string" || !entry.locator || typeof entry.sourceFile !== "string" || !entry.sourceFile || !fs.existsSync(path.join(root, entry.sourceFile)))) fail("P3_IA_CONTROL_BINDING_INCOMPLETE");
  for (const entry of controls) {
    // Contract IDs describe a source-of-truth assertion and therefore have no
    // rendered UI locator. Every other ID must resolve each declared locator
    // in its declared implementation file; prose is not an acceptable locator.
    if (entry.id.startsWith("IA-CONTRACT-")) {
      if (entry.locator !== "NOT_APPLICABLE") fail("P3_IA_CONTRACT_LOCATOR_NOT_APPLICABLE");
      continue;
    }
    const sourcePath = path.join(root, entry.sourceFile);
    const source = fs.readFileSync(sourcePath, "utf8");
    const locators = String(entry.locator || "").split("|").map((value) => value.trim()).filter(Boolean);
    const missing = locators.filter((locator) => !source.includes(locator));
    if (missing.length) fail("P3_IA_LOCATOR_SOURCE_MISSING", `${entry.id}:${missing.join(",")}`);
  }
}

function assertIaStatusLedger(reconciliation) {
  const ledger = reconciliation.statusLedger;
  if (!ledger || typeof ledger.policy !== "string" || !ledger.policy || !ledger.currentByteBeforeLatestRemediationCounts || !ledger.currentByteAfterLatestRemediationCounts || !Array.isArray(ledger.latestRemediationChanges) || !ledger.retainedNotImplementedReasons || !ledger.retainedBlockedReasons || !ledger.retainedPartialReasons) {
    fail("P3_IA_STATUS_LEDGER_MISSING");
  }
  const expectedCounts = ["IMPLEMENTED_STATIC", "PARTIAL_STATIC", "BLOCKED_UPSTREAM_CONTRACT", "NOT_IMPLEMENTED", "OUT_OF_SCOPE_STATIC"].reduce((result, statusName) => {
    result[statusName] = reconciliation.controls.filter((entry) => entry.implementationStatus === statusName).length;
    return result;
  }, {});
  const actualCounts = ledger.currentByteAfterLatestRemediationCounts;
  if (JSON.stringify(Object.keys(expectedCounts).sort().map((key) => [key, expectedCounts[key]])) !== JSON.stringify(Object.keys(actualCounts).sort().map((key) => [key, actualCounts[key]]))) {
    fail("P3_IA_STATUS_LEDGER_COUNTS_INVALID");
  }
  for (const change of ledger.latestRemediationChanges) {
    const control = reconciliation.controls.find((entry) => entry.id === change.id);
    if (!control || !["BLOCKED_UPSTREAM_CONTRACT", "NOT_IMPLEMENTED", "PARTIAL_STATIC"].includes(change.from) || change.to !== control.implementationStatus || typeof change.basis !== "string" || !change.basis) {
      fail("P3_IA_STATUS_LEDGER_CHANGE_INVALID", change.id || "unknown");
    }
  }
  for (const [id, reason] of Object.entries(ledger.retainedNotImplementedReasons)) {
    const control = reconciliation.controls.find((entry) => entry.id === id);
    if (!control || control.implementationStatus !== "NOT_IMPLEMENTED" || typeof reason !== "string" || !reason) {
      fail("P3_IA_STATUS_LEDGER_REASON_INVALID", id);
    }
  }
  for (const [id, reason] of Object.entries(ledger.retainedPartialReasons)) {
    const control = reconciliation.controls.find((entry) => entry.id === id);
    if (!control || control.implementationStatus !== "PARTIAL_STATIC" || typeof reason !== "string" || !reason || reason !== control.reason) {
      fail("P3_IA_STATUS_LEDGER_PARTIAL_REASON_INVALID", id);
    }
  }
  const blockedControls = reconciliation.controls.filter((entry) => entry.implementationStatus === "BLOCKED_UPSTREAM_CONTRACT");
  const blockedReasons = ledger.retainedBlockedReasons;
  const blockedReasonIds = Object.keys(blockedReasons);
  if (blockedReasonIds.length !== blockedControls.length || new Set(Object.values(blockedReasons)).size !== blockedReasonIds.length) {
    fail("P3_IA_STATUS_LEDGER_BLOCKED_REASONS_INVALID");
  }
  for (const control of blockedControls) {
    const reason = blockedReasons[control.id];
    if (typeof reason !== "string" || !reason || reason !== control.reason) {
      fail("P3_IA_STATUS_LEDGER_BLOCKED_REASON_INVALID", control.id);
    }
  }
}

function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-catalog-p3-"));
  try {
    const target = path.join(root, "contracts/policy/catalog-inventory-l2-locator-bindings.json");
    const copy = path.join(scratch, "bindings.json");
    fs.copyFileSync(target, copy);
    const value = JSON.parse(fs.readFileSync(copy, "utf8"));
    value.bindings.pop();
    fs.writeFileSync(copy, JSON.stringify(value));
    try {
      assertLocatorExactSet(scenarios.scenarios.flatMap((scenario) => scenario.cases.map((entry) => entry.caseId)), value.bindings.map((entry) => entry.caseId));
      fail("P3_SELF_TEST_RED_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_L2_LOCATOR_EXACT_SET_INVALID") throw error;
      process.stdout.write("P3_RED_MUTATION=LOCATOR_EXACT_SET\n");
    }
    const locatorMutation = JSON.parse(fs.readFileSync(target, "utf8"));
    locatorMutation.bindings[0].locator = "p3-locator-that-is-not-rendered";
    try {
      assertLocatorBindingsPresent(locatorMutation);
      fail("P3_SELF_TEST_LOCATOR_SOURCE_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_L2_LOCATOR_SOURCE_MISSING") throw error;
      process.stdout.write("P3_RED_MUTATION=LOCATOR_SOURCE\n");
    }
    const assertionMutation = JSON.parse(fs.readFileSync(target, "utf8"));
    delete assertionMutation.bindings[0].expectedBusinessResult;
    try {
      assertLocatorBindingsPresent(assertionMutation);
      fail("P3_SELF_TEST_ASSERTION_METADATA_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_L2_LOCATOR_METADATA_MISSING") throw error;
      process.stdout.write("P3_RED_MUTATION=BUSINESS_ASSERTION_METADATA\n");
    }
    const generatedPath = path.join(root, "apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts");
    const generated = fs.readFileSync(generatedPath, "utf8");
    try {
      assertGeneratedClientTyped(generated.replace("export type CatalogItemSaveRequest =", "export type CatalogItemSaveRequest_REMOVED ="));
      fail("P3_SELF_TEST_TYPED_SCHEMA_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_GENERATED_TYPED_SCHEMA_MISSING") throw error;
      process.stdout.write("P3_RED_MUTATION=TYPED_SCHEMA\n");
    }
    try {
      assertGeneratedClientTyped(generated.replace('"getOperationsCatalogItems": {request: CatalogItemPageQuery; response: CatalogInventoryEnvelope<CatalogItemPage>; requestRequired: false; requiresSession: true; path: Record<string, never>; query: CatalogItemPageQuery;', '"getOperationsCatalogItems": {request: CatalogItemPageQuery; response: CatalogInventoryEnvelope<CatalogItemPage>; requestRequired: false; requiresSession: true; path: Record<string, never>; query: Record<string, JsonValue>;'));
      fail("P3_SELF_TEST_QUERY_TYPE_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_GENERATED_QUERY_TYPE_UNRESOLVED") throw error;
      process.stdout.write("P3_RED_MUTATION=QUERY_TYPE\n");
    }
    try {
      assertIaControlExactSet({...iaReconciliation, controls: iaReconciliation.controls.slice(0, -1)});
      fail("P3_SELF_TEST_IA_CONTROL_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_IA_CONTROL_EXACT_SET_INVALID") throw error;
      process.stdout.write("P3_RED_MUTATION=IA_CONTROL_EXACT_SET\n");
    }
    const iaLocatorMutation = JSON.parse(JSON.stringify(iaReconciliation));
    iaLocatorMutation.controls[0].locator = "p3-ia-locator-not-rendered";
    try {
      assertIaControlExactSet(iaLocatorMutation);
      fail("P3_SELF_TEST_IA_LOCATOR_SOURCE_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_IA_LOCATOR_SOURCE_MISSING") throw error;
      process.stdout.write("P3_RED_MUTATION=IA_LOCATOR_SOURCE\n");
    }
    const contractLocatorMutation = JSON.parse(JSON.stringify(iaReconciliation));
    const contractControl = contractLocatorMutation.controls.find((entry) => entry.id === "IA-CONTRACT-001");
    contractControl.locator = "generated CatalogInventory operation/client types";
    try {
      assertIaControlExactSet(contractLocatorMutation);
      fail("P3_SELF_TEST_CONTRACT_LOCATOR_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_IA_CONTRACT_LOCATOR_NOT_APPLICABLE") throw error;
      process.stdout.write("P3_RED_MUTATION=CONTRACT_LOCATOR\n");
    }
    const statusLedgerMutation = JSON.parse(JSON.stringify(iaReconciliation));
    statusLedgerMutation.statusLedger.latestRemediationChanges[0].to = "PARTIAL_STATIC";
    try {
      assertIaStatusLedger(statusLedgerMutation);
      fail("P3_SELF_TEST_STATUS_LEDGER_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_IA_STATUS_LEDGER_CHANGE_INVALID") throw error;
      process.stdout.write("P3_RED_MUTATION=IA_STATUS_LEDGER\n");
    }
    const blockedReasonMutation = JSON.parse(JSON.stringify(iaReconciliation));
    blockedReasonMutation.controls[0].implementationStatus = "BLOCKED_UPSTREAM_CONTRACT";
    blockedReasonMutation.controls[1].implementationStatus = "BLOCKED_UPSTREAM_CONTRACT";
    blockedReasonMutation.controls[0].reason = "同一阻塞理由";
    blockedReasonMutation.controls[1].reason = "同一阻塞理由";
    delete blockedReasonMutation.statusLedger.retainedNotImplementedReasons[blockedReasonMutation.controls[0].id];
    delete blockedReasonMutation.statusLedger.retainedNotImplementedReasons[blockedReasonMutation.controls[1].id];
    blockedReasonMutation.statusLedger.retainedBlockedReasons[blockedReasonMutation.controls[0].id] = "同一阻塞理由";
    blockedReasonMutation.statusLedger.retainedBlockedReasons[blockedReasonMutation.controls[1].id] = "同一阻塞理由";
    blockedReasonMutation.statusLedger.currentByteAfterLatestRemediationCounts.NOT_IMPLEMENTED -= 2;
    blockedReasonMutation.statusLedger.currentByteAfterLatestRemediationCounts.BLOCKED_UPSTREAM_CONTRACT = 2;
    try {
      assertIaStatusLedger(blockedReasonMutation);
      fail("P3_SELF_TEST_BLOCKED_REASON_MUTATION_NOT_REJECTED");
    } catch (error) {
      if (error.code !== "P3_IA_STATUS_LEDGER_BLOCKED_REASONS_INVALID") throw error;
      process.stdout.write("P3_RED_MUTATION=IA_BLOCKED_REASON_LEDGER\n");
    }
  } finally { fs.rmSync(scratch, {recursive: true, force: true}); }
}

try {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") { selfTest(); process.stdout.write("CATALOG_INVENTORY_P3_SELF_TEST=PASS\n"); }
  else process.stdout.write(`CATALOG_INVENTORY_P3_STATIC=PASS\n${JSON.stringify(check())}\n`);
} catch (error) { process.stderr.write(`${error.code || "P3_CHECK_FAILED"}:${error.message}\n`); process.exitCode = 1; }
