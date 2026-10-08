#!/usr/bin/env node

import childProcess from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveGradleCommand} from '../../scripts/lib/gradle-runtime.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const childOutputBudgetBytes = 32 * 1024 * 1024;
const verifyRunId = `r5-verify-${process.pid}-${Date.now()}`;

// `scripts/verify --validate-only` deliberately names the real static checks it
// runs. It has no derived denominator, dependency digest, persistent execution artifact, or hook
// contract: a check passes only when its current command actually passes.
const staticCommands = Object.freeze([
  [
    'project-memory',
    'scripts/check/project-memory',
    [],
    ['PROJECT_MEMORY_RED_NO_MQ_OUTBOX_TDP_OMISSION=PASS', 'PROJECT_MEMORY_CHECK=PASS'],
  ],
  [
    'backend-boundaries-self-test',
    'scripts/check/backend-boundaries',
    ['--self-test'],
    ['R4_TDS_MQ_RED=PASS', 'R4_TDS_OUTBOX_RED=PASS', 'R4_TDS_APPROVED_RUNTIME_GREEN=PASS', 'R4_BACKEND_SELF_TEST=PASS'],
  ],
  [
    'logging-boundaries-self-test',
    'node',
    ['tools/verify-gates/cli.mjs', 'logging', '--self-test'],
    ['R4_LOGGING_TERMINAL_BINDING_RED=PASS', 'R4_LOGGING_TDS_RED=PASS', 'R4_LOGGING_SELF_TEST=PASS'],
  ],
  ['logging-boundaries', 'scripts/check/logging-boundaries', [], ['R4_LOGGING_BOUNDARIES=PASS']],
  ['database-boundaries', 'scripts/check/database-boundaries', [], ['R4_DATABASE_BOUNDARIES=PASS']],
  ['query-boundaries', 'scripts/check/query-boundaries', [], ['R4_DATABASE_QUERY_BOUNDARIES=PASS']],
  ['backend-boundaries', 'scripts/check/backend-boundaries', [], ['R4_BACKEND_BOUNDARIES=PASS']],
  [
    'seed-fixture-contract',
    'node',
    ['--test', 'tools/verify-gates/r5-seed-fixture-contract.test.mjs'],
    ['R5_SEED_FIXTURE_TDP_FORBIDDEN_RED=PASS'],
  ],
  [
    'frontend-architecture',
    'scripts/check/frontend-architecture',
    ['--self-test'],
    ['R5_FRONTEND_TERMINAL_FACE_RED=PASS', 'R5_TERMINAL_GENERATED_FACE_RED=PASS', 'R5_FRONTEND_ARCHITECTURE=PASS'],
  ],
  ['frontend-format', 'yarn', ['format:check'], ['All matched files use Prettier code style!']],
  ['name-code-density', 'node', ['scripts/check/name-code-density.mjs'], ['NAME_CODE_DENSITY=PASS']],
  [
    'r5-edge-materialize-path-self-test',
    'node',
    ['scripts/generate/r5-edge-materialize.mjs', '--self-test'],
    [
      'R5_EDGE_MATERIALIZE_SELF_TEST=PASS',
      'R5_EDGE_TERMINAL_READ_ANONYMOUS_RED=PASS',
      'R5_EDGE_TERMINAL_READ_WORKSPACE_SESSION_RED=PASS',
      'R5_EDGE_TERMINAL_READ_CREDENTIAL_REQUIREMENT_RED=PASS',
    ],
  ],
  [
    'terminal-client-api-self-test',
    'node',
    ['scripts/generate/terminal-client-api.mjs', '--self-test'],
    [
      'TERMINAL_CLIENT_API_SELF_TEST=PASS',
      'RED_ZERO_SELECTOR=PASS',
      'RED_WRONG_FACE=PASS',
      'RED_GENERATED_DRIFT=PASS',
      'RED_MULTIPLE_TARGET_ASSIGNMENT=PASS',
      'RED_DUPLICATE_ASSIGNMENT=PASS',
      'RED_NON_OWNER_TARGET=PASS',
      'RED_SELECTOR_MISMATCH=PASS',
      'RED_OUTPUT_ESCAPE=PASS',
      'RED_ROOT_ESCAPE=PASS',
      'RED_SYMLINK_ESCAPE=PASS',
      'RED_TARGET_PACKAGE_SYMLINK_ESCAPE=PASS',
      'RED_TARGET_MODULE_NAME_SYMLINK_ESCAPE=PASS',
    ],
  ],
  [
    'terminal-update-artifact-self-test',
    'node',
    ['scripts/build/terminal-update-artifact.mjs', '--self-test'],
    [
      'TERMINAL_UPDATE_ARTIFACT_BUILD_SELF_TEST=PASS',
      'RED_BINARY_OUTPUT_OVER_DEFAULT=PASS',
      'RED_ZIP_ENTRY_SET=PASS',
      'RED_NATIVE_VERSION_IDENTITY=PASS',
      'RED_INVALID_PUBLICATION_ID=PASS',
      'RED_CHANGED_EMBEDDED_BUNDLE=PASS',
      'RED_MISSING_APK_RESOURCE=PASS',
      'RED_WRONG_RESOURCE_QUALIFIER=PASS',
      'RED_INVALID_RELEASE_VALUES=PASS',
      'RED_INSTALL_IDENTITY_MISMATCH=PASS',
      'RED_EXTERNAL_SYMLINK_INPUT=PASS',
    ],
  ],
  [
    'terminal-update-artifact-generator-self-test',
    'node',
    ['scripts/generate/terminal-update-artifact.mjs', '--self-test'],
    ['TERMINAL_UPDATE_ARTIFACT_SELF_TEST=PASS'],
  ],
  [
    'terminal-update-artifact-generator',
    'node',
    ['scripts/generate/terminal-update-artifact.mjs', '--check'],
    ['TERMINAL_UPDATE_ARTIFACT_GENERATOR_CHECK=PASS'],
  ],
  [
    'terminal-connection-protocol-self-test',
    'node',
    ['scripts/generate/terminal-connection-protocol.mjs', '--self-test'],
    [
      'TDP_PROTOCOL_ROOT_ESCAPE_RED=PASS',
      'TDP_PROTOCOL_SYMLINK_ESCAPE_RED=PASS',
      'TDP_PROTOCOL_SECRET_TOSTRING_RED=PASS',
      'TDP_PROTOCOL_MESSAGE_CLOSURE_RED=PASS',
      'TDP_PROTOCOL_SELF_TEST=PASS',
    ],
  ],
  [
    'terminal-connection-protocol',
    'node',
    ['scripts/generate/terminal-connection-protocol.mjs', '--check'],
    ['TDP_PROTOCOL_CHECK=PASS'],
  ],
  [
    'heritage-registry',
    'node',
    ['scripts/check/heritage-registry', '--self-test'],
    ['HERITAGE_REGISTRY_SELF_TEST=PASS', 'HERITAGE_REGISTRY=PASS'],
  ],
  [
    'r5-edge-materialize',
    'node',
    ['scripts/generate/r5-edge-materialize.mjs', '--check'],
    ['R5_EDGE_MATERIALIZE_CHECK=PASS'],
  ],
  [
    'capability-invariants-self-test',
    'node',
    ['tools/capability-invariants/cli.mjs', '--self-test'],
    [
      'CAPABILITY_INVARIANTS_SELF_TEST=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadStoreBasic=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadStoreOrganizationPath=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadStoreActiveContracts=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadContract=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadStoreServicePointAreas=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadServicePointArea=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadStoreServicePoints=PASS',
      'RED_TERMINAL_CREDENTIAL_READ_MARKER:terminalReadServicePoint=PASS',
    ],
  ],
  [
    'capability-invariants',
    'node',
    ['tools/capability-invariants/cli.mjs', 'check'],
    ['CAPABILITY_INVARIANTS=PASS', 'P3_A_OTP_RESPONSE_EXPOSURE=PASS'],
  ],
  [
    'operation-handler-bindings-self-test',
    'node',
    ['scripts/generate/operation-handler-bindings.mjs', '--self-test'],
    ['BP_U02_BINDING_SELF_TEST=PASS'],
  ],
  [
    'operation-handler-bindings',
    'node',
    ['scripts/generate/operation-handler-bindings.mjs', '--check'],
    ['BP_U02_BINDING_CHECK=PASS', 'CONTEXT_KIND_NEGATIVE=PASS'],
  ],
  [
    'backend-performance-m1-command-bindings-self-test',
    'node',
    ['scripts/generate/backend-performance-m1-command-execution-bindings.mjs', '--self-test'],
    ['RED_TERMINAL_OPERATION_EMITTER_MISSING=PASS', 'OPERATION_COMMAND_BINDING_RED_MUTATIONS=PASS'],
  ],
  [
    'backend-performance-m1-command-bindings',
    'node',
    ['scripts/generate/backend-performance-m1-command-execution-bindings.mjs', '--check'],
    ['OPERATION_COMMAND_BINDINGS=VALIDATED'],
  ],
  [
    'security-boundaries-self-test',
    'node',
    ['tools/verify-gates/cli.mjs', 'security', '--self-test'],
    ['R4_SECURITY_SELF_TEST=PASS'],
  ],
  ['security-boundaries', 'scripts/check/security-boundaries', [], ['R5_SECURITY_BOUNDARIES=PASS']],
  ['openapi-contracts', 'scripts/check/openapi-contracts', [], ['R5_OPENAPI_CONTRACTS=PASS']],
  ['ui-wireframe-traceability', 'scripts/check/ui-wireframe-traceability', [], ['R4_UI_WIREFRAME_TRACEABILITY=PASS']],
  [
    'business-terminology-traceability',
    'scripts/check/business-terminology-traceability',
    [],
    ['R4_BUSINESS_TERMINOLOGY_TRACEABILITY=PASS'],
  ],
  [
    'code-layout-self-test',
    'scripts/check/code-layout',
    ['--self-test'],
    ['CODE_LAYOUT_SELF_TEST=PASS', 'GREEN_FIXTURE_APPROVED_TDS_RUNTIME=PASS'],
  ],
  ['code-layout', 'scripts/check/code-layout', [], ['CODE_LAYOUT=PASS']],
  ['catalog-inventory-p1', 'node', ['tools/catalog-inventory-p1/cli.mjs'], ['CATALOG_INVENTORY_P1_CHECK=PASS']],
  ['sales-menu-contract', 'scripts/check/sales-menu-contract', [], ['SALES_MENU_CONTRACT=PASS']],
  ['sales-menu-schema', 'scripts/check/sales-menu-schema', [], ['SALES_MENU_SCHEMA=PASS']],
  ['sales-menu-l2-p1', 'node', ['scripts/generate/sales-menu-p1.mjs', '--check'], ['SALES_MENU_P1=PASS']],
  [
    'store-terminal-rules',
    'node',
    ['scripts/generate/store-terminal-rules.mjs', '--self-test', '--check'],
    ['STORE_TERMINAL_RULES_SELF_TEST=PASS', 'STORE_TERMINAL_RULES_CHECK=PASS'],
  ],
  [
    'sales-menu-l2-fixture',
    'node',
    ['scripts/test/sales-menu-l2-fixture.mjs', '--self-test'],
    ['SALES_MENU_L2_FIXTURE_SELF_TEST=PASS'],
  ],
  [
    'sales-menu-l2-runner-self-test',
    'scripts/test/browser-l2',
    ['--suite', 'sales-menu', '--self-test'],
    ['BROWSER_L2_SALES_MENU_RUNTIME_SELF_TEST=PASS'],
  ],
  [
    'l2-locator-bindings-static',
    'node',
    ['--test', 'scripts/test/l2-locator-bindings.static.test.mjs'],
    ['tests 8', 'pass 8'],
  ],
  ['runtime-environment-keys', 'scripts/check/runtime-environment-keys', [], ['R5_RUNTIME_ENVIRONMENT_KEYS=PASS']],
  [
    'runtime-environment-keys-self-test',
    'node',
    ['tools/verify-gates/cli.mjs', 'runtime-environment-keys', '--self-test'],
    ['R5_RUNTIME_ENVIRONMENT_KEYS_SELF_TEST=PASS'],
  ],
  ['lifecycle-vocabulary', 'scripts/check/lifecycle-vocabulary', [], ['R6_LIFECYCLE_VOCABULARY=PASS']],
  ['reuse-consistency', 'node', ['tools/verify-gates/cli.mjs', 'r11'], ['R11_REUSE_CONSISTENCY=PASS']],
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
  ['module-dependency-registry', 'scripts/check/module-dependency-registry', [], ['MODULE_DEPENDENCY_REGISTRY=PASS']],
  [
    'backend-archunit',
    'gradle',
    [':apps:backend:catering-business-server:backendModuleBoundariesArchunitSelector', '--no-daemon'],
    ['BUILD SUCCESSFUL'],
  ],
  ['backend-pmd-preserve-stack-trace', 'gradle', ['backendPmdPreserveStackTrace', '--no-daemon'], ['BUILD SUCCESSFUL']],
  ['backend-spotless-check', 'gradle', ['spotlessCheck', '--no-daemon'], ['BUILD SUCCESSFUL']],
  [
    'terminal-static',
    'yarn',
    ['workspace', '@catering-v2s/terminal', 'run', 'verify:static'],
    ['TERMINAL_STATIC=PASS'],
  ],
]);

