import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  CONTRACT_RULE_NAMES,
  CONTRACT_SUPPORT_CHECK_COUNT,
  contractsRoot,
  runContractsStaticChecks,
} from './check-static.mjs';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-contracts-static-'));

function rule(report, name) {
  const result = report.results.find((candidate) => candidate.name === name);
  assert.ok(result, `contracts static report must contain ${name}`);
  return result;
}

function assertVector(report, failingRules = [], supportStatus = 'PASS') {
  const expectedFailures = new Set(failingRules);
  for (const result of report.results) {
    assert.equal(
      result.status,
      expectedFailures.has(result.name) ? 'FAIL' : 'PASS',
      `${result.name} status drifted during a targeted mutation: ${result.error ?? ''}`,
    );
  }
  assert.equal(report.support.status, supportStatus, report.support.error);
}

function withMutation(relativePath, mutate, assertion) {
  const filePath = path.join(fixtureRoot, relativePath);
  const original = fs.readFileSync(filePath, 'utf8');
  try {
    fs.writeFileSync(filePath, mutate(original));
    assertion(runContractsStaticChecks({contractsRoot: fixtureRoot}));
  } finally {
    fs.writeFileSync(filePath, original);
  }
}

try {
  fs.cpSync(contractsRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules');
    },
  });

  assert.deepEqual(CONTRACT_RULE_NAMES, [
    'zero-adapter-capability',
    'tr05-named-boundary',
    'runtime-id-prefix-exact-set',
    'closed-literal-unions',
  ]);
  assert.equal(CONTRACT_SUPPORT_CHECK_COUNT, 1);

  const cleanReport = runContractsStaticChecks({contractsRoot: fixtureRoot});
  assertVector(cleanReport);

  withMutation(
    'src/foundations/time.ts',
    (source) => `${source}\nexport const forbiddenFetchProbe = () => fetch('/x');\n`,
    (report) => {
      assertVector(report, ['zero-adapter-capability']);
      assert.match(rule(report, 'zero-adapter-capability').error, /fetch/);
    },
  );

  withMutation(
    'src/types/error.ts',
    (source) => `${source}\nexport interface ForbiddenOpenRecord { readonly payload: Record<string, unknown>; }\n`,
    (report) => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /Record<string, unknown>/);
    },
  );

  withMutation(
    'src/types/error.ts',
    (source) => source.replace(
      /export interface ErrorDefinition \{[\s\S]*?\n\}\n\nexport interface RenderedErrorTemplate/,
      'interface InternalErrorDefinition { readonly payload: Record<string, unknown>; }\nexport type ErrorDefinition = InternalErrorDefinition;\n\nexport interface RenderedErrorTemplate',
    ),
    (report) => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /Record<string, unknown>/);
    },
  );

  withMutation(
    'src/types/error.ts',
    (source) => source.replace(
      /export interface ErrorDefinition \{[\s\S]*?\n\}\n\nexport interface RenderedErrorTemplate/,
      'interface InternalErrorDefinition { readonly payload: Record<string, unknown>; }\ntype ErrorDefinitionAlias = InternalErrorDefinition;\nexport type {ErrorDefinitionAlias as ErrorDefinition};\n\nexport interface RenderedErrorTemplate',
    ),
    (report) => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /Record<string, unknown>/);
    },
  );

  withMutation(
    'src/foundations/time.ts',
    (source) => source.replace(
      'export const nowTimestampMs = (): TimestampMs => Date.now();',
      'const unsafeTimestamp = (payload: Record<string, unknown>) => payload;\nexport const nowTimestampMs = unsafeTimestamp;',
    ),
    (report) => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /Record<string, unknown>/);
    },
  );

  withMutation(
    'src/types/error.ts',
    (source) => `${source}\nexport type ForbiddenGeneric<TValue extends Record<string, unknown>> = TValue;\n`,
    (report) => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /generic constraint/);
    },
  );

  withMutation(
    'src/foundations/time.ts',
    (source) => `${source}\nconst forbiddenDoubleCast = 'x' as unknown as string;\nvoid forbiddenDoubleCast;\n`,
    (report) => {
      assertVector(report, ['tr05-named-boundary']);
      assert.match(rule(report, 'tr05-named-boundary').error, /double assertion/);
    },
  );

  withMutation(
    'src/foundations/runtimeId.ts',
    (source) => source.replace("  projection: 'prj',\n", ''),
    (report) => {
      assertVector(report, ['runtime-id-prefix-exact-set']);
      assert.match(rule(report, 'runtime-id-prefix-exact-set').error, /projection/);
    },
  );

  withMutation(
    'src/types/error.ts',
    (source) => source.replace(
      /export type ErrorCategory =[\s\S]*?;\n\nexport type ErrorSeverity/,
      'export type ErrorCategory = string;\n\nexport type ErrorSeverity',
    ),
    (report) => {
      assertVector(report, ['closed-literal-unions']);
      assert.match(rule(report, 'closed-literal-unions').error, /ErrorCategory/);
    },
  );

  withMutation(
    'src/types/command.ts',
    (source) => source.replace(
      "readonly workspace?: 'MAIN' | 'BRANCH';",
      'readonly workspace?: string;',
    ),
    (report) => {
      assertVector(report, ['closed-literal-unions']);
      assert.match(rule(report, 'closed-literal-unions').error, /CommandRouteContext\.workspace/);
    },
  );

  withMutation(
    'src/types/command.ts',
    (source) => source.replace(
      "readonly workspace?: 'MAIN' | 'BRANCH';",
      "readonly workspace: 'MAIN' | 'BRANCH';",
    ),
    (report) => {
      assertVector(report);
    },
  );

  withMutation(
    'src/index.ts',
    (source) => source.replace('  ProjectionId,\n', ''),
    (report) => {
      assertVector(report, [], 'FAIL');
      assert.match(report.support.error, /ProjectionId/);
    },
  );

  withMutation(
    'src/index.ts',
    (source) => `${source}\nexport const unexpectedContractExport = 1;\n`,
    (report) => {
      assertVector(report, [], 'FAIL');
      assert.match(report.support.error, /unexpectedContractExport/);
    },
  );
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

assert.equal(fs.existsSync(fixtureRoot), false, 'contracts static fixture must be cleaned');
console.log('CONTRACTS_MODEL_CLEANUP=PASS');
console.log('TERMINAL_CONTRACTS_STATIC_MODEL_TEST=PASS');
