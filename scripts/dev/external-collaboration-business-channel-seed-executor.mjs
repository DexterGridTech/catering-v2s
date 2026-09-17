#!/usr/bin/env node

/**
 * Managed r5-full child seed for collaboration enablements and business
 * channels. Logical plan codes never cross the HTTP boundary as resource
 * identifiers: this executor resolves current owner identities first and
 * submits only generated operations with authoritative readback.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {acceptanceScenarioIds, plan as seedPlan, validate as validateSeedPlan} from "./external-collaboration-business-channel-seed-plan.mjs";
import {FormalSeedFailure, managedSeedEnvironment} from "./owner-command-seed-executor.mjs";
import {canonicalStartToken} from "./managed-process-tree.mjs";
import {validateRemoteJavaControl} from "./r5-remote-java.mjs";
import {buildManagedDiagnosticHeaders, measurementMetadataForReport, readManagedDiagnosticEvents, validateManagedDiagnosticTransport} from "./managed-diagnostic-protocol.mjs";
import {buildSeedReport, loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById, writeSeedReportPair} from "../test/seed-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, ".runtime/r5"));
const fixturePath = path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json");
const catalogPath = path.join(root, "contracts/collaboration/external-platform-catalog.json");
const registryPath = path.join(root, "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json");
const stageId = "external-collaboration-business-channel";
const requiredOperationIds = Object.freeze([
  "platformPasswordLogin", "getCurrentPlatformSession", "getPlatformProviderProfileDetail", "transitionPlatformProviderProfileStatus",
  "operationsWorkspacePasswordLogin", "getOperationsWorkspaceSessionEntry", "selectOperationsWorkspaceSessionContext",
  "createOperationsBusinessChannelTemplate", "updateOperationsBusinessChannelTemplate", "createOperationsBusinessChannel", "createOperationsOwnerBinding",
  "getOperationsBusinessChannelDetail", "transitionOperationsBusinessChannelStatus", "getOperationsStoreBusinessChannels",
  "getOperationsProjectBusinessChannels", "getOperationsStoreBusinessChannelTemplateCandidates",
  "getOperationsBusinessChannelTemplateVisibleStores", "transitionOperationsOrganizationStoreStatus",
  "selectOperationsWorkspaceSessionDataNode", "getOperationsStoreQrChannelCandidates", "getOperationsStoreQrConfiguration",
  "patchOperationsStoreQrConfiguration",
]);

export class ExternalCollaborationBusinessChannelSeedFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

const fail = (code) => { throw new ExternalCollaborationBusinessChannelSeedFailure(code); };
const compact = (value) => String(value ?? "UNKNOWN").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, 240);
const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const readJson = (file, code) => {
  if (!fs.existsSync(file)) fail(`${code}_MISSING`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { fail(`${code}_INVALID`); }
};
const required = (value, code) => { if (value === undefined || value === null || value === "") fail(code); return value; };
const dataOf = (json) => json?.result ?? json?.data?.result ?? json?.data ?? json;
const versionOf = (json, code) => {
  const value = Number(dataOf(json)?.version ?? json?.version);
  if (!Number.isInteger(value) || value < 0) fail(code);
  return value;
};
const revisionOf = (json, code) => {
  const value = Number(dataOf(json)?.revision ?? dataOf(json)?.version ?? json?.revision ?? json?.version);
  if (!Number.isInteger(value) || value < 0) fail(code);
  return value;
};
const stringOf = (json, field, code) => {
  const value = dataOf(json)?.[field] ?? json?.[field];
  if (typeof value !== "string" || !value) fail(code);
  return value;
};
const problemCodeOf = (json) => dataOf(json)?.errorCode ?? dataOf(json)?.code ?? json?.errorCode ?? json?.code;
export function validateStoreCandidateBlock({status, json, code}) {
  const expectedProblem = status === 403
    ? "PLATFORM_COMMON_ACCESS_DENIED"
    : status === 409
      ? "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE"
      : null;
  const actualProblem = problemCodeOf(json);
  if (expectedProblem === null || actualProblem !== expectedProblem) fail(`${code}:${actualProblem ?? "UNKNOWN"}`);
  return actualProblem;
}
const cookieFromHeaders = (headers) => headers.get("set-cookie")?.split(",").map((part) => part.split(";", 1)[0].trim()).filter(Boolean).join("; ") || null;

function writeJsonAtomically(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

function loadManagedRun() {
  const manifest = readJson(path.join(runtimeRoot, "run-manifest.json"), "EXTERNAL_BUSINESS_CHANNEL_SEED_MANAGED_RUN_MANIFEST");
  if (manifest.kind !== "r5-dev-run-manifest" || manifest.freshDatabase !== true || typeof manifest.runId !== "string") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_MANAGED_RUN_INVALID");
  if (typeof manifest.localHttpBaseUrl !== "string" || !/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(manifest.localHttpBaseUrl)) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_MANAGED_HTTP_INVALID");
  try { validateRemoteJavaControl(manifest.remoteJava); validateManagedDiagnosticTransport(manifest); }
  catch { fail("EXTERNAL_BUSINESS_CHANNEL_SEED_MANAGED_BINDING_INVALID"); }
  for (const process of manifest.processes ?? []) {
    const probe = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {encoding: "utf8"});
    if (probe.status !== 0 || canonicalStartToken(probe.stdout) !== canonicalStartToken(process.startToken)) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_MANAGED_PROCESS_INVALID:${process.name}`);
  }
  const credentialsFile = manifest.credentialsFile;
  if (!credentialsFile || !fs.existsSync(credentialsFile) || (fs.statSync(credentialsFile).mode & 0o777) !== 0o600) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_MANAGED_CREDENTIALS_INVALID");
  const credentials = Object.fromEntries(fs.readFileSync(credentialsFile, "utf8").split("\n").filter(Boolean).map((line) => line.split("=", 2)));
  let environment;
  try { environment = managedSeedEnvironment(manifest, credentials); }
  catch (error) { fail(error instanceof FormalSeedFailure ? error.code : "EXTERNAL_BUSINESS_CHANNEL_SEED_MANAGED_ENVIRONMENT_INVALID"); }
  return Object.freeze({manifest, credentials, environment});
}

/** Parent-only runtime admission. Static plan modes do not require this context. */
export function validateParentSeedContext({context, parentManifest, contextPath, parentRuntimeRoot = runtimeRoot}) {
  const resolvedRoot = path.resolve(parentRuntimeRoot);
  const resolvedContext = path.resolve(contextPath ?? "");
  if (!resolvedContext.startsWith(`${resolvedRoot}${path.sep}`)) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_PATH_INVALID");
  if (context?.schemaVersion !== 1 || context?.kind !== "r5-complete-seed-child-context" || context?.profile !== "r5-full" || context?.stageId !== stageId || typeof context?.runId !== "string" || !context.runId || typeof context?.managedDevRunId !== "string" || !context.managedDevRunId || !/^[0-9a-f]{64}$/.test(context?.tokenSha256 ?? "")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_INVALID");
  const expectedPath = path.join(resolvedRoot, "seed", "complete", context.runId, `${stageId}-context.json`);
  if (resolvedContext !== expectedPath) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_PATH_INVALID");
  if (parentManifest?.kind !== "r5-complete-seed-manifest" || parentManifest?.profile !== "r5-full" || parentManifest?.runId !== context.runId || parentManifest?.managedDevRunId !== context.managedDevRunId) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_MANIFEST_INVALID");
  if (!parentManifest.phases?.some((entry) => entry?.stage === stageId && entry?.status === "RUNNING")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_STAGE_NOT_RUNNING");
  return Object.freeze({runId: context.runId, managedDevRunId: context.managedDevRunId, contextPath: resolvedContext});
}

function loadParentSeedContext() {
  const contextPath = process.env.R5_COMPLETE_SEED_CHILD_CONTEXT;
  const token = process.env.R5_COMPLETE_SEED_CHILD_TOKEN;
  if (typeof contextPath !== "string" || !contextPath || typeof token !== "string" || !token) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_REQUIRED");
  const resolvedContext = path.resolve(contextPath);
  if (!resolvedContext.startsWith(`${runtimeRoot}${path.sep}`) || !fs.existsSync(resolvedContext) || (fs.statSync(resolvedContext).mode & 0o777) !== 0o600) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_PATH_INVALID");
  const context = readJson(resolvedContext, "EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT");
  const parentManifestPath = path.join(path.dirname(resolvedContext), "run-manifest.json");
  if (!fs.existsSync(parentManifestPath) || (fs.statSync(parentManifestPath).mode & 0o777) !== 0o600) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_MANIFEST_INVALID");
  if (sha256(token) !== context.tokenSha256) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_TOKEN_INVALID");
  const parent = validateParentSeedContext({context, parentManifest: readJson(parentManifestPath, "EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_MANIFEST"), contextPath: resolvedContext});
  const claimPath = `${resolvedContext}.claimed`;
  try { fs.writeFileSync(claimPath, `${JSON.stringify({parentRunId: parent.runId, stageId, claimedAt: new Date().toISOString()})}\n`, {encoding: "utf8", mode: 0o600, flag: "wx"}); fs.chmodSync(claimPath, 0o600); }
  catch (error) { if (error?.code === "EEXIST") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_ALREADY_CLAIMED"); fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_CLAIM_FAILED"); }
  return parent;
}

function organizationFactByKey(fixture, sourceFixtureKey, nodeType) {
  const collections = {COMMERCIAL_GROUP: "commercialGroups", REGION: "regions", PROJECT: "projects", HEAD_COMPANY: "headCompanies", STORE: "stores"};
  const value = fixture?.stableFixtures?.organization?.[collections[nodeType]]?.find((entry) => entry.key === sourceFixtureKey);
  if (!value) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_OWNER_SOURCE_MISSING:${sourceFixtureKey}`);
  return value;
}

/** Pure admission for source/plan/contract drift before any DEV write. */
export function validateRuntimeSeedStaticInputs({fixture, staticPlan, registry, catalog}) {
  validateSeedPlan(staticPlan);
  if (fixture?.profile?.id !== "r5-full" || fixture?.profile?.version !== 1) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PROFILE_INVALID");
  if (!Array.isArray(registry)) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_REGISTRY_INVALID");
  for (const operationId of requiredOperationIds) if (registry.filter((entry) => entry.operationId === operationId).length !== 1) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_OPERATION_MISSING:${operationId}`);
  const providerCodes = new Set(catalog?.providerProfiles?.map((entry) => entry.providerCode));
  if (providerCodes.size === 0) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_CATALOG_INVALID");
  const dataset = staticPlan.seedDatasets?.[0]; const entities = dataset?.entities;
  if (!entities) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_DATASET_INVALID");
  const ownerRefs = new Map();
  for (const owner of entities.ownerNodes ?? []) {
    const source = organizationFactByKey(fixture, owner.sourceFixtureKey, owner.nodeType);
    if (source.name !== owner.name) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_OWNER_NAME_DRIFT:${owner.code}`);
    if (owner.nodeType === "STORE") {
      const project = organizationFactByKey(fixture, "project-river", "PROJECT");
      if (source.project !== project.key || owner.projectRef !== "COLLAB-PROJECT") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_PROJECT_DRIFT");
    }
    ownerRefs.set(owner.code, owner);
  }
  const projectRole = fixture.stableFixtures.workspaceIam.roles.find((entry) => entry.key === "role-project");
  const storeRole = fixture.stableFixtures.workspaceIam.roles.find((entry) => entry.key === "role-store");
  if (!projectRole?.actionCapabilityKeys?.includes("BC-BUSINESS-CHANNEL-PROJECT-EDIT")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PROJECT_GRANT_MISSING");
  if (!storeRole?.actionCapabilityKeys?.includes("BC-BUSINESS-CHANNEL-STORE-EDIT")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_GRANT_MISSING");
  if (!storeRole?.actionCapabilityKeys?.includes("EDIT_STORE_SERVICE_POINT_QR")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_QR_GRANT_MISSING");
  const servicePointFixture = fixture.stableFixtures.organization.storeServicePoints;
  if (!servicePointFixture?.qr?.enabled || fixture.stableFixtures.organization.stores.find((entry) => entry.key === servicePointFixture.store)?.operatingRuleSwitches?.tableManagementEnabled !== true) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_QR_GATE_MISSING");
  const assignments = fixture.stableFixtures.workspaceIam.assignments ?? [];
  if (!assignments.some((entry) => entry.account === "account-multi-role" && entry.role === "role-project" && entry.node === "project-river")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PROJECT_IDENTITY_MISSING");
  if (!assignments.some((entry) => entry.account === "account-single-role" && entry.role === "role-store" && entry.node === "store-operating")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_IDENTITY_MISSING");
  if (!assignments.some((entry) => entry.account === "account-multi-role" && entry.role === "role-store" && entry.node === "store-preparing")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_SECOND_STORE_IDENTITY_MISSING");
  const enablements = entities.enablements ?? [];
  if (enablements.length !== 6 || new Set(enablements.map((entry) => entry.providerCode)).size !== enablements.length || enablements.some((entry) => entry.status !== "ENABLED" || !providerCodes.has(entry.providerCode))) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_ENABLEMENT_PLAN_INVALID");
  const bindingsByCode = new Map((entities.bindings ?? []).map((entry) => [entry.code, entry]));
  const templatesByCode = new Map((entities.templates ?? []).map((entry) => [entry.code, entry]));
  if (templatesByCode.size !== 10) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_TEMPLATE_DENOMINATOR_INVALID");
  for (const template of templatesByCode.values()) {
    if (typeof template.templateName !== "string" || !template.templateName || typeof template.code !== "string" || !template.code) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_TEMPLATE_INPUT_MISSING:${template.code ?? "UNKNOWN"}`);
    if (template.accessKind === "EXTERNAL" && (!providerCodes.has(template.providerCode) || !enablements.some((entry) => entry.providerCode === template.providerCode))) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_EXTERNAL_TEMPLATE_PROVIDER_INVALID:${template.code}`);
    if (template.accessKind === "INTERNAL" && template.providerCode !== null) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_INTERNAL_TEMPLATE_PROVIDER_INVALID:${template.code}`);
  }
  const channelCodes = new Set();
  for (const channel of entities.channels ?? []) {
    if (typeof channel.channelCode !== "string" || !channel.channelCode || channelCodes.has(channel.channelCode)) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_CHANNEL_CODE_INVALID:${channel.code ?? "UNKNOWN"}`);
    channelCodes.add(channel.channelCode);
    const owner = ownerRefs.get(channel.ownerNodeRef); const template = templatesByCode.get(channel.templateRef);
    if (!owner || !template || owner.nodeType !== channel.ownerNodeType || template.ownerNodeType !== channel.operatorKind) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_CHANNEL_REFERENCE_INVALID:${channel.code}`);
    if (channel.accessKind === "EXTERNAL") {
      const binding = bindingsByCode.get(channel.bindingRef);
      if (!binding || binding.providerCode !== template.providerCode || binding.nodeRef !== channel.ownerNodeRef || binding.capabilityClass !== channel.orderKind) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_EXTERNAL_BINDING_INVALID:${channel.code}`);
    } else if (channel.bindingRef !== null) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_INTERNAL_BINDING_FORBIDDEN:${channel.code}`);
  }
  return Object.freeze({fixture, staticPlan, registry, catalog, dataset, ownerRefs, templatesByCode, bindingsByCode, planDigest: sha256(JSON.stringify({revision: staticPlan.revision, entities, requiredOperationIds}))});
}