const runtimeCommands = [
  [
    'tds-constructor-assembly',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:terminal-data-server:test',
      '--tests',
      'architecture.TdsModuleBoundariesTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocolTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodecTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.websocket.TdsAuthenticationFailureDiagnosticsTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.websocket.TdsWebSocketMessageOwnershipTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.websocket.TdsWebSocketConnectionTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.websocket.TdsWebSocketHandlerTransportFailureTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.session.TdsConnectionCapacityLimiterTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.config.TdsRuntimeSettingsTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.config.TdsBlockHoundTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.session.TdsBindingRevocationListenerTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.session.TdsGracefulShutdownLifecycleTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.session.SessionRegistrationGateTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.session.TdsTerminalSessionActorsTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.history.TdsConnectionHistoryWriterTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.history.TdsDorisStreamLoadClientTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.state.TdsConnectionCloseReasonContractTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepositoryTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.state.TdsConnectionStateWriterTest',
    ],
    true,
  ],
  [
    'tds-compression-focused',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:terminal-data-server:test',
      '--tests',
      'com.catering.v2s.terminaldataserver.websocket.TdsNativeDecompressionLimitTest',
      '--tests',
      'com.catering.v2s.terminaldataserver.websocket.TdsMessageSizeCloseHandlerTest',
    ],
    true,
  ],
  [
    'terminal-binding-owner-unit',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:catering-business-server:modules:terminal-binding:test',
      '--tests',
      'com.catering.v2s.terminalbinding.application.TerminalBindingOwnerServiceTest',
    ],
    true,
  ],
  [
    'tds-topic-repository-owner-routing',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:terminal-data-server:test',
      '--tests',
      'com.catering.v2s.terminaldataserver.state.TdsTerminalTopicRepositoryTest',
    ],
    true,
  ],
  [
    'tds-postgres-transaction-integration',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:terminal-data-server:test',
      '--tests',
      'com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepositoryPostgresIntegrationTest',
    ],
    true,
  ],
  ['U01-face', 'scripts/check/contract-face', []],
  ['U01-retirement', 'scripts/check/retirement', []],
  ['THCL-04-node-tests', 'node', ['scripts/test/test-health-entry-runner.mjs', '--node']],
  ['THCL-04-foundation-tests', 'yarn', ['--cwd', 'libraries/frontend/admin-ui-foundation', 'test']],
  [
    'U02-backend',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:test'],
    true,
  ],
  ['U02-flyway', 'scripts/check/flyway-layout', []],
  [
    'U03-platform-iam',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:catering-business-server:modules:platform-admin-iam:test',
    ],
    true,
  ],
  [
    'U04-workspace',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:workspace:test'],
    true,
  ],
  [
    'U04-asset',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:asset:test'],
    true,
  ],
  [
    'U05-organization',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:organization:test'],
    true,
  ],
  [
    'U06-workspace-iam',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:workspace-iam:test'],
    true,
  ],
  [
    'U07-contract',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:store-contract:test'],
    true,
  ],
  [
    'B1-store-terminal-owner-unit',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:catering-business-server:modules:store-terminal:test',
      '--tests',
      'com.catering.v2s.storeterminal.application.StoreTerminalOwnerServiceTest',
    ],
    true,
  ],
  [
    'THCL-JAVA-audit-model',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:audit-model:test'],
    true,
  ],
  [
    'THCL-JAVA-audit-read',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:audit-read:test'],
    true,
  ],
  [
    'THCL-JAVA-catalog',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:catalog:test'],
    true,
  ],
  [
    'THCL-JAVA-execution-context',
    'node',
    [
      'scripts/test/r5-remote-testcontainers.mjs',
      ':apps:backend:catering-business-server:modules:execution-context:test',
    ],
    true,
  ],
  [
    'THCL-JAVA-extension',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:extension:test'],
    true,
  ],
  [
    'THCL-JAVA-foundation',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:foundation:test'],
    true,
  ],
  [
    'THCL-JAVA-inventory',
    'node',
    ['scripts/test/r5-remote-testcontainers.mjs', ':apps:backend:catering-business-server:modules:inventory:test'],
    true,
  ],
  ['U08-platform-ui-test', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'test']],
  ['U08-platform-ui-build', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'build']],
  ['U09-operations-ui-test', 'yarn', ['--cwd', 'apps/frontend/operations-admin', 'test']],
  ['U09-operations-ui-build', 'yarn', ['--cwd', 'apps/frontend/operations-admin', 'build']],
  ['U10-affected-l2', 'scripts/check/affected-l2', []],
  ['U11-dev-check', 'scripts/dev/check', []],
  ['U11-seed-dry-run', 'scripts/dev/seed', ['--profile', 'r5-full', '--dry-run']],
  ['terminal-verify', 'yarn', ['workspace', '@catering-v2s/terminal', 'run', 'verify', '--static-verified-by-parent']],
];

