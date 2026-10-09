#!/usr/bin/env node

import {hostTrustEnvironment, resolveTrustedRemoteHost} from "./r5-remote-host-trust.mjs";
import {loadTdsCapacityConfiguration} from "../env/tds-capacity-configuration.mjs";

const requiredSecrets = [
  "V2S_SEED_PLATFORM_ROOT_PASSWORD",
  "V2S_SEED_PLATFORM_SUPPORT_PASSWORD",
  "V2S_SEED_PLATFORM_DISABLED_PASSWORD",
  "V2S_SEED_OPERATIONS_DEFAULT_PASSWORD",
  "V2S_SEED_OPERATIONS_DISABLED_PASSWORD",
  "V2S_SEED_OTP_FIXED_VALUE",
];

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function databaseName(value) {
  const url = new URL(value.replace(/^jdbc:/, ""));
  return url.pathname.replace(/^\//, "");
}
function productionLike(value) { return /(?:^|[._/-])(?:prod|production)(?:$|[._/-])/i.test(value); }
function validPort(value, code) {
  if (!/^\d{4,5}$/.test(String(value ?? "")) || Number(value) < 1024 || Number(value) > 65535) fail(code);
  return String(value);
}
function validateTerminalBrowserOrigins(value) {
  if (value === undefined || value === "") return;
  const origins = String(value).split(",").map(origin => origin.trim());
  if (origins.some(origin => {
    const match = /^http:\/\/(localhost|127\.0\.0\.1):([0-9]{4,5})$/.exec(origin);
    return match === null || Number(match[2]) < 1024 || Number(match[2]) > 65535;
  }) || new Set(origins).size !== origins.length) {
    fail("R5_DEV_TERMINAL_BROWSER_CORS_ORIGINS_INVALID");
  }
}
function effectiveEnvironment(env, tdsCapacity) {
  const namespace = env.V2S_DEV_NAMESPACE ?? "v2s-dev-r5-full";
  const hostTrust = hostTrustEnvironment(env);
  const expectedDatabase = `catering_v2s_dev_${namespace.replace(/^v2s-dev-/, "").replaceAll("-", "_")}`;
  return {
    ...env,
    V2S_DEV_NAMESPACE: namespace,
    V2S_DEV_PROFILE: env.V2S_DEV_PROFILE ?? "r5-full",
    V2S_RUNTIME_ENVIRONMENT: env.V2S_RUNTIME_ENVIRONMENT ?? "non-production",
    // The managed TER Expo Web runner serves at 127.0.0.1:8093 by default.
    // Keep the DEV-only browser activation/cancel CORS origin explicit and narrow.
    V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS: env.V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS ?? "http://127.0.0.1:8093",
    ...hostTrust,
    // DEV Java now runs beside PostgreSQL on the trusted remote host.  This is
    // the Java-side URL; no local PostgreSQL tunnel is part of the topology.
    V2S_DEV_DATABASE_URL: env.V2S_DEV_DATABASE_URL ?? `jdbc:postgresql://127.0.0.1:5432/${expectedDatabase}`,
    V2S_DEV_REMOTE_HTTP_PORT: env.V2S_DEV_REMOTE_HTTP_PORT ?? "8080",
    V2S_DEV_REMOTE_ASSET_PORT: env.V2S_DEV_REMOTE_ASSET_PORT ?? "19000",
    // Terminal update package validation runs on remote Java and invokes the
    // exact Android Build Tools installed by the managed preparation entry.
    V2S_DEV_REMOTE_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY:
      env.V2S_DEV_REMOTE_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY ?? "/root/.cache/catering-v2s/android-sdk/build-tools/36.0.0",
    V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT: env.V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT ?? "18083",
    V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT: env.V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT ?? "18087",
    V2S_DEV_REMOTE_TDS_A_PORT: env.V2S_DEV_REMOTE_TDS_A_PORT ?? "18084",
    V2S_DEV_REMOTE_TDS_B_PORT: env.V2S_DEV_REMOTE_TDS_B_PORT ?? "18085",
    V2S_DEV_REMOTE_TDS_C_PORT: env.V2S_DEV_REMOTE_TDS_C_PORT ?? "18086",
    V2S_DEV_ASSET_ROOT: env.V2S_DEV_ASSET_ROOT ?? "s3://catering-v2s-r5-assets",
    V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS: tdsCapacity.maxUnauthenticatedConnections,
    V2S_TDS_MAX_TRACKED_SESSIONS: tdsCapacity.maxTrackedSessions,
    V2S_TDS_NODE_ID: env.V2S_TDS_NODE_ID ?? "tds",
    V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS: env.V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS ?? "3000",
  };
}
function validate(input, mode) {
  const tdsCapacity = loadTdsCapacityConfiguration();
  const env = effectiveEnvironment(input, tdsCapacity);
  const namespace = env.V2S_DEV_NAMESPACE;
  if (!/^v2s-dev-[a-z0-9-]{3,32}$/.test(namespace)) fail("R5_DEV_NAMESPACE_INVALID");
  if (env.V2S_DEV_PROFILE !== "r5-full") fail("R5_DEV_PROFILE_REQUIRED");
  if (env.V2S_RUNTIME_ENVIRONMENT !== "non-production") fail("R5_DEV_NON_PRODUCTION_MARKER_REQUIRED");
  const host = resolveTrustedRemoteHost(env).host;
  if (productionLike(host)) fail("R5_DEV_REMOTE_HOST_PRODUCTION_LIKE");
  const expectedDatabase = `catering_v2s_dev_${namespace.replace(/^v2s-dev-/, "").replaceAll("-", "_")}`;
  if (!/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(expectedDatabase)) fail("R5_DEV_DATABASE_NAME_INVALID");
  const databaseUrl = env.V2S_DEV_DATABASE_URL ?? "";
  if (!databaseUrl || productionLike(databaseUrl) || databaseName(databaseUrl) !== expectedDatabase) fail("R5_DEV_DATABASE_URL_INVALID");
  let parsedDatabaseUrl;
  try { parsedDatabaseUrl = new URL(databaseUrl.replace(/^jdbc:/, "")); } catch { fail("R5_DEV_DATABASE_URL_INVALID"); }
  if (parsedDatabaseUrl.hostname === "127.0.0.1" && [25432, 25433, 25434, 25435].includes(Number(parsedDatabaseUrl.port))) fail("R5_DEV_LEGACY_POSTGRES_TUNNEL_FORBIDDEN");
  validPort(env.V2S_DEV_REMOTE_HTTP_PORT, "R5_DEV_REMOTE_HTTP_PORT_INVALID");
  if (typeof env.V2S_DEV_REMOTE_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY !== "string" ||
      !/^\/[A-Za-z0-9._/-]+$/.test(env.V2S_DEV_REMOTE_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY) ||
      env.V2S_DEV_REMOTE_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY.split("/").includes("..")) {
    fail("R5_DEV_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY_INVALID");
  }
  validateTerminalBrowserOrigins(env.V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS);
  validPort(env.V2S_DEV_REMOTE_ASSET_PORT, "R5_DEV_REMOTE_ASSET_PORT_INVALID");
  const remoteTdsPorts = [
    env.V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT,
    env.V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT,
    env.V2S_DEV_REMOTE_TDS_A_PORT,
    env.V2S_DEV_REMOTE_TDS_B_PORT,
    env.V2S_DEV_REMOTE_TDS_C_PORT,
  ].map(value => validPort(value, "R5_DEV_REMOTE_TDS_PORT_INVALID"));
  if (new Set([env.V2S_DEV_REMOTE_HTTP_PORT, env.V2S_DEV_REMOTE_ASSET_PORT, ...remoteTdsPorts]).size !== 7) fail("R5_DEV_REMOTE_PORT_COLLISION");
  if (mode === "start") {
    for (const key of ["V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS", "V2S_TDS_MAX_TRACKED_SESSIONS"]) {
      const value = env[key];
      if (!/^[1-9][0-9]{0,9}$/.test(String(value ?? "")) || Number(value) > 2147483647) fail(`R5_DEV_${key}_REQUIRED_OR_INVALID`);
    }
    if (typeof env.V2S_TDS_NODE_ID !== "string" || !/^[A-Za-z0-9._-]{1,126}$/.test(env.V2S_TDS_NODE_ID)) fail("R5_DEV_TDS_NODE_ID_INVALID");
    const withdrawalWait = env.V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS;
    if (!/^[1-9][0-9]{0,4}$/.test(String(withdrawalWait ?? "")) || Number(withdrawalWait) < 2000 || Number(withdrawalWait) > 10000) fail("R5_DEV_TDS_READINESS_WITHDRAWAL_WAIT_INVALID");
  }
  const assetRoot = env.V2S_DEV_ASSET_ROOT ?? "";
  if (!assetRoot || productionLike(assetRoot)) fail("R5_DEV_ASSET_ROOT_INVALID");
  if (mode === "seed" && requiredSecrets.some((name) => !env[name])) fail("R5_DEV_SEED_SECRET_MISSING");
  return {
    environment: env,
    namespace,
    expectedDatabase,
    assetPrefix: `${assetRoot.replace(/\/$/, "")}/catering-v2s/dev/${namespace}/`,
    tdsCapacity,
  };
}
function main() {
  const [, , mode = "start", flag] = process.argv;
  if (!["start", "seed", "reset", "check"].includes(mode)) fail("R5_DEV_USAGE");
  if (flag === "--self-test") {
    const valid = { V2S_DEV_NAMESPACE: "v2s-dev-alpha", V2S_DEV_PROFILE: "r5-full", V2S_RUNTIME_ENVIRONMENT: "non-production", V2S_DEV_REMOTE_HOST: "catering-remote-dev", V2S_DEV_DATABASE_URL: "jdbc:postgresql://catering-remote-dev/catering_v2s_dev_alpha", V2S_DEV_ASSET_ROOT: "s3://dev-assets", ...Object.fromEntries(requiredSecrets.map((name) => [name, "test-only"])) };
    Object.assign(valid, hostTrustEnvironment(valid));
    validate(valid, "seed");
    const tdsCapacity = loadTdsCapacityConfiguration();
    const defaultBrowserOrigins = effectiveEnvironment(valid, tdsCapacity).V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS;
    if (defaultBrowserOrigins !== "http://127.0.0.1:8093") fail("R5_DEV_TERMINAL_BROWSER_CORS_DEFAULT_INVALID");
    const customBrowserOrigins = effectiveEnvironment(
      { ...valid, V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS: "http://localhost:8093" },
      tdsCapacity,
    ).V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS;
    if (customBrowserOrigins !== "http://localhost:8093") fail("R5_DEV_TERMINAL_BROWSER_CORS_OVERRIDE_INVALID");
    let nodeIdRed = false;
    try { validate({ ...valid, V2S_TDS_NODE_ID: " " }, "start"); } catch (error) { nodeIdRed = error.code === "R5_DEV_TDS_NODE_ID_INVALID"; }
    if (!nodeIdRed) fail("R5_DEV_TDS_NODE_ID_SELF_TEST_RED_NOT_DETECTED");
    let withdrawalWaitRed = false;
    try { validate({ ...valid, V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS: "1999" }, "start"); } catch (error) { withdrawalWaitRed = error.code === "R5_DEV_TDS_READINESS_WITHDRAWAL_WAIT_INVALID"; }
    if (!withdrawalWaitRed) fail("R5_DEV_TDS_READINESS_WITHDRAWAL_WAIT_SELF_TEST_RED_NOT_DETECTED");
    validateTerminalBrowserOrigins("http://127.0.0.1:8093,http://localhost:8081");
    let browserOriginsRed = false;
    try { validateTerminalBrowserOrigins("*"); } catch (error) { browserOriginsRed = error.code === "R5_DEV_TERMINAL_BROWSER_CORS_ORIGINS_INVALID"; }
    if (!browserOriginsRed) fail("R5_DEV_TERMINAL_BROWSER_CORS_ORIGINS_SELF_TEST_RED_NOT_DETECTED");
    let red = false;
    try { validate({ ...valid, V2S_DEV_REMOTE_HOST_SHA256: "0".repeat(64) }, "start"); } catch (error) { red = error.code === "R5_DEV_REMOTE_HOST_BINDING_INVALID"; }
    if (!red) fail("R5_DEV_ENVIRONMENT_SELF_TEST_RED_NOT_DETECTED");
    process.stdout.write("R5_DEV_ENVIRONMENT_SELF_TEST=PASS; remote-host-binding=RED(R5_DEV_REMOTE_HOST_BINDING_INVALID); tds-node-id=RED(R5_DEV_TDS_NODE_ID_INVALID); tds-withdrawal-wait=RED(R5_DEV_TDS_READINESS_WITHDRAWAL_WAIT_INVALID); terminal-browser-origins=DEFAULT(http://127.0.0.1:8093),OVERRIDE(http://localhost:8093),RED(R5_DEV_TERMINAL_BROWSER_CORS_ORIGINS_INVALID)\n");
    return;
  }
  const result = validate(process.env, mode === "check" ? "start" : mode);
  if (flag === "--json") {
    process.stdout.write(`${JSON.stringify({namespace: result.namespace, expectedDatabase: result.expectedDatabase, assetPrefix: result.assetPrefix, tdsCapacity: result.tdsCapacity, environment: Object.fromEntries(Object.entries(result.environment).filter(([name]) => !requiredSecrets.includes(name)))})}\n`);
    return;
  }
  process.stdout.write(`R5_DEV_ENVIRONMENT=PASS; MODE=${mode}; DATABASE=${result.expectedDatabase}; ASSET_PREFIX=${result.assetPrefix}\n`);
}
try { main(); } catch (error) { process.stderr.write(`${error.code ?? "R5_DEV_ENVIRONMENT_FAIL"}\n`); process.exitCode = 2; }
