#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {managedRuntime, managedSeedEnvironment, invocationKey} from "./owner-command-seed-executor.mjs";
import {buildManagedDiagnosticHeaders} from "./managed-diagnostic-protocol.mjs";
import {loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById} from "../test/seed-report.mjs";
import {createSeedHttpClient} from "./seed-http-client.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, ".runtime/r5"));
const fixturePath = path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json");
const registryPath = path.join(root, "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json");
const GROUP_WORKSPACE_KEY = "aurora";

const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
const required = (value, code) => (value === undefined || value === null || value === "" ? fail(code) : value);
const canonicalLogin = (key) => `r5-${key}`.replaceAll(/[^a-z0-9-]/g, "-").slice(0, 60);
const arrayOf = (value) => Array.isArray(value) ? value : [];
const unwrap = (json) => json?.data ?? json;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requiredUuid = (value, code) => {
  if (typeof value !== "string" || !uuidPattern.test(value)) fail(code);
  return value;
};
const compactJson = (value) => JSON.stringify(value, (_key, item) => Array.isArray(item) ? [...item].sort() : item);
const sorted = (values) => [...values].map(String).sort();

export function buildStoreTerminalSeedPlan(fixture) {
  const terminals = fixture?.stableFixtures?.organization?.storeTerminals;
  if (!Array.isArray(terminals) || terminals.length !== 8) fail("STORE_TERMINAL_SEED_PLAN_FIXTURE_DENOMINATOR_INVALID");
  const keys = terminals.map((terminal) => terminal?.key);
  if (keys.some((key) => typeof key !== "string" || key.length === 0) || new Set(keys).size !== keys.length)
    fail("STORE_TERMINAL_SEED_PLAN_KEYS_INVALID");
  const codes = terminals.map((terminal) => terminal?.activationCode);
  if (codes.some((code) => !/^[0-9]{8}$/.test(String(code))) || new Set(codes).size !== codes.length)
    fail("STORE_TERMINAL_SEED_PLAN_ACTIVATION_CODES_INVALID");
  for (const terminal of terminals) {
    const printers = arrayOf(terminal.configuration?.printers);
    const printerKeys = printers.map((printer) => printer?.clientKey);
    if (printerKeys.some((key) => typeof key !== "string" || key.length === 0) || new Set(printerKeys).size !== printerKeys.length)
      fail(`STORE_TERMINAL_SEED_PLAN_PRINTER_KEYS_INVALID:${terminal.key}`);
    for (const fn of arrayOf(terminal.configuration?.functions)) {
      if (typeof fn?.clientKey !== "string" || !fn.clientKey) fail(`STORE_TERMINAL_SEED_PLAN_FUNCTION_KEY_INVALID:${terminal.key}`);
      for (const scene of arrayOf(fn.scenes)) {
        for (const binding of arrayOf(scene?.printers)) {
          if (!printerKeys.includes(binding?.printerClientKey)) fail(`STORE_TERMINAL_SEED_PLAN_SCENE_PRINTER_INVALID:${terminal.key}`);
        }
      }
    }
    const areaKeys = new Set(arrayOf(terminal.configuration?.functions).flatMap((fn) => arrayOf(fn.ranges).filter((range) => range?.key === "TABLE_AREA").flatMap((range) => arrayOf(range.referenceKeys))));
    const tagCodes = new Set(arrayOf(terminal.configuration?.functions).flatMap((fn) => arrayOf(fn.ranges).filter((range) => range?.key === "PRODUCTION_TAG").flatMap((range) => arrayOf(range.referenceKeys))));
    resolveConfiguration(terminal.configuration, new Map([...areaKeys].map((key) => [key, key])), new Map([...tagCodes].map((code) => [code, code])), terminal.key);
  }
  const source = {keys, activationCodeCount: codes.length, terminalCount: terminals.length};
  const planDigest = crypto.createHash("sha256").update(`${JSON.stringify(source, null, 2)}\n`).digest("hex");
  return Object.freeze({
    schemaVersion: 1,
    kind: "store-terminal-seed-plan",
    status: "PASS",
    terminalCount: terminals.length,
    terminalKeys: keys,
    planDigest,
  });
}

function sessionIdentity(session, nodeType, expectedNodeRef = null) {
  const candidates = arrayOf(session?.candidates).filter((entry) => entry?.roleNodeType === nodeType);
  const chosen = expectedNodeRef
    ? candidates.find((entry) => String(entry.roleNodeRef) === String(expectedNodeRef))
    : candidates.length === 1 ? candidates[0] : null;
  return required(chosen, `STORE_TERMINAL_SEED_SESSION_IDENTITY_MISSING:${nodeType}`);
}