function fail(reason) {
  throw new Error(reason);
}

function commandExecutable(root, command) {
  if (command === 'gradle') return resolveGradleCommand({root}).command;
  return command.includes('/') ? path.join(root, command) : command;
}

function spawnAndForward({root, command, args, spawnSyncImpl, env = process.env}) {
  const result = spawnSyncImpl(commandExecutable(root, command), args, {
    cwd: root,
    encoding: 'utf8',
    env: {...env},
    maxBuffer: childOutputBudgetBytes,
  });
  process.stdout.write(result?.stdout || '');
  process.stderr.write(result?.stderr || '');
  return result;
}

function runStaticCommand({root, commandTuple, spawnSyncImpl}) {
  const [label, command, args, successMarkers] = commandTuple;
  const startedAt = process.hrtime.bigint();
  const result = spawnAndForward({root, command, args, spawnSyncImpl});
  if (label === 'r5-edge-materialize') {
    const elapsedMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
    process.stdout.write(`R5_VERIFY_STATIC_DURATION_MS:${label}=${elapsedMs}\n`);
  }
  if (result?.error) fail(`R5_VERIFY_STATIC_SPAWN_FAILURE:${label}`);
  if (result?.status !== 0) fail(`R5_VERIFY_STATIC_FIRST_FAILURE:${label}`);
  const output = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  const missingMarker = successMarkers.find(marker => !output.includes(marker));
  if (missingMarker) fail(`R5_VERIFY_STATIC_MARKER_MISSING:${label}:${missingMarker}`);
}