function loadStaticInputs() {
  return validateRuntimeSeedStaticInputs({fixture: readJson(fixturePath, "EXTERNAL_BUSINESS_CHANNEL_SEED_FIXTURE"), staticPlan: seedPlan, registry: loadGeneratedOperationRegistry(registryPath), catalog: readJson(catalogPath, "EXTERNAL_BUSINESS_CHANNEL_SEED_CATALOG")});
}

/** Retained plan-only entry for static CI and parent preflight. */
export function buildStaticSeedPlan() {
  const inputs = loadStaticInputs();
  return Object.freeze({schemaVersion: 2, kind: "external-collaboration-business-channel-seed-child-plan", stageId, status: "STATIC_PLAN_ONLY", business: "NOT_RUN", cleanup: "NOT_APPLICABLE_STATIC_ONLY", noDirectDatabaseWrites: true, noRuntimeExecution: true, requiresManagedParentRunId: true, seedPlanRevision: seedPlan.revision, acceptanceScenarioIds: [...seedPlan.acceptanceScenarioIds], runtimePlanDigest: inputs.planDigest});
}

export function validateStaticSeedPlan(input) {
  if (input?.kind !== "external-collaboration-business-channel-seed-child-plan" || input.stageId !== stageId || input.status !== "STATIC_PLAN_ONLY" || input.business !== "NOT_RUN" || input.cleanup !== "NOT_APPLICABLE_STATIC_ONLY" || input.noDirectDatabaseWrites !== true || input.noRuntimeExecution !== true || input.requiresManagedParentRunId !== true || JSON.stringify(input.acceptanceScenarioIds) !== JSON.stringify(acceptanceScenarioIds) || typeof input.runtimePlanDigest !== "string") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STATIC_PLAN_INVALID");
  return input;
}

