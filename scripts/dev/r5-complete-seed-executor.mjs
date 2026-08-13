#!/usr/bin/env node
/**
 * Public r5-full seed composition.  The two child executors retain their
 * owner-specific reports; this runner only proves that a complete DEV seed
 * has run both components in their required order for one managed DEV run.
 */
import {randomUUID} from "node:crypto";
import {spawn, spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, ".runtime/r5"));
export const COMPLETE_SEED_STAGE_IDS = Object.freeze(["owner-command", "catalog-inventory"]);

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function compact(value) {
  return String(value ?? "UNKNOWN").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, 240);
}

function readJson(file, code) {
  if (!fs.existsSync(file)) throw failure(`${code}_MISSING`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { throw failure(`${code}_INVALID`); }
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, content, {mode: 0o600});
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function requirePass(value, code) {
  if (value !== "PASS") throw failure(code);
}

function requireCleanupPass(value, code) {
  if (typeof value !== "string" || !value.startsWith("PASS")) throw failure(code);
}

/** Pure boundary validation; unit tests exercise every red case without DEV. */
export function validateCompleteSeedEvidence({managedDevRunId, stages}) {
  if (typeof managedDevRunId !== "string" || !managedDevRunId) throw failure("COMPLETE_SEED_MANAGED_RUN_ID_REQUIRED");
  if (!Array.isArray(stages) || stages.length !== COMPLETE_SEED_STAGE_IDS.length) throw failure("COMPLETE_SEED_STAGE_DENOMINATOR_INVALID");
  if (stages.map((stage) => stage.id).join(",") !== COMPLETE_SEED_STAGE_IDS.join(",")) throw failure("COMPLETE_SEED_STAGE_ORDER_INVALID");
  for (const stage of stages) {
    if (stage.exitStatus !== 0) throw failure(`COMPLETE_SEED_STAGE_EXIT_NONZERO:${stage.id}`);
    if (!stage.manifest || !stage.report) throw failure(`COMPLETE_SEED_STAGE_RECEIPT_MISSING:${stage.id}`);
    if (stage.manifest.managedDevRunId !== managedDevRunId || stage.report.managedDevRunId !== managedDevRunId) throw failure(`COMPLETE_SEED_MANAGED_RUN_MISMATCH:${stage.id}`);
    requirePass(stage.manifest.business, `COMPLETE_SEED_MANIFEST_NOT_PASS:${stage.id}`);
    requireCleanupPass(stage.manifest.cleanup, `COMPLETE_SEED_MANIFEST_CLEANUP_NOT_PASS:${stage.id}`);
    requirePass(stage.report.status, `COMPLETE_SEED_REPORT_NOT_PASS:${stage.id}`);
    // The historical owner report predates a separate `business` field; its
    // manifest is the owner business authority. New component reports may
    // carry the redundant field, in which case it must agree.
    if (Object.hasOwn(stage.report, "business")) requirePass(stage.report.business, `COMPLETE_SEED_REPORT_BUSINESS_NOT_PASS:${stage.id}`);
  }
  const catalog = stages[1];
  if (!catalog.plan || catalog.plan.status !== "PASS") throw failure("COMPLETE_SEED_CATALOG_PLAN_NOT_PASS");
  const sourceItems = catalog.plan.sourceItems?.length;
  const eligibleItems = catalog.plan.eligibleSourceItems?.length;
  const excludedItems = catalog.plan.excludedSourceItems?.length;
  if (!Number.isInteger(sourceItems) || sourceItems !== eligibleItems + excludedItems || eligibleItems <= 0) throw failure("COMPLETE_SEED_CATALOG_DENOMINATOR_INVALID");
  if (catalog.report.sourceItems !== sourceItems || catalog.report.createdItems !== eligibleItems || !Array.isArray(catalog.report.excludedItems) || catalog.report.excludedItems.length !== excludedItems) throw failure("COMPLETE_SEED_CATALOG_READBACK_INVALID");
  return Object.freeze({managedDevRunId, sourceItems, eligibleItems, excludedItems, stageIds: [...COMPLETE_SEED_STAGE_IDS]});
}

function managedRun() {
  const manifest = readJson(path.join(runtimeRoot, "run-manifest.json"), "COMPLETE_SEED_MANAGED_RUN_MANIFEST");
  if (manifest.kind !== "r5-dev-run-manifest" || manifest.freshDatabase !== true || typeof manifest.runId !== "string") throw failure("COMPLETE_SEED_MANAGED_RUN_INVALID");
  return manifest;
}

function runChild({name, script, environment, phase}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [script], {cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "";
    let stderr = "";
    const forward = (stream, collect) => stream.on("data", (chunk) => {
      const text = chunk.toString();
      collect(text);
      process[stream === child.stdout ? "stdout" : "stderr"].write(text);
    });
    forward(child.stdout, (text) => { stdout += text; });
    forward(child.stderr, (text) => { stderr += text; });
    const heartbeat = setInterval(() => {
      const elapsedMs = Date.now() - started;
      phase(`${name}-heartbeat`, "RUNNING", {elapsedMs, pid: child.pid});
      process.stdout.write(`R5_COMPLETE_SEED_HEARTBEAT; STAGE=${name}; ELAPSED_MS=${elapsedMs}\n`);
    }, 30_000);
    child.on("error", (error) => {
      clearInterval(heartbeat);
      resolve({exitStatus: 2, stdout, stderr: `${stderr}${compact(error.message)}`, durationMs: Date.now() - started});
    });
    child.on("close", (exitStatus) => {
      clearInterval(heartbeat);
      resolve({exitStatus: exitStatus ?? 2, stdout, stderr, durationMs: Date.now() - started});
    });
  });
}