function runStatic({root = repositoryRoot, commands = staticCommands, spawnSyncImpl = childProcess.spawnSync} = {}) {
  for (const commandTuple of commands) runStaticCommand({root, commandTuple, spawnSyncImpl});
  return {count: commands.length};
}

function parseMode(argv) {
  if (argv.length === 0) return 'normal';
  if (argv.length === 1 && argv[0] === '--validate-only') return 'validate-only';
  fail('VERIFY_ACCEPTS_ONLY_VALIDATE_ONLY_OR_NO_ARGUMENTS');
}

function runRuntimeCommand({root, commandTuple, spawnSyncImpl}) {
  const [label, command, args, remote = false] = commandTuple;
  const startedAt = process.hrtime.bigint();
  process.stderr.write(`R5_VERIFY_RUNTIME_COMMAND ${JSON.stringify({runId: verifyRunId, label, phase: 'start'})}\n`);
  const result = spawnAndForward({root, command, args, spawnSyncImpl});
  const elapsedMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
  const outcome = {
    runId: verifyRunId,
    label,
    phase: 'finish',
    status: result?.status ?? null,
    signal: result?.signal ?? null,
    spawnErrorCode: result?.error?.code ?? null,
    stdoutBytes: Buffer.byteLength(result?.stdout || ''),
    stderrBytes: Buffer.byteLength(result?.stderr || ''),
    elapsedMs,
  };
  process.stderr.write(`R5_VERIFY_RUNTIME_COMMAND ${JSON.stringify(outcome)}\n`);
  if (result?.error || result?.status !== 0) {
    fail(
      `R5_VERIFY_FIRST_FAILURE:${label}:status=${String(outcome.status)}:signal=${String(outcome.signal)}:spawnError=${String(outcome.spawnErrorCode)}`,
    );
  }
  if (remote && !String(result?.stdout || '').includes('CLEANUP=PASS'))
    fail(`R5_REMOTE_CLEANUP_NOT_CONFIRMED:${label}`);
  return remote;
}