function writePlanIfRequested(plan) {
  const output = process.env.EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_PLAN_OUTPUT;
  if (!output) return;
  const resolved = path.resolve(root, output);
  if (!resolved.startsWith(`${root}${path.sep}`)) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PLAN_OUTPUT_ESCAPE");
  writeJsonAtomically(resolved, plan);
  process.stdout.write(`STATIC_CHILD_PLAN_OUTPUT=${path.relative(root, resolved)}\n`);
}

async function executeManagedSeed() {
  const runId = `external-business-channel-seed-${crypto.randomUUID()}`;
  const directory = path.join(runtimeRoot, "seed", stageId, runId);
  const manifestPath = path.join(directory, "run-manifest.json");
  const reportPath = path.join(directory, "seed-report.json");
  const startedAt = new Date().toISOString();
  const phases = []; const calls = [];
  let parent = null; let managed = null; let inputs = null; let measurement = null; let business = "RUNNING"; let cleanup = "RUNNING"; let firstFailure = null;
  const persist = () => writeJsonAtomically(manifestPath, {schemaVersion: 2, kind: "external-collaboration-business-channel-seed-manifest", runId, stageId, parentSeedRunId: parent?.runId ?? null, managedDevRunId: managed?.manifest?.runId ?? null, startedAt, business, cleanup, firstFailure, noDirectDatabaseWrites: true, phases});
  const phase = (name, status, detail = {}) => { phases.push({at: new Date().toISOString(), stage: name, status, ...detail}); persist(); };
  // Publish both receipt paths before any runtime work.  A child that fails
  // while finalizing its report must remain discoverable by the parent.
  persist();
  process.stdout.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_STARTED; RUN_MANIFEST=${manifestPath}; REPORT=${reportPath}\n`);
  try {
    parent = loadParentSeedContext(); inputs = loadStaticInputs(); managed = loadManagedRun(); measurement = measurementMetadataForReport(managed.manifest);
    if (parent.managedDevRunId !== managed.manifest.runId) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_MANAGED_RUN_MISMATCH");
    phase("PREFLIGHT", "PASS", {parentSeedRunId: parent.runId, managedDevRunId: managed.manifest.runId, runtimePlanDigest: inputs.planDigest});
  } catch (error) {
    firstFailure = error.code ?? compact(error.message); business = "FAIL"; cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("PREFLIGHT", "FAIL", {reason: firstFailure}); phase("SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", persistentSeedProcess: false, resetRequiredBeforeRerun: true});
    const report = {schemaVersion: 2, kind: "external-collaboration-business-channel-seed-report", runId, stageId, parentSeedRunId: parent?.runId ?? null, managedDevRunId: null, startedAt, finishedAt: new Date().toISOString(), status: business, business, cleanup, firstFailure, phases, calls, noDirectDatabaseWrites: true};
    try { writeSeedReportPair(reportPath, report); } catch { /* preserve primary preflight failure */ }
    process.stderr.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED=REFUSED; REASON=${firstFailure}; RUN_MANIFEST=${manifestPath}; REPORT=${reportPath}\n`); process.exitCode = 2; return;
  }
  const requestKey = (name) => `r5-external-${sha256(`${runId}:${name}`).slice(0, 48)}`;
  const request = async (name, operationId, pathParameters = {}, options = {}) => {
    const operation = resolveGeneratedOperationById(inputs.registry, operationId);
    const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters: options.queryParameters ?? {}});
    const began = Date.now(); const correlationId = crypto.randomUUID();
    const headers = {Accept: "application/json", ...buildManagedDiagnosticHeaders({manifest: managed.manifest, credentials: managed.credentials, operationId, routeTemplate: operation.path, correlationId})};
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (operation.method !== "GET") headers["Idempotency-Key"] = requestKey(name);
    let response;
    try {
      response = await fetch(`${managed.environment.V2S_DEV_HTTP_BASE_URL}${pathname}`, {method: operation.method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(15_000)});
    } catch {
      firstFailure ??= `${name}_NETWORK`;
      calls.push({stageId: name, managedDevRunId: managed.manifest.runId, owner: operation.owner, consumerFace: operation.consumerFaces?.join(",") ?? null, operationId, method: operation.method, routeTemplate: operation.path, status: 0, durationMs: Date.now() - began, outcome: "FAILED", correlationId, requestId: null});
      phase(name, "FAIL", {operationId, httpStatus: 0}); fail(firstFailure);
    }
    const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* classify by HTTP below */ }
    const expected = options.expected ?? [200]; const accepted = expected.includes(response.status); const requestId = response.headers.get("x-request-id");
    calls.push({stageId: name, managedDevRunId: managed.manifest.runId, owner: operation.owner, consumerFace: operation.consumerFaces?.join(",") ?? null, operationId, method: operation.method, routeTemplate: operation.path, status: response.status, durationMs: Date.now() - began, outcome: accepted ? "SUCCEEDED" : "FAILED", correlationId: response.headers.get("x-correlation-id") ?? correlationId, requestId});
    phase(name, accepted ? "PASS" : "FAIL", {operationId, httpStatus: response.status, requestId, ...(accepted ? {} : {problemCode: json?.errorCode ?? json?.code ?? "UNCLASSIFIED"})});
    if (!accepted) { firstFailure ??= `${name}_HTTP_${response.status}_${json?.errorCode ?? json?.code ?? "UNCLASSIFIED"}`; fail(firstFailure); }
    return {json, cookie: cookieFromHeaders(response.headers), status: response.status};
  };
  const assertChannel = (json, expected, ownerRef, templateRef, bindingRef = null) => {
    const actual = dataOf(json);
    if (actual?.templateRef !== templateRef || actual?.ownerNodeType !== expected.ownerNodeType || actual?.ownerNodeRef !== ownerRef || actual?.channelCode !== expected.channelCode || actual?.channelName !== expected.channelName || actual?.status !== expected.status || (actual?.bindingRef ?? null) !== bindingRef) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_CHANNEL_READBACK_INVALID:${expected.code}`);
    return actual;
  };
  try {
    const platformLogin = await request("platform-login", "platformPasswordLogin", {}, {body: {accountName: "root", password: managed.credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD}});
    const platformCookie = required(platformLogin.cookie, "EXTERNAL_BUSINESS_CHANNEL_SEED_PLATFORM_SESSION_MISSING");
    await request("platform-session", "getCurrentPlatformSession", {}, {cookie: platformCookie});
    for (const enablement of inputs.dataset.entities.enablements) {
      const current = await request(`provider-detail-${enablement.providerCode}`, "getPlatformProviderProfileDetail", {groupWorkspaceKey: "aurora", providerCode: enablement.providerCode}, {cookie: platformCookie});
      const value = dataOf(current.json);
      if (value?.providerCode !== enablement.providerCode) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_PROVIDER_READBACK_INVALID:${enablement.providerCode}`);
      if (value?.enablementStatus !== enablement.status) {
        const updated = await request(`provider-enable-${enablement.providerCode}`, "transitionPlatformProviderProfileStatus", {groupWorkspaceKey: "aurora", providerCode: enablement.providerCode}, {cookie: platformCookie, body: {status: enablement.status, expectedVersion: versionOf(current.json, `EXTERNAL_BUSINESS_CHANNEL_SEED_PROVIDER_VERSION_INVALID:${enablement.providerCode}`)}});
        if (dataOf(updated.json)?.enablementStatus !== "ENABLED") fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_PROVIDER_ENABLEMENT_INVALID:${enablement.providerCode}`);
      }
    }
    const loginOperations = async (name, loginName, roleNodeType, roleName = null) => {
      const login = await request(`${name}-login`, "operationsWorkspacePasswordLogin", {groupWorkspaceKey: "aurora"}, {body: {loginName, password: managed.credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
      const cookie = required(login.cookie, `EXTERNAL_BUSINESS_CHANNEL_SEED_${name}_SESSION_MISSING`);
      let session = (await request(`${name}-session`, "getOperationsWorkspaceSessionEntry", {groupWorkspaceKey: "aurora"}, {cookie})).json;
      if (session?.outcome === "SELECT_IDENTITY") {
        const candidates = (session.candidates ?? []).filter((entry) => entry.roleNodeType === roleNodeType && (roleName === null || entry.roleName === roleName));
        if (candidates.length !== 1) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_${name}_IDENTITY_AMBIGUOUS`);
        session = (await request(`${name}-select-context`, "selectOperationsWorkspaceSessionContext", {groupWorkspaceKey: "aurora"}, {cookie, body: {roleAssignmentRef: candidates[0].roleAssignmentRef, requiredContextVersion: required(session.contextVersion, `EXTERNAL_BUSINESS_CHANNEL_SEED_${name}_CONTEXT_VERSION_MISSING`)}})).json;
      }
      const scopeKey = roleNodeType === "PROJECT" ? "project" : roleNodeType === "STORE" ? "store" : null;
      const ref = scopeKey === null ? session?.selected?.roleNodeRef : session?.scopeContext?.[scopeKey]?.dataNodeRef;
      if (typeof ref !== "string" || session?.selected?.roleNodeType !== roleNodeType || session.selected.roleNodeRef !== ref) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_${name}_SCOPE_INVALID`);
      return {cookie, ref, contextVersion: required(session.contextVersion, `EXTERNAL_BUSINESS_CHANNEL_SEED_${name}_CONTEXT_VERSION_MISSING`)};
    };
    const project = await loginOperations("project", "r5-account-multi-role", "PROJECT");
    const store = await loginOperations("store", "r5-account-single-role", "STORE");
    const storeB = await loginOperations("store-b", "r5-account-multi-role", "STORE", "门店商品管理员");
    const organization = await loginOperations("organization", "r5-account-multi-role", "GROUP", "集团运营管理员");
    const organizationProjectResponse = await request(
      "organization-project-select",
      "selectOperationsWorkspaceSessionDataNode",
      {groupWorkspaceKey: "aurora"},
      {cookie: organization.cookie, body: {dataNodeType: "PROJECT", dataNodeRef: project.ref, requiredContextVersion: organization.contextVersion}},
    );
    if (dataOf(organizationProjectResponse.json)?.scopeContext?.project?.dataNodeRef !== project.ref) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_ORGANIZATION_PROJECT_SCOPE_INVALID");
    const organizationProject = {...organization, contextVersion: required(dataOf(organizationProjectResponse.json)?.contextVersion, "EXTERNAL_BUSINESS_CHANNEL_SEED_ORGANIZATION_CONTEXT_VERSION_MISSING")};
    const ownerRefFor = (ownerNodeRef) => ownerNodeRef === "COLLAB-PROJECT" ? project.ref : ownerNodeRef === "COLLAB-STORE" ? store.ref : ownerNodeRef === "COLLAB-STORE-B" ? storeB.ref : fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_RUNTIME_OWNER_UNSUPPORTED:${ownerNodeRef}`);
    const templates = new Map();
    for (const template of inputs.dataset.entities.templates) {
      const created = await request(`template-create-${template.code}`, "createOperationsBusinessChannelTemplate", {groupWorkspaceKey: "aurora"}, {cookie: project.cookie, expected: [200], body: {projectRef: project.ref, templateName: template.templateName, templateCode: template.code, accessKind: template.accessKind, operatorKind: template.ownerNodeType, orderKind: template.orderKind, dineInForm: template.dineInForm ?? null, providerCode: template.providerCode ?? null, urlRule: template.urlRule ?? null, storeVisibilityScope: template.storeVisibilityScope ?? null, visibleStoreRefs: (template.visibleStoreRefs ?? []).map(ownerRefFor)}});
      const value = dataOf(created.json);
      if (value?.templateCode !== template.code || value?.templateName !== template.templateName || value?.projectRef !== project.ref || value?.status !== "ENABLED" || (value?.urlRule ?? null) !== (template.urlRule ?? null)) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_TEMPLATE_READBACK_INVALID:${template.code}`);
      templates.set(template.code, {ref: stringOf(created.json, "templateRef", `EXTERNAL_BUSINESS_CHANNEL_SEED_TEMPLATE_REF_MISSING:${template.code}`), name: template.templateName, version: versionOf(created.json, `EXTERNAL_BUSINESS_CHANNEL_SEED_TEMPLATE_VERSION_INVALID:${template.code}`)});
    }
    const channels = new Map();
    for (const channel of inputs.dataset.entities.channels) {
      const ownerRef = ownerRefFor(channel.ownerNodeRef); const client = channel.ownerNodeType === "PROJECT" ? project : channel.ownerNodeRef === "COLLAB-STORE-B" ? storeB : store; const template = templates.get(channel.templateRef);
      const created = await request(`channel-create-${channel.code}`, "createOperationsBusinessChannel", {groupWorkspaceKey: "aurora"}, {cookie: client.cookie, expected: [200], body: {templateRef: template.ref, ownerNodeType: channel.ownerNodeType, ownerNodeRef: ownerRef, channelCode: channel.channelCode, channelName: channel.channelName, bindingRef: null}});
      const createdValue = dataOf(created.json); const channelRef = stringOf(created.json, "channelRef", `EXTERNAL_BUSINESS_CHANNEL_SEED_CHANNEL_REF_MISSING:${channel.code}`);
      if (createdValue?.channelCode !== channel.channelCode || createdValue?.status !== (channel.accessKind === "EXTERNAL" ? "DISABLED" : "ENABLED")) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_CHANNEL_CREATE_INVALID:${channel.code}`);
      let finalJson = created.json; let bindingRef = null;
      if (channel.accessKind === "EXTERNAL") {
        const binding = inputs.bindingsByCode.get(channel.bindingRef);
        const attached = await request(`channel-binding-${channel.code}`, "createOperationsOwnerBinding", {groupWorkspaceKey: "aurora", channelRef}, {cookie: store.cookie, body: {providerCode: binding.providerCode, capabilityClass: binding.capabilityClass, nodeType: binding.nodeType, nodeRef: store.ref, bindingDisplayName: binding.bindingDisplayName, externalOwnerId: binding.externalOwnerId}});
        bindingRef = stringOf(attached.json, "bindingRef", `EXTERNAL_BUSINESS_CHANNEL_SEED_BINDING_REF_MISSING:${channel.code}`);
        const attachedChannel = await request(`channel-detail-after-binding-${channel.code}`, "getOperationsBusinessChannelDetail", {groupWorkspaceKey: "aurora", channelRef}, {cookie: store.cookie});
        const attachedValue = dataOf(attachedChannel.json);
        if (attachedValue?.bindingRef !== bindingRef || attachedValue?.status !== "DISABLED") fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_BINDING_ATTACH_INVALID:${channel.code}`);
        finalJson = (await request(`channel-enable-${channel.code}`, "transitionOperationsBusinessChannelStatus", {groupWorkspaceKey: "aurora", channelRef}, {cookie: store.cookie, body: {status: "ENABLED", expectedVersion: versionOf(attachedChannel.json, `EXTERNAL_BUSINESS_CHANNEL_SEED_CHANNEL_VERSION_INVALID:${channel.code}`)}})).json;
      } else if (channel.status === "DISABLED") {
        finalJson = (await request(`channel-disable-${channel.code}`, "transitionOperationsBusinessChannelStatus", {groupWorkspaceKey: "aurora", channelRef}, {cookie: client.cookie, body: {status: "DISABLED", expectedVersion: versionOf(created.json, `EXTERNAL_BUSINESS_CHANNEL_SEED_CHANNEL_VERSION_INVALID:${channel.code}`)}})).json;
      }
      assertChannel(finalJson, channel, ownerRef, template.ref, bindingRef);
      channels.set(channel.code, {channelRef, ownerRef, client, templateRef: template.ref, bindingRef});
    }
    for (const channel of inputs.dataset.entities.channels) {
      const created = channels.get(channel.code);
      const detail = await request(`channel-readback-${channel.code}`, "getOperationsBusinessChannelDetail", {groupWorkspaceKey: "aurora", channelRef: created.channelRef}, {cookie: created.client.cookie});
      assertChannel(detail.json, channel, created.ownerRef, created.templateRef, created.bindingRef);
    }
    const qrFixture = inputs.fixture.stableFixtures.organization.storeServicePoints?.qr;
    const qrChannel = channels.get(qrFixture?.channelCode);
    if (!qrFixture || qrFixture.enabled !== true || !qrChannel) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_QR_FIXTURE_INVALID");
    const qrCandidates = await request("store-qr-channel-candidates", "getOperationsStoreQrChannelCandidates", {groupWorkspaceKey: "aurora", storeRef: store.ref}, {cookie: store.cookie});
    const candidateItems = dataOf(qrCandidates.json)?.items ?? [];
    const qrCandidate = candidateItems.find((entry) => entry.channelRef === qrChannel.channelRef);
    if (!qrCandidate || qrCandidate.channelCode !== qrFixture.channelCode || qrCandidate.status !== "ENABLED" || qrCandidate.bindingStatus !== "NOT_REQUIRED") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_QR_CANDIDATE_READBACK_INVALID");
    const qrBefore = await request("store-qr-configuration-before", "getOperationsStoreQrConfiguration", {groupWorkspaceKey: "aurora", storeRef: store.ref}, {cookie: store.cookie});
    const qrBeforeValue = dataOf(qrBefore.json);
    if (qrBeforeValue?.enabled !== false || qrBeforeValue?.channelRef !== null) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_QR_DEFAULT_READBACK_INVALID");
    const qrUpdated = await request("store-qr-configuration-enable", "patchOperationsStoreQrConfiguration", {groupWorkspaceKey: "aurora", storeRef: store.ref}, {cookie: store.cookie, body: {enabled: true, channelRef: qrChannel.channelRef, expectedVersion: revisionOf(qrBefore.json, "EXTERNAL_BUSINESS_CHANNEL_SEED_QR_VERSION_INVALID")}});
    const qrUpdatedValue = dataOf(qrUpdated.json);
    if (qrUpdatedValue?.enabled !== true || qrUpdatedValue?.channelRef !== qrChannel.channelRef) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_QR_UPDATE_READBACK_INVALID");
    const qrAfter = await request("store-qr-configuration-after", "getOperationsStoreQrConfiguration", {groupWorkspaceKey: "aurora", storeRef: store.ref}, {cookie: store.cookie});
    const qrAfterValue = dataOf(qrAfter.json);
    if (qrAfterValue?.enabled !== true || qrAfterValue?.channelRef !== qrChannel.channelRef) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_QR_FINAL_READBACK_INVALID");
    phase("store-qr-configuration-readback", "PASS", {channelCode: qrFixture.channelCode, enabled: true, candidateCount: candidateItems.length});
    const mainTemplate = templates.get("TEMPLATE-STORE-INTERNAL-TAKEAWAY");
    const statusTemplate = templates.get("TEMPLATE-STORE-VISIBILITY-STATUS");
    if (!mainTemplate || !statusTemplate) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_VISIBILITY_TEMPLATE_READBACK_MISSING");
    const removedStore = await request(
      "template-remove-store-b-visibility",
      "updateOperationsBusinessChannelTemplate",
      {groupWorkspaceKey: "aurora", templateRef: mainTemplate.ref},
      {cookie: project.cookie, expected: [200], body: {templateName: mainTemplate.name, expectedVersion: mainTemplate.version, storeVisibilityScope: "SELECTED_PROJECT_STORES", visibleStoreRefs: [store.ref]}},
    );
    if (dataOf(removedStore.json)?.storeVisibilityScope !== "SELECTED_PROJECT_STORES" || dataOf(removedStore.json)?.visibleStoreCount !== 1) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_VISIBILITY_REMOVE_READBACK_INVALID");
    mainTemplate.version = versionOf(removedStore.json, "EXTERNAL_BUSINESS_CHANNEL_SEED_VISIBILITY_REMOVE_VERSION_INVALID");
    const retainedStoreB = await request(
      "store-b-channel-retained-after-visibility-remove",
      "getOperationsStoreBusinessChannels",
      {groupWorkspaceKey: "aurora", storeRef: storeB.ref},
      {cookie: storeB.cookie, queryParameters: {usage: "SALES_MENU", pageSize: 20}},
    );
    if (!(dataOf(retainedStoreB.json)?.items ?? []).some((entry) => entry.channelCode === "CHANNEL-STORE-INTERNAL-TAKEAWAY-B" && entry.status === "ENABLED")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_EXISTING_CHANNEL_NOT_RETAINED");
    const visibleStorePage = async (filter, name) => request(
      name,
      "getOperationsBusinessChannelTemplateVisibleStores",
      {groupWorkspaceKey: "aurora", templateRef: statusTemplate.ref},
      {cookie: project.cookie, queryParameters: {storeStatusFilter: filter, pageSize: 20}},
    );
    const assertStatusBlocked = async (suffix) => {
      const candidates = await request(
        `store-b-${suffix}-candidate-blocked`,
        "getOperationsStoreBusinessChannelTemplateCandidates",
        {groupWorkspaceKey: "aurora"},
        {cookie: storeB.cookie, expected: [403, 409], queryParameters: {projectRef: project.ref, storeRef: storeB.ref, pageSize: 20}},
      );
      validateStoreCandidateBlock({
        status: candidates.status,
        json: candidates.json,
        code: `EXTERNAL_BUSINESS_CHANNEL_SEED_${suffix}_CANDIDATE_PROBLEM_INVALID`,
      });
      const attemptedCode = `CHANNEL-STORE-VISIBILITY-BLOCKED-${suffix}`;
      const created = await request(
        `store-b-${suffix}-create-blocked`,
        "createOperationsBusinessChannel",
        {groupWorkspaceKey: "aurora"},
        {cookie: storeB.cookie, expected: [403, 409], body: {templateRef: statusTemplate.ref, ownerNodeType: "STORE", ownerNodeRef: storeB.ref, channelCode: attemptedCode, channelName: `状态门禁${suffix}`, bindingRef: null}},
      );
      validateStoreCandidateBlock({
        status: created.status,
        json: created.json,
        code: `EXTERNAL_BUSINESS_CHANNEL_SEED_${suffix}_CREATE_PROBLEM_INVALID`,
      });
      const channelsAfterReject = await request(
        `store-b-${suffix}-create-rejection-readback`,
        "getOperationsStoreBusinessChannels",
        {groupWorkspaceKey: "aurora", storeRef: storeB.ref},
        {cookie: organizationProject.cookie, queryParameters: {usage: "SALES_MENU", pageSize: 20}},
      );
      if ((dataOf(channelsAfterReject.json)?.items ?? []).some((entry) => entry.channelCode === attemptedCode)) fail(`EXTERNAL_BUSINESS_CHANNEL_SEED_${suffix}_REJECTED_CHANNEL_PERSISTED`);
    };
    const initialVisible = await visibleStorePage("ALL", "visibility-status-initial-readback");
    if (dataOf(initialVisible.json)?.total !== 1 || dataOf(initialVisible.json)?.items?.[0]?.storeRef !== storeB.ref || dataOf(initialVisible.json)?.items?.[0]?.storeStatus !== "ENABLED") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_VISIBILITY_INITIAL_READBACK_INVALID");
    const disabled = await request(
      "store-b-status-disabled",
      "transitionOperationsOrganizationStoreStatus",
      {groupWorkspaceKey: "aurora", storeId: storeB.ref},
      {cookie: organizationProject.cookie, expected: [200], body: {targetStatus: "DISABLED", expectedVersion: 1}},
    );
    if (dataOf(disabled.json)?.status !== "DISABLED") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_DISABLED_READBACK_INVALID");
    await assertStatusBlocked("disabled");
    const enabledAgain = await request(
      "store-b-status-enabled-again",
      "transitionOperationsOrganizationStoreStatus",
      {groupWorkspaceKey: "aurora", storeId: storeB.ref},
      {cookie: organizationProject.cookie, expected: [200], body: {targetStatus: "ENABLED", expectedVersion: revisionOf(disabled.json, "EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_DISABLED_REVISION_INVALID")}},
    );
    if (dataOf(enabledAgain.json)?.status !== "ENABLED") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_REENABLE_READBACK_INVALID");
    const voided = await request(
      "store-b-status-voided",
      "transitionOperationsOrganizationStoreStatus",
      {groupWorkspaceKey: "aurora", storeId: storeB.ref},
      {cookie: organizationProject.cookie, expected: [200], body: {targetStatus: "VOIDED", expectedVersion: revisionOf(enabledAgain.json, "EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_REENABLED_REVISION_INVALID")}},
    );
    if (dataOf(voided.json)?.status !== "VOIDED") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_STORE_VOIDED_READBACK_INVALID");
    await assertStatusBlocked("voided");
    const allWithVoided = await visibleStorePage("ALL", "visibility-status-voided-all-readback");
    const nonVoidedAfterVoid = await visibleStorePage("NON_VOIDED", "visibility-status-voided-non-voided-readback");
    if (dataOf(allWithVoided.json)?.total !== 1 || dataOf(allWithVoided.json)?.items?.[0]?.storeStatus !== "VOIDED") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_VOIDED_RELATION_READBACK_INVALID");
    if (dataOf(nonVoidedAfterVoid.json)?.total !== 0 || (dataOf(nonVoidedAfterVoid.json)?.items ?? []).length !== 0) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_VOIDED_COUNT_READBACK_INVALID");
    const retainedVoidedRelation = await request(
      "store-b-voided-relation-retained",
      "updateOperationsBusinessChannelTemplate",
      {groupWorkspaceKey: "aurora", templateRef: statusTemplate.ref},
      {cookie: project.cookie, expected: [200], body: {templateName: statusTemplate.name, expectedVersion: statusTemplate.version, storeVisibilityScope: "SELECTED_PROJECT_STORES", visibleStoreRefs: [storeB.ref]}},
    );
    statusTemplate.version = versionOf(retainedVoidedRelation.json, "EXTERNAL_BUSINESS_CHANNEL_SEED_VOIDED_RELATION_RETAIN_VERSION_INVALID");
    const allAfterNoop = await visibleStorePage("ALL", "visibility-status-voided-retained-readback");
    if (dataOf(allAfterNoop.json)?.total !== 1 || dataOf(allAfterNoop.json)?.items?.[0]?.storeStatus !== "VOIDED") fail("EXTERNAL_BUSINESS_CHANNEL_SEED_VOIDED_RELATION_NOT_RETAINED");
    const removedVoidedRelation = await request(
      "store-b-voided-relation-removed",
      "updateOperationsBusinessChannelTemplate",
      {groupWorkspaceKey: "aurora", templateRef: statusTemplate.ref},
      {cookie: project.cookie, expected: [200], body: {templateName: statusTemplate.name, expectedVersion: statusTemplate.version, storeVisibilityScope: "SELECTED_PROJECT_STORES", visibleStoreRefs: []}},
    );
    statusTemplate.version = versionOf(removedVoidedRelation.json, "EXTERNAL_BUSINESS_CHANNEL_SEED_VOIDED_RELATION_REMOVE_VERSION_INVALID");
    const allAfterRemove = await visibleStorePage("ALL", "visibility-status-voided-removed-readback");
    if (dataOf(allAfterRemove.json)?.total !== 0 || (dataOf(allAfterRemove.json)?.items ?? []).length !== 0) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_VOIDED_RELATION_NOT_REMOVED");
    const storeReadback = await request("store-sales-menu-channel-readback", "getOperationsStoreBusinessChannels", {groupWorkspaceKey: "aurora", storeRef: store.ref}, {cookie: store.cookie, queryParameters: {usage: "SALES_MENU", pageSize: 20}});
    const expectedEligible = inputs.dataset.entities.channels.filter((entry) => entry.ownerNodeType === "STORE" && entry.ownerNodeRef === "COLLAB-STORE" && entry.accessKind === "INTERNAL" && ["DINE_IN", "TAKEAWAY"].includes(entry.orderKind)).map((entry) => entry.channelCode).sort();
    const actualEligible = (dataOf(storeReadback.json)?.items ?? []).map((entry) => entry.channelCode).sort();
    if (JSON.stringify(actualEligible) !== JSON.stringify(expectedEligible)) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_ELIGIBLE_READBACK_INVALID");
    const projectReadback = await request("project-channel-readback", "getOperationsProjectBusinessChannels", {groupWorkspaceKey: "aurora", projectRef: project.ref}, {cookie: project.cookie});
    if (!(dataOf(projectReadback.json)?.items ?? []).some((entry) => entry.channelCode === "CHANNEL-PROJECT-INTERNAL-TAKEAWAY")) fail("EXTERNAL_BUSINESS_CHANNEL_SEED_PROJECT_READBACK_INVALID");
    business = "PASS"; cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("SEED_BUSINESS_READBACK", "PASS", {templates: templates.size, channels: channels.size, eligibleSalesMenuChannels: expectedEligible.length});
    phase("SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", persistentSeedProcess: false, destructiveCleanupOwner: "r5-reset"});
  } catch (error) {
    firstFailure ??= error.code ?? compact(error.message); business = "FAIL"; cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("SEED_BUSINESS", "FAIL", {reason: firstFailure});
    phase("SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", persistentSeedProcess: false, destructiveCleanupOwner: "r5-reset", resetRequiredBeforeRerun: true});
  }
  let events = [];
  try { events = readManagedDiagnosticEvents(managed.manifest); }
  catch (error) { firstFailure ??= error.code ?? compact(error.message); business = "FAIL"; phase("SEED_DIAGNOSTICS", "FAIL", {reason: firstFailure}); }
  let reportError = null;
  try {
    const report = {...buildSeedReport({runId, managedDevRunId: managed.manifest.runId, measurement, seedProfile: stageId, startedAt, finishedAt: new Date().toISOString(), status: business, businessStatus: business, cleanupStatus: cleanup, fixtureIdentity: {path: path.relative(root, fixturePath), version: inputs.fixture.profile.version, sha256: sha256(fs.readFileSync(fixturePath))}, calls, events, firstFailure}), schemaVersion: 2, kind: "external-collaboration-business-channel-seed-report", stageId, parentSeedRunId: parent.runId, business, cleanup, firstFailure, phases, noDirectDatabaseWrites: true, planDigest: inputs.planDigest, templateCount: inputs.dataset.entities.templates.length, channelCount: inputs.dataset.entities.channels.length};
    writeSeedReportPair(reportPath, report);
  } catch (error) {
    // Preserve the primary business failure and emit a safe, machine-readable
    // finalization failure instead of leaving the parent without a receipt.
    reportError = error?.code ?? "SEED_REPORT_FINALIZATION_FAILED";
    const fallback = {schemaVersion: 2, kind: "external-collaboration-business-channel-seed-report", runId, stageId, parentSeedRunId: parent.runId, managedDevRunId: managed.manifest.runId, startedAt, finishedAt: new Date().toISOString(), status: "FAIL", business, cleanup, firstFailure, reportError, phases, calls, noDirectDatabaseWrites: true};
    try { writeSeedReportPair(reportPath, fallback); } catch { reportError = "SEED_REPORT_FINALIZATION_FAILED"; }
  }
  persist();
  process.stdout.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED=${business}; CLEANUP=${cleanup}; RUN_MANIFEST=${manifestPath}; REPORT=${reportPath}; FIRST_FAILURE=${firstFailure ?? "NONE"}; REPORT_ERROR=${reportError ?? "NONE"}\n`);
  if (business !== "PASS") process.exitCode = 2;
}

