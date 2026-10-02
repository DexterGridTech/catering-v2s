import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validateInvocationArguments} from './r5-remote-testcontainers.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const verifyPath = path.join(repoRoot, 'tools/verify-gates/verify.mjs');
const verify = await import(pathToFileURL(verifyPath).href);

test('static verification runs each explicit true gate once', () => {
  const calls = [];
  const commands = [
    ['first', 'first-command', ['--first'], ['FIRST=PASS']],
    ['second', 'scripts/check/second', [], ['SECOND=PASS']],
  ];
  const result = verify.runStatic({
    root: repoRoot,
    commands,
    spawnSyncImpl(command, args) {
      calls.push({command, args});
      return {status: 0, stdout: command.includes('second') ? 'SECOND=PASS\n' : 'FIRST=PASS\n', stderr: ''};
    },
  });
  assert.equal(result.count, 2);
  assert.deepEqual(calls, [
    {command: 'first-command', args: ['--first']},
    {command: path.join(repoRoot, 'scripts/check/second'), args: []},
  ]);
});

test('R5 materialization verification reports its actual child duration', () => {
  const chunks = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = function (chunk, ...args) {
    chunks.push(String(chunk));
    return true;
  };
  try {
    verify.runStatic({
      root: repoRoot,
      commands: [['r5-edge-materialize', 'node', ['fixture'], ['R5_EDGE_MATERIALIZE_CHECK=PASS']]],
      spawnSyncImpl() {
        return {status: 0, stdout: 'R5_EDGE_MATERIALIZE_CHECK=PASS\n', stderr: ''};
      },
    });
  } finally {
    process.stdout.write = originalWrite;
  }
  assert.match(chunks.join(''), /R5_VERIFY_STATIC_DURATION_MS:r5-edge-materialize=\d+\n/);
});

test('a static gate fails closed on its first missing marker', () => {
  const calls = [];
  assert.throws(
    () =>
      verify.runStatic({
        root: repoRoot,
        commands: [
          ['first', 'first-command', [], ['FIRST=PASS']],
          ['second', 'second-command', [], ['SECOND=PASS']],
        ],
        spawnSyncImpl(command) {
          calls.push(command);
          return {status: 0, stdout: 'OTHER=PASS\n', stderr: ''};
        },
      }),
    error => error.message === 'R5_VERIFY_STATIC_MARKER_MISSING:first:FIRST=PASS',
  );
  assert.deepEqual(calls, ['first-command']);
});

test('runtime command failures retain process status and spawn diagnostics', () => {
  const stderrChunks = [];
  const stdoutChunks = [];
  const originalStderrWrite = process.stderr.write;
  const originalStdoutWrite = process.stdout.write;
  process.stderr.write = function (chunk, ...args) {
    stderrChunks.push(String(chunk));
    return true;
  };
  process.stdout.write = function (chunk, ...args) {
    stdoutChunks.push(String(chunk));
    return true;
  };
  try {
    assert.throws(
      () =>
        verify.runRuntimeCommand({
          root: repoRoot,
          commandTuple: ['fixture-runtime', 'node', []],
          spawnSyncImpl() {
            return {
              status: null,
              signal: 'SIGTERM',
              error: {code: 'ECANCELED'},
              stdout: 'partial output',
              stderr: 'partial error\n',
            };
          },
        }),
      error =>
        error.message === 'R5_VERIFY_FIRST_FAILURE:fixture-runtime:status=null:signal=SIGTERM:spawnError=ECANCELED',
    );
  } finally {
    process.stderr.write = originalStderrWrite;
    process.stdout.write = originalStdoutWrite;
  }
  assert.equal(stdoutChunks.join(''), 'partial output');
  assert.ok(stderrChunks.join('').includes('partial error\n'));
  const finish = stderrChunks
    .join('')
    .split('\n')
    .filter(line => line.startsWith('R5_VERIFY_RUNTIME_COMMAND '))
    .map(line => JSON.parse(line.replace(/^R5_VERIFY_RUNTIME_COMMAND /, '')))
    .find(event => event.phase === 'finish');
  assert.equal(finish.label, 'fixture-runtime');
  assert.equal(finish.status, null);
  assert.equal(finish.signal, 'SIGTERM');
  assert.equal(finish.spawnErrorCode, 'ECANCELED');
  assert.equal(finish.stdoutBytes, Buffer.byteLength('partial output'));
  assert.equal(finish.stderrBytes, Buffer.byteLength('partial error\n'));
  assert.ok(Number.isInteger(finish.elapsedMs));
});