export function dataNodeCandidate(session, nodeType, expectedCode) {
  const candidates = arrayOf(session?.dataNodeCandidates).filter((entry) => entry?.dataNodeType === nodeType);
  const chosen = expectedCode
    ? candidates.find((entry) => entry.dataNodeCode === expectedCode)
    : candidates.length === 1 ? candidates[0] : null;
  return required(chosen, `STORE_TERMINAL_SEED_DATA_NODE_MISSING:${nodeType}:${expectedCode ?? "UNIQUE"}`);
}

export function mapAreaCandidateRefsByFixtureKey(candidates, fixtureAreas, referenceKeys, terminalKey) {
  const candidateByCode = new Map();
  for (const candidate of arrayOf(candidates)) {
    if (candidateByCode.has(candidate?.code)) fail("STORE_TERMINAL_SEED_CANDIDATE_CODE_DUPLICATE");
    candidateByCode.set(candidate?.code, candidate);
  }
  const fixtureAreaByKey = new Map(arrayOf(fixtureAreas).map((area) => [area?.key, area]));
  const resolved = new Map();
  for (const key of referenceKeys) {
    const fixtureArea = fixtureAreaByKey.get(key);
    const candidate = fixtureArea ? candidateByCode.get(fixtureArea.code) : null;
    if (!candidate) fail(`STORE_TERMINAL_SEED_REFERENCE_CANDIDATE_MISSING:${terminalKey}:TABLE_AREA:${key}`);
    resolved.set(key, requiredUuid(candidate.areaRef, "STORE_TERMINAL_SEED_AREA_CANDIDATE_REF_MISSING"));
  }
  return resolved;
}

export function expectedTerminalPageCount(terminals) {
  return arrayOf(terminals).filter((terminal) => terminal?.status !== "VOIDED").length;
}

export function validateTerminalPageReadback(items, detailReadback) {
  const details = arrayOf(detailReadback);
  const expected = new Map(details.filter((entry) => entry?.status !== "VOIDED").map((entry) => [entry.terminalRef, entry]));
  const actual = arrayOf(items);
  if (actual.length !== expected.size || actual.some((entry) => Object.hasOwn(entry, "activationCode")))
    fail("STORE_TERMINAL_SEED_PAGE_READBACK_INVALID");
  const seen = new Set();
  const listReadback = actual.map((entry) => {
    const terminalRef = requiredUuid(entry?.terminalRef, "STORE_TERMINAL_SEED_PAGE_READBACK_REF_INVALID");
    const detail = expected.get(terminalRef);
    if (!detail || seen.has(terminalRef) || entry.name !== detail.name || entry.status !== detail.status)
      fail("STORE_TERMINAL_SEED_PAGE_READBACK_IDENTITY_INVALID");
    seen.add(terminalRef);
    return {key: detail.key, terminalRef, name: entry.name, status: entry.status};
  });
  if (seen.size !== expected.size) fail("STORE_TERMINAL_SEED_PAGE_READBACK_KEYS_INVALID");
  return listReadback;
}

function resolvedReferenceKey(range, areaByKey, tagByCode, terminalKey) {
  const index = range.key === "TABLE_AREA" ? areaByKey : range.key === "PRODUCTION_TAG" ? tagByCode : null;
  return arrayOf(range.referenceKeys).map((key) => {
    const ref = index?.get(key);
    if (!ref) fail(`STORE_TERMINAL_SEED_REFERENCE_CANDIDATE_MISSING:${terminalKey}:${range.key}:${key}`);
    return ref;
  });
}

export function resolveConfiguration(configuration, areaByKey, tagByCode, terminalKey) {
  const printers = arrayOf(configuration?.printers).map((printer) => ({...printer}));
  const printerKeys = new Set(printers.map((printer) => printer.clientKey).filter(Boolean));
  if (printerKeys.size !== printers.length) fail(`STORE_TERMINAL_SEED_PRINTER_CLIENT_KEY_INVALID:${terminalKey}`);
  const functions = arrayOf(configuration?.functions).map((fn) => ({
    ...fn,
    ranges: arrayOf(fn.ranges).map((range) => ({
      key: range.key,
      all: Boolean(range.all),
      refs: resolvedReferenceKey(range, areaByKey, tagByCode, terminalKey),
    })),
    scenes: arrayOf(fn.scenes).map((scene) => ({
      sceneKey: scene.sceneKey,
      orderTypes: [...arrayOf(scene.orderTypes)],
      printers: arrayOf(scene.printers).map((binding) => {
        if (!printerKeys.has(binding.printerClientKey)) fail(`STORE_TERMINAL_SEED_SCENE_PRINTER_MISSING:${terminalKey}:${binding.printerClientKey}`);
        return {printerClientKey: binding.printerClientKey};
      }),
    })),
  }));
  return {printers, functions};
}

