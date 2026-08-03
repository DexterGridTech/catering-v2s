import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {ResetFailure, runRemoteReset, validateResetTopology, verifyRemoteResetTranscript} from "./r5-reset.mjs";

const host = "dev.example.internal";
const hash = crypto.createHash("sha256").update(host).digest("hex");
const valid = {namespace: "v2s-dev-reset-test", expectedDatabase: "catering_v2s_dev_reset_test", environment: {V2S_DEV_REMOTE_HOST: host, V2S_DEV_REMOTE_HOST_SHA256: hash}};

test("reset preflight rejects wrong remote host binding", () => {
  assert.throws(() => validateResetTopology({...valid, environment: {...valid.environment, V2S_DEV_REMOTE_HOST_SHA256: "0".repeat(64)}}), (error) => error instanceof ResetFailure && error.code === "REMOTE_HOST_BINDING_INVALID");
});

test("reset preflight rejects production-like host and illegal database", () => {
  assert.throws(() => validateResetTopology({...valid, environment: {...valid.environment, V2S_DEV_REMOTE_HOST: "database-prod.internal", V2S_DEV_REMOTE_HOST_SHA256: crypto.createHash("sha256").update("database-prod.internal").digest("hex")}}), (error) => error instanceof ResetFailure && error.code === "REMOTE_HOST_PRODUCTION_LIKE");
  assert.throws(() => validateResetTopology({...valid, expectedDatabase: "postgres"}), (error) => error instanceof ResetFailure && error.code === "TARGET_DATABASE_ALLOWLIST_INVALID");
});

test("reset rejects remote command failure and failed post-drop readback", () => {
  assert.throws(() => runRemoteReset({host, targetDatabase: valid.expectedDatabase, executor: () => ({status: 255, stdout: ""})}), (error) => error instanceof ResetFailure && error.code === "REMOTE_EXECUTION_FAILED");
  assert.throws(() => verifyRemoteResetTranscript("R5_REMOTE_RESET_TERMINATE=PASS\nR5_REMOTE_RESET_DROP=PASS\nR5_REMOTE_RESET_READBACK_ABSENT=FAIL\n"), (error) => error instanceof ResetFailure && error.code === "POST_DROP_READBACK_FAILED");
});
