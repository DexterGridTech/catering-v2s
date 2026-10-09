import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {buildTerminalUpdateSeedPlan} from "./terminal-update-seed-plan.mjs";

const fixture = JSON.parse(fs.readFileSync("doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json", "utf8"));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const apps = ["sample-terminal", "sample-wallpaper-terminal"];

function prepare(root) {
  const runId = "update-artifacts-test-0001";
  const runRoot = path.join(root, ".runtime/terminal-automation", runId);
  const exportRoot = path.join(runRoot, "update/seed-inputs");
  fs.mkdirSync(exportRoot, {recursive: true});
  fs.writeFileSync(path.join(runRoot, "run-manifest.json"), JSON.stringify({
    schemaVersion: 1, kind: "terminal-automation-run-manifest", runId,
    execution: {phase: "update", case: "update.artifacts"}, business: "PASS", cleanup: "PASS",
  }));
  const files = [];
  const artifactByApp = new Map();
  for (const [appIndex, app] of apps.entries()) {
    const applicationId = appIndex === 0 ? "com.example.terminal" : "com.example.wallpaper";
    const full = {
      schemaVersion: 1, platform: "android", applicationId, nativeVersion: "2.1.4", nativeBuildNumber: 1,
      bundleVersion: "1.0.0", runtimeVersion: "2.1.4", entry: "index.android.bundle",
      files: [{path: "assets/index.android.bundle", sizeBytes: 4, sha256: "a".repeat(64)}], publicationId: String(appIndex + 1).repeat(64),
      apk: {path: `${app}.apk`, sha256: String(appIndex + 3).repeat(64), certificateSha256: "c".repeat(64)},
    };
    const hot = {
      schemaVersion: 1, platform: "android", applicationId, nativeVersion: "2.1.4", nativeBuildNumber: 1,
      bundleVersion: "1.0.1", runtimeVersion: "2.1.4", entry: "index.android.bundle",
      files: [{path: "assets/index.android.bundle", sizeBytes: 4, sha256: "b".repeat(64)}], publicationId: String(appIndex + 5).repeat(64),
      minimumFull: {applicationId, nativeBuildNumber: 1, runtimeVersion: "2.1.4", publicationId: full.publicationId, apkSha256: full.apk.sha256},
    };
    artifactByApp.set(app, {full, hot});
    const fullPackage = {schemaVersion: 1, publicationId: full.publicationId,
      zip: {path: `${app}-full.zip`, sha256: digest(Buffer.from(`${app}:full`))},
      apk: {path: full.apk.path, sha256: full.apk.sha256, certificateSha256: full.apk.certificateSha256}};
    for (const item of [
      {key: `${app}-full`, kind: "FULL", file: `${app}-full.zip`, data: Buffer.from(`${app}:full`)},
      {key: `${app}-full-manifest`, kind: "FULL_MANIFEST", file: `${app}-full.json`, data: Buffer.from(JSON.stringify(full))},
      {key: `${app}-full-package`, kind: "FULL_PACKAGE", file: `${app}-full-package.json`, data: Buffer.from(JSON.stringify(fullPackage))},
      {key: `${app}-hot`, kind: "HOT", file: `${app}-hot.zip`, data: Buffer.from(`${app}:hot`)},
      {key: `${app}-hot-manifest`, kind: "HOT_MANIFEST", file: `${app}-hot.json`, data: Buffer.from(JSON.stringify(hot))},
    ]) {
      fs.writeFileSync(path.join(exportRoot, item.file), item.data);
      files.push({key: item.key, app, kind: item.kind, path: item.file, sha256: digest(item.data), byteSize: item.data.length});
    }
  }
  fs.writeFileSync(path.join(exportRoot, "manifest.json"), JSON.stringify({schemaVersion: 1, kind: "terminal-update-seed-input-manifest", sourceRunId: runId, files, totalBytes: files.reduce((sum, f) => sum + f.byteSize, 0)}));
  return {runId, exportRoot, artifactByApp};
}

test("terminal-update seed plan accepts only complete, root-contained, hash-matched A artifacts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "terminal-update-seed-plan-"));
  try {
    const source = prepare(root);
    const plan = buildTerminalUpdateSeedPlan({fixture, sourceRunId: source.runId, root});
    assert.equal(plan.status, "PASS");
    assert.equal(plan.artifacts.length, 4);
    assert.equal(plan.rules.length, 8);
    assert.equal(plan.artifacts.find(item => item.app === apps[0] && item.kind === "HOT").artifact.minimumFull.apkSha256,
      source.artifactByApp.get(apps[0]).full.apk.sha256);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test("terminal-update seed plan rejects unfinished build runs, changed bytes, and broken minimum-FULL pair", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "terminal-update-seed-plan-red-"));
  try {
    const source = prepare(root);
    const runManifest = path.join(root, ".runtime/terminal-automation", source.runId, "run-manifest.json");
    const originalRun = JSON.parse(fs.readFileSync(runManifest, "utf8"));
    fs.writeFileSync(runManifest, JSON.stringify({...originalRun, cleanup: "FAIL"}));
    assert.throws(() => buildTerminalUpdateSeedPlan({fixture, sourceRunId: source.runId, root}), /TERMINAL_UPDATE_SEED_SOURCE_RUN_NOT_COMPLETE/);
    fs.writeFileSync(runManifest, JSON.stringify(originalRun));

    fs.appendFileSync(path.join(source.exportRoot, "sample-terminal-full.zip"), "changed");
    assert.throws(() => buildTerminalUpdateSeedPlan({fixture, sourceRunId: source.runId, root}), /TERMINAL_UPDATE_SEED_EXPORT_DIGEST_INVALID/);
    fs.writeFileSync(path.join(source.exportRoot, "unowned-extra.bin"), "extra");
    assert.throws(() => buildTerminalUpdateSeedPlan({fixture, sourceRunId: source.runId, root}), /TERMINAL_UPDATE_SEED_EXPORT_FILESET_MISMATCH/);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
