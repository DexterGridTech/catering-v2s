import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {validateTerminalUpdateArtifactReadback, validateTerminalUpdateRuleReadback} from "./terminal-update-seed-executor.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("terminal update seed multipart usage matches the platform artifact endpoint", () => {
  const executor = fs.readFileSync(path.join(repositoryRoot, "scripts/dev/terminal-update-seed-executor.mjs"), "utf8");
  const controller = fs.readFileSync(path.join(repositoryRoot,
    "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/terminalupdate/PlatformTerminalUpdateArtifactController.java"), "utf8");
  const executorUsage = executor.match(/form\.set\("usage", "([A-Z_]+)"\)/)?.[1];
  const controllerUsage = controller.match(/private static final String USAGE = "([A-Z_]+)";/)?.[1];

  assert.ok(executorUsage, "seed executor must submit a terminal artifact usage");
  assert.ok(controllerUsage, "platform artifact endpoint must define its accepted usage");
  assert.equal(executorUsage, controllerUsage);
});

const expected = Object.freeze({
  app: "sample-terminal",
  kind: "HOT",
  zipSha256: "a".repeat(64),
  byteSize: 512,
  artifact: Object.freeze({
    applicationId: "com.example.terminal",
    nativeVersion: "2.1.4",
    nativeBuildNumber: 7,
    bundleVersion: "1.0.9",
    runtimeVersion: "2.1.4",
    publicationId: "pub-1",
  }),
});

const detail = Object.freeze({
  artifactRef: "7d96db32-bfda-4bf4-a54b-a117bb609874",
  kind: "HOT",
  applicationId: "com.example.terminal",
  runtimeVersion: "2.1.4",
  nativeBuildNumber: 7,
  apkVersion: "2.1.4",
  jsVersion: "1.0.9",
  publicationId: "pub-1",
  zipSha256: "a".repeat(64),
  byteSize: 512,
  createdAtEpochMillis: 1_791_518_400_000,
});

test("terminal update seed accepts artifact detail using the generated wire field names", () => {
  assert.equal(validateTerminalUpdateArtifactReadback(detail, expected), detail);
});

test("terminal update seed rejects an artifact detail that mismatches the canonical version fields", () => {
  assert.throws(() => validateTerminalUpdateArtifactReadback({...detail, apkVersion: "9.9.9"}, expected),
    /TERMINAL_UPDATE_SEED_ARTIFACT_READBACK_MISMATCH:sample-terminal:HOT/);
  assert.throws(() => validateTerminalUpdateArtifactReadback({...detail, jsVersion: "9.9.9"}, expected),
    /TERMINAL_UPDATE_SEED_ARTIFACT_READBACK_MISMATCH:sample-terminal:HOT/);
});

test("terminal update seed accepts a FULL-only rule with an explicit nullable HOT reference", () => {
  const fullArtifactRef = "04e92b76-bf36-4b4b-905d-977d92412a30";
  const rule = {
    ruleRef: "c82ff0ad-9c22-4468-8f21-3ec63651de18",
    projectRef: "b9b41869-f2a2-4387-b2dd-aedc888ae106",
    targetMode: "ALL",
    storeRefs: [],
    fullArtifactRef,
    hotArtifactRef: null,
    status: "ENABLED",
    nSeconds: 300,
    hotStrategy: "IMMEDIATE",
    mSeconds: null,
    createdAtEpochMillis: 1_791_518_400_000,
  };
  const expectedRule = {
    key: "update-console-full-all",
    targetMode: "ALL",
    storeKeys: [],
    fullArtifactKey: "update-console-full",
    hotArtifactKey: null,
    status: "ENABLED",
    nSeconds: 300,
    hotStrategy: "IMMEDIATE",
    mSeconds: null,
  };

  assert.equal(validateTerminalUpdateRuleReadback(rule, expectedRule, {
    projectRef: rule.projectRef,
    stores: new Map(),
    artifacts: new Map([[expectedRule.fullArtifactKey, fullArtifactRef]]),
  }), rule);
});