function resultPath(output, key) {
  const match = new RegExp(`${key}=([^;\\s]+)`).exec(output);
  return match?.[1] ?? null;
}

function writeCompositeReport(file, report) {
  atomicWrite(file, `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    "# 完整 DEV Seed 报告",
    "",
    `- 结论：${report.business}`,
    `- Cleanup：${report.cleanup}`,
    `- Managed DEV Run ID：${report.managedDevRunId}`,
    `- 完整 Seed Run ID：${report.runId}`,
    `- 组件：${report.components.map((component) => `${component.id}=${component.business}`).join("；") || "无"}`,
    `- 首败：${report.firstFailure ?? "无"}`,
    "",
    "本报告只汇总两个子阶段的 receipt；各 owner/API 计量仍由各自子报告提供。",
    "",
  ].join("\n");
  atomicWrite(file.replace(/\.json$/, ".md"), markdown);
}

function dryRun() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-r5-complete-seed-"));
  try {
    const base = spawnSync(process.execPath, ["scripts/dev/r5-seed-plan.mjs"], {cwd: root, encoding: "utf8"});
    if (base.status !== 0) throw failure("COMPLETE_SEED_BASE_PLAN_FAILED");
    const planPath = path.join(temporary, "catalog-plan.json");
    const catalog = spawnSync(process.execPath, ["scripts/dev/catalog-inventory-seed-plan.mjs"], {cwd: root, encoding: "utf8", env: {...process.env, CATALOG_INVENTORY_SEED_PLAN_OUTPUT: planPath}});
    if (catalog.status !== 0) throw failure("COMPLETE_SEED_CATALOG_PLAN_FAILED");
    const plan = readJson(planPath, "COMPLETE_SEED_CATALOG_PLAN");
    const sourceItems = plan.sourceItems?.length;
    if (!Number.isInteger(sourceItems) || sourceItems !== plan.eligibleSourceItems?.length + plan.excludedSourceItems?.length) throw failure("COMPLETE_SEED_CATALOG_DENOMINATOR_INVALID");
    process.stdout.write(`R5_COMPLETE_SEED_DRY_RUN=PASS; COMPONENTS=${COMPLETE_SEED_STAGE_IDS.join(",")}; SOURCE_ITEMS=${sourceItems}; CREATED_ITEMS=${plan.eligibleSourceItems.length}; EXCLUDED_ITEMS=${plan.excludedSourceItems.length}; MEDIA=${plan.mediaPlan.length}\n`);
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

async function execute() {
  const manifest = managedRun();
  const runId = `complete-seed-${randomUUID()}`;
  const directory = path.join(runtimeRoot, "seed", "complete", runId);
  const manifestPath = path.join(directory, "run-manifest.json");
  const reportPath = path.join(directory, "seed-report.json");
  const planPath = path.join(directory, "catalog-inventory-seed-plan.json");
  const startedAt = new Date().toISOString();
  const phases = [];
  const components = [];
  let business = "RUNNING";
  let cleanup = "RUNNING";
  let firstFailure = null;
  const persist = () => atomicWrite(manifestPath, `${JSON.stringify({schemaVersion: 1, kind: "r5-complete-seed-manifest", runId, profile: "r5-full", managedDevRunId: manifest.runId, startedAt, business, cleanup, firstFailure, components, phases}, null, 2)}\n`);
  const phase = (stage, status, detail = {}) => { phases.push({at: new Date().toISOString(), stage, status, ...detail}); persist(); };
  const finish = () => {
    const report = {schemaVersion: 1, kind: "r5-complete-seed-report", runId, profile: "r5-full", managedDevRunId: manifest.runId, startedAt, finishedAt: new Date().toISOString(), business, cleanup, firstFailure, components};
    persist();
    writeCompositeReport(reportPath, report);
  };
  persist();
  try {
    phase("STATIC_PLAN", "RUNNING");
    const planResult = await runChild({name: "catalog-plan", script: "scripts/dev/catalog-inventory-seed-plan.mjs", environment: {...process.env, CATALOG_INVENTORY_SEED_PLAN_OUTPUT: planPath}, phase});
    if (planResult.exitStatus !== 0) throw failure("COMPLETE_SEED_CATALOG_PLAN_FAILED");
    const plan = readJson(planPath, "COMPLETE_SEED_CATALOG_PLAN");
    phase("STATIC_PLAN", "PASS", {planDigest: plan.planDigest, sourceItems: plan.sourceItems?.length});

    phase("owner-command", "RUNNING");
    const ownerResult = await runChild({name: "owner-command", script: "scripts/dev/owner-command-seed-executor.mjs", environment: process.env, phase});
    const ownerDirectory = path.join(runtimeRoot, "seed", manifest.runId);
    const owner = {id: "owner-command", ...ownerResult, manifestPath: path.join(ownerDirectory, "run-manifest.json"), reportPath: path.join(ownerDirectory, "seed-report.json")};
    owner.manifest = readJson(owner.manifestPath, "COMPLETE_SEED_OWNER_MANIFEST");
    owner.report = readJson(owner.reportPath, "COMPLETE_SEED_OWNER_REPORT");
    components.push({id: owner.id, business: owner.manifest.business, cleanup: owner.manifest.cleanup, durationMs: owner.durationMs, manifestPath: owner.manifestPath, reportPath: owner.reportPath});
    if (owner.exitStatus !== 0 || owner.manifest.business !== "PASS" || owner.report.status !== "PASS") throw failure(`COMPLETE_SEED_OWNER_FAILED:${owner.manifest.firstFailure ?? owner.exitStatus}`);
    phase("owner-command", "PASS", {durationMs: owner.durationMs});

    phase("catalog-inventory", "RUNNING");
    const catalogResult = await runChild({name: "catalog-inventory", script: "scripts/dev/catalog-inventory-seed-executor.mjs", environment: {...process.env, CATALOG_INVENTORY_SEED_CONFIRMATION: "EXPLICIT_CATALOG_INVENTORY_SEED", CATALOG_INVENTORY_SEED_PLAN_OUTPUT: planPath}, phase});
    const catalogOutput = `${catalogResult.stdout}\n${catalogResult.stderr}`;
    const catalog = {id: "catalog-inventory", ...catalogResult, plan, manifestPath: resultPath(catalogOutput, "RUN_MANIFEST"), reportPath: resultPath(catalogOutput, "REPORT")};
    if (!catalog.manifestPath || !catalog.reportPath) throw failure("COMPLETE_SEED_CATALOG_RECEIPT_POINTER_MISSING");
    catalog.manifest = readJson(catalog.manifestPath, "COMPLETE_SEED_CATALOG_MANIFEST");
    catalog.report = readJson(catalog.reportPath, "COMPLETE_SEED_CATALOG_REPORT");
    components.push({id: catalog.id, business: catalog.manifest.business, cleanup: catalog.manifest.cleanup, durationMs: catalog.durationMs, planPath, manifestPath: catalog.manifestPath, reportPath: catalog.reportPath});
    validateCompleteSeedEvidence({managedDevRunId: manifest.runId, stages: [owner, catalog]});
    phase("catalog-inventory", "PASS", {durationMs: catalog.durationMs, sourceItems: plan.sourceItems.length});
    business = "PASS";
    cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("COMPLETE_SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", destructiveCleanupOwner: "r5-reset", persistentSeedProcess: false});
  } catch (error) {
    firstFailure ??= error.code ?? compact(error.message);
    business = "FAIL";
    cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("COMPLETE_SEED", "FAIL", {reason: firstFailure});
    phase("COMPLETE_SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", destructiveCleanupOwner: "r5-reset", persistentSeedProcess: false, resetRequiredBeforeRerun: true});
  }
  finish();
  process.stdout.write(`R5_COMPLETE_SEED=${business}; CLEANUP=${cleanup}; RUN_MANIFEST=${manifestPath}; REPORT=${reportPath}; FIRST_FAILURE=${firstFailure ?? "NONE"}\n`);
  if (business !== "PASS") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.includes("--dry-run")) dryRun();
  else execute().catch((error) => { process.stderr.write(`R5_COMPLETE_SEED=REFUSED; REASON=${error.code ?? compact(error.message)}\n`); process.exitCode = 2; });
}