export function assertConfigurationReadback(actual, expected, terminalKey) {
  const actualPrinters = arrayOf(actual?.configuration?.printers);
  const expectedPrinters = arrayOf(expected?.printers);
  if (actualPrinters.length !== expectedPrinters.length) fail(`STORE_TERMINAL_SEED_PRINTER_COUNT_READBACK_INVALID:${terminalKey}`);
  const actualPrinterRefs = new Map();
  actualPrinters.forEach((printer, index) => {
    const expectedPrinter = expectedPrinters[index];
    const ref = requiredUuid(printer.ref, `STORE_TERMINAL_SEED_PRINTER_REF_MISSING:${terminalKey}`);
    actualPrinterRefs.set(expectedPrinter.clientKey, ref);
    const fields = ["name", "brandKey", "modelKey", "paperSpecKey", "connectionMethodKey", "connectionParameter"];
    for (const field of fields) if ((printer[field] ?? null) !== (expectedPrinter[field] ?? null)) fail(`STORE_TERMINAL_SEED_PRINTER_READBACK_INVALID:${terminalKey}:${field}`);
  });
  const actualFunctions = arrayOf(actual?.configuration?.functions);
  const expectedFunctions = arrayOf(expected?.functions);
  if (actualFunctions.length !== expectedFunctions.length) fail(`STORE_TERMINAL_SEED_FUNCTION_COUNT_READBACK_INVALID:${terminalKey}`);
  const actualFunctionRefs = new Map();
  actualFunctions.forEach((fn, index) => {
    const expectedFn = expectedFunctions[index];
    const functionRef = requiredUuid(fn.ref, `STORE_TERMINAL_SEED_FUNCTION_REF_MISSING:${terminalKey}`);
    actualFunctionRefs.set(expectedFn.clientKey, functionRef);
    if (fn.functionKey !== expectedFn.functionKey) fail(`STORE_TERMINAL_SEED_FUNCTION_READBACK_INVALID:${terminalKey}:functionKey`);
    const actualRanges = arrayOf(fn.ranges).map((range) => ({key: range.key, all: Boolean(range.all), refs: sorted(range.refs)})).sort((a, b) => a.key.localeCompare(b.key));
    const expectedRanges = arrayOf(expectedFn.ranges).map((range) => ({key: range.key, all: Boolean(range.all), refs: sorted(range.refs)})).sort((a, b) => a.key.localeCompare(b.key));
    if (compactJson(actualRanges) !== compactJson(expectedRanges)) fail(`STORE_TERMINAL_SEED_RANGE_READBACK_INVALID:${terminalKey}:${index}`);
    const actualScenes = arrayOf(fn.scenes).map((scene) => ({
      sceneKey: scene.sceneKey,
      orderTypes: sorted(scene.orderTypes),
      printers: sorted(arrayOf(scene.printers).map((binding) => binding.printerRef)),
    })).sort((a, b) => a.sceneKey.localeCompare(b.sceneKey));
    const expectedScenes = arrayOf(expectedFn.scenes).map((scene) => ({
      sceneKey: scene.sceneKey,
      orderTypes: sorted(scene.orderTypes),
      printers: sorted(arrayOf(scene.printers).map((binding) => actualPrinterRefs.get(binding.printerClientKey))),
    })).sort((a, b) => a.sceneKey.localeCompare(b.sceneKey));
    if (expectedScenes.some((scene) => scene.printers.includes(undefined))) fail(`STORE_TERMINAL_SEED_SCENE_PRINTER_REF_READBACK_INVALID:${terminalKey}`);
    if (compactJson(actualScenes) !== compactJson(expectedScenes)) fail(`STORE_TERMINAL_SEED_SCENE_READBACK_INVALID:${terminalKey}:${index}`);
  });
  return {
    printerRefs: [...actualPrinterRefs.values()],
    functionRefs: [...actualFunctionRefs.values()],
    printerRefsByClientKey: Object.fromEntries(actualPrinterRefs),
    functionRefsByClientKey: Object.fromEntries(actualFunctionRefs),
  };
}

