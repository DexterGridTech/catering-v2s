#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";

const repositoryRoot = process.cwd();
const evidenceRoot = path.join(repositoryRoot, ".runtime/r5/evidence/formatting");
const runId = `backend-formatting-bytecode-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${process.pid}`;
const runRoot = path.join(evidenceRoot, "runs", runId);
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "catering-v2s-formatting-"));
const gradleCommand = process.env.V2S_GRADLE_HOME
  ? path.join(process.env.V2S_GRADLE_HOME, "bin", "gradle")
  : "gradle";
const events = [];
const state = {
  schemaVersion: 1,
  kind: "backend-formatting-bytecode-run-manifest",
  runId,
  status: "RUNNING",
  startedAt: new Date().toISOString(),
  authorizationBoundary: "Static backend formatting evidence only; no DEV, seed, reset, UAT, browser L2, deployment or runtime execution.",
  stages: events,
  cleanupStatus: "PENDING",
};

fs.mkdirSync(runRoot, {recursive: true});

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function relativeTo(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function shouldCopy(relativePath) {
  if (!relativePath) return true;
  return !relativePath.split(path.sep).some((segment) => [".git", ".gradle", "build", "node_modules", ".runtime"].includes(segment));
}

function copyRepositorySnapshot() {
  fs.cpSync(repositoryRoot, temporaryRoot, {
    recursive: true,
    filter(source) {
      return shouldCopy(path.relative(repositoryRoot, source));
    },
  });
}

function walkFiles(root, predicate, output = []) {
  for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) walkFiles(filePath, predicate, output);
    else if (entry.isFile() && predicate(filePath)) output.push(filePath);
  }
  return output;
}

function classFiles(root) {
  return walkFiles(
    path.join(root, "apps/backend/catering-business-server"),
    (filePath) => filePath.endsWith(".class") && filePath.includes(`${path.sep}build${path.sep}classes${path.sep}java${path.sep}main${path.sep}`),
  ).sort();
}

function formatTargetJavaFiles(root) {
  return walkFiles(
    path.join(root, "apps/backend/catering-business-server"),
    (filePath) => {
      if (!filePath.endsWith(".java") || filePath.includes(`${path.sep}build${path.sep}`)) return false;
      const relative = relativeTo(root, filePath);
      return !relative.includes("/app/edge/generated/")
        && !relative.endsWith("/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java")
        && !relative.endsWith("/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java");
    },
  ).sort();
}

function digestFileSet(root, files) {
  const digest = crypto.createHash("sha256");
  for (const filePath of files) {
    const relative = relativeTo(root, filePath);
    const content = fs.readFileSync(filePath);
    digest.update(relative);
    digest.update("\0");
    digest.update(content);
    digest.update("\0");
  }
  return {
    fileCount: files.length,
    filesSha256: digest.digest("hex"),
  };
}

function stripLineNumberTable(output) {
  const lines = output.replace(/\r\n?/g, "\n").split("\n");
  const normalized = [];
  let skipping = false;
  for (const line of lines) {
    if (line.trim() === "LineNumberTable:") {
      skipping = true;
      continue;
    }
    if (skipping && (/^\S/.test(line) || /^\s*[A-Za-z][A-Za-z0-9 ]*:\s*$/.test(line))) skipping = false;
    if (!skipping) normalized.push(line);
  }
  return normalized.join("\n");
}