function selfTest() {
  const staticPlan = buildStaticSeedPlan(); validateStaticSeedPlan(staticPlan);
  const fixture = readJson(fixturePath, "EXTERNAL_BUSINESS_CHANNEL_SEED_FIXTURE"); const registry = loadGeneratedOperationRegistry(registryPath); const catalog = readJson(catalogPath, "EXTERNAL_BUSINESS_CHANNEL_SEED_CATALOG");
  validateRuntimeSeedStaticInputs({fixture, staticPlan: seedPlan, registry, catalog});
  const expectRejected = (code, mutate) => {
    const nextFixture = structuredClone(fixture); const nextPlan = structuredClone(seedPlan); const nextRegistry = structuredClone(registry);
    mutate({fixture: nextFixture, plan: nextPlan, registry: nextRegistry});
    try { validateRuntimeSeedStaticInputs({fixture: nextFixture, staticPlan: nextPlan, registry: nextRegistry, catalog}); throw new Error(`EXTERNAL_BUSINESS_CHANNEL_SEED_RED_NOT_DETECTED:${code}`); }
    catch (error) { if (String(error.message).startsWith("EXTERNAL_BUSINESS_CHANNEL_SEED_RED_NOT_DETECTED")) throw error; }
  };
  expectRejected("MISSING_GENERATED_OPERATION", ({registry: next}) => next.splice(next.findIndex((entry) => entry.operationId === "createOperationsOwnerBinding"), 1));
  expectRejected("MISSING_TEMPLATE_PROVIDER", ({plan}) => { plan.seedDatasets[0].entities.templates.find((entry) => entry.code === "TEMPLATE-STORE-TAKEAWAY-A").providerCode = null; });
  expectRejected("CHANNEL_CODE_ABSENT", ({plan}) => { plan.seedDatasets[0].entities.channels[0].channelCode = null; });
  expectRejected("OWNER_SOURCE_DRIFT", ({fixture: next}) => { next.stableFixtures.organization.stores.find((entry) => entry.key === "store-operating").name = "错误门店"; });
  process.stdout.write("EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_EXECUTOR_SELF_TEST=PASS; RED=MISSING_GENERATED_OPERATION,MISSING_TEMPLATE_PROVIDER,CHANNEL_CODE_ABSENT,OWNER_SOURCE_DRIFT\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--self-test")) selfTest();
  else if (process.argv.includes("--plan-only")) {
    const staticPlan = buildStaticSeedPlan(); validateStaticSeedPlan(staticPlan); writePlanIfRequested(staticPlan);
    process.stdout.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_PLAN_ONLY=PASS; STAGE=${stageId}; PLAN_DIGEST=${staticPlan.runtimePlanDigest}\n`);
  } else if (!process.env.R5_COMPLETE_SEED_CHILD_CONTEXT) {
    process.stderr.write("EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED=REFUSED; REASON=RUN_FROM_R5_COMPLETE_SEED_ONLY\n"); process.exitCode = 2;
  } else {
    executeManagedSeed().catch((error) => { process.stderr.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED=REFUSED; REASON=${error.code ?? compact(error.message)}\n`); process.exitCode = 2; });
  }
}