function replaceConfigurationFromDetail(configuration) {
  return {
    printers: arrayOf(configuration?.printers).map((printer) => ({...printer, ref: requiredUuid(printer.ref, "STORE_TERMINAL_SEED_REPLACE_PRINTER_REF_MISSING")})),
    functions: arrayOf(configuration?.functions).map((fn) => ({
      ref: requiredUuid(fn.ref, "STORE_TERMINAL_SEED_REPLACE_FUNCTION_REF_MISSING"),
      functionKey: fn.functionKey,
      ranges: arrayOf(fn.ranges).map((range) => ({
        key: range.key,
        all: Boolean(range.all),
        refs: arrayOf(range.refs).map((ref) => requiredUuid(ref, "STORE_TERMINAL_SEED_REPLACE_RANGE_REF_MISSING")),
      })),
      scenes: arrayOf(fn.scenes).map((scene) => ({
        sceneKey: scene.sceneKey,
        orderTypes: [...arrayOf(scene.orderTypes)],
        printers: arrayOf(scene.printers).map((binding) => ({printerRef: requiredUuid(binding.printerRef, "STORE_TERMINAL_SEED_REPLACE_SCENE_PRINTER_REF_MISSING")})),
      })),
    })),
  };
}

function reportPath(runId) {
  return path.join(runtimeRoot, "seed", "store-terminal", runId, "post-step.json");
}