function runCommand(stage, command, args, cwd, options = {}) {
  const logPath = path.join(runRoot, "logs", `${String(events.length + 1).padStart(2, "0")}-${stage}.log`);
  fs.mkdirSync(path.dirname(logPath), {recursive: true});
  const log = fs.createWriteStream(logPath, {flags: "w"});
  const startedAt = new Date().toISOString();
  const event = {
    stage,
    command: [command, ...args],
    cwd: relativeTo(repositoryRoot, cwd),
    pid: null,
    startedAt,
    logPath: relativeTo(repositoryRoot, logPath),
    exitCode: null,
    signal: null,
    status: "RUNNING",
  };
  events.push(event);
  writeJson(path.join(runRoot, "run-manifest.json"), state);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: ["ignore", "pipe", "pipe"]});
    event.pid = child.pid;
    const stdout = [];
    child.stdout.on("data", (chunk) => {
      log.write(chunk);
      if (options.captureOutput) stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => log.write(chunk));
    child.on("error", (error) => {
      event.status = "FAIL";
      event.error = error.message;
      event.finishedAt = new Date().toISOString();
      log.end();
      writeJson(path.join(runRoot, "run-manifest.json"), state);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      event.exitCode = exitCode;
      event.signal = signal;
      event.status = exitCode === 0 ? "PASS" : "FAIL";
      event.finishedAt = new Date().toISOString();
      log.end();
      writeJson(path.join(runRoot, "run-manifest.json"), state);
      if (exitCode !== 0) reject(new Error(`${stage}:EXIT_${exitCode ?? "NULL"}:${signal ?? "NONE"}`));
      else resolve({stdout: Buffer.concat(stdout).toString("utf8")});
    });
  });
}

async function javapSnapshot(stage, root, files) {
  const outputPath = path.join(runRoot, `${stage}.javap.txt`);
  fs.writeFileSync(outputPath, "");
  const batches = [];
  const batchSize = 64;
  for (let start = 0; start < files.length; start += batchSize) {
    const batchFiles = files.slice(start, start + batchSize);
    const args = ["-c", "-p", ...batchFiles];
    const result = await runCommand(`${stage}-javap-${String(batches.length + 1).padStart(2, "0")}`, "javap", args, root, {captureOutput: true});
    const normalized = stripLineNumberTable(result.stdout);
    const section = [
      `# class-batch ${String(batches.length + 1).padStart(2, "0")}`,
      ...batchFiles.map((filePath) => relativeTo(root, filePath)),
      "# javap-output",
      normalized,
      "",
    ].join("\n");
    fs.appendFileSync(outputPath, section);
    batches.push({
      ordinal: batches.length + 1,
      fileCount: batchFiles.length,
      firstFile: relativeTo(root, batchFiles[0]),
      lastFile: relativeTo(root, batchFiles[batchFiles.length - 1]),
      normalizedOutputBytes: Buffer.byteLength(normalized),
      normalizedOutputSha256: sha256(normalized),
    });
  }
  const output = fs.readFileSync(outputPath);
  return {
    command: "javap -c -p <class-files>",
    normalization: "UTF-8 LF; LineNumberTable blocks removed; batch/file order is sorted and recorded.",
    artifact: relativeTo(repositoryRoot, outputPath),
    normalizedOutputBytes: output.length,
    normalizedOutputSha256: sha256(output),
    batches,
  };
}

async function captureBytecode(stage, root) {
  const files = classFiles(root);
  if (files.length === 0) throw new Error(`${stage}:NO_MAIN_BYTECODE`);
  const source = digestFileSet(root, formatTargetJavaFiles(root));
  const classEntries = files.map((filePath) => {
    const content = fs.readFileSync(filePath);
    return {
      file: relativeTo(root, filePath),
      sha256: sha256(content),
      length: content.length,
    };
  });
  const evidence = {
    schemaVersion: 2,
    kind: "backend-formatting-bytecode-snapshot",
    stage,
    runId,
    generatedAt: new Date().toISOString(),
    sourceSet: {
      root: "apps/backend/catering-business-server",
      excludedGeneratedSurfaces: ["**/app/edge/generated/**", "**/WorkspaceAuthorizationCatalog.java", "**/WorkspaceCapabilityRequirementCatalog.java", "**/build/generated/**"],
      ...source,
    },
    classCount: classEntries.length,
    errorCount: 0,
    entries: classEntries,
    javap: await javapSnapshot(stage, root, files),
  };
  writeJson(path.join(runRoot, `bytecode-${stage}.json`), evidence);
  return evidence;
}

