#!/usr/bin/env node

import crypto from "node:crypto";

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
function effectiveEnvironment(env) {
  const namespace = env.V2S_DEV_NAMESPACE ?? "v2s-dev-r5-full";
  const host = env.V2S_DEV_REMOTE_HOST ?? env.CATERING_ALL_V2_DEV_SSH_HOST ?? "catering-remote-dev";
  const expectedDatabase = `catering_v2s_dev_${namespace.replace(/^v2s-dev-/, "").replaceAll("-", "_")}`;
  return {
    ...env,
    V2S_DEV_NAMESPACE: namespace,
    V2S_DEV_PROFILE: env.V2S_DEV_PROFILE ?? "r5-full",
    V2S_RUNTIME_ENVIRONMENT: env.V2S_RUNTIME_ENVIRONMENT ?? "non-production",
    V2S_DEV_REMOTE_HOST: host,
    V2S_DEV_REMOTE_HOST_SHA256: env.V2S_DEV_REMOTE_HOST_SHA256 ?? crypto.createHash("sha256").update(host).digest("hex"),
    V2S_DEV_DATABASE_URL: env.V2S_DEV_DATABASE_URL ?? `jdbc:postgresql://127.0.0.1:25432/${expectedDatabase}`,
    V2S_DEV_ASSET_ROOT: env.V2S_DEV_ASSET_ROOT ?? "s3://catering-v2s-r5-assets",
  };
}
function validate(input, mode) {
  const env = effectiveEnvironment(input);
  const namespace = env.V2S_DEV_NAMESPACE;
  if (!/^v2s-dev-[a-z0-9-]{3,32}$/.test(namespace)) fail("R5_DEV_NAMESPACE_INVALID");
  if (env.V2S_DEV_PROFILE !== "r5-full") fail("R5_DEV_PROFILE_REQUIRED");
  if (env.V2S_RUNTIME_ENVIRONMENT !== "non-production") fail("R5_DEV_NON_PRODUCTION_MARKER_REQUIRED");
  const host = env.V2S_DEV_REMOTE_HOST ?? "";
  const hostHash = env.V2S_DEV_REMOTE_HOST_SHA256 ?? "";
  if (!host || !/^[a-f0-9]{64}$/i.test(hostHash) || crypto.createHash("sha256").update(host).digest("hex") !== hostHash) fail("R5_DEV_REMOTE_HOST_BINDING_INVALID");
  if (productionLike(host)) fail("R5_DEV_REMOTE_HOST_PRODUCTION_LIKE");
  const expectedDatabase = `catering_v2s_dev_${namespace.replace(/^v2s-dev-/, "").replaceAll("-", "_")}`;
  if (!/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(expectedDatabase)) fail("R5_DEV_DATABASE_NAME_INVALID");
  const databaseUrl = env.V2S_DEV_DATABASE_URL ?? "";
  if (!databaseUrl || productionLike(databaseUrl) || databaseName(databaseUrl) !== expectedDatabase) fail("R5_DEV_DATABASE_URL_INVALID");
  const assetRoot = env.V2S_DEV_ASSET_ROOT ?? "";
  if (!assetRoot || productionLike(assetRoot)) fail("R5_DEV_ASSET_ROOT_INVALID");
  if (mode === "seed" && requiredSecrets.some((name) => !env[name])) fail("R5_DEV_SEED_SECRET_MISSING");
  return { environment: env, namespace, expectedDatabase, assetPrefix: `${assetRoot.replace(/\/$/, "")}/catering-v2s/dev/${namespace}/` };
}
function main() {
  const [, , mode = "start", flag] = process.argv;
  if (!["start", "seed", "reset", "check"].includes(mode)) fail("R5_DEV_USAGE");
  if (flag === "--self-test") {
    const valid = { V2S_DEV_NAMESPACE: "v2s-dev-alpha", V2S_DEV_PROFILE: "r5-full", V2S_RUNTIME_ENVIRONMENT: "non-production", V2S_DEV_REMOTE_HOST: "dev.example.internal", V2S_DEV_DATABASE_URL: "jdbc:postgresql://dev.example.internal/catering_v2s_dev_alpha", V2S_DEV_ASSET_ROOT: "s3://dev-assets", ...Object.fromEntries(requiredSecrets.map((name) => [name, "test-only"])) };
    valid.V2S_DEV_REMOTE_HOST_SHA256 = crypto.createHash("sha256").update(valid.V2S_DEV_REMOTE_HOST).digest("hex");
    validate(valid, "seed");
    let red = false;
    try { validate({ ...valid, V2S_DEV_REMOTE_HOST_SHA256: "0".repeat(64) }, "start"); } catch (error) { red = error.code === "R5_DEV_REMOTE_HOST_BINDING_INVALID"; }
    if (!red) fail("R5_DEV_ENVIRONMENT_SELF_TEST_RED_NOT_DETECTED");
    process.stdout.write("R5_DEV_ENVIRONMENT_SELF_TEST=PASS; remote-host-binding=RED(R5_DEV_REMOTE_HOST_BINDING_INVALID)\n");
    return;
  }
  const result = validate(process.env, mode === "check" ? "start" : mode);
  if (flag === "--json") {
    process.stdout.write(`${JSON.stringify({namespace: result.namespace, expectedDatabase: result.expectedDatabase, assetPrefix: result.assetPrefix, environment: Object.fromEntries(Object.entries(result.environment).filter(([name]) => !requiredSecrets.includes(name)))})}\n`);
    return;
  }
  process.stdout.write(`R5_DEV_ENVIRONMENT=PASS; MODE=${mode}; DATABASE=${result.expectedDatabase}; ASSET_PREFIX=${result.assetPrefix}\n`);
}
try { main(); } catch (error) { process.stderr.write(`${error.code ?? "R5_DEV_ENVIRONMENT_FAIL"}\n`); process.exitCode = 2; }
