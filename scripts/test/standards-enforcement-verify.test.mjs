import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {fileURLToPath, pathToFileURL} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const verifyPath = path.join(repoRoot, "tools/verify-gates/verify.mjs");
const verify = await import(pathToFileURL(verifyPath).href);

test("static verification runs each explicit true gate once", () => {
  const calls = [];
  const commands = [
    ["first", "first-command", ["--first"], ["FIRST=PASS"]],
    ["second", "scripts/check/second", [], ["SECOND=PASS"]],
  ];
  const result = verify.runStatic({
    root: repoRoot,
    commands,
    spawnSyncImpl(command, args) {
      calls.push({command, args});
      return {status: 0, stdout: command.includes("second") ? "SECOND=PASS\n" : "FIRST=PASS\n", stderr: ""};
    },
  });
  assert.equal(result.count, 2);
  assert.deepEqual(calls, [
    {command: "first-command", args: ["--first"]},
    {command: path.join(repoRoot, "scripts/check/second"), args: []},
  ]);
});

test("a static gate fails closed on its first missing marker", () => {
  const calls = [];
  assert.throws(
    () => verify.runStatic({
      root: repoRoot,
      commands: [
        ["first", "first-command", [], ["FIRST=PASS"]],
        ["second", "second-command", [], ["SECOND=PASS"]],
      ],
      spawnSyncImpl(command) {
        calls.push(command);
        return {status: 0, stdout: "OTHER=PASS\n", stderr: ""};
      },
    }),
    (error) => error.message === "R5_VERIFY_STATIC_MARKER_MISSING:first:FIRST=PASS",
  );
  assert.deepEqual(calls, ["first-command"]);
});

test("verify retains true static gates and has no retired control-plane dependency", () => {
  const commandLabels = new Set(verify.staticCommands.map(([label]) => label));
  for (const required of ["frontend-architecture", "openapi-contracts", "code-layout", "runtime-environment-keys", "backend-archunit"]) {
    assert.equal(commandLabels.has(required), true, `missing static gate: ${required}`);
  }
  for (const retired of ["database-operation-budget", "agent-lifecycle", "foundation-standard-actions", "project-memory", "provider-free-context", "roadmap-program-registry"]) {
    assert.equal(commandLabels.has(retired), false, `retired control remained: ${retired}`);
  }
  const source = fs.readFileSync(verifyPath, "utf8");
  for (const retiredReference of ["standards-coverage", "standards-enforcement", "receipt", "dependencyDigests", "randomUUID"]) {
    assert.doesNotMatch(source, new RegExp(retiredReference, "i"));
  }
});

test("normal verification keeps the explicit local, foundation and Java test entries", () => {
  const commands = new Map(verify.runtimeCommands.map(([label, command, args, remote = false]) => [label, {command, args, remote}]));
  assert.deepEqual(commands.get("THCL-04-node-tests"), {command: "node", args: ["scripts/test/test-health-entry-runner.mjs", "--node"], remote: false});
  assert.deepEqual(commands.get("THCL-04-foundation-tests"), {command: "yarn", args: ["--cwd", "libraries/frontend/admin-ui-foundation", "test"], remote: false});
  const expectedModules = ["audit-model", "audit-read", "catalog", "execution-context", "extension", "foundation", "fulfillment-production", "inventory"];
  assert.deepEqual(expectedModules.map((moduleName) => commands.get(`THCL-JAVA-${moduleName}`)), expectedModules.map((moduleName) => ({
    command: "node",
    args: ["scripts/test/r5-remote-testcontainers.mjs", `:apps:backend:catering-business-server:modules:${moduleName}:test`],
    remote: true,
  })));
});
