#!/usr/bin/env node
/**
 * Public r5-full seed composition. The owner-specific child executors retain their
 * owner-specific reports; this runner only proves that a complete DEV seed
 * has run both components in their required order for one managed DEV run.
 */
import {createHash, randomBytes, randomUUID} from "node:crypto";
import {spawn, spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {renderSeedReportMarkdown} from "../test/seed-report.mjs";
import {availabilityReceiptFacts, validateAvailabilityReceiptAgainstPlan} from "./catalog-availability-receipt.mjs";
import {validateFixtureContract, validateFixtureSeedStages} from "./r5-fixture-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, ".runtime/r5"));
const fixturePath = path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json");
export const COMPLETE_SEED_STAGE_IDS = Object.freeze(["owner-command", "external-collaboration-business-channel", "catalog-inventory", "sales-menu"]);

export function completeSeedMarkdownPath(reportPath) {
  return String(reportPath).replace(/\.json$/i, ".md");
}

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function compact(value) {
  return String(value ?? "UNKNOWN").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, 240);
}

export function childFirstFailure(result) {
  const text = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}`;
  return compact(text.match(/(?:REASON|FIRST_FAILURE)=([A-Za-z0-9_:-]+)/)?.[1] ?? `EXIT_${result?.status ?? "UNKNOWN"}`);
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

function requireChildStagePass(stage, code) {
  if (stage.exitStatus !== 0) throw failure(`${code}:EXIT_${stage.exitStatus}`);
  if (!stage.manifest || !stage.report) throw failure(`${code}:RECEIPT_MISSING`);
  requirePass(stage.manifest.business, `${code}:MANIFEST_BUSINESS_NOT_PASS`);
  requireCleanupPass(stage.manifest.cleanup, `${code}:MANIFEST_CLEANUP_NOT_PASS`);
  requirePass(stage.report.status, `${code}:REPORT_STATUS_NOT_PASS`);
  if (Object.hasOwn(stage.report, "business")) requirePass(stage.report.business, `${code}:REPORT_BUSINESS_NOT_PASS`);
}

function validateStoreTerminalPostStep({terminalPostStep, fixture}) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const expected = fixture?.stableFixtures?.organization?.storeTerminals;
  const actual = terminalPostStep.report;
  if (!Array.isArray(expected) || expected.length !== 8) throw failure("COMPLETE_SEED_STORE_TERMINAL_FIXTURE_INVALID");
  const expectedByKey = new Map(expected.map((entry) => [entry.key, entry]));
  const detailReadback = actual?.detailReadback;
  const listReadback = actual?.listReadback;
  const expectedList = expected.filter((entry) => entry.status !== "VOIDED");
  if (!Array.isArray(detailReadback) || detailReadback.length !== expected.length) throw failure("COMPLETE_SEED_STORE_TERMINAL_DETAIL_READBACK_DENOMINATOR_INVALID");
  if (new Set(detailReadback.map((entry) => entry?.key)).size !== expected.length) throw failure("COMPLETE_SEED_STORE_TERMINAL_DETAIL_READBACK_KEYS_INVALID");
  if (!Array.isArray(listReadback) || listReadback.length !== expectedList.length) throw failure("COMPLETE_SEED_STORE_TERMINAL_LIST_READBACK_DENOMINATOR_INVALID");
  const expectedListKeys = new Set(expectedList.map((entry) => entry.key));
  if (new Set(listReadback.map((entry) => entry?.key)).size !== expectedList.length
      || listReadback.some((entry) => entry?.status === "VOIDED" || !expectedListKeys.has(entry?.key)))
    throw failure("COMPLETE_SEED_STORE_TERMINAL_LIST_READBACK_KEYS_INVALID");
  for (const entry of detailReadback) {
    const source = expectedByKey.get(entry?.key);
    if (!source || !uuid.test(String(entry.terminalRef ?? "")) || !entry.name || entry.name !== source.name || entry.status !== source.status)
      throw failure(`COMPLETE_SEED_STORE_TERMINAL_READBACK_INVALID:${entry?.key ?? "UNKNOWN"}`);
    if (!Number.isInteger(Number(entry.version)) || Number(entry.version) <= 0) throw failure(`COMPLETE_SEED_STORE_TERMINAL_VERSION_INVALID:${entry.key}`);
    const expectedPrinterKeys = source.configuration?.printers?.map((printer) => printer.clientKey) ?? [];
    const expectedFunctionKeys = source.configuration?.functions?.map((fn) => fn.clientKey) ?? [];
    const actualPrinterMap = entry.printerRefsByClientKey;
    const actualFunctionMap = entry.functionRefsByClientKey;
    if (!actualPrinterMap || !actualFunctionMap ||
        JSON.stringify(Object.keys(actualPrinterMap).sort()) !== JSON.stringify([...expectedPrinterKeys].sort()) ||
        JSON.stringify(Object.keys(actualFunctionMap).sort()) !== JSON.stringify([...expectedFunctionKeys].sort()))
      throw failure(`COMPLETE_SEED_STORE_TERMINAL_CHILD_KEYS_INVALID:${entry.key}`);
    if (Object.values(actualPrinterMap).some((ref) => !uuid.test(String(ref))) || Object.values(actualFunctionMap).some((ref) => !uuid.test(String(ref))))
      throw failure(`COMPLETE_SEED_STORE_TERMINAL_CHILD_REFS_INVALID:${entry.key}`);
    if (Object.hasOwn(entry, "activationCode")) throw failure(`COMPLETE_SEED_STORE_TERMINAL_ACTIVATION_LEAK:${entry.key}`);
  }
  const roleStoreReadback = actual.roleStoreReadback;
  const roleTarget = detailReadback.find((entry) => entry.terminalRef === roleStoreReadback?.terminalRef);
  if (!roleStoreReadback || !roleTarget || !uuid.test(String(roleStoreReadback.terminalRef ?? "")) ||
      !Number.isInteger(Number(roleStoreReadback.areaCandidateCount)) ||
      !Number.isInteger(Number(roleStoreReadback.tagCandidateCount)) ||
      roleStoreReadback.status !== roleTarget.status ||
      Number(roleStoreReadback.version) !== Number(roleTarget.version) ||
      roleStoreReadback.deniedEditStatus !== 403 || roleStoreReadback.deniedStatusStatus !== 403 ||
      roleStoreReadback.deniedCreateStatus !== 403 || roleStoreReadback.unchangedAfterDenial !== true)
    throw failure("COMPLETE_SEED_STORE_TERMINAL_ROLE_READBACK_INVALID");
}

export function projectPostStepReceipt(step) {
  const keys = ["id", "exitStatus", "business", "cleanup", "created", "detailReadback", "listReadback", "artifacts", "rules", "reportPath"];
  return Object.fromEntries(keys.filter((key) => step[key] !== undefined).map((key) => [key, step[key]]));
}

/** Pure boundary validation; unit tests exercise every red case without DEV. */
export function validateCompleteSeedEvidence({managedDevRunId, stages, fixture = null, postSteps = []}) {
  if (fixture) validateFixtureSeedStages(fixture);
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
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const catalog = stageById.get("catalog-inventory");
  const salesMenu = stageById.get("sales-menu");
  if (!catalog.plan || catalog.plan.status !== "PASS") throw failure("COMPLETE_SEED_CATALOG_PLAN_NOT_PASS");
  const sourceItems = catalog.plan.sourceItems?.length;
  const eligibleItems = catalog.plan.eligibleSourceItems?.length;
  const excludedItems = catalog.plan.excludedSourceItems?.length;
  if (!Number.isInteger(sourceItems) || sourceItems !== eligibleItems + excludedItems || eligibleItems <= 0) throw failure("COMPLETE_SEED_CATALOG_DENOMINATOR_INVALID");
  if (catalog.report.sourceItems !== sourceItems || catalog.report.createdItems !== eligibleItems || !Array.isArray(catalog.report.excludedItems) || catalog.report.excludedItems.length !== excludedItems) throw failure("COMPLETE_SEED_CATALOG_READBACK_INVALID");
  let availability;
  let availabilityContract;
  try {
    availability = availabilityReceiptFacts(catalog.report.salesMenuAvailabilityReceipt);
    availabilityContract = validateAvailabilityReceiptAgainstPlan({plan: catalog.plan, receipt: catalog.report.salesMenuAvailabilityReceipt});
  } catch {
    throw failure("COMPLETE_SEED_CATALOG_AVAILABILITY_RECEIPT_INVALID");
  }
  if (!/^[0-9a-f]{64}$/.test(catalog.availabilityReceiptSha256 ?? ""))
    throw failure("COMPLETE_SEED_CATALOG_AVAILABILITY_DIGEST_INVALID");
  if (salesMenu.report.catalogAvailabilityReceiptPath !== catalog.reportPath
      || salesMenu.report.catalogAvailabilityItemCount !== availability.length
      || salesMenu.report.catalogAvailabilityReceiptDigest !== catalog.availabilityReceiptSha256
      || salesMenu.report.catalogAvailabilityContractDigest !== availabilityContract.contractDigest)
    throw failure("COMPLETE_SEED_SALES_MENU_AVAILABILITY_READBACK_INVALID");
  if (!Array.isArray(postSteps) || postSteps.length !== 2 || postSteps.map((step) => step?.id).join(",") !== "store-terminal,terminal-update") {
    throw failure("COMPLETE_SEED_POST_STEP_DENOMINATOR_INVALID");
  }
  const terminalPostStep = postSteps[0];
  const terminalDetailReadback = terminalPostStep.report?.detailReadback;
  const terminalListReadback = terminalPostStep.report?.listReadback;
  if (terminalPostStep.exitStatus !== 0 || !terminalPostStep.reportPath || !terminalPostStep.report
      || terminalPostStep.report.managedDevRunId !== managedDevRunId
      || terminalPostStep.report.business !== "PASS"
      || !String(terminalPostStep.report.cleanup ?? "").startsWith("PASS")
      || terminalPostStep.report.created !== 8
      || terminalPostStep.report.roleGroup !== "EDIT"
      || terminalPostStep.report.roleProject !== "EDIT"
      || terminalPostStep.report.roleStore !== "READ_ONLY"
      || !Array.isArray(terminalDetailReadback)
      || terminalDetailReadback.length !== 8
      || new Set(terminalDetailReadback.map((entry) => entry?.key)).size !== 8
      || terminalDetailReadback.some((entry) => !entry?.terminalRef || Object.hasOwn(entry, "activationCode"))
      || !Array.isArray(terminalListReadback)
      || terminalListReadback.length !== 7
      || new Set(terminalListReadback.map((entry) => entry?.key)).size !== 7
      || terminalListReadback.some((entry) => !entry?.terminalRef || entry?.status === "VOIDED" || Object.hasOwn(entry, "activationCode"))) {
    throw failure("COMPLETE_SEED_STORE_TERMINAL_POST_STEP_INVALID");
  }
  if (fixture) validateStoreTerminalPostStep({terminalPostStep, fixture});
  const updatePostStep = postSteps[1];
  const updateReport = updatePostStep.report;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const expectedArtifacts = fixture?.stableFixtures?.terminalUpdate?.artifacts ?? [];
  const expectedRules = fixture?.stableFixtures?.terminalUpdate?.rules ?? [];
  const artifactRows = updateReport?.createdArtifacts;
  const ruleRows = updateReport?.createdRules;
  if (updatePostStep.exitStatus !== 0 || !updatePostStep.reportPath || !updateReport
      || updateReport.managedDevRunId !== managedDevRunId
      || updateReport.business !== "PASS"
      || updateReport.cleanup !== "PASS_SOURCE_ARTIFACT_INPUTS_REMOVED"
      || typeof updateReport.sourceArtifactRunId !== "string"
      || !/^[0-9a-f]{64}$/.test(updateReport.sourceDigest ?? "")
      || updateReport.roleGroup !== "WRITE_CONFIRMED"
      || updateReport.roleProject !== "READ_PAGE_CONFIRMED"
      || updateReport.roleStore !== "NOT_GRANTED"
      || !Array.isArray(artifactRows) || artifactRows.length !== 4
      || new Set(artifactRows.map((entry) => entry?.key)).size !== expectedArtifacts.length
      || artifactRows.some((entry) => !expectedArtifacts.some((source) => source.key === entry?.key)
        || !uuid.test(String(entry?.artifactRef ?? "")) || !/^[0-9a-f]{64}$/.test(entry?.zipSha256 ?? ""))
      || !Array.isArray(ruleRows) || ruleRows.length !== 8
      || new Set(ruleRows.map((entry) => entry?.key)).size !== expectedRules.length
      || ruleRows.some((entry) => !expectedRules.some((source) => source.key === entry?.key) || !uuid.test(String(entry?.ruleRef ?? "")))) {
    throw failure("COMPLETE_SEED_TERMINAL_UPDATE_POST_STEP_INVALID");
  }
  return Object.freeze({managedDevRunId, sourceItems, eligibleItems, excludedItems, availabilityItemCount: availability.length,
    terminalUpdateArtifacts: artifactRows.length, terminalUpdateRules: ruleRows.length,
    stageIds: [...COMPLETE_SEED_STAGE_IDS], postStepIds: ["store-terminal", "terminal-update"]});
}

function issueChildContext({directory, runId, managedDevRunId, stageId, catalogAvailabilityReceipt = null}) {
  const token = randomBytes(32).toString("hex");
  const contextPath = path.join(directory, `${stageId}-context.json`);
  atomicWrite(contextPath, `${JSON.stringify({
    schemaVersion: 1,
    kind: "r5-complete-seed-child-context",
    profile: "r5-full",
    stageId,
    runId,
    managedDevRunId,
    tokenSha256: createHash("sha256").update(token).digest("hex"),
    ...(catalogAvailabilityReceipt ? {catalogAvailabilityReceipt} : {}),
  }, null, 2)}\n`);
  return Object.freeze({contextPath, token});
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

function markdownTable(headers, rows) {
  const separator = headers.map(() => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((value) => escapeMarkdown(value)).join(" | ")} |`),
  ].join("\n");
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2).replace(/\.00$/, "") : "-";
}