async function runVerify({
  argv = process.argv.slice(2),
  root = repositoryRoot,
  spawnSyncImpl = childProcess.spawnSync,
} = {}) {
  const mode = parseMode(argv);
  const staticResult = runStatic({root, spawnSyncImpl});
  if (mode === 'validate-only') {
    console.log('R5_VERIFY_VALIDATE_ONLY=PASS');
    console.log(`EXECUTED=${staticResult.count}/${staticResult.count}`);
    console.log('CLEANUP=NOT_APPLICABLE_STATIC_ONLY');
    return {mode, ...staticResult};
  }

  let remoteExecuted = false;
  for (const commandTuple of runtimeCommands) {
    remoteExecuted = runRuntimeCommand({root, commandTuple, spawnSyncImpl}) || remoteExecuted;
  }
  console.log('R5_VERIFY=PASS');
  console.log('BUSINESS=UNVERIFIED_REQUIRES_R5_L3_AND_SEED_EVIDENCE');
  if (remoteExecuted) console.log('REMOTE_TESTCONTAINERS_CLEANUP=PASS');
  return {mode, ...staticResult};
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runVerify().catch(error => {
    process.stderr.write(`R5_VERIFY=FAIL\nREASON=${error.message}\n`);
    process.exit(1);
  });
}

export {parseMode, runRuntimeCommand, runStatic, runVerify, runtimeCommands, staticCommands};
