import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  STATE_RULE_NAMES,
  STATE_SUPPORT_CHECK_COUNT,
  runStateStaticChecks,
  stateRoot,
} from './check-static.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-state-static-'));

function rule(report, name) {
  const result = report.results.find(candidate => candidate.name === name);
  assert.ok(result, `state static report must contain ${name}`);
  return result;
}

function assertVector(report, failingRules = [], supportStatus = 'PASS') {
  const expectedFailures = new Set(failingRules);
  for (const result of report.results) {
    assert.equal(
      result.status,
      expectedFailures.has(result.name) ? 'FAIL' : 'PASS',
      `${result.name} status drifted during targeted mutation: ${result.error ?? ''}`,
    );
  }
  assert.equal(report.support.status, supportStatus, report.support.error);
}

function withMutation(relativePath, mutate, assertion) {
  const filePath = path.join(fixtureRoot, relativePath);
  const original = fs.readFileSync(filePath, 'utf8');
  try {
    fs.writeFileSync(filePath, mutate(original));
    assertion(runStateStaticChecks({statePackageRoot: fixtureRoot}));
  } finally {
    fs.writeFileSync(filePath, original);
  }
}

try {
  fs.cpSync(stateRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules');
    },
  });

  assert.deepEqual(STATE_RULE_NAMES, [
    'toolkit-zero-slice',
    'tr05-named-boundary',
    'storage-result-consumed',
    'no-storage-clear',
  ]);
  assert.equal(STATE_SUPPORT_CHECK_COUNT, 1);

  assertVector(runStateStaticChecks({statePackageRoot: fixtureRoot}));

  withMutation(
    'src/foundations/createStateStore.ts',
    source => "import {createSlice} from '@reduxjs/toolkit';\n" + source.replace(
      'export const createStateStore = (',
      "void createSlice({name: 'bad', initialState: {}, reducers: {}});\n\nexport const createStateStore = (",
    ),
    report => {
      assertVector(report, ['toolkit-zero-slice']);
      assert.match(rule(report, 'toolkit-zero-slice').error, /createSlice/);
    },
  );

  withMutation(
    'src/types/slice.ts',
    source => `${source}\nexport const leakedRegistration: StateRuntimeSliceRegistration | undefined = undefined;\n`,
    report => {
      assertVector(report, ['toolkit-zero-slice']);
      assert.match(rule(report, 'toolkit-zero-slice').error, /descriptor or registration/);
    },
  );

  withMutation(
    'src/types/sync.ts',
    source => source.replace(
      '  readonly value: SyncValueEnvelope<TValue>',
      '  readonly value: any',
    ),
    report => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /TR-05 any/);
    },
  );

  withMutation(
    'src/foundations/persistenceEngine.ts',
    source => source.replace(
      '    const result = await this.#storagePorts[input.storageKind].write({',
      '    await this.#storagePorts[input.storageKind].write({key: input.storageKey, value: input.encoded, timeoutMs: this.#timeouts.writeMs});\n    const result = await this.#storagePorts[input.storageKind].write({',
    ),
    report => {
      assertVector(report, ['storage-result-consumed']);
      assert.match(rule(report, 'storage-result-consumed').error, /result must be consumed/);
    },
  );

  withMutation(
    'src/foundations/persistenceEngine.ts',
    source => source.replace(
      '      const listed = await this.#storagePorts[storageKind].listKeys({',
      '      const clearResult = await this.#storagePorts[storageKind].clear({timeoutMs: this.#timeouts.resetMs});\n      void clearResult;\n      const listed = await this.#storagePorts[storageKind].listKeys({',
    ),
    report => {
      assertVector(report, ['no-storage-clear']);
      assert.match(rule(report, 'no-storage-clear').error, /StateStoragePort\.clear/);
    },
  );

  withMutation(
    'src/index.ts',
    source => `${source}\nexport const unexpectedStateExport = 1;\n`,
    report => {
      assertVector(report, [], 'FAIL');
      assert.match(report.support.error, /unexpectedStateExport/);
    },
  );
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

assert.equal(fs.existsSync(fixtureRoot), false, 'state static fixture must be cleaned');
console.log('STATE_MODEL_CLEANUP=PASS');
console.log('TERMINAL_STATE_STATIC_MODEL_TEST=PASS');