test('verify retains true static gates and has no retired control-plane dependency', () => {
  const commandLabels = new Set(verify.staticCommands.map(([label]) => label));
  for (const required of [
    'project-memory',
    'backend-boundaries-self-test',
    'frontend-architecture',
    'openapi-contracts',
    'r5-edge-materialize-path-self-test',
    'r5-edge-materialize',
    'heritage-registry',
    'seed-fixture-contract',
    'code-layout-self-test',
    'code-layout',
    'runtime-environment-keys',
    'backend-archunit',
    'query-boundaries',
    'security-boundaries-self-test',
    'security-boundaries',
    'capability-invariants-self-test',
    'capability-invariants',
    'operation-handler-bindings-self-test',
    'operation-handler-bindings',
    'backend-performance-m1-command-bindings-self-test',
    'backend-performance-m1-command-bindings',
    'module-dependency-registry-self-test',
    'module-dependency-registry',
  ]) {
    assert.equal(commandLabels.has(required), true, `missing static gate: ${required}`);
  }
  const labels = verify.staticCommands.map(([label]) => label);
  assert.ok(labels.indexOf('r5-edge-materialize-path-self-test') < labels.indexOf('r5-edge-materialize'));
  assert.ok(labels.indexOf('r5-edge-materialize-path-self-test') < labels.indexOf('heritage-registry'));
  assert.ok(labels.indexOf('heritage-registry') < labels.indexOf('r5-edge-materialize'));
  assert.ok(labels.indexOf('r5-edge-materialize') < labels.indexOf('openapi-contracts'));
  assert.ok(labels.indexOf('r5-edge-materialize') < labels.indexOf('security-boundaries-self-test'));
  assert.ok(labels.indexOf('security-boundaries-self-test') < labels.indexOf('security-boundaries'));
  assert.ok(labels.indexOf('security-boundaries') < labels.indexOf('openapi-contracts'));
  assert.ok(labels.indexOf('r5-edge-materialize') < labels.indexOf('capability-invariants-self-test'));
  assert.ok(labels.indexOf('capability-invariants-self-test') < labels.indexOf('capability-invariants'));
  assert.ok(labels.indexOf('capability-invariants') < labels.indexOf('operation-handler-bindings-self-test'));
  assert.ok(labels.indexOf('operation-handler-bindings-self-test') < labels.indexOf('operation-handler-bindings'));
  assert.ok(labels.indexOf('operation-handler-bindings') < labels.indexOf('openapi-contracts'));
  assert.ok(
    labels.indexOf('operation-handler-bindings') < labels.indexOf('backend-performance-m1-command-bindings-self-test'),
  );
  assert.ok(
    labels.indexOf('backend-performance-m1-command-bindings-self-test') <
      labels.indexOf('backend-performance-m1-command-bindings'),
  );
  assert.ok(labels.indexOf('backend-performance-m1-command-bindings') < labels.indexOf('openapi-contracts'));
  assert.ok(labels.indexOf('reuse-consistency') < labels.indexOf('module-dependency-registry-self-test'));
  assert.ok(labels.indexOf('module-dependency-registry-self-test') < labels.indexOf('module-dependency-registry'));
  assert.ok(labels.indexOf('module-dependency-registry') < labels.indexOf('backend-archunit'));
  assert.deepEqual(
    verify.staticCommands.find(([label]) => label === 'backend-performance-m1-command-bindings-self-test'),
    [
      'backend-performance-m1-command-bindings-self-test',
      'node',
      ['scripts/generate/backend-performance-m1-command-execution-bindings.mjs', '--self-test'],
      ['RED_TERMINAL_OPERATION_EMITTER_MISSING=PASS', 'OPERATION_COMMAND_BINDING_RED_MUTATIONS=PASS'],
    ],
  );
  assert.deepEqual(
    verify.staticCommands.find(([label]) => label === 'backend-performance-m1-command-bindings'),
    [
      'backend-performance-m1-command-bindings',
      'node',
      ['scripts/generate/backend-performance-m1-command-execution-bindings.mjs', '--check'],
      ['OPERATION_COMMAND_BINDINGS=VALIDATED'],
    ],
  );
  assert.deepEqual(
    verify.staticCommands.find(([label]) => label === 'module-dependency-registry-self-test'),
    [
      'module-dependency-registry-self-test',
      'scripts/check/module-dependency-registry',
      ['--self-test'],
      [
        'MODULE_DEPENDENCY_REGISTRY_SELF_TEST=PASS',
        'RED_MODULE_SOURCE_ROOT_MISSING=PASS',
        'RED_MODULE_SOURCE_ROOT_EMPTY=PASS',
      ],
    ],
  );
  assert.deepEqual(
    verify.staticCommands.find(([label]) => label === 'module-dependency-registry'),
    ['module-dependency-registry', 'scripts/check/module-dependency-registry', [], ['MODULE_DEPENDENCY_REGISTRY=PASS']],
  );
  for (const retired of [
    'database-operation-budget',
    'agent-lifecycle',
    'foundation-standard-actions',
    'provider-free-context',
    'roadmap-program-registry',
  ]) {
    assert.equal(commandLabels.has(retired), false, `retired control remained: ${retired}`);
  }
  const source = fs.readFileSync(verifyPath, 'utf8');
  for (const retiredReference of [
    'standards-coverage',
    'standards-enforcement',
    'receipt',
    'dependencyDigests',
    'randomUUID',
  ]) {
    assert.doesNotMatch(source, new RegExp(retiredReference, 'i'));
  }
});