function escapeMarkdown(value) {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function displayPath(file) {
  const relative = path.relative(root, file);
  return relative && !relative.startsWith("..") ? relative : file;
}

function loadComponentReports(report) {
  return (report.components ?? []).map((component) => {
    if (!component.reportPath) return {component, error: "COMPLETE_SEED_COMPONENT_REPORT_PATH_MISSING"};
    try {
      const childReport = readJson(component.reportPath, "COMPLETE_SEED_COMPONENT_REPORT");
      if (childReport.managedDevRunId !== report.managedDevRunId) {
        return {component, error: "COMPLETE_SEED_COMPONENT_MANAGED_RUN_MISMATCH"};
      }
      return {component, report: childReport};
    } catch (error) {
      return {component, error: error.code ?? compact(error.message)};
    }
  });
}

function componentReportMarkdown(component, childReport) {
  // The child report remains the only metric authority.  This is a heading
  // and presentation adjustment only; no metric is recomputed here.
  return renderSeedReportMarkdown({...childReport, cleanupStatus: component.cleanup ?? childReport.cleanupStatus})
    .replace(/^# Seed 报告\s*/u, "")
    .replace(/^## /gmu, "#### ")
    .trim();
}

export function renderCompleteSeedMarkdown(report, componentDetails = loadComponentReports(report)) {
  const componentRows = componentDetails.map(({component, report: childReport, error}) => [
    component.id,
    component.business ?? childReport?.businessStatus ?? childReport?.status ?? "-",
    component.cleanup ?? childReport?.cleanupStatus ?? "-",
    Number.isFinite(component.durationMs) ? `${formatNumber(component.durationMs)} ms` : "-",
    childReport?.completeness?.apiCallCount ?? "-",
    childReport?.completeness?.endpointGroupCount ?? "-",
    childReport ? `${childReport.completeness?.unmatchedHttpEvents?.length ?? 0}/${childReport.completeness?.unmatchedDatabaseEvents?.length ?? 0}` : `详报不可用：${error}`,
  ]);
  const fixtureRows = componentDetails
    .filter(({report: childReport}) => childReport && (childReport.sourceItems !== undefined || childReport.createdItems !== undefined || childReport.mediaAssets !== undefined))
    .map(({component, report: childReport}) => [
      component.id,
      childReport.sourceItems ?? "-",
      childReport.createdItems ?? "-",
      Array.isArray(childReport.excludedItems) ? childReport.excludedItems.length : "-",
      childReport.mediaAssets ?? "-",
      childReport.planDigest ?? "-",
    ]);
  const startedAt = new Date(report.startedAt).getTime();
  const finishedAt = new Date(report.finishedAt).getTime();
  const durationMs = Number.isFinite(startedAt) && Number.isFinite(finishedAt) ? Math.max(0, finishedAt - startedAt) : null;
  const lines = [
    "# 完整 DEV Seed 报告",
    "",
    "> 这是完整 `r5-full` seed 的可读投影；机器校验真相是同目录 `seed-report.json`，接口/数据库计量真相保留在各 owner 子报告中。",
    "",
    `## 结论：${report.business}`,
    "",
    `- Seed profile：\`${escapeMarkdown(report.profile)}\``,
    `- Managed DEV Run ID：\`${escapeMarkdown(report.managedDevRunId)}\``,
    `- 完整 Seed Run ID：\`${escapeMarkdown(report.runId)}\``,
    `- Business：\`${escapeMarkdown(report.business)}\``,
    `- Cleanup：\`${escapeMarkdown(report.cleanup)}\``,
    `- 开始：${escapeMarkdown(report.startedAt)}`,
    `- 结束：${escapeMarkdown(report.finishedAt)}`,
    `- 父流程耗时：${formatNumber(durationMs)} ms`,
    `- 首败：${escapeMarkdown(report.firstFailure ?? "无")}`,
    "",
    "## 子阶段总览",
    "",
    "API 调用数、endpoint 分组数和关联性直接来自各子报告；父报告不重新计算或合并第二套 API/数据库统计。最后一列为“未关联 HTTP / 未关联数据库”事件数。",
    "",
    markdownTable(["阶段", "Business", "Cleanup", "阶段耗时", "API 调用", "Endpoint 分组", "关联缺口"], componentRows.length ? componentRows : [["无", "-", "-", "-", "-", "-", "-"]]),
    "",
    "## 终端后置 Seed",
    "",
    report.postSteps?.length
      ? markdownTable(["后置步骤", "Business", "Cleanup", "创建数", "详情读回数", "列表读回数", "工件数", "规则数", "报告"], report.postSteps.map((step) => [step.id, step.business ?? "-", step.cleanup ?? "-", step.created ?? "-", step.detailReadback ?? "-", step.listReadback ?? "-", step.artifacts ?? "-", step.rules ?? "-", step.reportPath ?? "-"]))
      : "未执行终端后置步骤。",
    "",
    "## Catalog / Inventory 数据计划",
    "",
    fixtureRows.length
      ? markdownTable(["阶段", "来源项", "创建项", "排除项", "媒体", "Plan digest"], fixtureRows)
      : "当前父 receipt 中没有可读的数据计划字段。",
    "",
    "## 子阶段详细计量",
    "",
    "以下各节逐字复用子报告的 endpoint 表和非 API 阶段，不把多个阶段压成无法追溯的总数。重点耗时接口可直接在各表的 HTTP/DB average/min/max 列定位。",
    "",
  ];
  for (const {component, report: childReport, error} of componentDetails) {
    lines.push(`### ${escapeMarkdown(component.id)}`, "");
    lines.push(`- 子报告 JSON：\`${escapeMarkdown(component.reportPath ? displayPath(component.reportPath) : "未提供")}\``);
    if (error) {
      lines.push(`- 详细计量：不可用（${escapeMarkdown(error)}）`, "");
      continue;
    }
    lines.push("", componentReportMarkdown(component, childReport), "");
  }
  lines.push(
    "## 证据边界",
    "",
    "- `Business=PASS` 与 `Cleanup=PASS*` 是本次 seed 的受管执行结果，不替代浏览器 L2、UAT 或完整业务验收。",
    "- API 请求与 backend request-completed event 已按 managed DEV run、correlation id、request id 关联；未关联事件在各子报告总览中单独列出。",
    "- 报告只展示 route、operation、计数和耗时，不展示 SQL、bind value、raw payload、密码、token、cookie、Authorization 或账号敏感信息。",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function writeCompositeReport(file, report) {
  atomicWrite(file, `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(completeSeedMarkdownPath(file), renderCompleteSeedMarkdown(report));
}

function dryRun() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-r5-complete-seed-"));
  try {
    const base = spawnSync(process.execPath, ["scripts/dev/r5-seed-plan.mjs"], {cwd: root, encoding: "utf8"});
    if (base.status !== 0) throw failure("COMPLETE_SEED_BASE_PLAN_FAILED");
    const planPath = path.join(temporary, "catalog-plan.json");
    const catalog = spawnSync(process.execPath, ["scripts/dev/catalog-inventory-seed-plan.mjs"], {cwd: root, encoding: "utf8", env: {...process.env, CATALOG_INVENTORY_SEED_PLAN_OUTPUT: planPath}});
    if (catalog.status !== 0) throw failure("COMPLETE_SEED_CATALOG_PLAN_FAILED");
    const businessChannel = spawnSync(process.execPath, ["scripts/dev/external-collaboration-business-channel-seed-executor.mjs", "--plan-only"], {cwd: root, encoding: "utf8"});
    if (businessChannel.status !== 0) throw failure("COMPLETE_SEED_BUSINESS_CHANNEL_PLAN_FAILED");
    const salesMenu = spawnSync(process.execPath, ["scripts/dev/sales-menu-seed-executor.mjs", "--plan-only"], {cwd: root, encoding: "utf8"});
    if (salesMenu.status !== 0) throw failure(`COMPLETE_SEED_SALES_MENU_PLAN_FAILED:${childFirstFailure(salesMenu)}`);
    const terminal = spawnSync(process.execPath, ["scripts/dev/store-terminal-seed-executor.mjs", "--plan-only"], {cwd: root, encoding: "utf8"});
    if (terminal.status !== 0) throw failure(`COMPLETE_SEED_STORE_TERMINAL_PLAN_FAILED:${childFirstFailure(terminal)}`);
    const terminalMarker = String(terminal.stdout ?? "").match(/R5_STORE_TERMINAL_SEED_PLAN=PASS; TERMINALS=(\d+); PLAN_DIGEST=([0-9a-f]{64})/);
    if (!terminalMarker || terminalMarker[1] !== "8") throw failure("COMPLETE_SEED_STORE_TERMINAL_PLAN_MARKER_INVALID");
    const terminalUpdate = spawnSync(process.execPath, ["scripts/dev/terminal-update-seed-executor.mjs", "--plan-only"], {cwd: root, encoding: "utf8", env: process.env});
    if (terminalUpdate.status !== 0) throw failure(`COMPLETE_SEED_TERMINAL_UPDATE_PLAN_FAILED:${childFirstFailure(terminalUpdate)}`);
    const terminalUpdateMarker = String(terminalUpdate.stdout ?? "").match(/R5_TERMINAL_UPDATE_SEED_PLAN=PASS; SOURCE_RUN=([A-Za-z0-9_-]+); ARTIFACTS=(\d+); RULES=(\d+); SOURCE_DIGEST=([0-9a-f]{64})/);
    if (!terminalUpdateMarker || terminalUpdateMarker[2] !== "4" || terminalUpdateMarker[3] !== "8") throw failure("COMPLETE_SEED_TERMINAL_UPDATE_PLAN_MARKER_INVALID");
    const plan = readJson(planPath, "COMPLETE_SEED_CATALOG_PLAN");
    const sourceItems = plan.sourceItems?.length;
    if (!Number.isInteger(sourceItems) || sourceItems !== plan.eligibleSourceItems?.length + plan.excludedSourceItems?.length) throw failure("COMPLETE_SEED_CATALOG_DENOMINATOR_INVALID");
    process.stdout.write(`R5_COMPLETE_SEED_DRY_RUN=PASS; COMPONENTS=${COMPLETE_SEED_STAGE_IDS.join(",")}; SOURCE_ITEMS=${sourceItems}; CREATED_ITEMS=${plan.eligibleSourceItems.length}; EXCLUDED_ITEMS=${plan.excludedSourceItems.length}; MEDIA=${plan.mediaPlan.length}; TERMINALS=${terminalMarker[1]}; TERMINAL_PLAN_DIGEST=${terminalMarker[2]}; UPDATE_SOURCE_RUN=${terminalUpdateMarker[1]}; UPDATE_ARTIFACTS=${terminalUpdateMarker[2]}; UPDATE_RULES=${terminalUpdateMarker[3]}; UPDATE_SOURCE_DIGEST=${terminalUpdateMarker[4]}\n`);
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

async function execute() {
  const manifest = managedRun();
  const fixture = readJson(fixturePath, "COMPLETE_SEED_FIXTURE_CONTRACT");
  validateFixtureContract(fixture);
  const runId = `complete-seed-${randomUUID()}`;
  const directory = path.join(runtimeRoot, "seed", "complete", runId);
  const manifestPath = path.join(directory, "run-manifest.json");
  const reportPath = path.join(directory, "seed-report.json");
  const planPath = path.join(directory, "catalog-inventory-seed-plan.json");
  const startedAt = new Date().toISOString();
  const phases = [];
  const components = [];
  const postSteps = [];
  let business = "RUNNING";
  let cleanup = "RUNNING";
  let firstFailure = null;
  const persist = () => atomicWrite(manifestPath, `${JSON.stringify({schemaVersion: 1, kind: "r5-complete-seed-manifest", runId, profile: "r5-full", managedDevRunId: manifest.runId, startedAt, business, cleanup, firstFailure, components, postSteps: postSteps.map(projectPostStepReceipt), phases}, null, 2)}\n`);
  const phase = (stage, status, detail = {}) => { phases.push({at: new Date().toISOString(), stage, status, ...detail}); persist(); };
  const finish = () => {
    const report = {schemaVersion: 1, kind: "r5-complete-seed-report", runId, profile: "r5-full", managedDevRunId: manifest.runId, startedAt, finishedAt: new Date().toISOString(), business, cleanup, firstFailure, components, postSteps: postSteps.map(projectPostStepReceipt)};
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
    requireChildStagePass(owner, "COMPLETE_SEED_OWNER_FAILED");
    phase("owner-command", "PASS", {durationMs: owner.durationMs});

    phase("external-collaboration-business-channel", "RUNNING");
    const businessChannelContext = issueChildContext({directory, runId, managedDevRunId: manifest.runId, stageId: "external-collaboration-business-channel"});
    const businessChannelResult = await runChild({name: "external-collaboration-business-channel", script: "scripts/dev/external-collaboration-business-channel-seed-executor.mjs", environment: {...process.env, R5_COMPLETE_SEED_CHILD_CONTEXT: businessChannelContext.contextPath, R5_COMPLETE_SEED_CHILD_TOKEN: businessChannelContext.token}, phase});
    const businessChannelOutput = `${businessChannelResult.stdout}\n${businessChannelResult.stderr}`;
    const businessChannel = {id: "external-collaboration-business-channel", ...businessChannelResult, manifestPath: resultPath(businessChannelOutput, "RUN_MANIFEST"), reportPath: resultPath(businessChannelOutput, "REPORT")};
    if (!businessChannel.manifestPath || !businessChannel.reportPath) throw failure("COMPLETE_SEED_BUSINESS_CHANNEL_RECEIPT_POINTER_MISSING");
    businessChannel.manifest = readJson(businessChannel.manifestPath, "COMPLETE_SEED_BUSINESS_CHANNEL_MANIFEST");
    businessChannel.report = readJson(businessChannel.reportPath, "COMPLETE_SEED_BUSINESS_CHANNEL_REPORT");
    components.push({id: businessChannel.id, business: businessChannel.manifest.business, cleanup: businessChannel.manifest.cleanup, durationMs: businessChannel.durationMs, manifestPath: businessChannel.manifestPath, reportPath: businessChannel.reportPath});
    requireChildStagePass(businessChannel, "COMPLETE_SEED_BUSINESS_CHANNEL_FAILED");
    phase("external-collaboration-business-channel", "PASS", {durationMs: businessChannel.durationMs});

    phase("catalog-inventory", "RUNNING");
    const catalogResult = await runChild({name: "catalog-inventory", script: "scripts/dev/catalog-inventory-seed-executor.mjs", environment: {...process.env, CATALOG_INVENTORY_SEED_CONFIRMATION: "EXPLICIT_CATALOG_INVENTORY_SEED", CATALOG_INVENTORY_SEED_PLAN_OUTPUT: planPath}, phase});
    const catalogOutput = `${catalogResult.stdout}\n${catalogResult.stderr}`;
    const catalog = {id: "catalog-inventory", ...catalogResult, plan, manifestPath: resultPath(catalogOutput, "RUN_MANIFEST"), reportPath: resultPath(catalogOutput, "REPORT")};
    if (!catalog.manifestPath || !catalog.reportPath) throw failure("COMPLETE_SEED_CATALOG_RECEIPT_POINTER_MISSING");
    catalog.manifest = readJson(catalog.manifestPath, "COMPLETE_SEED_CATALOG_MANIFEST");
    catalog.report = readJson(catalog.reportPath, "COMPLETE_SEED_CATALOG_REPORT");
    catalog.availabilityReceiptSha256 = createHash("sha256").update(fs.readFileSync(catalog.reportPath)).digest("hex");
    components.push({id: catalog.id, business: catalog.manifest.business, cleanup: catalog.manifest.cleanup, durationMs: catalog.durationMs, planPath, manifestPath: catalog.manifestPath, reportPath: catalog.reportPath});
    requireChildStagePass(catalog, "COMPLETE_SEED_CATALOG_FAILED");
    let catalogAvailabilityContract;
    try { catalogAvailabilityContract = validateAvailabilityReceiptAgainstPlan({plan, receipt: catalog.report.salesMenuAvailabilityReceipt}); }
    catch { throw failure("COMPLETE_SEED_CATALOG_AVAILABILITY_RECEIPT_INVALID"); }
    const catalogAvailabilityReceipt = Object.freeze({
      reportPath: path.resolve(catalog.reportPath),
      sha256: catalog.availabilityReceiptSha256,
      contractDigest: catalogAvailabilityContract.contractDigest,
      itemCount: catalogAvailabilityContract.itemCount,
    });
    phase("catalog-inventory", "PASS", {durationMs: catalog.durationMs, sourceItems: plan.sourceItems.length});

    phase("sales-menu", "RUNNING");
    const salesMenuContext = issueChildContext({directory, runId, managedDevRunId: manifest.runId, stageId: "sales-menu", catalogAvailabilityReceipt});
    const salesMenuResult = await runChild({name: "sales-menu", script: "scripts/dev/sales-menu-seed-executor.mjs", environment: {...process.env, R5_COMPLETE_SEED_CHILD_CONTEXT: salesMenuContext.contextPath, R5_COMPLETE_SEED_CHILD_TOKEN: salesMenuContext.token, R5_CATALOG_AVAILABILITY_RECEIPT: catalog.reportPath}, phase});
    const salesMenuOutput = `${salesMenuResult.stdout}\n${salesMenuResult.stderr}`;
    const salesMenu = {id: "sales-menu", ...salesMenuResult, manifestPath: resultPath(salesMenuOutput, "RUN_MANIFEST"), reportPath: resultPath(salesMenuOutput, "REPORT")};
    if (!salesMenu.manifestPath || !salesMenu.reportPath) throw failure("COMPLETE_SEED_SALES_MENU_RECEIPT_POINTER_MISSING");
    salesMenu.manifest = readJson(salesMenu.manifestPath, "COMPLETE_SEED_SALES_MENU_MANIFEST");
    salesMenu.report = readJson(salesMenu.reportPath, "COMPLETE_SEED_SALES_MENU_REPORT");
    components.push({id: salesMenu.id, business: salesMenu.manifest.business, cleanup: salesMenu.manifest.cleanup, durationMs: salesMenu.durationMs, manifestPath: salesMenu.manifestPath, reportPath: salesMenu.reportPath});
    requireChildStagePass(salesMenu, "COMPLETE_SEED_SALES_MENU_FAILED");
    phase("sales-menu", "PASS", {durationMs: salesMenu.durationMs});
    phase("store-terminal-post-step", "RUNNING");
    const terminalResult = await runChild({name: "store-terminal", script: "scripts/dev/store-terminal-seed-executor.mjs", environment: process.env, phase});
    const terminalOutput = `${terminalResult.stdout}\n${terminalResult.stderr}`;
    const terminalPostStep = {id: "store-terminal", ...terminalResult, reportPath: resultPath(terminalOutput, "REPORT")};
    if (!terminalPostStep.reportPath) throw failure(`COMPLETE_SEED_STORE_TERMINAL_POST_STEP_FAILED:${childFirstFailure(terminalResult)}`);
    terminalPostStep.report = readJson(terminalPostStep.reportPath, "COMPLETE_SEED_STORE_TERMINAL_POST_STEP_REPORT");
    terminalPostStep.business = terminalPostStep.report.business;
    terminalPostStep.cleanup = terminalPostStep.report.cleanup;
    terminalPostStep.created = terminalPostStep.report.created;
    terminalPostStep.detailReadback = Array.isArray(terminalPostStep.report.detailReadback)
      ? terminalPostStep.report.detailReadback.length
      : terminalPostStep.report.detailReadback;
    terminalPostStep.listReadback = Array.isArray(terminalPostStep.report.listReadback)
      ? terminalPostStep.report.listReadback.length
      : terminalPostStep.report.listReadback;
    postSteps.push(terminalPostStep);
    if (terminalPostStep.exitStatus !== 0) throw failure(`COMPLETE_SEED_STORE_TERMINAL_POST_STEP_FAILED:${terminalPostStep.report?.firstFailure ?? terminalPostStep.exitStatus}`);
    phase("store-terminal-post-step", "PASS", {created: terminalPostStep.created, detailReadback: terminalPostStep.detailReadback, listReadback: terminalPostStep.listReadback});

    phase("terminal-update-post-step", "RUNNING", {sourceRunId: process.env.R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID ?? "MISSING"});
    const updateResult = await runChild({name: "terminal-update", script: "scripts/dev/terminal-update-seed-executor.mjs", environment: process.env, phase});
    const updateOutput = `${updateResult.stdout}\n${updateResult.stderr}`;
    const updatePostStep = {id: "terminal-update", ...updateResult, reportPath: resultPath(updateOutput, "REPORT")};
    if (!updatePostStep.reportPath) throw failure(`COMPLETE_SEED_TERMINAL_UPDATE_POST_STEP_FAILED:${childFirstFailure(updateResult)}`);
    updatePostStep.report = readJson(updatePostStep.reportPath, "COMPLETE_SEED_TERMINAL_UPDATE_POST_STEP_REPORT");
    updatePostStep.business = updatePostStep.report.business;
    updatePostStep.cleanup = updatePostStep.report.cleanup;
    updatePostStep.artifacts = updatePostStep.report.createdArtifacts?.length;
    updatePostStep.rules = updatePostStep.report.createdRules?.length;
    postSteps.push(updatePostStep);
    if (updatePostStep.exitStatus !== 0) throw failure(`COMPLETE_SEED_TERMINAL_UPDATE_POST_STEP_FAILED:${updatePostStep.report?.firstFailure ?? updatePostStep.exitStatus}`);
    phase("terminal-update-post-step", "PASS", {artifacts: updatePostStep.artifacts, rules: updatePostStep.rules});
    validateCompleteSeedEvidence({managedDevRunId: manifest.runId, stages: [owner, businessChannel, catalog, salesMenu], fixture, postSteps});
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
  process.stdout.write(`R5_COMPLETE_SEED=${business}; CLEANUP=${cleanup}; RUN_MANIFEST=${manifestPath}; REPORT=${reportPath}; MARKDOWN=${completeSeedMarkdownPath(reportPath)}; FIRST_FAILURE=${firstFailure ?? "NONE"}\n`);
  if (business !== "PASS") process.exitCode = 2;
}

function renderExistingReport(reportPath) {
  const absoluteReportPath = path.resolve(reportPath);
  const report = readJson(absoluteReportPath, "COMPLETE_SEED_REPORT");
  const markdownPath = completeSeedMarkdownPath(absoluteReportPath);
  atomicWrite(markdownPath, renderCompleteSeedMarkdown(report));
  process.stdout.write(`R5_COMPLETE_SEED_REPORT_RENDER=PASS; REPORT=${absoluteReportPath}; MARKDOWN=${markdownPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const renderIndex = process.argv.indexOf("--render-existing");
  if (renderIndex >= 0) {
    const reportPath = process.argv[renderIndex + 1];
    if (!reportPath) {
      process.stderr.write("R5_COMPLETE_SEED_REPORT_RENDER=REFUSED; REASON=REPORT_PATH_REQUIRED\n");
      process.exitCode = 2;
    } else {
      try { renderExistingReport(reportPath); }
      catch (error) {
        process.stderr.write(`R5_COMPLETE_SEED_REPORT_RENDER=REFUSED; REASON=${error.code ?? compact(error.message)}\n`);
        process.exitCode = 2;
      }
    }
  } else if (process.argv.includes("--dry-run")) {
    try { dryRun(); }
    catch (error) { process.stderr.write(`R5_COMPLETE_SEED_DRY_RUN=FAIL; FIRST_FAILURE=${error.code ?? compact(error.message)}\n`); process.exitCode = 2; }
  }
  else execute().catch((error) => { process.stderr.write(`R5_COMPLETE_SEED=REFUSED; REASON=${error.code ?? compact(error.message)}\n`); process.exitCode = 2; });
}
