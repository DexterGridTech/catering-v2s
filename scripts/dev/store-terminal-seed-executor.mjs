#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {managedRuntime, managedSeedEnvironment, invocationKeyForTest} from "./owner-command-seed-executor.mjs";
import {buildManagedDiagnosticHeaders} from "./managed-diagnostic-protocol.mjs";
import {loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById} from "../test/seed-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, ".runtime/r5"));
const fixturePath = path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json");
const registryPath = path.join(root, "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json");
const GROUP_WORKSPACE_KEY = "aurora";

const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
const required = (value, code) => (value === undefined || value === null || value === "" ? fail(code) : value);
const canonicalLogin = (key) => `r5-${key}`.replaceAll(/[^a-z0-9-]/g, "-").slice(0, 60);

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
  async function request(stage, operationId, pathParameters = {}, {queryParameters = {}, cookie = null, body, expected = [200], idempotency = true} = {}) {
    const operation = resolveGeneratedOperationById(registry, operationId);
    const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters});
    const correlationId = `store-terminal-seed-${crypto.randomUUID()}`;
    const headers = {
      Accept: "application/json",
      ...buildManagedDiagnosticHeaders({manifest, credentials, operationId, routeTemplate: operation.path, correlationId}),
    };
    if (cookie) headers.Cookie = cookie;
    if (idempotency) headers["Idempotency-Key"] = invocationKeyForTest(runId, `${stage}-${sequence++}`);
    if (body !== undefined) { headers["Content-Type"] = "application/json"; }
    let response;
    try {
      response = await fetch(`${environment.V2S_DEV_HTTP_BASE_URL}${pathname}`, {
        method: operation.method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      calls.push({stage, operationId, status: 0, outcome: "FAILED"});
      fail(`${stage}_NETWORK`);
    }
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* the status remains authoritative */ }
    const accepted = expected.includes(response.status);
    calls.push({stage, operationId, status: response.status, outcome: accepted ? "PASS" : "FAIL"});
    if (!accepted) fail(`${stage}_HTTP_${response.status}_${json?.errorCode ?? "UNCLASSIFIED"}`);
    return {json, cookie: response.headers.get("set-cookie")?.split(";", 1)[0] ?? null, status: response.status};
  }

  const login = await request("group-login", "operationsWorkspacePasswordLogin", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    body: {loginName: canonicalLogin("account-multi-role"), password: required(credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD, "STORE_TERMINAL_SEED_PASSWORD_MISSING")},
  });
  const groupCookie = required(login.cookie, "STORE_TERMINAL_SEED_GROUP_COOKIE_MISSING");
  const session = await request("group-session", "getOperationsWorkspaceSessionEntry", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {cookie: groupCookie, idempotency: false});
  const stores = await request("store-list", "getOperationsOrganizationStores", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    idempotency: false,
    queryParameters: {expectedContextVersion: session.json?.contextVersion, page: 1, pageSize: 20, sort: "CODE", direction: "ASC"},
  });
  const store = (stores.json?.items ?? []).find((entry) => entry.code === "S-OP");
  const storeRef = required(store?.id, "STORE_TERMINAL_SEED_TARGET_STORE_MISSING");
  const selected = await request("group-store-select", "selectOperationsWorkspaceSessionDataNode", {groupWorkspaceKey: GROUP_WORKSPACE_KEY}, {
    cookie: groupCookie,
    body: {dataNodeRef: storeRef, dataNodeType: "STORE", requiredContextVersion: session.json?.contextVersion},
  });
  let created = 0;
  const readback = [];
  for (const terminal of terminals) {
    const result = await request(`terminal-create-${terminal.key}`, "postOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef}, {
      cookie: groupCookie,
      expected: [201],
      body: {name: terminal.name, deviceType: terminal.deviceType, activationCode: terminal.activationCode, configuration: terminal.configuration},
    });
    const terminalRef = required(result.json?.terminalRef, `STORE_TERMINAL_SEED_REF_MISSING:${terminal.key}`);
    let version = Number(result.json?.version);
    const detail = async (stage) => request(stage, "getOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef, terminalRef}, {cookie: groupCookie, idempotency: false});
    let current = (await detail(`terminal-readback-${terminal.key}`)).json;
    if (current.activationCode !== terminal.activationCode || current.name !== terminal.name) fail(`STORE_TERMINAL_SEED_CREATE_READBACK_INVALID:${terminal.key}`);
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
    created += 1;
    readback.push({key: terminal.key, terminalRef, name: current.name, status: current.status, version: current.version});
  }
  const page = await request("terminal-page-readback", "getOperationsStoreTerminals", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef}, {cookie: groupCookie, idempotency: false, queryParameters: {pageSize: 20}});
  if ((page.json?.items ?? []).length !== 8 || (page.json?.items ?? []).some((entry) => Object.hasOwn(entry, "activationCode"))) fail("STORE_TERMINAL_SEED_PAGE_READBACK_INVALID");

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
  const denied = await request("store-read-only-create", "postOperationsStoreTerminal", {groupWorkspaceKey: GROUP_WORKSPACE_KEY, storeRef}, {
    cookie: storeCookie,
    expected: [403],
    body: {name: "不应写入终端", deviceType: "laptop", activationCode: "62999999", configuration: {printers: [], functions: [{clientKey: "denied-ordering", functionKey: "ORDERING_CASHIER", ranges: [], scenes: []}]}},
  });
  if (denied.status !== 403) fail("STORE_TERMINAL_SEED_STORE_READ_ONLY_NOT_ENFORCED");

  const output = reportPath(runId);
  fs.mkdirSync(path.dirname(output), {recursive: true, mode: 0o700});
  fs.writeFileSync(output, `${JSON.stringify({schemaVersion: 1, managedDevRunId: runId, business: "PASS", cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS", created, readback, roleGroup: "EDIT", roleStore: "READ_ONLY", calls}, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`R5_STORE_TERMINAL_POST_STEP=PASS; REPORT=${output}; CREATED=${created}; READBACK=${readback.length}; ROLE_GROUP=EDIT; ROLE_STORE=READ_ONLY\n`);
}

function selfTest() {
  if (canonicalLogin("account-multi-role") !== "r5-account-multi-role") fail("STORE_TERMINAL_SEED_LOGIN_CANONICALIZATION_INVALID");
  process.stdout.write("R5_STORE_TERMINAL_SEED_SELF_TEST=PASS; RED=FIXED_CODE_AND_READ_ONLY_ASSERTIONS_RUNTIME\n");
}

if (process.argv.includes("--self-test")) selfTest();
else execute().catch((error) => { process.stderr.write(`R5_STORE_TERMINAL_POST_STEP=FAIL; REASON=${error.code ?? error.message}\n`); process.exitCode = 2; });