function compareSnapshots(before, after) {
  const beforeJavap = fs.readFileSync(path.join(repositoryRoot, before.javap.artifact));
  const afterJavap = fs.readFileSync(path.join(repositoryRoot, after.javap.artifact));
  const classPathsEqual = JSON.stringify(before.entries.map((entry) => entry.file)) === JSON.stringify(after.entries.map((entry) => entry.file));
  const javapByteEqual = Buffer.compare(beforeJavap, afterJavap) === 0;
  const comparison = {
    schemaVersion: 1,
    kind: "backend-formatting-bytecode-comparison",
    runId,
    comparedAt: new Date().toISOString(),
    status: classPathsEqual && javapByteEqual ? "PASS" : "FAIL",
    acceptance: "Compile before formatting and after formatting; javap -c -p output is compared byte-for-byte after LineNumberTable removal.",
    before: {
      manifest: relativeTo(repositoryRoot, path.join(runRoot, "bytecode-before.json")),
      sourceFilesSha256: before.sourceSet.filesSha256,
      classCount: before.classCount,
      javapSha256: before.javap.normalizedOutputSha256,
    },
    after: {
      manifest: relativeTo(repositoryRoot, path.join(runRoot, "bytecode-after.json")),
      sourceFilesSha256: after.sourceSet.filesSha256,
      classCount: after.classCount,
      javapSha256: after.javap.normalizedOutputSha256,
    },
    classPathsEqual,
    javapByteEqual,
    semanticBytecodeEqual: classPathsEqual && javapByteEqual,
  };
  writeJson(path.join(runRoot, "bytecode-comparison.json"), comparison);
  return comparison;
}

async function main() {
  writeJson(path.join(runRoot, "run-manifest.json"), state);
  let before;
  let after;
  let comparison;
  try {
    copyRepositorySnapshot();
    state.snapshot = {copiedFrom: "current repository working tree", temporaryRoot: "ephemeral isolated copy"};
    writeJson(path.join(runRoot, "run-manifest.json"), state);
    await runCommand("compile-before-formatting", gradleCommand, ["clean", ":apps:backend:catering-business-server:compileJava", "--no-daemon"], temporaryRoot);
    before = await captureBytecode("before", temporaryRoot);
    await runCommand("spotless-apply", gradleCommand, ["spotlessApply", "--no-daemon"], temporaryRoot);
    await runCommand("compile-after-formatting", gradleCommand, ["clean", ":apps:backend:catering-business-server:compileJava", "--no-daemon"], temporaryRoot);
    after = await captureBytecode("after", temporaryRoot);
    comparison = compareSnapshots(before, after);
    if (comparison.status !== "PASS") throw new Error("BACKEND_FORMATTING_BYTECODE_NOT_EQUIVALENT");

    for (const name of ["bytecode-before.json", "bytecode-after.json", "bytecode-comparison.json"]) {
      fs.copyFileSync(path.join(runRoot, name), path.join(evidenceRoot, name));
    }
    state.status = "PASS";
    state.result = {
      comparison: relativeTo(repositoryRoot, path.join(runRoot, "bytecode-comparison.json")),
      before: relativeTo(repositoryRoot, path.join(runRoot, "bytecode-before.json")),
      after: relativeTo(repositoryRoot, path.join(runRoot, "bytecode-after.json")),
    };
    process.stdout.write(`BACKEND_FORMATTING_BYTECODE=PASS\nRUN_ID=${runId}\nCLASS_COUNT=${before.classCount}\nJAVAP_BYTE_EQUAL=true\n`);
  } catch (error) {
    state.status = "FAIL";
    state.error = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${state.error}\n`);
    process.exitCode = 1;
  } finally {
    try {
      fs.rmSync(temporaryRoot, {recursive: true, force: true});
      state.cleanupStatus = "PASS";
    } catch (error) {
      state.cleanupStatus = "FAIL";
      state.cleanupError = error instanceof Error ? error.message : String(error);
      process.exitCode = 1;
    }
    state.finishedAt = new Date().toISOString();
    writeJson(path.join(runRoot, "run-manifest.json"), state);
    writeJson(path.join(evidenceRoot, "latest-run-manifest.json"), state);
  }
}

await main();
