#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const forbiddenAppRoots = new Set([
  "pages",
  "components",
  "shared",
  "common",
  "hooks",
  "utils",
]);
const backendAppRoot = "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app";
const allowedBackendAppChildren = new Set(["bootstrap", "configuration", "edge"]);
const contractRoots = new Set(["openapi", "catalog", "protocol", "policy", "registry"]);
const allowedRepositoryRootDirectories = new Set([
  ".agents",
  ".claude",
  ".codex",
  ".git",
  ".gradle",
  ".idea",
  ".runtime",
  ".yarn",
  "apps",
  "build",
  "contracts",
  "doc",
  "infra",
  "libraries",
  "node_modules",
  "project-memory",
  "scripts",
  "tools",
]);
const scenarioName = /(?:^|[-_])(?:D\d{2}-S\d{2}|R\d+(?:J\d+|U\d+))/;
const flowIdentifier = /(?:^|[._-])(?:(?:r|u|j|jg|pkg)\d+[a-z0-9_-]*|g-\d+[a-z0-9_-]*)(?=$|[._-])/i;

function fail(reason) {
  throw new Error(reason);
}

function isDirectory(target) {
  return fs.existsSync(target) && fs.statSync(target).isDirectory();
}

function walk(root, visitor) {
  if (!isDirectory(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (["build", ".gradle", "node_modules", "dist"].includes(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    visitor(absolute, entry);
    if (entry.isDirectory()) walk(absolute, visitor);
  }
}

function rel(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

function isSourceTreePath(relativePath) {
  return /^(?:apps|libraries)\/.*\/src(?:\/|$)/.test(relativePath);
}

function validateTdpPlaceholder(root, reasons) {
  const placeholder = path.join(root, "apps/backend/terminal-data-server");
  if (!isDirectory(placeholder)) return;

  const allowedFiles = new Set([
    "apps/backend/terminal-data-server/README.md",
    "apps/backend/terminal-data-server/build.gradle.kts",
  ]);
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (["build", ".gradle", "dist", "node_modules"].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (!allowedFiles.has(rel(root, absolute))) {
        reasons.push(`TDP_PLACEHOLDER_UNEXPECTED_FILE:${rel(root, absolute)}`);
      }
    }
  };
  visit(placeholder);

  const buildFile = path.join(placeholder, "build.gradle.kts");
  if (fs.existsSync(buildFile)) {
    const buildText = fs.readFileSync(buildFile, "utf8");
    if (/\bdependencies\s*\{|project\s*\(/.test(buildText)) {
      reasons.push("TDP_PLACEHOLDER_DEPENDENCY_EDGE:apps/backend/terminal-data-server/build.gradle.kts");
    }
  }
}

function validateBackendJavaPackagePaths(root, reasons) {
  const backend = path.join(root, "apps/backend/catering-business-server");
  let count = 0;
  walk(backend, (target, entry) => {
    if (!entry.isFile() || !target.endsWith(".java")) return;
    const relative = rel(root, target);
    const marker = "/src/main/java/";
    const offset = relative.indexOf(marker);
    if (offset < 0) return;
    count += 1;
    const declared = fs.readFileSync(target, "utf8").match(/^\s*package\s+([A-Za-z_][\w.]*)\s*;/m)?.[1];
    const actual = relative.slice(offset + marker.length);
    const expected = declared ? `${declared.replaceAll(".", "/")}/${path.basename(target)}` : "";
    if (!declared || actual !== expected) reasons.push(`JAVA_PACKAGE_PATH_MISMATCH:${relative}`);
  });
}

function validate(root) {
  const reasons = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !allowedRepositoryRootDirectories.has(entry.name)) {
      reasons.push(`REPOSITORY_ROOT_DIRECTORY_NOT_ALLOWED:${entry.name}`);
    }
  }
  validateTdpPlaceholder(root, reasons);
  validateBackendJavaPackagePaths(root, reasons);
  const appSources = [
    "apps/backend/catering-business-server/src",
    "apps/frontend/platform-admin/src",
    "apps/frontend/operations-admin/src",
  ];
  for (const sourceRelative of appSources) {
    const source = path.join(root, sourceRelative);
    if (!isDirectory(source)) continue;
    for (const child of fs.readdirSync(source, { withFileTypes: true })) {
      if (child.isDirectory() && forbiddenAppRoots.has(child.name)) {
        reasons.push(`FORBIDDEN_APP_ROOT:${rel(root, path.join(source, child.name))}`);
      }
    }
  }

  const backendRoot = path.join(root, backendAppRoot);
  if (isDirectory(backendRoot)) {
    for (const child of fs.readdirSync(backendRoot, { withFileTypes: true })) {
      const relative = rel(root, path.join(backendRoot, child.name));
      if (!child.isDirectory() || !allowedBackendAppChildren.has(child.name)) {
        reasons.push(`BACKEND_APP_ROOT_NOT_ALLOWED:${relative}`);
      }
    }
  }

  const contracts = path.join(root, "contracts");
  if (isDirectory(contracts)) {
    for (const entry of fs.readdirSync(contracts, { withFileTypes: true })) {
      if (entry.isDirectory() && !contractRoots.has(entry.name)) {
        reasons.push(`CONTRACT_CLASSIFICATION_INVALID:${rel(root, path.join(contracts, entry.name))}`);
      }
    }
  }

  for (const sourceRoot of ["apps", "libraries", "modules"]) {
    const absoluteRoot = path.join(root, sourceRoot);
    walk(absoluteRoot, (target, entry) => {
      const relative = rel(root, target);
      if (isSourceTreePath(relative) && flowIdentifier.test(path.basename(target))) {
        reasons.push(`FLOW_IDENTIFIER_IN_SOURCE_NAME:${relative}`);
      }
      if (scenarioName.test(path.basename(target))) {
        reasons.push(`SCENARIO_IDENTIFIER_IN_RUNTIME_NAME:${relative}`);
      }
      if (relative.split("/").includes("__red__")) {
        reasons.push(`RED_FIXTURE_IN_PRODUCTION_TREE:${relative}`);
      }
      if (entry.isDirectory() && fs.readdirSync(target).length === 0) {
        reasons.push(`EMPTY_SOURCE_DIRECTORY:${relative}`);
      }
    });
  }

  if (reasons.length > 0) fail(reasons.sort().join(","));
  return "CODE_LAYOUT=PASS\n";
}

function expectFailure(root, mutation, expected) {
  mutation(root);
  try {
    validate(root);
  } catch (error) {
    if (error instanceof Error && error.message.includes(expected)) return;
    throw error;
  }
  fail(`SELF_TEST_RED_DID_NOT_FAIL:${expected}`);
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    validate(root);
    expectFailure(root, (fixture) => {
      fs.mkdirSync(path.join(fixture, "apps/frontend/platform-admin/src/pages"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "apps/frontend/platform-admin/src/pages/index.ts"), "export {}\n");
    }, "FORBIDDEN_APP_ROOT:apps/frontend/platform-admin/src/pages");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const scenarioRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(scenarioRoot, (fixture) => {
      fs.mkdirSync(path.join(fixture, "modules/example"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "modules/example/D01-S05Service.java"), "class X {}\n");
    }, "SCENARIO_IDENTIFIER_IN_RUNTIME_NAME:modules/example/D01-S05Service.java");
  } finally {
    fs.rmSync(scenarioRoot, { recursive: true, force: true });
  }

  const flowNameRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(flowNameRoot, (fixture) => {
      fs.mkdirSync(path.join(fixture, "apps/frontend/platform-admin/src/R5Bar"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "apps/frontend/platform-admin/src/R5Bar/Capability.ts"), "export {}\n");
    }, "FLOW_IDENTIFIER_IN_SOURCE_NAME:apps/frontend/platform-admin/src/R5Bar");
  } finally {
    fs.rmSync(flowNameRoot, { recursive: true, force: true });
  }

  const contractRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    fs.mkdirSync(path.join(contractRoot, "contracts/registry"), { recursive: true });
    validate(contractRoot);
    expectFailure(contractRoot, (fixture) => fs.mkdirSync(path.join(fixture, "contracts/random"), { recursive: true }), "CONTRACT_CLASSIFICATION_INVALID:contracts/random");
  } finally {
    fs.rmSync(contractRoot, { recursive: true, force: true });
  }

  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(repositoryRoot, (fixture) => {
      fs.mkdirSync(path.join(fixture, "components/common"), { recursive: true });
    }, "REPOSITORY_ROOT_DIRECTORY_NOT_ALLOWED:components");
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  }

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(fixtureRoot, (fixture) => {
      fs.mkdirSync(path.join(fixture, "apps/frontend/platform-admin/src/features/__red__"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "apps/frontend/platform-admin/src/features/__red__/fixture.ts"), "export {}\n");
    }, "RED_FIXTURE_IN_PRODUCTION_TREE:apps/frontend/platform-admin/src/features/__red__");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }

  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(emptyRoot, (fixture) => {
      fs.mkdirSync(path.join(fixture, "modules/example/empty"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "modules/example/Live.java"), "class X {}\n");
    }, "EMPTY_SOURCE_DIRECTORY:modules/example/empty");
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }

  const tdpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(tdpRoot, (fixture) => {
      fs.mkdirSync(path.join(fixture, "apps/backend/terminal-data-server/src/main"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "apps/backend/terminal-data-server/README.md"), "placeholder\n");
      fs.writeFileSync(path.join(fixture, "apps/backend/terminal-data-server/build.gradle.kts"), "plugins { java }\n");
      fs.writeFileSync(path.join(fixture, "apps/backend/terminal-data-server/src/main/Future.java"), "class Future {}\n");
    }, "TDP_PLACEHOLDER_UNEXPECTED_FILE:apps/backend/terminal-data-server/src/main/Future.java");
  } finally {
    fs.rmSync(tdpRoot, { recursive: true, force: true });
  }

  const backendRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(backendRoot, (fixture) => {
      const app = path.join(fixture, "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app");
      fs.mkdirSync(path.join(app, "service"), { recursive: true });
      fs.writeFileSync(path.join(app, "service/Stray.java"), "class Stray {}\n");
    }, "BACKEND_APP_ROOT_NOT_ALLOWED:apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/service");
  } finally {
    fs.rmSync(backendRoot, { recursive: true, force: true });
  }

  const javaPackageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-code-layout-"));
  try {
    expectFailure(javaPackageRoot, (fixture) => {
      const source = path.join(fixture, "apps/backend/catering-business-server/modules/example/src/main/java/com/example/actual");
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, "Mismatch.java"), "package com.example.declared;\nclass Mismatch {}\n");
    }, "JAVA_PACKAGE_PATH_MISMATCH:apps/backend/catering-business-server/modules/example/src/main/java/com/example/actual/Mismatch.java");
  } finally {
    fs.rmSync(javaPackageRoot, { recursive: true, force: true });
  }

  process.stdout.write([
    "CODE_LAYOUT_SELF_TEST=PASS",
    "RED_FIXTURE_FORBIDDEN_APP_ROOT=PASS",
    "RED_FIXTURE_SCENARIO_RUNTIME_NAME=PASS",
    "RED_FIXTURE_FLOW_IDENTIFIER_IN_SOURCE_NAME=PASS",
    "CONTRACT_REGISTRY_ALLOWED=PASS",
    "RED_FIXTURE_CONTRACT_CLASSIFICATION=PASS",
    "RED_FIXTURE_REPOSITORY_ROOT_ALLOWLIST=PASS",
    "RED_FIXTURE_PRODUCTION_RED_FIXTURE=PASS",
    "RED_FIXTURE_EMPTY_SOURCE_DIRECTORY=PASS",
    "RED_FIXTURE_TDP_PLACEHOLDER_BOUNDARY=PASS",
    "RED_FIXTURE_BACKEND_APP_ROOT_ALLOWLIST=PASS",
    "",
  ].join("\n"));
}

function main(argv) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  if (argv.length === 1 && argv[0] === "--self-test") return selfTest();
  if (argv.length === 0) return process.stdout.write(validate(repositoryRoot));
  process.stderr.write("Usage: scripts/check/code-layout [--self-test]\n");
  process.exitCode = 2;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`CODE_LAYOUT=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
