import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PLATFORM_PORT_RULE_NAMES,
  PLATFORM_PORT_SUPPORT_CHECK_COUNT,
  platformPortsRoot,
  runPlatformPortsStaticChecks,
} from './check-static.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-platform-ports-static-'));

function rule(report, name) {
  const result = report.results.find(candidate => candidate.name === name);
  assert.ok(result, `platform-ports static report must contain ${name}`);
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
    assertion(runPlatformPortsStaticChecks({platformPortsRoot: fixtureRoot}));
  } finally {
    fs.writeFileSync(filePath, original);
  }
}

function withNestedDefaultDependencyMutation(assertion) {
  const defaultPath = path.join(fixtureRoot, 'src/defaults/unavailableConnector.ts');
  const helperPath = path.join(fixtureRoot, 'src/foundations/defaultLeakProbe.ts');
  const original = fs.readFileSync(defaultPath, 'utf8');
  try {
    fs.writeFileSync(
      helperPath,
      "import {reduxLeak} from 'redux';\nexport const defaultLeakProbe = (): string => reduxLeak;\n",
    );
    fs.writeFileSync(
      defaultPath,
      `import {defaultLeakProbe} from '../foundations/defaultLeakProbe';\n${original}\nvoid defaultLeakProbe;\n`,
    );
    assertion(runPlatformPortsStaticChecks({platformPortsRoot: fixtureRoot}));
  } finally {
    fs.writeFileSync(defaultPath, original);
    fs.rmSync(helperPath, {force: true});
  }
}

try {
  fs.cpSync(platformPortsRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules');
    },
  });
  const contractsFixtureRoot = path.join(fixtureRoot, 'node_modules/@catering-v2s/kernel-base-contracts');
  fs.mkdirSync(path.dirname(contractsFixtureRoot), {recursive: true});
  fs.cpSync(path.join(path.dirname(platformPortsRoot), 'contracts'), contractsFixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules');
    },
  });
  const reactNativeFixtureRoot = path.join(fixtureRoot, 'node_modules/react-native');
  fs.mkdirSync(reactNativeFixtureRoot, {recursive: true});
  fs.writeFileSync(
    path.join(reactNativeFixtureRoot, 'index.d.ts'),
    'export interface NativeModules { readonly marker: string; }\n',
  );
  const reduxFixtureRoot = path.join(fixtureRoot, 'node_modules/redux');
  fs.mkdirSync(reduxFixtureRoot, {recursive: true});
  fs.writeFileSync(
    path.join(reduxFixtureRoot, 'index.d.ts'),
    "export interface Store { readonly dispatch: (action: string) => void; }\nexport const reduxLeak = 'leak';\n",
  );

  assert.deepEqual(PLATFORM_PORT_RULE_NAMES, [
    'tr05-named-boundary',
    'required-port-shape',
    'default-import-allowlist',
    'platform-identifier-boundary',
  ]);
  assert.equal(PLATFORM_PORT_SUPPORT_CHECK_COUNT, 1);

  assertVector(runPlatformPortsStaticChecks({platformPortsRoot: fixtureRoot}));

  withMutation(
    'src/types/connector.ts',
    source => source.replace(
      'export interface ConnectorCallResponse<TPayload extends ConnectorValue> {',
      'export interface ConnectorCallResponse<TPayload extends ConnectorValue> {\n  readonly forbiddenPayload: Record<string, unknown>;',
    ),
    report => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /Record<string, unknown>/);
    },
  );

  withMutation(
    'src/types/connector.ts',
    source => source.replace('  on<TEvent extends ConnectorValue>(', '  on?<TEvent extends ConnectorValue>('),
    report => {
      assertVector(report, ['required-port-shape']);
      assert.match(rule(report, 'required-port-shape').error, /optional port member ConnectorPort\.on/);
    },
  );

  withMutation(
    'src/defaults/unavailableConnector.ts',
    source => `import type {Store} from 'redux';\n${source}\nvoid (undefined as Store | undefined);\n`,
    report => {
      assertVector(report, ['default-import-allowlist']);
      assert.match(rule(report, 'default-import-allowlist').error, /default import outside allowlist: redux/);
    },
  );

  withNestedDefaultDependencyMutation(report => {
    assertVector(report, ['default-import-allowlist']);
    assert.match(report.results.find(result => result.name === 'default-import-allowlist')?.error ?? '', /default import outside allowlist: redux/);
  });

  withMutation(
    'src/types/device.ts',
    source => `import type {NativeModules} from 'react-native';\n${source}\nexport type ForbiddenNativeModulesProbe = NativeModules;\n`,
    report => {
      assertVector(report, ['platform-identifier-boundary']);
      assert.match(rule(report, 'platform-identifier-boundary').error, /platform import react-native/);
    },
  );

  withMutation(
    'src/index.ts',
    source => `${source}\nexport const unexpectedPortExport = 1;\n`,
    report => {
      assertVector(report, [], 'FAIL');
      assert.match(report.support.error, /unexpectedPortExport/);
    },
  );
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

assert.equal(fs.existsSync(fixtureRoot), false, 'platform-ports static fixture must be cleaned');
console.log('PLATFORM_PORTS_MODEL_CLEANUP=PASS');
console.log('TERMINAL_PLATFORM_PORTS_STATIC_MODEL_TEST=PASS');
