import assert from "node:assert/strict";
import childProcess from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const start = path.join(root, "scripts/dev/start");
const runnerSource = readFileSync(path.join(root, "scripts/dev/r5-dev-runner.mjs"), "utf8");

test("DEV start rejects every argument before it can launch managed resources", () => {
  const result = childProcess.spawnSync(start, ["--help"], {
    cwd: root,
    encoding: "utf8",
    env: {...process.env},
  });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^R5_DEV_START=REFUSED; REASON=ARGUMENT_INVALID\n$/);
});

test("DEV start propagates authoritative existing MinIO credentials to Java", () => {
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_ACCESS_KEY = objectStorage\.access/);
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_SECRET_KEY = objectStorage\.secretKey/);
});

test("DEV start gives Java the selected local asset ingress for browser public URLs", () => {
  assert.match(runnerSource, /const tunnel = await openTunnel\(env, tunnelPorts\);[\s\S]*startRemoteJava/);
  assert.match(runnerSource, /assetPublicBaseUrl: `http:\/\/127\.0\.0\.1:\$\{tunnelPorts\.asset\}`/);
  assert.match(runnerSource, /CATERING_ASSET_PUBLIC_BASE_URL: assetPublicBaseUrl/);
  assert.doesNotMatch(runnerSource, /CATERING_ASSET_PUBLIC_BASE_URL: `http:\/\/127\.0\.0\.1:\$\{env\.environment\.V2S_DEV_REMOTE_ASSET_PORT\}`/);
});

test("remote Java binds the selected HTTP port instead of assuming one shared listener", () => {
  assert.match(runnerSource, /httpPort = env\.environment\.V2S_DEV_REMOTE_HTTP_PORT/);
  assert.match(runnerSource, /SERVER_PORT: String\(httpPort\)/);
  assert.match(runnerSource, /httpPort.*\$http_port/);
});

test("DEV start forwards only an explicit backend verification mode to remote Java", () => {
  assert.match(runnerSource, /const backendAcceptanceVerificationMode = env\.environment\.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE/);
  assert.match(runnerSource, /V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE: backendAcceptanceVerificationMode/);
  assert.match(runnerSource, /!\['ACCEPTANCE', 'CALIBRATION'\]\.includes\(backendAcceptanceVerificationMode\)/);
});
