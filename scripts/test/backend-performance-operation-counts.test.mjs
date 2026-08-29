import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  OPERATION_COUNT_SOURCE_PATH,
  readBackendPerformanceOperationCounts,
} from "../policy/backend-performance-operation-counts.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

const writeSource = (root, source) => {
  const absolute = path.join(root, OPERATION_COUNT_SOURCE_PATH);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(source, null, 2)}\n`);
};

const canonicalSource = () =>
  JSON.parse(fs.readFileSync(path.join(repositoryRoot, OPERATION_COUNT_SOURCE_PATH), "utf8"));

const withScratchSource = (mutate) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-operation-counts-"));
  try {
    const source = canonicalSource();
    mutate?.(source);
    writeSource(root, source);
    return readBackendPerformanceOperationCounts({ root });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

test("manual operation count source exposes all six denominator values", () => {
  const source = canonicalSource();
  assert.deepEqual(withScratchSource(), {
    operations: source.operations,
    reads: source.reads,
    commands: source.commands,
    commandsByFace: {
      operationsAdmin: source.commandsByFace.operationsAdmin,
      platformAdmin: source.commandsByFace.platformAdmin,
      public: source.commandsByFace.public,
    },
  });
});

test("manual operation count source reads each denominator field from the source file", () => {
  const source = canonicalSource();
  assert.equal(withScratchSource((value) => { value.operations = source.operations + 4; }).operations, source.operations + 4);
  assert.equal(withScratchSource((value) => { value.reads = source.reads + 1; }).reads, source.reads + 1);
  assert.equal(withScratchSource((value) => {
    value.commands = source.commands + 1;
    value.commandsByFace.operationsAdmin = source.commandsByFace.operationsAdmin + 1;
  }).commands, source.commands + 1);
  assert.equal(withScratchSource((value) => {
    value.commandsByFace.operationsAdmin = source.commandsByFace.operationsAdmin - 1;
    value.commandsByFace.platformAdmin = source.commandsByFace.platformAdmin + 1;
  }).commandsByFace.operationsAdmin, source.commandsByFace.operationsAdmin - 1);
  assert.equal(withScratchSource((value) => {
    value.commandsByFace.platformAdmin = source.commandsByFace.platformAdmin - 1;
    value.commandsByFace.public = source.commandsByFace.public + 1;
  }).commandsByFace.platformAdmin, source.commandsByFace.platformAdmin - 1);
  assert.equal(withScratchSource((value) => {
    value.commandsByFace.public = source.commandsByFace.public - 1;
    value.commandsByFace.operationsAdmin = source.commandsByFace.operationsAdmin + 1;
  }).commandsByFace.public, source.commandsByFace.public - 1);
});

test("manual operation count source rejects mismatched command face totals", () => {
  for (const field of ["operationsAdmin", "platformAdmin", "public"]) {
    assert.throws(
      () => withScratchSource((source) => { source.commandsByFace[field] -= 1; }),
      /OPERATION_COUNT_SOURCE_FACE_SUM_INVALID/,
    );
  }
});
