import assert from "node:assert/strict";
import childProcess from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const start = path.join(root, "scripts/dev/start");

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
