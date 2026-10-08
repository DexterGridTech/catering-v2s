import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {fileURLToPath, pathToFileURL} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const verifyPath = path.join(repoRoot, "tools/verify-gates/verify.mjs");
const verify = await import(pathToFileURL(verifyPath).href);

test("the static gate list contains commands and success signals, not a generated catalog", () => {
  for (const [label, command, args, markers] of verify.staticCommands) {
    assert.equal(typeof label, "string");
    assert.equal(typeof command, "string");
    assert.equal(Array.isArray(args), true);
    assert.equal(Array.isArray(markers) && markers.length > 0, true);
  }
  const source = fs.readFileSync(verifyPath, "utf8");
  assert.doesNotMatch(source, /catalogPath|executionCatalog|coverageChecker|receiptPath|sha256/i);
});

test("static verification fails closed on a nonzero real-check result", () => {
  assert.throws(
    () => verify.runStatic({
      root: repoRoot,
      commands: [["broken", "broken-command", [], ["BROKEN=PASS"]]],
      spawnSyncImpl() {
        return {status: 7, stdout: "", stderr: "broken\n"};
      },
    }),
    (error) => error.message === "R5_VERIFY_STATIC_FIRST_FAILURE:broken",
  );
});

test("TER tuples use the accepted commands, arguments, and marker contract", () => {
  assert.deepEqual(verify.staticCommands.find(([label]) => label === "terminal-static"), [
    "terminal-static",
    "yarn",
    ["workspace", "@catering-v2s/terminal", "run", "verify:static"],
    ["TERMINAL_STATIC=PASS"],
  ]);
  assert.deepEqual(verify.runtimeCommands.find(([label]) => label === "terminal-verify"), [
    "terminal-verify",
    "yarn",
    ["workspace", "@catering-v2s/terminal", "run", "verify", "--static-verified-by-parent"],
  ]);
});