test('normal verification keeps the explicit local, foundation and Java test entries', () => {
  const commands = new Map(
    verify.runtimeCommands.map(([label, command, args, remote = false]) => [label, {command, args, remote}]),
  );
  for (const [label, command, args, remote = false] of verify.runtimeCommands) {
    if (remote && command === 'node' && args[0] === 'scripts/test/r5-remote-testcontainers.mjs') {
      assert.equal(args.includes('--no-daemon'), false, `${label} delegates --no-daemon to the managed runner`);
      assert.doesNotThrow(
        () => validateInvocationArguments(args.slice(1)),
        `${label} uses only arguments accepted by the managed runner`,
      );
    }
  }
  assert.equal(commands.has('U01-codegen'), false, 'contract-face/openapi-contracts own edge-codegen --check');
  assert.deepEqual(commands.get('THCL-04-node-tests'), {
    command: 'node',
    args: ['scripts/test/test-health-entry-runner.mjs', '--node'],
    remote: false,
  });
  assert.deepEqual(commands.get('THCL-04-foundation-tests'), {
    command: 'yarn',
    args: ['--cwd', 'libraries/frontend/admin-ui-foundation', 'test'],
    remote: false,
  });
  const expectedModules = [
    'audit-model',
    'audit-read',
    'catalog',
    'execution-context',
    'extension',
    'foundation',
    'inventory',
  ];
  assert.deepEqual(
    expectedModules.map(moduleName => commands.get(`THCL-JAVA-${moduleName}`)),
    expectedModules.map(moduleName => ({
      command: 'node',
      args: [
        'scripts/test/r5-remote-testcontainers.mjs',
        `:apps:backend:catering-business-server:modules:${moduleName}:test`,
      ],
      remote: true,
    })),
  );
});

test('TER root verifier tuples are wired only after CP-7 closure', () => {
  assert.deepEqual(
    verify.staticCommands.find(([label]) => label === 'terminal-static'),
    [
      'terminal-static',
      'yarn',
      ['workspace', '@catering-v2s/terminal', 'run', 'verify:static'],
      ['TERMINAL_STATIC=PASS'],
    ],
  );
  assert.deepEqual(
    verify.runtimeCommands.find(([label]) => label === 'terminal-verify'),
    ['terminal-verify', 'yarn', ['workspace', '@catering-v2s/terminal', 'run', 'verify']],
  );
});