async function execute() {
  const {manifest, credentials} = managedRuntime();
  const environment = managedSeedEnvironment(manifest, credentials);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const terminals = fixture.stableFixtures.organization.storeTerminals;
  if (!Array.isArray(terminals) || terminals.length !== 8) fail("STORE_TERMINAL_SEED_FIXTURE_INVALID");
  const registry = loadGeneratedOperationRegistry(registryPath);
  const calls = [];
  const runId = required(manifest.runId, "STORE_TERMINAL_SEED_MANAGED_RUN_ID_REQUIRED");
  let sequence = 0;
  const request = createSeedHttpClient({
    baseUrl: environment.V2S_DEV_HTTP_BASE_URL,
    resolveOperation: operationId => resolveGeneratedOperationById(registry, operationId),
    materializeOperationPath: materializeGeneratedOperationPath,
    buildDiagnosticHeaders: buildManagedDiagnosticHeaders,
    manifest,
    credentials,
    calls,
    correlationPrefix: "store-terminal-seed",
    timeoutMs: 15_000,
    idempotencyKeyFor: stage => invocationKey(runId, `${stage}-${sequence++}`),
    failureFactory: code => {
      const error = new Error(code);
      error.code = code;
      return error;
    },
  }).request;

  async function readCandidatePages(stage, operationId, pathParameters, cookie) {
    const items = [];
    const seenCursors = new Set();
    let cursor = null;
    let total = null;
    for (let page = 0; page < 100; page += 1) {
      const result = await request(`${stage}-${page}`, operationId, pathParameters, {
        cookie,
        idempotency: false,
        queryParameters: {pageSize: 20, ...(cursor ? {cursor} : {})},
      });
      const data = unwrap(result.json);
      const pageItems = arrayOf(data?.items);
      const pageTotal = Number(data?.total);
      if (!Number.isInteger(pageTotal) || pageTotal < 0 || (total !== null && total !== pageTotal)) fail(`STORE_TERMINAL_SEED_CANDIDATE_PAGE_INVALID:${stage}`);
      total ??= pageTotal;
      items.push(...pageItems);
      const nextCursor = data?.nextCursor ?? null;
      if (nextCursor !== null && (typeof nextCursor !== "string" || nextCursor.length === 0 || seenCursors.has(nextCursor))) fail(`STORE_TERMINAL_SEED_CANDIDATE_CURSOR_INVALID:${stage}`);
      if (nextCursor === null) break;
      seenCursors.add(nextCursor);
      cursor = nextCursor;
      if (page === 99) fail(`STORE_TERMINAL_SEED_CANDIDATE_PAGE_LIMIT:${stage}`);
    }
    if (total !== items.length) fail(`STORE_TERMINAL_SEED_CANDIDATE_INCOMPLETE:${stage}`);
    return items;
  }

  const login = await request("group-login", "operationsWorkspacePasswordLogin", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    body: {loginName: canonicalLogin("account-multi-role"), password: required(credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD, "STORE_TERMINAL_SEED_PASSWORD_MISSING")},
  });
  const groupCookie = required(login.cookie, "STORE_TERMINAL_SEED_GROUP_COOKIE_MISSING");
  const session = await request("group-session", "getOperationsWorkspaceSessionEntry", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {cookie: groupCookie, idempotency: false});
  const groupIdentity = sessionIdentity(session.json, "GROUP");
  const groupContext = await request("group-context", "selectOperationsWorkspaceSessionContext", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    body: {roleAssignmentRef: groupIdentity.roleAssignmentRef, requiredContextVersion: session.json?.contextVersion},
  });
  const storeServicePointKey = required(fixture.stableFixtures.organization.storeServicePoints?.store, "STORE_TERMINAL_SEED_STORE_FIXTURE_MISSING");
  const storeFixture = required(
    fixture.stableFixtures.organization.stores?.find((entry) => entry.key === storeServicePointKey),
    "STORE_TERMINAL_SEED_STORE_FIXTURE_NOT_FOUND",
  );
  const projectFixture = required(
    fixture.stableFixtures.organization.projects?.find((entry) => entry.key === storeFixture.project),
    "STORE_TERMINAL_SEED_PROJECT_FIXTURE_NOT_FOUND",
  );
  const projectCandidate = dataNodeCandidate(groupContext.json, "PROJECT", projectFixture.code);
  const projectSelection = await request("group-project-select", "selectOperationsWorkspaceSessionDataNode", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    body: {dataNodeRef: projectCandidate.dataNodeRef, dataNodeType: "PROJECT", requiredContextVersion: groupContext.json?.contextVersion},
  });
  const stores = await request("store-list", "getOperationsOrganizationStores", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    idempotency: false,
    queryParameters: {expectedContextVersion: projectSelection.json?.contextVersion, page: 1, pageSize: 20, sort: "CODE", direction: "ASC"},
  });
  const store = (stores.json?.items ?? []).find((entry) => entry.code === "S-OP");
  const storeRef = required(store?.id, "STORE_TERMINAL_SEED_TARGET_STORE_MISSING");
  await request("group-store-select", "selectOperationsWorkspaceSessionDataNode", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    body: {dataNodeRef: storeRef, dataNodeType: "STORE", requiredContextVersion: projectSelection.json?.contextVersion},
  });
  const areaCandidates = await readCandidatePages(
    "group-area-candidates",
    "getOperationsStoreTerminalAreaCandidates",
    {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef},
    groupCookie,
  );
  const tagCandidates = await readCandidatePages(
    "group-tag-candidates",
    "getOperationsStoreTerminalTagCandidates",
    {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef},
    groupCookie,
  );
  const servicePointAreas = fixture.stableFixtures.organization.storeServicePoints?.areas;
  const tagByCode = new Map(tagCandidates.map((entry) => [entry.code, requiredUuid(entry.tagRef, "STORE_TERMINAL_SEED_TAG_CANDIDATE_REF_MISSING")]));
  if (tagByCode.size !== tagCandidates.length) fail("STORE_TERMINAL_SEED_CANDIDATE_CODE_DUPLICATE");
  let created = 0;
  const readback = [];
  const resolvedByKey = new Map();
  for (const terminal of terminals) {
    const areaReferenceKeys = new Set(arrayOf(terminal.configuration?.functions)
      .flatMap((fn) => arrayOf(fn.ranges))
      .filter((range) => range?.key === "TABLE_AREA" && !range.all)
      .flatMap((range) => arrayOf(range.referenceKeys)));
    const areaByKey = mapAreaCandidateRefsByFixtureKey(areaCandidates, servicePointAreas, areaReferenceKeys, terminal.key);
    const configuration = resolveConfiguration(terminal.configuration, areaByKey, tagByCode, terminal.key);
    const result = await request(`terminal-create-${terminal.key}`, "postOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef}, {
      cookie: groupCookie,
      expected: [201],
      body: {name: terminal.name, deviceType: terminal.deviceType, activationCode: terminal.activationCode, configuration},
    });
    const terminalRef = required(result.json?.terminalRef, `STORE_TERMINAL_SEED_REF_MISSING:${terminal.key}`);
    let version = Number(result.json?.version);
    const detail = async (stage) => request(stage, "getOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef, terminalRef}, {cookie: groupCookie, idempotency: false});
    let current = (await detail(`terminal-readback-${terminal.key}`)).json;
    if (current.activationCode !== terminal.activationCode || current.name !== terminal.name || current.deviceType !== terminal.deviceType) fail(`STORE_TERMINAL_SEED_CREATE_READBACK_INVALID:${terminal.key}`);
    const childRefs = assertConfigurationReadback(current, configuration, terminal.key);
    resolvedByKey.set(terminal.key, {terminalRef, configuration});
    if (terminal.status === "DISABLED" || terminal.status === "VOIDED") {
      const disabled = await request(`terminal-disable-${terminal.key}`, "postOperationsStoreTerminalStatus", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef, terminalRef}, {cookie: groupCookie, body: {status: "DISABLED", expectedVersion: Number(current.version)}});
      version = Number(disabled.json?.version);
      current = (await detail(`terminal-disabled-readback-${terminal.key}`)).json;
    }
    if (terminal.status === "VOIDED") {
      await request(`terminal-void-${terminal.key}`, "postOperationsStoreTerminalStatus", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef, terminalRef}, {cookie: groupCookie, body: {status: "VOIDED", expectedVersion: Number(current.version)}});
      current = (await detail(`terminal-voided-readback-${terminal.key}`)).json;
    }
    if (current.status !== terminal.status || current.name !== terminal.name || !/^[0-9]{8}$/.test(current.activationCode ?? "")) fail(`STORE_TERMINAL_SEED_STATUS_READBACK_INVALID:${terminal.key}`);
    const statusChildRefs = assertConfigurationReadback(current, configuration, terminal.key);
    if (compactJson(childRefs) !== compactJson(statusChildRefs)) fail(`STORE_TERMINAL_SEED_CHILD_REF_CHANGED:${terminal.key}`);
    created += 1;
    readback.push({
      key: terminal.key,
      terminalRef,
      name: current.name,
      status: current.status,
      version: current.version,
      printerRefs: childRefs.printerRefs,
      functionRefs: childRefs.functionRefs,
      printerRefsByClientKey: childRefs.printerRefsByClientKey,
      functionRefsByClientKey: childRefs.functionRefsByClientKey,
    });
  }
  const page = await request("terminal-page-readback", "getOperationsStoreTerminals", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef}, {cookie: groupCookie, idempotency: false, queryParameters: {pageSize: 20}});
  const listReadback = validateTerminalPageReadback(page.json?.items, readback);

  const projectEntry = await request("project-session", "getOperationsWorkspaceSessionEntry", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {cookie: groupCookie, idempotency: false});
  const projectIdentity = sessionIdentity(projectEntry.json, "PROJECT");
  const projectContext = await request("project-context", "selectOperationsWorkspaceSessionContext", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    body: {roleAssignmentRef: projectIdentity.roleAssignmentRef, requiredContextVersion: projectEntry.json?.contextVersion},
  });
  const projectStoreCandidate = dataNodeCandidate(projectContext.json, "STORE", "S-OP");
  const projectStoreSelection = await request("project-store-select", "selectOperationsWorkspaceSessionDataNode", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    body: {dataNodeRef: projectStoreCandidate.dataNodeRef, dataNodeType: "STORE", requiredContextVersion: projectContext.json?.contextVersion},
  });
  const projectStoreRef = requiredUuid(projectStoreSelection.json?.scopeContext?.store?.dataNodeRef ?? projectStoreCandidate.dataNodeRef, "STORE_TERMINAL_SEED_PROJECT_STORE_REF_MISSING");
  const projectTerminal = required(resolvedByKey.get("term-front"), "STORE_TERMINAL_SEED_PROJECT_FIXTURE_MISSING");
  const projectDetail = await request("project-terminal-readback", "getOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef: projectStoreRef, terminalRef: projectTerminal.terminalRef}, {cookie: groupCookie, idempotency: false});
  const projectBefore = unwrap(projectDetail.json);
  if (projectBefore.name !== "前台收银终端") fail("STORE_TERMINAL_SEED_PROJECT_READBACK_INVALID");
  const projectReplace = await request("project-terminal-edit", "putOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef: projectStoreRef, terminalRef: projectTerminal.terminalRef}, {
    cookie: groupCookie,
    body: {name: projectBefore.name, configuration: replaceConfigurationFromDetail(projectBefore.configuration), expectedVersion: Number(projectBefore.version)},
  });
  if (!Number.isFinite(Number(projectReplace.json?.version))) fail("STORE_TERMINAL_SEED_PROJECT_EDIT_READBACK_INVALID");
  const projectAfter = unwrap((await request("project-terminal-edit-readback", "getOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef: projectStoreRef, terminalRef: projectTerminal.terminalRef}, {cookie: groupCookie, idempotency: false})).json);
  const projectChildRefs = assertConfigurationReadback(projectAfter, projectTerminal.configuration, "term-front");
  const projectReadback = readback.find((entry) => entry.key === "term-front");
  if (!projectReadback) fail("STORE_TERMINAL_SEED_PROJECT_READBACK_ENTRY_MISSING");
  projectReadback.name = projectAfter.name;
  projectReadback.status = projectAfter.status;
  projectReadback.version = Number(projectAfter.version);
  projectReadback.printerRefs = projectChildRefs.printerRefs;
  projectReadback.functionRefs = projectChildRefs.functionRefs;
  projectReadback.printerRefsByClientKey = projectChildRefs.printerRefsByClientKey;
  projectReadback.functionRefsByClientKey = projectChildRefs.functionRefsByClientKey;

  const storeLogin = await request("store-login", "operationsWorkspacePasswordLogin", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    body: {loginName: canonicalLogin("account-single-role"), password: required(credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD, "STORE_TERMINAL_SEED_PASSWORD_MISSING")},
  });
  const storeCookie = required(storeLogin.cookie, "STORE_TERMINAL_SEED_STORE_COOKIE_MISSING");
  const storeSession = await request("store-session", "getOperationsWorkspaceSessionEntry", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {cookie: storeCookie, idempotency: false});
  await request("store-read-only-select", "selectOperationsWorkspaceSessionDataNode", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: storeCookie,
    body: {dataNodeRef: storeRef, dataNodeType: "STORE", requiredContextVersion: storeSession.json?.contextVersion},
  });
  await request("store-read-only-page", "getOperationsStoreTerminals", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef}, {cookie: storeCookie, idempotency: false, queryParameters: {pageSize: 20}});
  const storeReadOnlyTerminal = required(resolvedByKey.get("term-front"), "STORE_TERMINAL_SEED_STORE_READ_ONLY_FIXTURE_MISSING");
  const storeReadOnlyDetail = unwrap((await request(
    "store-read-only-detail",
    "getOperationsStoreTerminal",
    {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef, terminalRef: storeReadOnlyTerminal.terminalRef},
    {cookie: storeCookie, idempotency: false},
  )).json);
  if (!storeReadOnlyDetail?.terminalRef || !storeReadOnlyDetail.name || !storeReadOnlyDetail.configuration)
    fail("STORE_TERMINAL_SEED_STORE_READ_ONLY_DETAIL_INVALID");
  const storeReadOnlyBefore = {
    terminalRef: storeReadOnlyDetail.terminalRef,
    name: storeReadOnlyDetail.name,
    status: storeReadOnlyDetail.status,
    version: Number(storeReadOnlyDetail.version),
    configuration: compactJson(storeReadOnlyDetail.configuration),
  };
  const storeReadOnlyAreaCandidates = await readCandidatePages(
    "store-read-only-area-candidates",
    "getOperationsStoreTerminalAreaCandidates",
    {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef},
    storeCookie,
  );
  const storeReadOnlyTagCandidates = await readCandidatePages(
    "store-read-only-tag-candidates",
    "getOperationsStoreTerminalTagCandidates",
    {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef},
    storeCookie,
  );
  const deniedEdit = await request("store-read-only-edit", "putOperationsStoreTerminal", {
    groupWorkspaceKey: GROUP_WORKSPACE_KEY,
    storeRef,
    terminalRef: storeReadOnlyTerminal.terminalRef,
  }, {
    cookie: storeCookie,
    expected: [403],
    body: {
      name: storeReadOnlyDetail.name,
      configuration: replaceConfigurationFromDetail(storeReadOnlyDetail.configuration),
      expectedVersion: storeReadOnlyBefore.version,
    },
  });
  const deniedStatus = await request("store-read-only-status", "postOperationsStoreTerminalStatus", {
    groupWorkspaceKey: GROUP_WORKSPACE_KEY,
    storeRef,
    terminalRef: storeReadOnlyTerminal.terminalRef,
  }, {
    cookie: storeCookie,
    expected: [403],
    body: {status: "DISABLED", expectedVersion: storeReadOnlyBefore.version},
  });
  if (deniedEdit.status !== 403 || deniedStatus.status !== 403) fail("STORE_TERMINAL_SEED_STORE_READ_ONLY_WRITE_NOT_ENFORCED");
  const storeReadOnlyAfter = unwrap((await request(
    "store-read-only-detail-after-denial",
    "getOperationsStoreTerminal",
    {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef, terminalRef: storeReadOnlyTerminal.terminalRef},
    {cookie: storeCookie, idempotency: false},
  )).json);
  if (
    storeReadOnlyAfter.name !== storeReadOnlyBefore.name ||
    storeReadOnlyAfter.status !== storeReadOnlyBefore.status ||
    Number(storeReadOnlyAfter.version) !== storeReadOnlyBefore.version ||
    compactJson(storeReadOnlyAfter.configuration) !== storeReadOnlyBefore.configuration
  ) fail("STORE_TERMINAL_SEED_STORE_READ_ONLY_STATE_CHANGED");
  const denied = await request("store-read-only-create", "postOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef}, {
    cookie: storeCookie,
    expected: [403],
    body: {name: "不应写入终端", deviceType: "laptop", activationCode: "62999999", configuration: {printers: [], functions: [{clientKey: "denied-ordering", functionKey: "ORDERING_CASHIER", ranges: [], scenes: []}]}},
  });
  if (denied.status !== 403) fail("STORE_TERMINAL_SEED_STORE_READ_ONLY_NOT_ENFORCED");

  const output = reportPath(runId);
  fs.mkdirSync(path.dirname(output), {recursive: true, mode: 0o700});
  fs.writeFileSync(output, `${JSON.stringify({
    schemaVersion: 1,
    managedDevRunId: runId,
    business: "PASS",
    cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS",
    created,
    detailReadback: readback,
    listReadback,
    candidateCounts: {areas: areaCandidates.length, tags: tagCandidates.length},
    roleGroup: "EDIT",
    roleProject: "EDIT",
    roleStore: "READ_ONLY",
    roleStoreReadback: {
      terminalRef: storeReadOnlyBefore.terminalRef,
      status: storeReadOnlyBefore.status,
      version: storeReadOnlyBefore.version,
      areaCandidateCount: storeReadOnlyAreaCandidates.length,
      tagCandidateCount: storeReadOnlyTagCandidates.length,
      deniedEditStatus: deniedEdit.status,
      deniedStatusStatus: deniedStatus.status,
      deniedCreateStatus: denied.status,
      unchangedAfterDenial: true,
    },
    calls,
  }, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`R5_STORE_TERMINAL_POST_STEP=PASS; REPORT=${output}; CREATED=${created}; DETAIL_READBACK=${readback.length}; LIST_READBACK=${listReadback.length}; ROLE_GROUP=EDIT; ROLE_PROJECT=EDIT; ROLE_STORE=READ_ONLY\n`);
}

function planOnly() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const plan = buildStoreTerminalSeedPlan(fixture);
  process.stdout.write(`R5_STORE_TERMINAL_SEED_PLAN=PASS; TERMINALS=${plan.terminalCount}; PLAN_DIGEST=${plan.planDigest}\n`);
  return plan;
}

function selfTest() {
  if (canonicalLogin("account-multi-role") !== "r5-account-multi-role") fail("STORE_TERMINAL_SEED_LOGIN_CANONICALIZATION_INVALID");
  process.stdout.write("R5_STORE_TERMINAL_SEED_SELF_TEST=PASS; RED=FIXED_CODE_AND_FULL_CONFIGURATION_READBACK,CANDIDATE_RESOLUTION,PROJECT_EDIT,STORE_READ_ONLY\n");
}

// Keep helper imports side-effect free under Node's test runner.  Managed seed
// execution remains the only direct-entry path that invokes the networked
// post-step.
const isDirectExecution =
  !process.env.NODE_TEST_CONTEXT &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectExecution) {
  if (process.argv.includes("--self-test")) selfTest();
  else if (process.argv.includes("--plan-only")) {
    try { planOnly(); }
    catch (error) { process.stderr.write(`R5_STORE_TERMINAL_SEED_PLAN=FAIL; REASON=${error.code ?? error.message}\n`); process.exitCode = 2; }
  } else execute().catch((error) => { process.stderr.write(`R5_STORE_TERMINAL_POST_STEP=FAIL; REASON=${error.code ?? error.message}\n`); process.exitCode = 2; });
}
