#!/usr/bin/env node
/** Runs one focused Testcontainers Gradle task on the approved remote host. */
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';
import {
  TDS_CAPACITY_CONFIG_RELATIVE_PATH,
  loadTdsCapacityConfiguration,
  validateTdsCapacityConfiguration,
} from '../env/tds-capacity-configuration.mjs';
import {
  resolveGradleHome as resolveSharedGradleHome,
  validateGradleHome as validateSharedGradleHome,
} from '../lib/gradle-runtime.mjs';
import {
  assertNoObservationErrors,
  assertUnclassifiedSqlRatio,
  parseHttpRequestEvents,
} from './backend-performance-event-verifier.mjs';
import {
  assertPerformanceConnectionBudgets,
  assertPerformanceConnectionBudgetsForIdentity,
  assertPerformanceOperationExactSet,
  assertPerformanceOperationBudgets,
  buildNormalSampleMatrix,
  buildNormalSampleMatrixForIdentity,
  loadPerformanceOperationRegistry,
  reconcilePerformanceOperationEvents,
} from './backend-performance-operation-reconciliation.mjs';
import {validateBudgetRegistry} from '../generate/backend-performance-budget.mjs';
import {BACKEND_PERFORMANCE_OPERATION_COUNTS} from '../policy/backend-performance-operation-counts.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const evidence = path.join(runtime, 'evidence', 'remote-testcontainers');
const remoteDependencyCache = '/tmp/catering-v2s-r5-gradle-cache';
const remoteGradleDistributionPrefix = '/tmp/catering-v2s-r5-gradle-distribution-';
const remoteHostTrust = resolveTrustedRemoteHost(process.env);
const remoteHost = remoteHostTrust.host;
const backendAcceptanceSelector = 'com.catering.v2s.app.acceptance.BackendAcceptanceTest';
export const V_S15_TDS_CONTRACT_SCENARIO = 'terminal.connection.vs15.readiness-withdrawal-and-drain';
export const TDS_HISTORY_SECRET_SEARCH_SCENARIO = 'terminal.connection.vs11.secret-search';
export const TDS_HISTORY_RECORDS_SCENARIO = 'terminal.connection.history-records';
export const TDS_HISTORY_OUTAGE_BOUNDED_SCENARIO = 'terminal.connection.history-outage-bounded';
export const TDS_CROSS_NODE_RECOVERY_SCENARIO = 'terminal.connection.vs13.cross-node-recovery';
const TDS_CONTRACT_SCENARIO_PREFLIGHT = new Map([
  [V_S15_TDS_CONTRACT_SCENARIO, true],
  [TDS_HISTORY_SECRET_SEARCH_SCENARIO, false],
  [TDS_HISTORY_RECORDS_SCENARIO, true],
  [TDS_HISTORY_OUTAGE_BOUNDED_SCENARIO, false],
  [TDS_CROSS_NODE_RECOVERY_SCENARIO, true],
]);
const isTdsContractScenarioScopeValid = (scenario, topologyPreflight) =>
  TDS_CONTRACT_SCENARIO_PREFLIGHT.has(scenario) &&
  TDS_CONTRACT_SCENARIO_PREFLIGHT.get(scenario) === topologyPreflight;
const hasBackendAcceptanceSelector = extraArguments =>
  extraArguments.some(
    argument =>
      argument === backendAcceptanceSelector || argument.startsWith(`${backendAcceptanceSelector}.`),
  );
const EXPECTED_OPERATION_COUNT = BACKEND_PERFORMANCE_OPERATION_COUNTS.operations;

const now = () => new Date().toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const localRunLockPath = path.join(runtime, `remote-testcontainers.${sha256(remoteHost).slice(0, 16)}.lock`);
const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stableValue(value[key])]),
    );
  return value;
};
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const compact = (value, limit = 240) =>
  String(value ?? 'FAILED')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, limit);
const script = (...lines) => lines.join('\n');
export const terminalWireEvidenceAggregationScript = () =>
  script(
    'wire_log_directory="$root/backend-acceptance/tds"',
    'wire_log_archive="$results/terminal-wire-client.log"',
    'if test -f "$wire_log_directory/terminal-wire-client.log"; then cp -- "$wire_log_directory/terminal-wire-client.log" "$wire_log_archive" || exit 1; else : > "$wire_log_archive" || exit 1; fi',
    'for wire_log in "$wire_log_directory"/terminal-wire-*.log; do',
    '  test -f "$wire_log" || continue',
    '  if test "$wire_log" = "$wire_log_directory/terminal-wire-client.log"; then continue; fi',
    '  printf "\\n===== %s =====\\n" "${wire_log##*/}" >> "$wire_log_archive"',
    '  cat -- "$wire_log" >> "$wire_log_archive" || exit 1',
    'done',
  );
export const remoteProcessInventoryScript = () =>
  script(
    'process_inventory_file="$results/remote-process-identities.tsv"',
    'process_inventory_status=FAIL',
    'capture_remote_process_inventory() {',
    '  phase="$1"',
    '  test -r /proc/self/stat || return 1',
    '  boot_id="$(cat /proc/sys/kernel/random/boot_id)" || return 1',
    '  captured_at="$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)" || return 1',
    '  printf \'snapshot\\t%s\\t%s\\t%s\\t%s\\n\' "${root##*/}" "$phase" "$captured_at" "$boot_id" >> "$process_inventory_file" || return 1',
    '  for proc_dir in /proc/[0-9]*; do',
    '    pid="${proc_dir##*/}"',
    '    stat_line="$(cat "$proc_dir/stat" 2>/dev/null)" || continue',
    '    stat_tail="${stat_line##*) }"',
    '    read -r -a stat_fields <<< "$stat_tail"',
    '    test "${#stat_fields[@]}" -ge 20 || continue',
    '    state="${stat_fields[0]}"',
    '    ppid="${stat_fields[1]}"',
    '    start_ticks="${stat_fields[19]}"',
    '    [[ "$pid" =~ ^[0-9]+$ && "$ppid" =~ ^[0-9]+$ && "$start_ticks" =~ ^[0-9]+$ ]] || continue',
    '    uid="$(awk \'/^Uid:/{print $2; exit}\' "$proc_dir/status" 2>/dev/null)" || continue',
    '    [[ "$uid" =~ ^[0-9]+$ ]] || continue',
    '    comm="$(tr -cd \'[:alnum:]_.+-\' < "$proc_dir/comm" 2>/dev/null | cut -c1-64)" || comm=""',
    '    executable="$(readlink "$proc_dir/exe" 2>/dev/null || true)"',
    '    executable="${executable##*/}"',
    '    executable="$(printf "%s" "$executable" | tr -cd \'[:alnum:]_.+-\' | cut -c1-64)"',
    '    test -n "$comm" || comm=unknown',
    '    test -n "$executable" || executable=unavailable',
    '    printf \'process\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n\' "${root##*/}" "$phase" "$captured_at" "$boot_id" "$pid" "$ppid" "$uid" "$state" "$start_ticks" "$comm" "$executable" >> "$process_inventory_file" || return 1',
    '  done',
    '}',
    'if : > "$process_inventory_file" && capture_remote_process_inventory BEFORE_GRADLE; then process_inventory_status=CAPTURED; fi',
  );
export const resolveTdsCapacityConfiguration = (configuration = loadTdsCapacityConfiguration()) =>
  validateTdsCapacityConfiguration(configuration);
const runnerEvent = (event, fields = {}) =>
  process.stdout.write(
    `R5_TESTCONTAINERS_${event} ${Object.entries(fields)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ')}\n`,
  );

const BACKEND_ACCEPTANCE_VERIFICATION_MODES = Object.freeze(['ACCEPTANCE', 'CALIBRATION']);
const ARCHIVED_EVIDENCE_ARTIFACTS = Object.freeze([
  'http-request-events.jsonl',
  'backend-acceptance-result.jsonl',
  'db-operation-events.jsonl',
  'statement-dictionary.json',
  'tds-contract-result.jsonl',
  'tds-process.log',
  'tds-process-evidence.json',
  'terminal-wire-client.log',
  'process-signal-trace.log',
  'remote-process-identities.tsv',
]);
const TDS_CONTRACT_ONLY_EVIDENCE_ARTIFACTS = Object.freeze(
  ARCHIVED_EVIDENCE_ARTIFACTS.filter(name => name !== 'backend-acceptance-result.jsonl'),
);

/**
 * A production mutation is applied only after the source has been copied to the
 * run-owned remote staging root. The specifications are intentionally closed:
 * callers cannot choose a file or source replacement.
 */
export const PRODUCTION_MUTATION_SPECS = Object.freeze({
  'extension-definition-second-field-status': Object.freeze({
    id: 'extension-definition-second-field-status',
    operationId: 'replaceExtensionDefinition',
    scenarioId: 'pagination.extension-definition-aggregate-closure',
    scenarioOperation: 'extensionDefinitionAggregateClosure',
    module: 'EXTENSION',
    pointer: '/definitions/1/status',
    file: 'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/extension/ExtensionDefinitionWireMapper.java',
    symbol: 'field',
    anchor: 'private static ExtensionDefinitionDefinitionsItem field(ExtensionDefinitionReadback.Field value)',
    from: 'value.status()',
    to: 'value.displayOrder() == 1 ? "ENABLED" : value.status()',
    replaceCount: 1,
    expectedSignal: 'HTTP=200;CONTRACT=PASS;BUSINESS=FAIL;failureCategory=BUSINESS_ORACLE',
  }),
  'tds-registration-pending-generation-check': Object.freeze({
    id: 'tds-registration-pending-generation-check',
    evidenceType: 'TDS_CONTRACT',
    operationId: 'cancelTerminalActivation',
    scenarioId: 'terminal.connection.vs10.device-cancel',
    scenarioOperation: 'storeTerminalActivationBusinessPrecedence',
    module: 'TERMINAL_DATA_SERVER',
    pointer: 'TDS_SESSION_REGISTRATION_GENERATION_REVOCATION',
    file: 'apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java',
    symbol: 'generationRevoked',
    anchor: 'private boolean generationRevoked(long generation)',
    from: 'return generation <= revokedThroughGeneration;',
    to: 'return false;',
    replaceCount: 1,
    expectedSignal:
      'HTTP=200;BUSINESS=PASS;TDS_CONTRACT=FAIL;failureCategory=TDS_VS10_REGISTRATION_RACE_RED_CONTROL',
  }),
});

export function resolveProductionMutation(id) {
  if (typeof id !== 'string' || id.trim() === '') throw new Error('PRODUCTION_MUTATION_ID_REQUIRED');
  const mutation = PRODUCTION_MUTATION_SPECS[id];
  if (!mutation) throw new Error(`PRODUCTION_MUTATION_ID_UNKNOWN:${id}`);
  return mutation;
}

const literalOccurrenceCount = (source, literal) => {
  if (typeof source !== 'string' || typeof literal !== 'string' || literal === '') return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = source.indexOf(literal, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + literal.length;
  }
};

const enclosedMethod = (source, anchor) => {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`PRODUCTION_MUTATION_ANCHOR_NOT_FOUND:${anchor}`);
  const openingBrace = source.indexOf('{', anchorIndex + anchor.length);
  if (openingBrace < 0) throw new Error(`PRODUCTION_MUTATION_METHOD_BODY_NOT_FOUND:${anchor}`);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return Object.freeze({start: openingBrace, end: index + 1});
    }
  }
  throw new Error(`PRODUCTION_MUTATION_METHOD_BODY_UNCLOSED:${anchor}`);
};

/**
 * Computes the exact source edit without writing it.  The returned hashes are
 * later checked against the copy in the remote staging root before Gradle is
 * started, so an upload/source drift cannot silently become mutation evidence.
 */
export function prepareProductionMutation({repositoryRoot = root, mutation}) {
  const spec = typeof mutation === 'string' ? resolveProductionMutation(mutation) : mutation;
  if (!spec || typeof spec !== 'object') throw new Error('PRODUCTION_MUTATION_SPEC_REQUIRED');
  const target = path.resolve(repositoryRoot, spec.file);
  const relativeTarget = path.relative(repositoryRoot, target);
  if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    throw new Error(`PRODUCTION_MUTATION_FILE_OUTSIDE_REPOSITORY:${spec.id}`);
  }
  if (!existsSync(target)) throw new Error(`PRODUCTION_MUTATION_FILE_NOT_FOUND:${spec.file}`);
  const source = readFileSync(target, 'utf8');
  const method = enclosedMethod(source, spec.anchor);
  const methodSource = source.slice(method.start, method.end);
  const replaceCount = literalOccurrenceCount(methodSource, spec.from);
  if (replaceCount !== spec.replaceCount) {
    throw new Error(`PRODUCTION_MUTATION_REPLACE_COUNT_MISMATCH:${spec.id}:${replaceCount}!=${spec.replaceCount}`);
  }
  const index = method.start + methodSource.indexOf(spec.from);
  const mutatedSource = source.slice(0, index) + spec.to + source.slice(index + spec.from.length);
  if (mutatedSource === source) throw new Error(`PRODUCTION_MUTATION_NO_SOURCE_CHANGE:${spec.id}`);
  return Object.freeze({
    id: spec.id,
    file: spec.file,
    replaceCount,
    sourceBeforeSha256: sha256(source),
    sourceAfterSha256: sha256(mutatedSource),
  });
}

export const fullPerformanceWorkload = ({task, operation, verificationMode, registry}) => {
  if (!Array.isArray(registry)) throw new Error('PERFORMANCE_WORKLOAD_REGISTRY_REQUIRED');
  const descriptor = {
    schemaVersion: 1,
    task,
    backendAcceptanceOperation: operation,
    verificationMode,
    normalRecipe: 'BackendPerformanceOperationCoverage.runNormalRecipes',
    coverageRecipe: 'BackendPerformanceOperationCoverage.runCoverageRecipes',
    p2ScopeRecipe: 'P2ReadConnectionScopeScenarios.run',
    operationIdentity: registry.map(({operationId, method, routeTemplate, owner, consumerFace}) => ({
      operationId,
      method,
      routeTemplate,
      owner,
      consumerFace,
    })),
  };
  return Object.freeze({
    schemaVersion: 1,
    descriptor: stableValue(descriptor),
    fingerprint: sha256(JSON.stringify(stableValue(descriptor))),
  });
};

export const remoteResourceCleanupStatus = ({
  remoteGradleStatus,
  containerQueryStatus,
  volumeQueryStatus,
  afterContainerQueryStatus,
  afterVolumeQueryStatus,
  containerCleanup,
  volumeCleanup,
} = {}) =>
  remoteGradleStatus !== undefined &&
  containerQueryStatus === 'PASS' &&
  volumeQueryStatus === 'PASS' &&
  afterContainerQueryStatus === 'PASS' &&
  afterVolumeQueryStatus === 'PASS' &&
  containerCleanup === 'PASS' &&
  volumeCleanup === 'PASS'
    ? 'PASS'
    : 'FAIL';

export const canonicalBackendAcceptanceOperation = (operation, extensionScaleProof = false) =>
  extensionScaleProof && operation === 'typed-filter-validation-and-recovery'
    ? 'extension.typed-filter-validation-and-recovery'
    : operation;

export const backendAcceptanceEnvironment = (
  runId,
  operation = 'all',
  verificationMode = 'ACCEPTANCE',
  batchCardinality = null,
  extensionScaleProof = false,
  tdsCapacity = null,
  terminalWireNodePath = null,
  topologyPreflight = false,
  vs12Diagnostic = false,
  vs8Diagnostic = false,
  d46Focused = false,
  tdsContractScenario = null,
) => {
  if (extensionScaleProof && runId === null) throw new Error('EXTENSION_SCALE_PROOF_REQUIRES_BACKEND_ACCEPTANCE');
  const effectiveOperation = canonicalBackendAcceptanceOperation(operation, extensionScaleProof);
  if (topologyPreflight && (runId === null || effectiveOperation === 'all' || verificationMode !== 'ACCEPTANCE')) {
    throw new Error('BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT_ARGUMENT_INVALID');
  }
  if (
    tdsContractScenario !== null &&
    (!isTdsContractScenarioScopeValid(tdsContractScenario, topologyPreflight) ||
      runId === null ||
      effectiveOperation !== 'storeTerminalActivationBusinessPrecedence' ||
      verificationMode !== 'ACCEPTANCE' ||
      vs12Diagnostic ||
      vs8Diagnostic ||
      d46Focused ||
      extensionScaleProof)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_SCOPE_INVALID');
  }
  if (
    vs12Diagnostic &&
    (runId === null ||
      effectiveOperation !== 'storeTerminalActivationBusinessPrecedence' ||
      verificationMode !== 'ACCEPTANCE' ||
      topologyPreflight ||
      extensionScaleProof)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC_ARGUMENT_INVALID');
  }
  if (
    vs8Diagnostic &&
    (runId === null ||
      effectiveOperation !== 'storeTerminalActivationBusinessPrecedence' ||
      verificationMode !== 'ACCEPTANCE' ||
      topologyPreflight ||
      extensionScaleProof ||
      vs12Diagnostic)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC_ARGUMENT_INVALID');
  }
  if (runId === null) return effectiveOperation === 'all' ? [] : ['export V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY'];
  return [
        'export V2S_RUNTIME_ENVIRONMENT=non-production',
        'export V2S_DEV_PROFILE=backend-acceptance',
        `export V2S_DEV_NAMESPACE=${quote(`v2s-backend-acceptance-${sha256(runId).slice(0, 16)}`)}`,
        `export V2S_BACKEND_ACCEPTANCE_RUN_ID=${quote(runId)}`,
        'export V2S_BACKEND_ACCEPTANCE_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d \' \\n\')"',
        'export V2S_BACKEND_ACCEPTANCE_EVENTS="$root/results/http-request-events.jsonl"',
        'export V2S_BACKEND_ACCEPTANCE_RESULT="$root/results/backend-acceptance-result.jsonl"',
        'export V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_RESULT="$root/results/tds-contract-result.jsonl"',
        'export V2S_BACKEND_ACCEPTANCE_RUN_DIRECTORY="$root/backend-acceptance"',
        'export V2S_DB_OPERATIONS_EVENTS="$root/results/db-operation-events.jsonl"',
        'export V2S_DB_OPERATIONS_HMAC_KEY="$(od -An -N32 -tx1 /dev/urandom | tr -d \' \\n\')"',
        'export V2S_DB_STATEMENT_DICTIONARY="$root/results/statement-dictionary.json"',
        `export V2S_BACKEND_ACCEPTANCE_OPERATION=${quote(effectiveOperation)}`,
        `export V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT=${topologyPreflight ? 'true' : 'false'}`,
        ...(tdsContractScenario === null
          ? ['unset V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO']
          : [`export V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO=${quote(tdsContractScenario)}`]),
        ...(vs12Diagnostic ? ['export V2S_BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC=true'] : []),
        ...(vs8Diagnostic ? ['export V2S_BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC=true'] : []),
        ...(d46Focused ? ['export V2S_BACKEND_ACCEPTANCE_D46_FOCUSED=true'] : []),
        `export V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=${quote(verificationMode)}`,
        ...(terminalWireNodePath === null
          ? []
          : [`export V2S_TERMINAL_WIRE_NODE_BINARY=${quote(terminalWireNodePath)}`]),
        ...(tdsCapacity === null
          ? []
          : [
              `export V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS=${quote(tdsCapacity.maxUnauthenticatedConnections)}`,
              `export V2S_TDS_MAX_TRACKED_SESSIONS=${quote(tdsCapacity.maxTrackedSessions)}`,
            ]),
        ...(effectiveOperation === 'all' ? [] : ['export V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY']),
        ...(batchCardinality === null || batchCardinality === undefined || batchCardinality === ''
          ? []
          : [`export V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY=${quote(batchCardinality)}`]),
        ...(extensionScaleProof
          ? [
              'export V2S_EXTENSION_SCALE_PROOF=true',
              'export V2S_EXTENSION_SCALE_EVIDENCE="$root/results/extension-scale-evidence.json"',
            ]
          : []),
        // The complete exact-set workload needs the existing P2 normal recipes.
        // They cannot remain caller-selected diagnostics: coverage-only probes
        // deliberately do not satisfy the normal performance denominator.
        ...(effectiveOperation === 'all' ? ['export V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true'] : []),
        // A managed whole-suite run is the canonical generated-operation measurement workload.
        // Its non-scenario coverage fixture must therefore be enabled by the runner itself,
        // never by a caller-controlled diagnostic switch.
        ...(effectiveOperation === 'all' ? ['export V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true'] : []),
        'export CATERING_OTP_DEBUG_CODE_EXPOSURE=true',
  ];
};

export const validateVs12DiagnosticScope = ({
  vs12Diagnostic,
  backendAcceptanceRunId,
  backendAcceptanceOperation,
  verificationMode,
  topologyPreflight = false,
  productionMutation = null,
  extensionScaleProof = false,
  traceSystemSignals = false,
}) => {
  if (!vs12Diagnostic) return;
  if (
    backendAcceptanceRunId === null ||
    backendAcceptanceOperation !== 'storeTerminalActivationBusinessPrecedence' ||
    verificationMode !== 'ACCEPTANCE' ||
    topologyPreflight ||
    productionMutation !== null ||
    extensionScaleProof
  ) {
    throw new Error('BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC_ARGUMENT_INVALID');
  }
  if (!traceSystemSignals) throw new Error('R5_VS12_DIAGNOSTIC_REQUIRES_SYSTEM_SIGNAL_TRACE');
};

/**
 * A complete backend-acceptance run is the only run whose event denominator is the full generated operation set.
 * Its budgets are therefore an unconditional acceptance invariant, not an opt-in diagnostics switch.
 */
export const requiresFullPerformanceVerification = (backendAcceptanceRunId, backendAcceptanceOperation) =>
  backendAcceptanceRunId !== null && backendAcceptanceOperation === 'all';

export const requiresActiveBudgetVerification = (
  backendAcceptanceRunId,
  backendAcceptanceOperation,
  verificationMode,
) =>
  requiresFullPerformanceVerification(backendAcceptanceRunId, backendAcceptanceOperation) &&
  verificationMode === 'ACCEPTANCE';

export const parseEvidenceArchiveIndex = source => {
  const rows = String(source)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t'));
  const seen = new Set();
  return rows.map(([name, rawBytes, rawSha256, archiveBytes, archiveSha256]) => {
    if (
      !ARCHIVED_EVIDENCE_ARTIFACTS.includes(name) ||
      !/^\d+$/.test(rawBytes) ||
      !/^[a-f0-9]{64}$/.test(rawSha256) ||
      !/^\d+$/.test(archiveBytes) ||
      !/^[a-f0-9]{64}$/.test(archiveSha256) ||
      seen.has(name)
    ) {
      throw new Error('EVIDENCE_ARCHIVE_INDEX_INVALID');
    }
    seen.add(name);
    return Object.freeze({
      name,
      rawBytes: Number(rawBytes),
      rawSha256,
      archiveBytes: Number(archiveBytes),
      archiveSha256,
    });
  });
};

// A failed Gradle preflight may still leave an empty archive index behind.  An
// entry is the boundary that proves the acceptance process produced evidence;
// callers must not require the four archived artifacts before that boundary.
export const hasArchivedEvidenceIndexEntries = directory => {
  const indexPath = path.join(directory, 'evidence-artifacts.tsv');
  return existsSync(indexPath) && readFileSync(indexPath, 'utf8').trim().length > 0;
};

export const readEvidenceArtifact = (directory, name, {requireArchive = false} = {}) => {
  const plainPath = path.join(directory, name);
  if (!requireArchive && existsSync(plainPath)) return readFileSync(plainPath, 'utf8');
  const indexPath = path.join(directory, 'evidence-artifacts.tsv');
  const archivePath = `${plainPath}.gz`;
  if (!existsSync(indexPath) || !existsSync(archivePath)) throw new Error(`EVIDENCE_ARTIFACT_REQUIRED:${name}`);
  const entry = parseEvidenceArchiveIndex(readFileSync(indexPath, 'utf8')).find(candidate => candidate.name === name);
  if (!entry) throw new Error(`EVIDENCE_ARCHIVE_ENTRY_REQUIRED:${name}`);
  const archive = readFileSync(archivePath);
  if (archive.length !== entry.archiveBytes || sha256(archive) !== entry.archiveSha256)
    throw new Error(`EVIDENCE_ARCHIVE_INTEGRITY_INVALID:${name}`);
  const raw = gunzipSync(archive);
  if (raw.length !== entry.rawBytes || sha256(raw) !== entry.rawSha256)
    throw new Error(`EVIDENCE_ARTIFACT_INTEGRITY_INVALID:${name}`);
  return raw.toString('utf8');
};

export const validateEvidenceArchiveReceipt = (receipt, requiredArtifacts = ARCHIVED_EVIDENCE_ARTIFACTS) => {
  if (!receipt || receipt.status !== 'PASS') throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_REQUIRED');
  if (typeof receipt.indexPath !== 'string' || receipt.indexPath.trim() === '') {
    throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_INDEX_REQUIRED');
  }
  if (!Array.isArray(receipt.artifacts)) throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_ARTIFACTS_REQUIRED');
  const names = new Set();
  for (const artifact of receipt.artifacts) {
    if (
      !artifact ||
      !ARCHIVED_EVIDENCE_ARTIFACTS.includes(artifact.name) ||
      !Number.isInteger(artifact.rawBytes) ||
      artifact.rawBytes < 0 ||
      !/^[a-f0-9]{64}$/.test(artifact.rawSha256 ?? '') ||
      !Number.isInteger(artifact.archiveBytes) ||
      artifact.archiveBytes < 0 ||
      !/^[a-f0-9]{64}$/.test(artifact.archiveSha256 ?? '') ||
      names.has(artifact.name)
    ) {
      throw new Error('RUN_MANIFEST_EVIDENCE_ARCHIVE_ARTIFACT_INVALID');
    }
    names.add(artifact.name);
  }
  const missing = requiredArtifacts.filter(name => !names.has(name));
  if (missing.length > 0) throw new Error(`RUN_MANIFEST_EVIDENCE_ARCHIVE_NOT_CLOSED:${missing.join(',')}`);
  return receipt;
};

export const verifyFullBackendAcceptancePerformance = (registry, events) => {
  assertNoObservationErrors(events);
  const operationSet = reconcilePerformanceOperationEvents(registry, events);
  assertPerformanceOperationExactSet(operationSet);
  const budgetEvidence = assertPerformanceOperationBudgets(registry, events);
  const connectionBudgetEvidence = assertPerformanceConnectionBudgets(registry, events);
  const normalSampleMatrix = buildNormalSampleMatrix(registry, events);
  return {operationSet, budgetEvidence, connectionBudgetEvidence, normalSampleMatrix};
};

export const verifyFullBackendAcceptanceCalibration = (registry, events) => {
  assertNoObservationErrors(events);
  const operationSet = reconcilePerformanceOperationEvents(registry, events);
  assertPerformanceOperationExactSet(operationSet);
  const connectionBudgetEvidence = assertPerformanceConnectionBudgetsForIdentity(registry, events);
  const normalSampleMatrix = buildNormalSampleMatrixForIdentity(registry, events);
  return {operationSet, connectionBudgetEvidence, normalSampleMatrix};
};

export const parseBackendAcceptanceResult = contents => {
  const rows = String(contents ?? '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (rows.length < 2) throw new Error('BACKEND_ACCEPTANCE_RESULT_CARDINALITY_INVALID');
  const parsed = rows.map(row => {
    try {
      return JSON.parse(row);
    } catch {
      throw new Error('BACKEND_ACCEPTANCE_RESULT_INVALID_JSON');
    }
  });
  const discovery = parsed.filter(row => row?.type === 'discovery');
  const scenarios = parsed.filter(row => row?.type !== 'discovery');
  if (discovery.length !== 1 || scenarios.length === 0)
    throw new Error('BACKEND_ACCEPTANCE_RESULT_CARDINALITY_INVALID');
  const [discoveryRow] = discovery;
  if (
    !Number.isInteger(discoveryRow.discovered) ||
    discoveryRow.discovered < 1 ||
    !Number.isInteger(discoveryRow.selected) ||
    discoveryRow.selected < 1 ||
    discoveryRow.selected > discoveryRow.discovered
  ) {
    throw new Error('BACKEND_ACCEPTANCE_DISCOVERY_INVALID');
  }
  for (const result of scenarios) {
    if (
      !result ||
      typeof result.operation !== 'string' ||
      typeof result.module !== 'string' ||
      !['PASS', 'FAIL'].includes(result.contract) ||
      !['PASS', 'FAIL'].includes(result.business) ||
      !['REAL', 'STUB'].includes(result.businessMode) ||
      !Number.isInteger(result.dbOperations) ||
      result.dbOperations < 0 ||
      !['PASS', 'FAIL'].includes(result.status)
    ) {
      throw new Error('BACKEND_ACCEPTANCE_RESULT_INVALID');
    }
    if (result.businessMode === 'STUB') throw new Error('BACKEND_ACCEPTANCE_RESULT_STUB_BUSINESS');
  }
  if (scenarios.length !== discoveryRow.selected) throw new Error('BACKEND_ACCEPTANCE_RESULT_SELECTION_MISMATCH');
  const failureCategories = Object.fromEntries(
    Object.entries(
      Object.groupBy(
        scenarios.filter(row => row.status === 'FAIL' || row.contract === 'FAIL' || row.business === 'FAIL'),
        row => row.failureCategory ?? 'UNKNOWN',
      ),
    ).map(([key, values]) => [key, values.length]),
  );
  const summary = {
    discovered: discoveryRow.discovered,
    selected: discoveryRow.selected,
    httpSuccess: scenarios.filter(row => row.contract === 'PASS').length,
    realBusinessAssertions: scenarios.filter(row => row.businessMode === 'REAL').length,
    stubOnly: scenarios.filter(row => row.businessMode === 'STUB').length,
    directFailures: scenarios.filter(row => row.status === 'FAIL' || row.contract === 'FAIL' || row.business === 'FAIL')
      .length,
    failureCategories,
  };
  return {rows: scenarios, discovery: discoveryRow, summary};
};

export const parseTdsContractResult = contents => {
  const rows = String(contents ?? '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(row => {
      try {
        return JSON.parse(row);
      } catch {
        throw new Error('TDS_CONTRACT_RESULT_INVALID_JSON');
      }
    });
  if (rows.length === 0) throw new Error('TDS_CONTRACT_RESULT_REQUIRED');
  const seen = new Set();
  for (const row of rows) {
    if (
      row?.type !== 'transport-contract' ||
      typeof row.operation !== 'string' ||
      row.operation.trim() === '' ||
      row.module !== 'TERMINAL_DATA_SERVER' ||
      !['PASS', 'FAIL'].includes(row.contract) ||
      !['PASS', 'FAIL'].includes(row.status) ||
      typeof row.runId !== 'string' ||
      row.runId.trim() === '' ||
      seen.has(row.operation)
    ) {
      throw new Error('TDS_CONTRACT_RESULT_INVALID');
    }
    seen.add(row.operation);
  }
  const directFailures = rows.filter(row => row.contract === 'FAIL' || row.status === 'FAIL').length;
  return Object.freeze({
    rows: Object.freeze(rows),
    summary: Object.freeze({discovered: rows.length, contractPass: rows.length - directFailures, directFailures}),
  });
};

export const parseTdsProcessEvidence = ({processEvidence, processLog, expectedRunId}) => {
  let evidence;
  try {
    evidence = JSON.parse(String(processEvidence ?? ''));
  } catch {
    throw new Error('TDS_PROCESS_EVIDENCE_INVALID_JSON');
  }
  const log = String(processLog ?? '');
  if (
    evidence?.schemaVersion !== 1 ||
    evidence?.kind !== 'backend-acceptance-tds-process' ||
    evidence?.runId !== expectedRunId ||
    evidence?.phase !== 'STOPPED' ||
    !Number.isInteger(evidence?.processId) ||
    evidence.processId <= 0 ||
    typeof evidence?.processStartTicks !== 'string' ||
    !/^\d+$/.test(evidence.processStartTicks) ||
    evidence?.applicationType !== 'REACTIVE' ||
    !Number.isInteger(evidence?.port) ||
    evidence.port < 1 ||
    evidence.port > 65535 ||
    !/^[a-f0-9]{64}$/.test(evidence?.runtimeClasspathReportSha256 ?? '') ||
    !/^[a-f0-9]{64}$/.test(evidence?.bootJarSha256 ?? '') ||
    !Number.isInteger(evidence?.rssBudgetMiB) ||
    evidence.rssBudgetMiB < 1 ||
    !Number.isInteger(evidence?.rssAtReadyKiB) ||
    evidence.rssAtReadyKiB < 1 ||
    evidence.rssAtReadyKiB > evidence.rssBudgetMiB * 1024 ||
    !Number.isInteger(evidence?.rssBeforeStopKiB) ||
    evidence.rssBeforeStopKiB < 1 ||
    evidence.rssBeforeStopKiB > evidence.rssBudgetMiB * 1024 ||
    evidence?.cleanupStatus !== 'PASS' ||
    !log.includes(`Netty started on port ${evidence.port}`) ||
    !log.includes('event=tds_listener_ready')
  ) {
    throw new Error('TDS_PROCESS_EVIDENCE_INVALID');
  }
  return Object.freeze({
    status: 'PASS',
    processId: evidence.processId,
    processStartTicks: evidence.processStartTicks,
    startedAt: evidence.processStartedAt,
    exitCode: evidence.exitCode,
    applicationType: evidence.applicationType,
    port: evidence.port,
    runtimeClasspathReportSha256: evidence.runtimeClasspathReportSha256,
    bootJarSha256: evidence.bootJarSha256,
    rssBudgetMiB: evidence.rssBudgetMiB,
    rssAtReadyKiB: evidence.rssAtReadyKiB,
    rssBeforeStopKiB: evidence.rssBeforeStopKiB,
    logPath: evidence.logPath,
    cleanup: evidence.cleanupStatus,
  });
};

/**
 * Confirms the one allowed production mutation was observed at the real HTTP
 * boundary.  A failing BUSINESS assertion is the expected red result here;
 * it is never converted into a normal acceptance PASS.
 */
export function verifyProductionMutationOutcome({
  mutation,
  backendAcceptanceResult,
  tdsContractResult = null,
  httpEvents,
  runId = null,
}) {
  if (!mutation || !backendAcceptanceResult || !Array.isArray(httpEvents)) {
    throw new Error('PRODUCTION_MUTATION_OUTCOME_INPUT_INVALID');
  }
  if (mutation.evidenceType === 'TDS_CONTRACT') {
    if (!tdsContractResult || !Array.isArray(tdsContractResult.rows) || typeof runId !== 'string') {
      throw new Error('PRODUCTION_MUTATION_TDS_CONTRACT_INPUT_INVALID');
    }
    if (
      backendAcceptanceResult.discovery.selected !== 1 ||
      backendAcceptanceResult.discovery.operation !== mutation.scenarioOperation ||
      backendAcceptanceResult.rows.length !== 1 ||
      backendAcceptanceResult.summary.directFailures !== 0
    ) {
      throw new Error('PRODUCTION_MUTATION_BUSINESS_SCENARIO_INVALID');
    }
    const [businessRow] = backendAcceptanceResult.rows;
    if (
      businessRow.contract !== 'PASS' ||
      businessRow.business !== 'PASS' ||
      businessRow.businessMode !== 'REAL' ||
      businessRow.status !== 'PASS'
    ) {
      throw new Error('PRODUCTION_MUTATION_BUSINESS_SIGNAL_INVALID');
    }
    const raceRows = tdsContractResult.rows.filter(row => row.operation === mutation.scenarioId);
    if (raceRows.length !== 1 || raceRows[0].runId !== runId) {
      throw new Error('PRODUCTION_MUTATION_TDS_RACE_SCENARIO_INVALID');
    }
    const [raceRow] = raceRows;
    if (
      raceRow.module !== mutation.module ||
      raceRow.contract !== 'FAIL' ||
      raceRow.status !== 'FAIL' ||
      raceRow.failureCategory !== 'TDS_VS10_REGISTRATION_RACE_RED_CONTROL' ||
      raceRow.clientFailureCategory !== 'SESSION_READY_AFTER_REVOCATION' ||
      raceRow.sessionReadyObserved !== true ||
      tdsContractResult.summary.directFailures !== 1 ||
      tdsContractResult.rows.some(row => row.operation !== mutation.scenarioId && (row.contract !== 'PASS' || row.status !== 'PASS'))
    ) {
      throw new Error('PRODUCTION_MUTATION_TDS_CONTRACT_SIGNAL_INVALID');
    }
    const operationEvents = httpEvents.filter(event => event.operationId === mutation.operationId);
    const successfulEvents = operationEvents.filter(event => event.status === 200 && event.outcome === 'SUCCEEDED');
    if (operationEvents.length !== 1 || successfulEvents.length !== 1) {
      throw new Error(`PRODUCTION_MUTATION_HTTP_SIGNAL_INVALID:${operationEvents.length}:${successfulEvents.length}`);
    }
    const signal =
      `HTTP=${successfulEvents[0].status};BUSINESS=PASS;TDS_CONTRACT=${raceRow.contract};` +
      `failureCategory=${raceRow.failureCategory}`;
    if (signal !== mutation.expectedSignal) throw new Error('PRODUCTION_MUTATION_EXPECTED_SIGNAL_INVALID');
    return Object.freeze({
      signal,
      operationId: mutation.operationId,
      scenarioId: mutation.scenarioId,
      pointer: mutation.pointer,
      httpStatus: successfulEvents[0].status,
      httpOutcome: successfulEvents[0].outcome,
      httpEventCount: successfulEvents.length,
      business: businessRow.business,
      tdsContract: raceRow.contract,
      failureCategory: raceRow.failureCategory,
    });
  }
  const rows = backendAcceptanceResult.rows;
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('PRODUCTION_MUTATION_SCENARIO_CARDINALITY_INVALID');
  }
  const [row] = rows;
  if (
    row.operation !== mutation.scenarioId ||
    row.module !== mutation.module ||
    row.contract !== 'PASS' ||
    row.business !== 'FAIL' ||
    row.businessMode !== 'REAL' ||
    row.status !== 'FAIL' ||
    row.failureCategory !== 'BUSINESS_ORACLE'
  ) {
    throw new Error('PRODUCTION_MUTATION_BUSINESS_SIGNAL_INVALID');
  }
  const operationEvents = httpEvents.filter(event => event.operationId === mutation.operationId);
  const matchingEvents = operationEvents.filter(event => event.status === 200 && event.outcome === 'SUCCEEDED');
  if (operationEvents.length !== 1 || matchingEvents.length !== 1) {
    throw new Error(`PRODUCTION_MUTATION_HTTP_SIGNAL_INVALID:${operationEvents.length}:${matchingEvents.length}`);
  }
  const [event] = matchingEvents;
  const signal = `HTTP=${event.status};CONTRACT=${row.contract};BUSINESS=${row.business};failureCategory=${row.failureCategory}`;
  if (signal !== mutation.expectedSignal) throw new Error('PRODUCTION_MUTATION_EXPECTED_SIGNAL_INVALID');
  return Object.freeze({
    signal,
    operationId: mutation.operationId,
    scenarioId: mutation.scenarioId,
    pointer: mutation.pointer,
    httpStatus: event.status,
    httpOutcome: event.outcome,
    httpEventCount: matchingEvents.length,
    failureCategory: row.failureCategory,
  });
}

export const resolveGradleHome = (options = {}) => resolveSharedGradleHome({root, ...options});

export function validateGradleHome(value, distributionAvailable) {
  return validateSharedGradleHome(value, {distributionAvailable, exists: () => Boolean(distributionAvailable)});
}

export function remoteGradleDistributionPath(distributionSha256) {
  if (typeof distributionSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(distributionSha256))
    throw new Error('GRADLE_DISTRIBUTION_SHA256_INVALID');
  return `${remoteGradleDistributionPrefix}${distributionSha256}`;
}

export function validateGradleDistribution(distribution) {
  if (
    !distribution ||
    typeof distribution !== 'object' ||
    typeof distribution.sha256 !== 'string' ||
    !['PENDING', 'SYNCED', 'REUSED', 'REUSED_AFTER_RACE'].includes(distribution.status)
  ) {
    throw new Error('GRADLE_DISTRIBUTION_RECORD_INVALID');
  }
  if (distribution.path !== remoteGradleDistributionPath(distribution.sha256))
    throw new Error('GRADLE_DISTRIBUTION_PATH_INVALID');
  return distribution;
}

export function validateInvocationArguments(argumentsList) {
  if (!Array.isArray(argumentsList) || argumentsList.length === 0) throw new Error('TASK_REQUIRED');
  const [task, ...extraArguments] = argumentsList;
  if (typeof task !== 'string' || !/^:[a-z0-9:-]+:test$/.test(task)) throw new Error('TASK_MUST_BE_A_SINGLE_TEST_TASK');
  const gradleArguments = [];
  let productionMutationId;
  let extensionScaleProof = false;
  for (let index = 0; index < extraArguments.length; ) {
    if (extraArguments[index] === '--tests') {
      if (typeof extraArguments[index + 1] !== 'string' || extraArguments[index + 1].trim() === '') {
        throw new Error('FOCUSED_TEST_SELECTOR_REQUIRED');
      }
      gradleArguments.push(extraArguments[index], extraArguments[index + 1]);
      index += 2;
      continue;
    }
    if (extraArguments[index] === '--production-mutation') {
      if (productionMutationId !== undefined) throw new Error('PRODUCTION_MUTATION_DUPLICATE');
      productionMutationId = extraArguments[index + 1];
      resolveProductionMutation(productionMutationId);
      index += 2;
      continue;
    }
    if (extraArguments[index] === '--extension-scale-proof') {
      if (extensionScaleProof) throw new Error('EXTENSION_SCALE_PROOF_DUPLICATE');
      extensionScaleProof = true;
      index += 1;
      continue;
    }
    throw new Error('FOCUSED_TEST_SELECTOR_REQUIRED');
  }
  const invocation = {task, extraArguments: Object.freeze(gradleArguments)};
  if (productionMutationId !== undefined) invocation.productionMutationId = productionMutationId;
  if (extensionScaleProof) invocation.extensionScaleProof = true;
  return Object.freeze(invocation);
}

/** A fresh remote Test task may never be accepted from Gradle's cache or skip markers. */
export function classifyGradleTestExecution(log, expectedTask) {
  if (typeof log !== 'string' || typeof expectedTask !== 'string' || expectedTask.trim() === '') {
    return {status: 'FAIL', reason: 'TESTCONTAINERS_TARGET_EXECUTION_LOG_INVALID'};
  }
  const taskPrefix = `> Task ${expectedTask}`;
  const taskLine = log
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line === taskPrefix || line.startsWith(`${taskPrefix} `));
  if (!taskLine) return {status: 'FAIL', reason: 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED'};
  const skippedMarker = ['FROM-CACHE', 'UP-TO-DATE', 'NO-SOURCE', 'SKIPPED'].find(marker =>
    taskLine.endsWith(` ${marker}`),
  );
  if (skippedMarker) return {status: 'FAIL', reason: `TESTCONTAINERS_TARGET_NOT_EXECUTED:${skippedMarker}`, taskLine};
  return {status: 'PASS', taskLine};
}

export function firstGradleFailureCode(log) {
  if (typeof log !== 'string') return null;
  const marker = log.match(/(?:^|\r?\n)Error:\s+([A-Z][A-Z0-9_]*(?::[A-Z0-9_.-]+)*)/)?.[1];
  if (marker) return marker;
  if (/Resolution of the configuration '[^']+' was attempted without an exclusive lock\./.test(log)) {
    return 'GRADLE_UNSAFE_CONFIGURATION_RESOLUTION';
  }
  return null;
}

const decodeXml = value =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

const stableFailureToken = value =>
  value
    .replace(/\b(?:[a-z_$][\w$]*\.){2,}([A-Z_$][\w$]*)\b/g, '$1')
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, 'UUID')
    .replace(/\b\d+\b/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);

/** Extract a stable test-level first failure; Gradle's summary alone loses setup causes. */
export function firstJUnitFailureCode(xml) {
  if (typeof xml !== 'string' || xml.trim() === '') return null;
  const failure = xml.match(/<(?:failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:failure|error)>)/);
  if (!failure) return null;
  const attributes = failure[1];
  const detail = decodeXml(`${attributes} ${failure[2] ?? ''}`.replace(/<[^>]*>/g, ' '));
  const assertionCode = detail.match(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,})\b(?=\s*(?:==>|:))/)?.[1];
  if (assertionCode) return `TEST_${assertionCode}`;

  const causes = [...detail.matchAll(/Caused by:\s+([\w.$]+)(?::\s*([^\r\n]+))?/g)];
  const deepestCause = causes.at(-1);
  const throwable = deepestCause?.[1] ?? attributes.match(/\btype="([^"]+)"/)?.[1];
  if (!throwable) return 'TEST_FAILURE_DETAILS_UNAVAILABLE';
  const simpleType = throwable.split('.').at(-1).replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  const causeMessage = deepestCause?.[2] ?? detail.match(/\bmessage="([^"]+)"/)?.[1] ?? '';
  const messageToken = stableFailureToken(causeMessage);
  return `TEST_${stableFailureToken(simpleType)}${messageToken ? `_${messageToken}` : ''}`;
}

/** Prefer test evidence over Gradle's wrapper exit marker when classifying a failed run. */
export function classifyRemoteGradleFailure(log, junitFailureCode) {
  if (typeof junitFailureCode === 'string' && junitFailureCode.trim() !== '') return junitFailureCode;

  const gradleCode = firstGradleFailureCode(log);
  if (gradleCode && gradleCode !== 'REMOTE_GRADLE_EXIT_NONZERO') return gradleCode;
  return 'GRADLE_TEST_FAILURE_DETAILS_UNAVAILABLE';
}

export const requiresBackendAcceptanceEvidence = (backendAcceptanceRunId, testExecutionPassed) =>
  backendAcceptanceRunId !== null && testExecutionPassed;

export const requiresBackendAcceptanceTdsContract = (backendAcceptanceRunId, mutationEvidenceType) =>
  backendAcceptanceRunId !== null && mutationEvidenceType !== 'TDS_CONTRACT';

export const validateCleanupReceipt = cleanup => {
  if (cleanup?.status !== 'PASS') throw new Error('RESOURCE_CLEANUP_NOT_PASS');
  for (const component of ['remoteProcess', 'remoteWorkspace', 'testcontainersContainers', 'testcontainersVolumes']) {
    if (cleanup[component] !== 'PASS') throw new Error(`RESOURCE_CLEANUP_COMPONENT_NOT_PASS:${component}`);
  }
  return cleanup;
};

export const validateProductionMutationReceipt = mutation => {
  const expected = resolveProductionMutation(mutation?.id);
  for (const field of [
    'operationId',
    'evidenceType',
    'scenarioId',
    'scenarioOperation',
    'module',
    'pointer',
    'file',
    'symbol',
    'from',
    'to',
    'replaceCount',
    'expectedSignal',
  ]) {
    if (mutation[field] !== expected[field]) throw new Error(`PRODUCTION_MUTATION_RECEIPT_${field.toUpperCase()}_INVALID`);
  }
  if (mutation.status !== 'PASS' || mutation.verdict !== 'PASS' || mutation.business !== 'FAIL' || mutation.cleanup !== 'PASS') {
    if (
      expected.evidenceType !== 'TDS_CONTRACT' ||
      mutation.status !== 'PASS' ||
      mutation.verdict !== 'PASS' ||
      mutation.business !== 'PASS' ||
      mutation.cleanup !== 'PASS'
    ) {
      throw new Error('PRODUCTION_MUTATION_RECEIPT_VERDICT_INVALID');
    }
  }
  for (const field of ['sourceBeforeSha256', 'sourceAfterSha256', 'stagingSnapshotHash']) {
    if (!/^[a-f0-9]{64}$/.test(mutation[field] ?? '')) {
      throw new Error(`PRODUCTION_MUTATION_RECEIPT_${field.toUpperCase()}_INVALID`);
    }
  }
  const observed = mutation.observed;
  if (expected.evidenceType === 'TDS_CONTRACT') {
    if (
      !observed ||
      observed.operationId !== expected.operationId ||
      observed.scenarioId !== expected.scenarioId ||
      observed.pointer !== expected.pointer ||
      observed.httpStatus !== 200 ||
      observed.httpOutcome !== 'SUCCEEDED' ||
      observed.httpEventCount !== 1 ||
      observed.business !== 'PASS' ||
      observed.tdsContract !== 'FAIL' ||
      observed.failureCategory !== 'TDS_VS10_REGISTRATION_RACE_RED_CONTROL'
    ) {
      throw new Error('PRODUCTION_MUTATION_RECEIPT_OBSERVATION_INVALID');
    }
    return mutation;
  }
  if (
    !observed ||
    observed.operationId !== expected.operationId ||
    observed.scenarioId !== expected.scenarioId ||
    observed.pointer !== expected.pointer ||
    observed.httpStatus !== 200 ||
    observed.httpOutcome !== 'SUCCEEDED' ||
    observed.httpEventCount !== 1 ||
    observed.failureCategory !== 'BUSINESS_ORACLE'
  ) {
    throw new Error('PRODUCTION_MUTATION_RECEIPT_OBSERVATION_INVALID');
  }
  return mutation;
};

const requireClosedPerformanceCount = (evidence, field, expected = EXPECTED_OPERATION_COUNT) => {
  if (!evidence || evidence.declared !== expected || evidence.observed !== expected || evidence.exceeded !== 0) {
    throw new Error(`RUN_MANIFEST_${field}_NOT_CLOSED`);
  }
};

const requireClosedOperationSet = operationSet => {
  if (
    !operationSet ||
    operationSet.expected !== EXPECTED_OPERATION_COUNT ||
    operationSet.observed !== EXPECTED_OPERATION_COUNT ||
    !Array.isArray(operationSet.missing) ||
    !Array.isArray(operationSet.extra) ||
    !Array.isArray(operationSet.drift) ||
    operationSet.missing.length !== 0 ||
    operationSet.extra.length !== 0 ||
    operationSet.drift.length !== 0
  ) {
    throw new Error('RUN_MANIFEST_OPERATION_SET_NOT_CLOSED');
  }
};

const requireClosedNormalSampleMatrix = normalSampleMatrix => {
  if (
    !normalSampleMatrix ||
    normalSampleMatrix.expected !== EXPECTED_OPERATION_COUNT ||
    normalSampleMatrix.observed !== EXPECTED_OPERATION_COUNT ||
    typeof normalSampleMatrix.path !== 'string' ||
    normalSampleMatrix.path.trim() === ''
  ) {
    throw new Error('RUN_MANIFEST_NORMAL_SAMPLE_MATRIX_NOT_CLOSED');
  }
};

const validateFullBackendAcceptanceMeasurementEvidence = (measurementEvidence, verificationMode) => {
  if (measurementEvidence?.status !== 'PASS' || measurementEvidence.verificationMode !== verificationMode) {
    throw new Error('RUN_MANIFEST_FULL_MEASUREMENT_EVIDENCE_REQUIRED');
  }
  requireClosedOperationSet(measurementEvidence.operationSet);
  requireClosedPerformanceCount(measurementEvidence.connectionBudgetEvidence, 'CONNECTION_BUDGET');
  requireClosedNormalSampleMatrix(measurementEvidence.normalSampleMatrix);
  if (verificationMode === 'ACCEPTANCE') {
    requireClosedPerformanceCount(measurementEvidence.budgetEvidence, 'BUDGET');
    if (Object.hasOwn(measurementEvidence, 'calibrationEvidence')) {
      throw new Error('RUN_MANIFEST_ACCEPTANCE_CALIBRATION_EVIDENCE_FORBIDDEN');
    }
    return;
  }
  if (measurementEvidence?.calibrationEvidence?.status !== 'PASS') {
    throw new Error('RUN_MANIFEST_CALIBRATION_EVIDENCE_REQUIRED');
  }
  if (Object.hasOwn(measurementEvidence, 'budgetEvidence')) {
    throw new Error('RUN_MANIFEST_CALIBRATION_BUDGET_EVIDENCE_FORBIDDEN');
  }
};

export const parseAndValidateRunManifest = manifest => {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.kind !== 'r5-managed-testcontainers-run')
    throw new Error('RUN_MANIFEST_INVALID');
  for (const key of [
    'runId',
    'task',
    'verificationMode',
    'startedAt',
    'finishedAt',
    'remote',
    'sourceSync',
    'gradleDistribution',
    'logPath',
    'backendAcceptance',
    'workload',
    'testExecution',
    'cleanup',
    'status',
    'firstFailure',
    'lastKnownGood',
    'brokenBoundary',
  ]) {
    if (!(key in manifest)) throw new Error(`RUN_MANIFEST_FIELD_MISSING:${key}`);
  }
  if (!BACKEND_ACCEPTANCE_VERIFICATION_MODES.includes(manifest.verificationMode)) {
    throw new Error('RUN_MANIFEST_VERIFICATION_MODE_INVALID');
  }
  if (typeof manifest.finishedAt !== 'string' || manifest.finishedAt.trim() === '') {
    throw new Error('RUN_MANIFEST_FINISHED_AT_INVALID');
  }
  if (!/^r5-tc-[0-9]+-[0-9]+$/.test(manifest.runId) || !/^:[a-z0-9:-]+:test$/.test(manifest.task))
    throw new Error('RUN_MANIFEST_IDENTITY_INVALID');
  if (!['PASS', 'FAIL'].includes(manifest.sourceSync.status)) throw new Error('RUN_MANIFEST_SOURCE_SYNC_INVALID');
  validateGradleDistribution(manifest.gradleDistribution);
  if (!['PASS', 'FAIL', 'NOT_RUN'].includes(manifest.testExecution.status))
    throw new Error('RUN_MANIFEST_TEST_EXECUTION_INVALID');
  if (manifest.status === 'PASS') {
    const resources = manifest.testcontainersResources;
    if (
      resources?.captureStatus !== 'PASS' ||
      typeof resources?.capturedAt !== 'string' ||
      resources?.cleanupStatus !== 'PASS' ||
      !Array.isArray(resources.capturedContainerIds) ||
      !resources.capturedContainerIds.every(id => /^[a-f0-9]{12,64}$/i.test(id)) ||
      !Array.isArray(resources.capturedVolumeNames) ||
      !resources.capturedVolumeNames.every(name => /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/.test(name))
    ) {
      throw new Error('RUN_MANIFEST_TESTCONTAINERS_RESOURCE_EVIDENCE_INVALID');
    }
  }
  const backendAcceptance = manifest.backendAcceptance;
  const tdsContractOnly = backendAcceptance?.scope === 'TDS_CONTRACT_ONLY';
  if (
    backendAcceptance !== null &&
    (!backendAcceptance ||
      typeof backendAcceptance.runId !== 'string' ||
      backendAcceptance.runId.trim() === '' ||
      typeof backendAcceptance.operation !== 'string' ||
      backendAcceptance.operation.trim() === '')
  ) {
    throw new Error('RUN_MANIFEST_BACKEND_ACCEPTANCE_IDENTITY_INVALID');
  }
  if (backendAcceptance !== null && backendAcceptance.tdsContractScenario != null) {
    if (
      !isTdsContractScenarioScopeValid(
        backendAcceptance.tdsContractScenario,
        backendAcceptance.topologyPreflight,
      ) ||
      backendAcceptance.operation !== 'storeTerminalActivationBusinessPrecedence' ||
      manifest.verificationMode !== 'ACCEPTANCE' ||
      (backendAcceptance.tdsContractScenarioResult !== undefined &&
        backendAcceptance.tdsContractScenarioResult !== 'PASS') ||
      (manifest.status === 'PASS' && backendAcceptance.tdsContractScenarioResult !== 'PASS')
    ) {
      throw new Error('RUN_MANIFEST_TDS_CONTRACT_SCENARIO_SCOPE_INVALID');
    }
  }
  if (
    tdsContractOnly &&
    (backendAcceptance.operation !== 'all' ||
      manifest.business !== 'NOT_APPLICABLE' ||
      manifest.workload !== null ||
      manifest.measurementEvidence?.status !== 'NOT_RUN')
  ) {
    throw new Error('RUN_MANIFEST_TDS_CONTRACT_ONLY_SCOPE_INVALID');
  }
  if (
    manifest.measurementEvidence !== undefined &&
    !['PASS', 'NOT_RUN'].includes(manifest.measurementEvidence.status)
  ) {
    throw new Error('RUN_MANIFEST_MEASUREMENT_EVIDENCE_INVALID');
  }
  if (manifest.signalTrace !== undefined) {
    const trace = manifest.signalTrace;
    if (
      !trace ||
      typeof trace.requested !== 'boolean' ||
      !['PENDING', 'CAPTURED', 'PASS', 'FAIL', 'UNAVAILABLE', 'NOT_REQUESTED'].includes(trace.status) ||
      !['NONE', 'GRADLE_CHILD_TREE', 'REMOTE_HOST_SIGNAL_GENERATE'].includes(trace.scope) ||
      trace.artifact !== 'process-signal-trace.log' ||
      (trace.requested && trace.status === 'NOT_REQUESTED') ||
      (!trace.requested && (trace.status !== 'NOT_REQUESTED' || trace.scope !== 'NONE')) ||
      (trace.requested && trace.scope === 'NONE')
    ) {
      throw new Error('RUN_MANIFEST_SIGNAL_TRACE_INVALID');
    }
  }
  if (backendAcceptance === null && manifest.measurementEvidence?.status === 'PASS') {
    throw new Error('RUN_MANIFEST_MEASUREMENT_WITHOUT_BACKEND_ACCEPTANCE');
  }
  if (manifest.business !== undefined && !['PASS', 'FAIL', 'NOT_RUN', 'NOT_APPLICABLE'].includes(manifest.business)) {
    throw new Error('RUN_MANIFEST_BUSINESS_STATUS_INVALID');
  }
  if (
    (manifest.firstFailure !== null && typeof manifest.firstFailure !== 'string') ||
    (manifest.lastKnownGood !== null && typeof manifest.lastKnownGood !== 'string') ||
    (manifest.brokenBoundary !== null && typeof manifest.brokenBoundary !== 'string')
  ) {
    throw new Error('RUN_MANIFEST_BOUNDARY_FIELDS_INVALID');
  }
  if (
    manifest.failureCategory !== undefined &&
    ((manifest.failureCategory !== null &&
      (typeof manifest.failureCategory !== 'string' || manifest.failureCategory.trim() === '')) ||
      (manifest.firstFailure !== null && manifest.failureCategory === null))
  ) {
    throw new Error('RUN_MANIFEST_FAILURE_CATEGORY_INVALID');
  }
  if (manifest.lastKnownGood !== null && manifest.lastKnownGood.trim() === '') {
    throw new Error('RUN_MANIFEST_LAST_KNOWN_GOOD_INVALID');
  }
  if (manifest.brokenBoundary !== null && manifest.brokenBoundary.trim() === '') {
    throw new Error('RUN_MANIFEST_BROKEN_BOUNDARY_INVALID');
  }
  if (manifest.productionMutation !== undefined && manifest.productionMutation !== null) {
    validateProductionMutationReceipt(manifest.productionMutation);
  }
  if (backendAcceptance?.operation === 'all' && !tdsContractOnly) {
    if (
      !manifest.workload ||
      manifest.workload.schemaVersion !== 1 ||
      typeof manifest.workload.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(manifest.workload.fingerprint) ||
      !manifest.workload.descriptor
    ) {
      throw new Error('RUN_MANIFEST_WORKLOAD_FINGERPRINT_REQUIRED');
    }
    validateFullBackendAcceptanceMeasurementEvidence(manifest.measurementEvidence, manifest.verificationMode);
  } else if (manifest.workload !== null) {
    throw new Error('RUN_MANIFEST_WORKLOAD_UNEXPECTED');
  } else if (manifest.verificationMode === 'CALIBRATION') {
    throw new Error('RUN_MANIFEST_CALIBRATION_REQUIRES_FULL_BACKEND_ACCEPTANCE');
  }
  if (backendAcceptance !== null && manifest.status === 'PASS')
    validateEvidenceArchiveReceipt(
      manifest.evidenceArchive,
      tdsContractOnly ? TDS_CONTRACT_ONLY_EVIDENCE_ARTIFACTS : ARCHIVED_EVIDENCE_ARTIFACTS,
    );
  validateCleanupReceipt(manifest.cleanup);
  if (!['PASS', 'FAIL'].includes(manifest.status)) throw new Error('RUN_MANIFEST_STATUS_INVALID');
  return manifest;
};

export const managedGradleHomeScript = () => 'export V2S_GRADLE_HOME="$gradle"';

const walkFiles = (directory, relative = '') =>
  readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const child = path.join(directory, entry.name);
    const childRelative = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return walkFiles(child, childRelative);
    return entry.isFile() ? [childRelative] : [];
  });

const gradleDistributionSha256 = distributionHome => {
  const digest = createHash('sha256');
  for (const relativePath of walkFiles(distributionHome).sort()) {
    const file = path.join(distributionHome, relativePath);
    digest
      .update(relativePath)
      .update('\0')
      .update(String(statSync(file).mode & 0o777))
      .update('\0')
      .update(readFileSync(file))
      .update('\0');
  }
  return digest.digest('hex');
};

const commandResult = (binary, args, options = {}) =>
  spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});

const canonicalStartToken = value =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const processStartToken = pid => {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  const token = canonicalStartToken(result.stdout);
  return result.status === 0 && token ? token : null;
};

const processAlive = pid => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const acquireLocalRunLock = (
  lockPath = localRunLockPath,
  {
    pid = process.pid,
    startToken = processStartToken(pid),
    alive = processAlive,
    startTokenForPid = processStartToken,
    nowValue = now(),
    ownerToken = randomUUID(),
    remoteHostValue = remoteHost,
  } = {},
) => {
  const ownerPath = path.join(lockPath, 'owner.json');
  const owner = {
    pid,
    startToken: canonicalStartToken(startToken),
    ownerToken,
    remoteHost: remoteHostValue,
    startedAt: nowValue,
  };
  if (!Number.isInteger(owner.pid) || owner.pid <= 0 || owner.startToken === '') {
    throw new Error('LOCAL_TESTCONTAINERS_RUN_LOCK_OWNER_INVALID');
  }
  const priorIsLive = prior =>
    Number.isInteger(prior?.pid) &&
    typeof prior.startToken === 'string' &&
    canonicalStartToken(prior.startToken) !== '' &&
    alive(prior.pid) &&
    canonicalStartToken(startTokenForPid(prior.pid)) === canonicalStartToken(prior.startToken);
  const write = () => {
    mkdirSync(lockPath, {mode: 0o700});
    const temporaryOwnerPath = path.join(lockPath, `owner.${ownerToken}.tmp`);
    const fd = openSync(temporaryOwnerPath, 'wx', 0o600);
    try {
      writeFileSync(fd, `${JSON.stringify(owner)}\n`);
    } finally {
      closeSync(fd);
    }
    renameSync(temporaryOwnerPath, ownerPath);
  };
  for (;;) {
    try {
      write();
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      let prior;
      try {
        prior = JSON.parse(readFileSync(ownerPath, 'utf8'));
      } catch {
        throw new Error('LOCAL_TESTCONTAINERS_RUN_LOCK_OWNER_UNAVAILABLE');
      }
      if (priorIsLive(prior)) {
        throw new Error(`LOCAL_TESTCONTAINERS_RUN_ALREADY_ACTIVE:${prior.pid}`);
      }
      throw new Error('STALE_LOCAL_TESTCONTAINERS_RUN_LOCK_REQUIRES_EXPLICIT_DIAGNOSIS');
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      const current = JSON.parse(readFileSync(ownerPath, 'utf8'));
      if (current?.pid === owner.pid && current?.ownerToken === owner.ownerToken) {
        rmSync(lockPath, {recursive: true, force: true});
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  };
};

export const inspectManagedDevState = ({
  manifestPath = path.join(runtime, 'run-manifest.json'),
  exists = existsSync,
  read = readFileSync,
} = {}) => {
  if (!exists(manifestPath)) return Object.freeze({wasRunning: false, runId: null});
  let manifest;
  try {
    manifest = JSON.parse(read(manifestPath, 'utf8'));
  } catch {
    throw new Error('DEV_MANIFEST_INVALID');
  }
  if (
    manifest?.kind !== 'r5-dev-run-manifest' ||
    typeof manifest.runId !== 'string' ||
    !Array.isArray(manifest.processes) ||
    !manifest.remoteJava ||
    typeof manifest.remoteHostTrust?.host !== 'string'
  ) {
    throw new Error('DEV_MANIFEST_INVALID');
  }
  return Object.freeze({wasRunning: true, runId: manifest.runId});
};

export const classifyManagedDevLifecycleCommand = (result, marker) => {
  if (
    result?.status === 0 &&
    String(result.stdout ?? '')
      .split(/\r?\n/)
      .some(line => line.startsWith(marker))
  ) {
    return Object.freeze({status: 'PASS'});
  }
  return Object.freeze({status: 'FAIL', reason: `${marker}_NOT_CONFIRMED`});
};

const remoteResult = body =>
  commandResult('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, 'bash', '-s'], {input: body});
const remote = body => {
  const result = remoteResult(body);
  if (result.status !== 0) throw new Error(`SSH:${compact(result.stderr || result.stdout)}`);
  return result.stdout;
};
const atomicWrite = (target, value) => {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, value);
  renameSync(temporary, target);
};

export const remotePreflightScript = ({requireTerminalWireRuntime = false, tdsCapacity = null} = {}) => {
  if (requireTerminalWireRuntime && tdsCapacity === null) {
    throw new Error('REMOTE_TDS_CAPACITY_LOCAL_INPUT_REQUIRED');
  }
  const validCapacity = requireTerminalWireRuntime
    ? validateTdsCapacityConfiguration(tdsCapacity)
    : null;
  const capacityRows = requireTerminalWireRuntime
    ? [
        `printf "TDS_CAPACITY\\tV2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS\\t%s\\n" ${quote(validCapacity.maxUnauthenticatedConnections)}`,
        `printf "TDS_CAPACITY\\tV2S_TDS_MAX_TRACKED_SESSIONS\\t%s\\n" ${quote(validCapacity.maxTrackedSessions)}`,
        `printf "TDS_CAPACITY\\tV2S_TDS_RSS_BUDGET_MIB\\t%s\\n" ${quote(validCapacity.rssBudgetMiB)}`,
      ]
    : [];
  return script(
    'set -euo pipefail',
    'container_query_status=PASS',
    'container_ids=""',
    'if ! container_ids="$(docker ps -aq --filter label=org.testcontainers=true 2>/dev/null)"; then container_query_status=FAIL; fi',
    'printf "RESOURCE_QUERY\\tCONTAINERS\\t%s\\n" "$container_query_status"',
    'if test -n "$container_ids"; then while IFS= read -r container_id; do test -z "$container_id" || printf "CONTAINER\\t%s\\n" "$container_id"; done <<< "$container_ids"; fi',
    'volume_query_status=PASS',
    'volume_ids=""',
    'if ! volume_ids="$(docker volume ls -q --filter label=org.testcontainers=true 2>/dev/null)"; then volume_query_status=FAIL; fi',
    'printf "RESOURCE_QUERY\\tVOLUMES\\t%s\\n" "$volume_query_status"',
    'if test -n "$volume_ids"; then while IFS= read -r volume_id; do test -z "$volume_id" || printf "VOLUME\\t%s\\n" "$volume_id"; done <<< "$volume_ids"; fi',
    ...(requireTerminalWireRuntime
      ? [
          'node_candidates="$(type -a -p node || true)"',
          'if test -z "$node_candidates"; then printf "NODE_RUNTIME\\t%s\\n" \'{"status":"FAIL","reason":"NODE_EXECUTABLE_MISSING"}\'; else',
          `  node_probe='{"status":"FAIL","reason":"NODE_RUNTIME_PROBE_FAILED"}'`,
          '  while IFS= read -r node_binary; do',
          '    test -n "$node_binary" || continue',
          '    candidate_probe="$("$node_binary" --input-type=module - <<\'NODE\'',
          'import { createServer, createConnection } from "node:net";',
          'import { randomBytes } from "node:crypto";',
          'import { deflateRawSync } from "node:zlib";',
          'import { createInterface } from "node:readline";',
          'import { performance } from "node:perf_hooks";',
          'import { mkdtempSync, rmSync } from "node:fs";',
          'import os from "node:os";',
          'import path from "node:path";',
          'import { fileURLToPath } from "node:url";',
          'const requiredWireModules = ["net", "crypto", "zlib", "readline", "perf_hooks", "path", "url"];',
          'const coreApiPresent = typeof createServer === "function" && typeof createConnection === "function" && typeof randomBytes === "function" && typeof deflateRawSync === "function" && typeof createInterface === "function" && typeof performance.now === "function" && typeof path.resolve === "function" && typeof fileURLToPath === "function";',
          'const result = { nodePath: process.execPath, nodeVersion: process.versions.node, platform: process.platform, coreModules: coreApiPresent ? requiredWireModules : [], unixDomainSocket: "FAIL" };',
          'let directory;',
          'let server;',
          'try {',
          '  directory = mkdtempSync(path.join(os.tmpdir(), "v2s-uds-preflight-"));',
          '  server = createServer();',
          '  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(path.join(directory, "probe.sock"), resolve); });',
          '  result.unixDomainSocket = "PASS";',
          '} catch {',
          '  result.reason = "UNIX_DOMAIN_SOCKET_UNAVAILABLE";',
          '} finally {',
          '  if (server?.listening) await new Promise(resolve => server.close(() => resolve()));',
          '  if (directory) rmSync(directory, {recursive: true, force: true});',
          '}',
          'result.rawSocketClient = result.coreModules.includes("net");',
          'result.status = result.platform === "linux" && result.nodeVersion === "22.23.2" && result.unixDomainSocket === "PASS" && result.rawSocketClient ? "PASS" : "FAIL";',
          'if (result.status === "FAIL" && !result.reason) result.reason = "PINNED_NODE_RUNTIME_MISMATCH";',
          'process.stdout.write(`${JSON.stringify(result)}\\n`);',
          'NODE',
          '    )" || candidate_probe=\'{"status":"FAIL","reason":"NODE_RUNTIME_PROBE_FAILED"}\'',
          '    node_probe="$candidate_probe"',
          `    case "$node_probe" in *'"status":"PASS"'*) break ;; esac`,
          '  done <<< "$node_candidates"',
          '  printf "NODE_RUNTIME\\t%s\\n" "$node_probe"',
          'fi',
        ]
      : []),
    ...capacityRows,
    'if test "$container_query_status" != PASS || test "$volume_query_status" != PASS; then exit 80; fi',
  );
};

const safeTerminalWireRuntimeObservation = runtime => ({
  status: typeof runtime?.status === 'string' ? runtime.status.slice(0, 16) : null,
  reason: typeof runtime?.reason === 'string' ? runtime.reason.slice(0, 64) : null,
  platform: typeof runtime?.platform === 'string' ? runtime.platform.slice(0, 32) : null,
  nodeVersion: typeof runtime?.nodeVersion === 'string' ? runtime.nodeVersion.slice(0, 32) : null,
  unixDomainSocket: typeof runtime?.unixDomainSocket === 'string' ? runtime.unixDomainSocket.slice(0, 16) : null,
  rawSocketClient: typeof runtime?.rawSocketClient === 'boolean' ? runtime.rawSocketClient : null,
  coreModules: Array.isArray(runtime?.coreModules)
          ? runtime.coreModules.filter(module => ['net', 'crypto', 'zlib', 'readline', 'perf_hooks', 'path', 'url'].includes(module))
    : [],
});

const unavailableResourceInventory = () => ({
  status: 'UNAVAILABLE',
  containerQueryStatus: 'UNAVAILABLE',
  volumeQueryStatus: 'UNAVAILABLE',
  containers: 0,
  volumes: 0,
});

const remotePreflightFailure = (
  code,
  {
    nodeRuntime = null,
    tdsCapacity = null,
    resourceInventory = unavailableResourceInventory(),
    containers = [],
    volumes = [],
    remoteExitStatus = null,
  } = {},
) => {
  const diagnostic = {
    status: 'FAIL',
    reason: code,
    observedAt: now(),
    resourceInventory,
    containers,
    volumes,
    ...(nodeRuntime === null ? {} : {nodeRuntime: safeTerminalWireRuntimeObservation(nodeRuntime)}),
    ...(tdsCapacity === null ? {} : {tdsCapacity}),
    ...(remoteExitStatus === null ? {} : {remoteExitStatus}),
  };
  const detail = nodeRuntime?.reason ?? code;
  const error = new Error(`${code}:${detail}`);
  error.preflightEvidence = diagnostic;
  return error;
};

export const recordRemotePreflightFailure = (manifest, error, {remotePrepared = false} = {}) => {
  const evidence = error?.preflightEvidence;
  if (!evidence) return false;
  manifest.resourcePreflight = evidence;
  if (remotePrepared) return true;
  const inventory = evidence.resourceInventory ?? unavailableResourceInventory();
  const containersKnownEmpty = inventory.containerQueryStatus === 'PASS' && inventory.containers === 0;
  const volumesKnownEmpty = inventory.volumeQueryStatus === 'PASS' && inventory.volumes === 0;
  manifest.cleanup = {
    status: containersKnownEmpty && volumesKnownEmpty ? 'PASS' : 'FAIL',
    remoteProcess: 'PASS',
    remoteWorkspace: 'PASS',
    testcontainersContainers: containersKnownEmpty ? 'PASS' : 'FAIL',
    testcontainersVolumes: volumesKnownEmpty ? 'PASS' : 'FAIL',
  };
  return true;
};

export const parseRemotePreflightResult = (result, {requireTerminalWireRuntime = false} = {}) => {
  const rows = String(result?.stdout ?? '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t'));
  const queryRows = rows.filter(([kind]) => kind === 'RESOURCE_QUERY');
  const allowedRowKinds = new Set(['RESOURCE_QUERY', 'CONTAINER', 'VOLUME', 'NODE_RUNTIME', 'TDS_CAPACITY']);
  const unrecognizedOutputRows = rows.filter(([kind]) => !allowedRowKinds.has(kind)).length;
  const invalidQueryRows = queryRows.filter(
    row => row.length !== 3 || !['CONTAINERS', 'VOLUMES'].includes(row[1]) || !['PASS', 'FAIL'].includes(row[2]),
  ).length;
  const queryStatus = name => {
    const matches = queryRows.filter(([, query]) => query === name);
    if (matches.length === 0) return result.status === 0 ? 'NOT_REPORTED' : 'UNAVAILABLE';
    if (matches.length !== 1 || matches[0].length !== 3 || !['PASS', 'FAIL'].includes(matches[0][2])) return 'INVALID';
    return matches[0][2];
  };
  const containerQueryStatus = queryStatus('CONTAINERS');
  const volumeQueryStatus = queryStatus('VOLUMES');
  const rawContainers = rows.filter(([kind]) => kind === 'CONTAINER');
  const rawVolumes = rows.filter(([kind]) => kind === 'VOLUME');
  const safeContainerId = value => typeof value === 'string' && /^[a-f0-9]{12,64}$/i.test(value);
  const safeVolumeName = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value);
  const containers = rawContainers.filter(row => row.length === 2 && safeContainerId(row[1])).map(([, value]) => value);
  const volumes = rawVolumes.filter(row => row.length === 2 && safeVolumeName(row[1])).map(([, value]) => value);
  const invalidResourceRows = rawContainers.length - containers.length + rawVolumes.length - volumes.length;
  const bothQueriesPassed = containerQueryStatus === 'PASS' && volumeQueryStatus === 'PASS';
  const anyQueryPassed = containerQueryStatus === 'PASS' || volumeQueryStatus === 'PASS';
  const successfulCommandMissingQueryEvidence =
    result.status === 0 && (containerQueryStatus === 'NOT_REPORTED' || volumeQueryStatus === 'NOT_REPORTED');
  const resourceInventory = {
    status:
      invalidResourceRows > 0 ||
      invalidQueryRows > 0 ||
      unrecognizedOutputRows > 0 ||
      containerQueryStatus === 'INVALID' ||
      volumeQueryStatus === 'INVALID' ||
      successfulCommandMissingQueryEvidence
        ? 'INVALID'
        : bothQueriesPassed
          ? containers.length || volumes.length
            ? 'NON_EMPTY'
            : 'EMPTY'
          : anyQueryPassed || containers.length || volumes.length
            ? 'PARTIAL'
            : 'UNAVAILABLE',
    containerQueryStatus,
    volumeQueryStatus,
    containers: containers.length,
    volumes: volumes.length,
    ...(invalidResourceRows + invalidQueryRows + unrecognizedOutputRows > 0
      ? {invalidRows: invalidResourceRows + invalidQueryRows + unrecognizedOutputRows}
      : {}),
  };
  const failureEvidence = {resourceInventory, containers, volumes, remoteExitStatus: Number.isInteger(result.status) ? result.status : null};
  if (invalidResourceRows > 0 || resourceInventory.status === 'INVALID') {
    throw remotePreflightFailure('REMOTE_RESOURCE_PREFLIGHT_EVIDENCE_INVALID', failureEvidence);
  }
  if (!bothQueriesPassed) {
    throw remotePreflightFailure('REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE', failureEvidence);
  }
  if (containers.length || volumes.length) {
    throw remotePreflightFailure('REMOTE_TESTCONTAINERS_STALE_RESOURCE', failureEvidence);
  }
  if (result.status !== 0) {
    throw remotePreflightFailure('REMOTE_RESOURCE_PREFLIGHT_COMMAND_FAILED', failureEvidence);
  }
  const nodeRows = rows.filter(([kind]) => kind === 'NODE_RUNTIME');
  if (nodeRows.length > 1) throw remotePreflightFailure('REMOTE_TERMINAL_WIRE_RUNTIME_DUPLICATE', failureEvidence);
  let nodeRuntime = null;
  if (nodeRows.length === 1) {
    try {
      nodeRuntime = JSON.parse(nodeRows[0][1]);
    } catch {
      throw remotePreflightFailure('REMOTE_TERMINAL_WIRE_RUNTIME_INVALID', failureEvidence);
    }
    if (
      nodeRuntime?.status !== 'PASS' ||
      nodeRuntime?.platform !== 'linux' ||
      nodeRuntime?.nodeVersion !== '22.23.2' ||
      nodeRuntime?.unixDomainSocket !== 'PASS' ||
      nodeRuntime?.rawSocketClient !== true ||
      !Array.isArray(nodeRuntime?.coreModules) ||
      !['net', 'crypto', 'zlib', 'readline', 'perf_hooks', 'path', 'url']
        .every(module => nodeRuntime.coreModules.includes(module)) ||
      typeof nodeRuntime?.nodePath !== 'string' ||
      nodeRuntime.nodePath.trim() === ''
    ) {
      throw remotePreflightFailure('REMOTE_TERMINAL_WIRE_RUNTIME_INVALID', {...failureEvidence, nodeRuntime});
    }
  }
  if (requireTerminalWireRuntime && nodeRuntime === null) {
    throw remotePreflightFailure('REMOTE_TERMINAL_WIRE_RUNTIME_REQUIRED', failureEvidence);
  }
  const tdsCapacityRows = rows.filter(([kind]) => kind === 'TDS_CAPACITY');
  let tdsCapacity = null;
  if (requireTerminalWireRuntime) {
    const values = Object.fromEntries(tdsCapacityRows.map(([, key, value]) => [key, value]));
    const unauth = values.V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS;
    const tracked = values.V2S_TDS_MAX_TRACKED_SESSIONS;
    const rssBudgetMiB = values.V2S_TDS_RSS_BUDGET_MIB;
    if (
      tdsCapacityRows.length !== 3 ||
      !/^[1-9][0-9]{0,9}$/.test(unauth ?? '') ||
      !/^[1-9][0-9]{0,9}$/.test(tracked ?? '') ||
      !/^[1-9][0-9]{0,9}$/.test(rssBudgetMiB ?? '') ||
      Number(unauth) > 2147483647 ||
      Number(tracked) > 2147483647 ||
      Number(rssBudgetMiB) > 2147483647
    ) {
      throw remotePreflightFailure('REMOTE_TDS_CAPACITY_INVALID', {
        ...failureEvidence,
        nodeRuntime,
        tdsCapacity: {
          maxUnauthenticatedConnections: unauth ?? null,
          maxTrackedSessions: tracked ?? null,
          rssBudgetMiB: rssBudgetMiB ?? null,
        },
      });
    }
    tdsCapacity = Object.freeze({
      maxUnauthenticatedConnections: unauth,
      maxTrackedSessions: tracked,
      rssBudgetMiB: Number(rssBudgetMiB),
      source: TDS_CAPACITY_CONFIG_RELATIVE_PATH,
    });
  }
  return {
    containers,
    volumes,
    resourceInventory,
    ...(nodeRuntime === null ? {} : {nodeRuntime}),
    ...(tdsCapacity ? {tdsCapacity} : {}),
    observedAt: now(),
  };
};

const remotePreflight = ({requireTerminalWireRuntime = false, tdsCapacity = null} = {}) =>
  parseRemotePreflightResult(
    remoteResult(remotePreflightScript({requireTerminalWireRuntime, tdsCapacity})),
    {requireTerminalWireRuntime},
  );

const waitForClose = child =>
  new Promise(resolve => {
    let settled = false;
    const settle = code => {
      if (!settled) {
        settled = true;
        resolve(code);
      }
    };
    child.once('error', () => settle(-1));
    child.once('close', settle);
  });

const uploadSource = async remoteWorkspace => {
  const source = spawn(
    'tar',
    [
      '--exclude=.git',
      '--exclude=.runtime',
      '--exclude=.gradle',
      '--exclude=.yarn',
      '--exclude=node_modules',
      '--exclude=*/node_modules',
      '--exclude=build',
      '--exclude=*/build',
      '--exclude=*/.gradle',
      '--exclude=doc/evidence',
      '--exclude=apps/terminal',
      '--no-xattrs',
      '--no-fflags',
      '--no-acls',
      '--no-mac-metadata',
      '-C',
      root,
      '-czf',
      '-',
      '.',
    ],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {...process.env, COPYFILE_DISABLE: '1'},
    },
  );
  const upload = spawn(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, `tar -xzf - -C ${quote(remoteWorkspace)}`],
    {cwd: root, stdio: ['pipe', 'ignore', 'pipe']},
  );
  const sourceExit = waitForClose(source);
  const uploadExit = waitForClose(upload);
  let diagnostics = '';
  source.stderr.setEncoding('utf8').on('data', chunk => {
    diagnostics += chunk;
  });
  upload.stderr.setEncoding('utf8').on('data', chunk => {
    diagnostics += chunk;
  });
  const captureStreamError = error => {
    diagnostics += `${error.name ?? 'Error'}: ${error.message ?? String(error)}\n`;
  };
  source.on('error', captureStreamError);
  upload.on('error', captureStreamError);
  source.stdout.on('error', captureStreamError);
  upload.stdin.on('error', captureStreamError);
  let sourceClosed = false;
  let uploadClosed = false;
  const stopSource = () => {
    source.stdout.unpipe(upload.stdin);
    source.stdout.destroy();
    upload.stdin.destroy();
    if (source.exitCode === null && !source.killed) source.kill('SIGTERM');
  };
  const stopUpload = () => {
    source.stdout.unpipe(upload.stdin);
    source.stdout.destroy();
    upload.stdin.destroy();
    if (upload.exitCode === null && !upload.killed) upload.kill('SIGTERM');
  };
  source.once('close', status => {
    sourceClosed = true;
    if (status !== 0 && !uploadClosed) stopUpload();
  });
  source.once('error', () => {
    if (!uploadClosed) stopUpload();
  });
  upload.once('close', status => {
    uploadClosed = true;
    if (status !== 0 && !sourceClosed) stopSource();
  });
  upload.once('error', () => {
    if (!sourceClosed) stopSource();
  });
  source.stdout.pipe(upload.stdin);
  const [sourceStatus, uploadStatus] = await Promise.all([sourceExit, uploadExit]);
  if (sourceStatus !== 0 || uploadStatus !== 0) {
    throw new Error(
      `SOURCE_UPLOAD_FAILED:sourceStatus=${sourceStatus}:uploadStatus=${uploadStatus}:` +
        `${compact(diagnostics.slice(-240))}`,
    );
  }
};

const syncGradle = async ({directory, remoteRoot, distribution}) => {
  const syncLog = path.join(directory, 'gradle-sync.log');
  const reusable = remoteResult(
    script(
      'set -euo pipefail',
      `distribution=${quote(distribution.path)}`,
      `expected=${quote(distribution.sha256)}`,
      'marker="$distribution/.v2s-gradle-distribution.sha256"',
      'if test -x "$distribution/bin/gradle" && test -f "$marker" && test "$(cat \"$marker\")" = "$expected"; then printf REUSED; else printf SYNC_REQUIRED; fi',
    ),
  );
  const reusableDiagnostic = {
    event: 'GRADLE_DISTRIBUTION_CHECK',
    status: reusable.status ?? null,
    signal: reusable.signal ?? null,
    stdout: String(reusable.stdout ?? '').trim().slice(0, 1024),
    stderr: String(reusable.stderr ?? '').trim().slice(0, 1024),
  };
  appendFileSync(syncLog, `${JSON.stringify(reusableDiagnostic)}\n`);
  if (reusable.status !== 0)
    throw new Error(`GRADLE_DISTRIBUTION_CHECK_FAILED:${compact(JSON.stringify(reusableDiagnostic))}`);
  if (reusable.stdout.trim() === 'REUSED') return {...distribution, status: 'REUSED'};
  if (reusable.stdout.trim() !== 'SYNC_REQUIRED')
    throw new Error(`GRADLE_DISTRIBUTION_CHECK_INVALID:${compact(JSON.stringify(reusableDiagnostic))}`);
  const staging = `${remoteRoot}/gradle-distribution-staging`;
  const transfer = spawn(
    'rsync',
    ['-a', '--delete', '--timeout=30', `${distribution.localHome}/`, `${remoteHost}:${staging}/`],
    {cwd: root, stdio: ['ignore', 'pipe', 'pipe']},
  );
  let diagnostics = '';
  const capture = chunk => {
    const text = String(chunk);
    diagnostics += text;
    appendFileSync(syncLog, text);
  };
  transfer.stdout.setEncoding('utf8').on('data', capture);
  transfer.stderr.setEncoding('utf8').on('data', capture);
  if ((await waitForClose(transfer)) !== 0) throw new Error(`GRADLE_SYNC_FAILED:${compact(diagnostics)}`);
  const published = remoteResult(
    script(
      'set -euo pipefail',
      `distribution=${quote(distribution.path)}`,
      `staging=${quote(staging)}`,
      `expected=${quote(distribution.sha256)}`,
      'test -x "$staging/bin/gradle"',
      'if test -x "$distribution/bin/gradle" && test -f "$distribution/.v2s-gradle-distribution.sha256" && test "$(cat \"$distribution/.v2s-gradle-distribution.sha256\")" = "$expected"; then rm -rf "$staging"; printf REUSED_AFTER_RACE; else test ! -e "$distribution"; printf "%s\\n" "$expected" > "$staging/.v2s-gradle-distribution.sha256"; mv "$staging" "$distribution"; printf SYNCED; fi',
    ),
  );
  if (published.status !== 0 || !['SYNCED', 'REUSED_AFTER_RACE'].includes(published.stdout.trim()))
    throw new Error('GRADLE_DISTRIBUTION_PUBLISH_FAILED');
  return {...distribution, status: published.stdout.trim()};
};

let activeRemoteSshChild = null;

const installInterruptionHandlers = onInterrupt => {
  const handler = signal => {
    onInterrupt(signal);
    if (activeRemoteSshChild && !activeRemoteSshChild.killed) activeRemoteSshChild.kill('SIGTERM');
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
  return () => {
    process.off('SIGINT', handler);
    process.off('SIGTERM', handler);
  };
};

const streamRemoteRun = body =>
  new Promise(resolve => {
    const child = spawn(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=10',
        '-o',
        'ServerAliveInterval=30',
        '-o',
        'ServerAliveCountMax=3',
        remoteHost,
        'bash',
        '-s',
      ],
      {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    activeRemoteSshChild = child;
    let stdoutTail = '';
    let stderrTail = '';
    let stdoutMarkerRemainder = '';
    const stdoutMarkers = {};
    const appendTail = (prior, chunk) => `${prior}${chunk}`.slice(-32_768);
    const captureMarkers = chunk => {
      const lines = `${stdoutMarkerRemainder}${chunk}`.split(/\r?\n/);
      stdoutMarkerRemainder = lines.pop() ?? '';
      Object.assign(stdoutMarkers, parseRunnerMarkers(lines.join('\n')));
    };
    child.stdout.setEncoding('utf8').on('data', chunk => {
      process.stdout.write(chunk);
      stdoutTail = appendTail(stdoutTail, chunk);
      captureMarkers(chunk);
    });
    child.stderr.setEncoding('utf8').on('data', chunk => {
      process.stderr.write(chunk);
      stderrTail = appendTail(stderrTail, chunk);
    });
    child.stdin.end(body);
    child.once('error', error => {
      if (activeRemoteSshChild === child) activeRemoteSshChild = null;
      captureMarkers('\n');
      resolve({
        status: -1,
        stdoutTail,
        stderrTail: appendTail(stderrTail, error.message),
        markers: Object.freeze({...stdoutMarkers}),
      });
    });
    child.once('close', (status, signal) => {
      if (activeRemoteSshChild === child) activeRemoteSshChild = null;
      captureMarkers('\n');
      resolve({
        status: status ?? -1,
        signal,
        stdoutTail,
        stderrTail,
        markers: Object.freeze({...stdoutMarkers}),
      });
    });
  });

const collectArtifacts = (remoteResults, directory) => {
  const result = commandResult('scp', [
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=10',
    '-r',
    `${remoteHost}:${remoteResults}/.`,
    directory,
  ]);
  if (result.status !== 0) throw new Error(`ARTIFACT_COLLECTION_FAILED:${compact(result.stderr || result.stdout)}`);
};

const testcontainersRemoteRootPattern = /^\/tmp\/r5-tc-[0-9]+-[0-9]+$/;
const cleanupMarker = (output, name) => output.match(new RegExp(`(?:^|\\n)${name}=([^\\r\\n]+)`))?.[1]?.trim() ?? null;
const cleanupRemoteWorkspaceScript = (remoteRoot, baseline = null) => {
  const baselineSetup =
    baseline === null
      ? [
          'test -f "$before_container_ids_file" || { printf "REMOTE_CLEANUP_FAILURE=BEFORE_CONTAINER_IDS_MISSING\\n"; exit 65; }',
          'test -f "$before_volume_ids_file" || { printf "REMOTE_CLEANUP_FAILURE=BEFORE_VOLUME_IDS_MISSING\\n"; exit 66; }',
          'before_container_ids="$(cat "$before_container_ids_file")"',
          'before_volume_ids="$(cat "$before_volume_ids_file")"',
        ]
      : [
          `baseline_container_ids=${quote(baseline.containerIds.join('\\n'))}`,
          `baseline_volume_ids=${quote(baseline.volumeIds.join('\\n'))}`,
          'if test -f "$before_container_ids_file"; then before_container_ids="$(cat "$before_container_ids_file")"; else before_container_ids="$baseline_container_ids"; fi',
          'if test -f "$before_volume_ids_file"; then before_volume_ids="$(cat "$before_volume_ids_file")"; else before_volume_ids="$baseline_volume_ids"; fi',
        ];
  return script(
    'set -uo pipefail',
    `root=${quote(remoteRoot)}`,
    'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) printf "REMOTE_CLEANUP_FAILURE=ROOT_IDENTITY_INVALID\\n"; exit 64 ;; esac',
    'before_container_ids_file="$root/before-container-ids"',
    'before_volume_ids_file="$root/before-volume-ids"',
    ...baselineSetup,
    'if ! container_ids="$(docker ps -aq --filter label=org.testcontainers=true | sort)"; then printf "REMOTE_CLEANUP_FAILURE=CONTAINER_QUERY_FAILED\\n"; exit 70; fi',
    'if ! volume_ids="$(docker volume ls -q --filter label=org.testcontainers=true | sort)"; then printf "REMOTE_CLEANUP_FAILURE=VOLUME_QUERY_FAILED\\n"; exit 71; fi',
    'owned_container_ids="$(comm -13 <(printf "%s\\n" "$before_container_ids" | sed "/^$/d" | sort) <(printf "%s\\n" "$container_ids"))"',
    'owned_volume_ids="$(comm -13 <(printf "%s\\n" "$before_volume_ids" | sed "/^$/d" | sort) <(printf "%s\\n" "$volume_ids"))"',
    'cleanup_status=0',
    'if test -n "$owned_container_ids"; then while IFS= read -r container_id; do test -z "$container_id" || docker rm -f -- "$container_id" >/dev/null || cleanup_status=1; done <<< "$owned_container_ids"; fi',
    'if test -n "$owned_volume_ids"; then while IFS= read -r volume_id; do test -z "$volume_id" || docker volume rm -- "$volume_id" >/dev/null || cleanup_status=1; done <<< "$owned_volume_ids"; fi',
    'test "$cleanup_status" = 0 || { printf "REMOTE_CLEANUP_FAILURE=OWNED_RESOURCE_DELETE_FAILED\\n"; exit 72; }',
    'if ! container_ids="$(docker ps -aq --filter label=org.testcontainers=true | sort)"; then printf "REMOTE_CLEANUP_FAILURE=CONTAINER_QUERY_FAILED_AFTER_DELETE\\n"; exit 70; fi',
    'if ! volume_ids="$(docker volume ls -q --filter label=org.testcontainers=true | sort)"; then printf "REMOTE_CLEANUP_FAILURE=VOLUME_QUERY_FAILED_AFTER_DELETE\\n"; exit 71; fi',
    'container_count=0; test -z "$container_ids" || container_count="$(printf "%s\\n" "$container_ids" | wc -l | tr -d " ")"',
    'volume_count=0; test -z "$volume_ids" || volume_count="$(printf "%s\\n" "$volume_ids" | wc -l | tr -d " ")"',
    'active_process_count=0; active_process_pids=""',
    'for proc in /proc/[0-9]*; do',
    '  test -e "$proc/cwd" || continue',
    '  pid="${proc##*/}"',
    '  cwd="$(readlink "$proc/cwd" 2>/dev/null || true)"',
    '  case "$cwd" in "$root"|"$root"/*) active_process_count=$((active_process_count + 1)); active_process_pids="${active_process_pids}${pid}," ;; esac',
    'done',
    'while IFS= read -r process_record; do',
    '  pid="${process_record%% *}"',
    '  command_line="${process_record#* }"',
    '  case "$command_line" in *"$root"*) active_process_count=$((active_process_count + 1)); active_process_pids="${active_process_pids}${pid}," ;; esac',
    'done < <(ps -eo pid=,args=)',
    'printf "REMOTE_ROOT_PRESENT=%s\\n" "$([ -e "$root" ] && echo true || echo false)"',
    'printf "REMOTE_ACTIVE_PROCESS_COUNT=%s\\n" "$active_process_count"',
    'printf "REMOTE_ACTIVE_PROCESS_PIDS=%s\\n" "${active_process_pids%,}"',
    'printf "REMOTE_TESTCONTAINERS_CONTAINER_COUNT=%s\\n" "$container_count"',
    'printf "REMOTE_TESTCONTAINERS_VOLUME_COUNT=%s\\n" "$volume_count"',
    'test "$container_count" = 0 || { printf "REMOTE_CLEANUP_FAILURE=CONTAINERS_REMAIN\\n"; exit 73; }',
    'test "$volume_count" = 0 || { printf "REMOTE_CLEANUP_FAILURE=VOLUMES_REMAIN\\n"; exit 74; }',
    'test "$active_process_count" = 0 || { printf "REMOTE_CLEANUP_FAILURE=REMOTE_PROCESSES_REMAIN\\n"; exit 75; }',
    'if test ! -e "$root"; then printf "REMOTE_ROOT_ABSENT=true\\n"; exit 0; fi',
    'if ! rm -rf -- "$root"; then printf "REMOTE_CLEANUP_FAILURE=ROOT_DELETE_FAILED\\n"; exit 76; fi',
    'if test -e "$root"; then printf "REMOTE_CLEANUP_FAILURE=ROOT_READBACK_PRESENT\\n"; exit 77; fi',
    'printf "REMOTE_ROOT_ABSENT=true\\n"',
  );
};

export function cleanupRemoteWorkspaceDetailed(remoteRoot, execute = remoteResult, baseline = null) {
  if (!testcontainersRemoteRootPattern.test(String(remoteRoot ?? ''))) throw new Error('REMOTE_TESTCONTAINERS_ROOT_IDENTITY_INVALID');
  const result = execute(cleanupRemoteWorkspaceScript(remoteRoot, baseline));
  const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  return Object.freeze({
    status: result?.status === 0 && cleanupMarker(output, 'REMOTE_ROOT_ABSENT') === 'true' ? 'PASS' : 'FAIL',
    remoteRoot,
    remoteRootPresent: cleanupMarker(output, 'REMOTE_ROOT_PRESENT'),
    remoteRootAbsent: cleanupMarker(output, 'REMOTE_ROOT_ABSENT') === 'true',
    activeProcessCount: cleanupMarker(output, 'REMOTE_ACTIVE_PROCESS_COUNT'),
    activeProcessPids: cleanupMarker(output, 'REMOTE_ACTIVE_PROCESS_PIDS'),
    testcontainersContainerCount: cleanupMarker(output, 'REMOTE_TESTCONTAINERS_CONTAINER_COUNT'),
    testcontainersVolumeCount: cleanupMarker(output, 'REMOTE_TESTCONTAINERS_VOLUME_COUNT'),
    failure: result?.status === 0 ? null : cleanupMarker(output, 'REMOTE_CLEANUP_FAILURE') ?? compact(result?.stderr || result?.stdout),
  });
}

const cleanupRemoteWorkspace = remoteRoot => cleanupRemoteWorkspaceDetailed(remoteRoot).status;

export function validateCleanupRecoveryTarget(manifest, {expectedHost = remoteHost} = {}) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.kind !== 'r5-managed-testcontainers-run') {
    throw new Error('CLEANUP_RECOVERY_MANIFEST_INVALID');
  }
  if (!/^r5-tc-[0-9]+-[0-9]+$/.test(manifest.runId) || manifest.status !== 'FAIL' || typeof manifest.finishedAt !== 'string' || manifest.finishedAt.trim() === '') {
    throw new Error('CLEANUP_RECOVERY_MANIFEST_NOT_TERMINAL');
  }
  if (manifest.remote?.hostAlias !== expectedHost || manifest.remote?.hostTrust?.host !== expectedHost) {
    throw new Error('CLEANUP_RECOVERY_REMOTE_HOST_MISMATCH');
  }
  if (manifest.remote?.root !== `/tmp/${manifest.runId}` || manifest.remote?.stagingRoot !== `${manifest.remote.root}/workspace`) {
    throw new Error('CLEANUP_RECOVERY_REMOTE_ROOT_MISMATCH');
  }
  if (!['PASS', 'FAIL', 'NOT_RUN', 'NOT_APPLICABLE'].includes(manifest.business)) {
    throw new Error('CLEANUP_RECOVERY_BUSINESS_STATUS_INVALID');
  }
  if (typeof manifest.firstFailure !== 'string' || manifest.firstFailure.trim() === '') {
    throw new Error('CLEANUP_RECOVERY_FIRST_FAILURE_MISSING');
  }
  if (typeof manifest.lastKnownGood !== 'string' || manifest.lastKnownGood.trim() === '') {
    throw new Error('CLEANUP_RECOVERY_LAST_KNOWN_GOOD_MISSING');
  }
  if (typeof manifest.brokenBoundary !== 'string' || manifest.brokenBoundary.trim() === '') {
    throw new Error('CLEANUP_RECOVERY_BROKEN_BOUNDARY_MISSING');
  }
  if (manifest.cleanup?.status === 'PASS') throw new Error('CLEANUP_RECOVERY_ALREADY_CLOSED');
  return manifest;
}

export function recoverRemoteWorkspaceCleanup({manifestPath: sourceManifestPath, expectedHost = remoteHost} = {}) {
  const sourcePath = path.resolve(String(sourceManifestPath ?? ''));
  const relative = path.relative(evidence, sourcePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !relative.endsWith('/run-manifest.json')) {
    throw new Error('CLEANUP_RECOVERY_MANIFEST_PATH_OUTSIDE_EVIDENCE');
  }
  const manifest = validateCleanupRecoveryTarget(JSON.parse(readFileSync(sourcePath, 'utf8')), {expectedHost});
  const expectedPath = path.join(evidence, manifest.runId, 'run-manifest.json');
  if (sourcePath !== expectedPath) throw new Error('CLEANUP_RECOVERY_MANIFEST_PATH_RUN_ID_MISMATCH');
  const baseline = manifest.resourcePreflight;
  if (
    !baseline ||
    !Array.isArray(baseline.containers) ||
    !Array.isArray(baseline.volumes) ||
    baseline.containers.some(value => typeof value !== 'string') ||
    baseline.volumes.some(value => typeof value !== 'string')
  ) {
    throw new Error('CLEANUP_RECOVERY_RESOURCE_PREFLIGHT_MISSING');
  }
  const cleanup = cleanupRemoteWorkspaceDetailed(manifest.remote.root, remoteResult, {
    containerIds: [...new Set(baseline.containers)].sort(),
    volumeIds: [...new Set(baseline.volumes)].sort(),
  });
  const recoveryPath = path.join(path.dirname(sourcePath), 'cleanup-recovery.json');
  const recovery = {
    schemaVersion: 1,
    kind: 'r5-managed-testcontainers-cleanup-recovery',
    recoveredAt: now(),
    sourceManifest: path.relative(root, sourcePath),
    runId: manifest.runId,
    remote: {hostAlias: expectedHost, root: manifest.remote.root},
    cleanup,
    business: manifest.business,
    originalFirstFailure: manifest.firstFailure,
    originalLastKnownGood: manifest.lastKnownGood,
    originalBrokenBoundary: manifest.brokenBoundary,
  };
  writeFileSync(recoveryPath, `${JSON.stringify(recovery, null, 2)}\n`, {mode: 0o600});
  return Object.freeze({...recovery, recoveryPath});
}

export const runScript = ({
  remoteRoot,
  remoteWorkspace,
  remoteResults,
  distribution,
  invocation,
  backendAcceptanceRunId,
  backendAcceptanceOperation,
  verificationMode,
  productionMutation = null,
  mutationPreflight = null,
  tdsCapacity = null,
  terminalWireNodePath = null,
  topologyPreflight = false,
  traceChildSignals = false,
  traceSystemSignals = false,
  vs12Diagnostic = false,
  vs8Diagnostic = false,
  tdsContractOnly = false,
  d46Focused = false,
  tdsContractScenario = null,
}) => {
  const signalTracingRequested = traceChildSignals || traceSystemSignals;
  if (traceChildSignals && traceSystemSignals) throw new Error('R5_SIGNAL_TRACE_MODES_MUTUALLY_EXCLUSIVE');
  validateVs12DiagnosticScope({
    vs12Diagnostic,
    backendAcceptanceRunId,
    backendAcceptanceOperation,
    verificationMode,
    topologyPreflight,
    productionMutation,
    extensionScaleProof: invocation.extensionScaleProof === true,
    traceSystemSignals,
  });
  if (
    vs8Diagnostic &&
    (backendAcceptanceRunId === null ||
      backendAcceptanceOperation !== 'storeTerminalActivationBusinessPrecedence' ||
      verificationMode !== 'ACCEPTANCE' ||
      topologyPreflight ||
      productionMutation !== null ||
      invocation.extensionScaleProof === true ||
      vs12Diagnostic ||
      traceSystemSignals)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC_ARGUMENT_INVALID');
  }
  if (
    d46Focused &&
    (backendAcceptanceRunId === null ||
      verificationMode !== 'ACCEPTANCE' ||
      !invocation.extraArguments.includes(
        'com.catering.v2s.app.acceptance.BackendAcceptanceTest.terminalConnectionCompressionContracts',
      ) ||
      !invocation.extraArguments.includes(
        'com.catering.v2s.app.edge.generated.wire.TerminalActivationSecretToStringTest',
      ))
  ) {
    throw new Error('BACKEND_ACCEPTANCE_D46_FOCUSED_SCOPE_INVALID');
  }
  if (
    tdsContractOnly &&
    (backendAcceptanceRunId === null ||
      !d46Focused ||
      backendAcceptanceOperation !== 'all' ||
      verificationMode !== 'ACCEPTANCE' ||
      productionMutation !== null ||
      invocation.extensionScaleProof === true)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_ONLY_SCOPE_INVALID');
  }
  if (
    tdsContractScenario !== null &&
    (!isTdsContractScenarioScopeValid(tdsContractScenario, topologyPreflight) ||
      backendAcceptanceRunId === null ||
      backendAcceptanceOperation !== 'storeTerminalActivationBusinessPrecedence' ||
      verificationMode !== 'ACCEPTANCE' ||
      productionMutation !== null ||
      invocation.extensionScaleProof === true ||
      vs12Diagnostic ||
      vs8Diagnostic ||
      tdsContractOnly ||
      d46Focused)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_SCOPE_INVALID');
  }
  if (
    traceSystemSignals &&
    !(
      (backendAcceptanceRunId !== null &&
        backendAcceptanceOperation === 'all' &&
        verificationMode === 'CALIBRATION' &&
        !vs12Diagnostic) ||
      (vs12Diagnostic &&
        backendAcceptanceRunId !== null &&
        backendAcceptanceOperation === 'storeTerminalActivationBusinessPrecedence' &&
        verificationMode === 'ACCEPTANCE')
    )
  ) {
    throw new Error('R5_TRACE_SYSTEM_SIGNALS_SCOPE_INVALID');
  }
  if (productionMutation !== null && mutationPreflight === null) {
    throw new Error('PRODUCTION_MUTATION_PREFLIGHT_REQUIRED');
  }
  const selectorArguments = [
    ...invocation.extraArguments.map(quote),
    ...(productionMutation?.evidenceType === 'TDS_CONTRACT'
      ? ['-Pv2s.acceptance.registration-race-red-control=true']
      : []),
  ].join(' ');
  const acceptanceEnvironment = backendAcceptanceEnvironment(
    backendAcceptanceRunId,
    backendAcceptanceOperation,
    verificationMode,
    process.env.V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY ?? null,
    invocation.extensionScaleProof === true,
    tdsCapacity,
    terminalWireNodePath,
    topologyPreflight,
    vs12Diagnostic,
    vs8Diagnostic,
    d46Focused,
    tdsContractScenario,
  );
  const mutationLines =
    productionMutation === null
      ? []
      : [
          `  mutation_relative=${quote(productionMutation.file)}`,
          '  mutation_file="$workspace/$mutation_relative"',
          `  mutation_anchor=${quote(productionMutation.anchor)}`,
          `  mutation_from=${quote(productionMutation.from)}`,
          `  mutation_to=${quote(productionMutation.to)}`,
          `  expected_replace_count=${quote(String(productionMutation.replaceCount))}`,
          `  expected_source_before=${quote(mutationPreflight.sourceBeforeSha256)}`,
          `  expected_source_after=${quote(mutationPreflight.sourceAfterSha256)}`,
          '  mutation_failure() {',
          '    printf "R5_TEST_MUTATION_STATUS=FAIL\\n"',
          '    printf "R5_TEST_MUTATION_FAILURE=%s\\n" "$1"',
          '    return 1',
          '  }',
          '  apply_production_mutation() {',
          '    if ! test -f "$mutation_file"; then mutation_failure SOURCE_FILE_MISSING; return 1; fi',
          '    scoped_mutation_count() {',
          `      V2S_TEST_MUTATION_ANCHOR="$mutation_anchor" V2S_TEST_MUTATION_FROM="$mutation_from" perl -0ne 'my $start = index($_, $ENV{V2S_TEST_MUTATION_ANCHOR}); die "anchor" if $start < 0; my $opening = index($_, "{", $start + length($ENV{V2S_TEST_MUTATION_ANCHOR})); die "body" if $opening < 0; my $depth = 0; my $end = -1; for (my $i = $opening; $i < length($_); $i++) { my $character = substr($_, $i, 1); if ($character eq "{") { $depth++; } elsif ($character eq "}") { $depth--; if ($depth == 0) { $end = $i; last; } } } die "unclosed" if $end < 0; my $body = substr($_, $opening, $end - $opening + 1); my @matches = ($body =~ /\\Q$ENV{V2S_TEST_MUTATION_FROM}\\E/g); print scalar @matches;' -- "$mutation_file"`,
          '    }',
          '    if ! replace_count="$(scoped_mutation_count)"; then',
          '      mutation_failure SOURCE_SCAN_FAILED',
          '      return 1',
          '    fi',
          '    if ! test "$replace_count" = "$expected_replace_count"; then',
          '      mutation_failure "REPLACE_COUNT_MISMATCH:$replace_count:$expected_replace_count"',
          '      return 1',
          '    fi',
          '    if ! source_before_sha256="$(sha256sum -- "$mutation_file" | awk \'{print $1}\')"; then',
          '      mutation_failure SOURCE_BEFORE_HASH_FAILED',
          '      return 1',
          '    fi',
          '    if ! test "$source_before_sha256" = "$expected_source_before"; then',
          '      mutation_failure SOURCE_BEFORE_HASH_MISMATCH',
          '      return 1',
          '    fi',
          `    if ! V2S_TEST_MUTATION_ANCHOR="$mutation_anchor" V2S_TEST_MUTATION_FROM="$mutation_from" V2S_TEST_MUTATION_TO="$mutation_to" perl -0pi -e 'my $start = index($_, $ENV{V2S_TEST_MUTATION_ANCHOR}); die "anchor" if $start < 0; my $opening = index($_, "{", $start + length($ENV{V2S_TEST_MUTATION_ANCHOR})); die "body" if $opening < 0; my $depth = 0; my $end = -1; for (my $i = $opening; $i < length($_); $i++) { my $character = substr($_, $i, 1); if ($character eq "{") { $depth++; } elsif ($character eq "}") { $depth--; if ($depth == 0) { $end = $i; last; } } } die "unclosed" if $end < 0; my $body = substr($_, $opening, $end - $opening + 1); my @matches = ($body =~ /\\Q$ENV{V2S_TEST_MUTATION_FROM}\\E/g); die "count" if scalar @matches != 1; my $offset = index($body, $ENV{V2S_TEST_MUTATION_FROM}); die "target" if $offset < 0; substr($body, $offset, length($ENV{V2S_TEST_MUTATION_FROM}), $ENV{V2S_TEST_MUTATION_TO}); substr($_, $opening, $end - $opening + 1, $body);' -- "$mutation_file"; then`,
          '      mutation_failure SOURCE_REPLACE_FAILED',
          '      return 1',
          '    fi',
          '    if ! source_after_sha256="$(sha256sum -- "$mutation_file" | awk \'{print $1}\')"; then',
          '      mutation_failure SOURCE_AFTER_HASH_FAILED',
          '      return 1',
          '    fi',
          '    if ! test "$source_after_sha256" = "$expected_source_after"; then',
          '      mutation_failure SOURCE_AFTER_HASH_MISMATCH',
          '      return 1',
          '    fi',
          '    if ! staging_snapshot_sha256="$( ',
          '      find "$workspace" -type f -print0 | LC_ALL=C sort -z |',
          '        while IFS= read -r -d "" file; do',
          '          relative="${file#"$workspace"/}"',
          '          printf "%s\\t" "$relative"',
          '          sha256sum -- "$file" | awk \'{print $1}\'',
          '        done | sha256sum | awk \'{print $1}\'',
          '    )"; then',
          '      mutation_failure STAGING_SNAPSHOT_HASH_FAILED',
          '      return 1',
          '    fi',
          '    printf "R5_TEST_MUTATION_STATUS=PASS\\n"',
          `    printf "R5_TEST_MUTATION_ID=%s\\n" ${quote(productionMutation.id)}`,
          '    printf "R5_TEST_MUTATION_REPLACE_COUNT=%s\\n" "$replace_count"',
          '    printf "R5_TEST_MUTATION_SOURCE_BEFORE_SHA256=%s\\n" "$source_before_sha256"',
          '    printf "R5_TEST_MUTATION_SOURCE_AFTER_SHA256=%s\\n" "$source_after_sha256"',
          '    printf "R5_TEST_MUTATION_STAGING_SNAPSHOT_SHA256=%s\\n" "$staging_snapshot_sha256"',
          '  }',
          '  if ! apply_production_mutation; then exit 65; fi',
        ];
  return script(
    '#!/usr/bin/env bash',
    'set -uo pipefail',
    `root=${quote(remoteRoot)}`,
    `workspace=${quote(remoteWorkspace)}`,
    `results=${quote(remoteResults)}`,
    `gradle=${quote(distribution.path)}`,
    `cache=${quote(remoteDependencyCache)}`,
    `task=${quote(invocation.task)}`,
    'log_file="$results/gradle.log"',
    `signal_trace_requested=${signalTracingRequested ? 'true' : 'false'}`,
    `signal_trace_system_requested=${traceSystemSignals ? 'true' : 'false'}`,
    'signal_trace_file="$results/process-signal-trace.log"',
    'signal_trace_raw="$results/process-signal-trace.raw.log"',
    'signal_trace_status=NOT_REQUESTED',
    'signal_trace_preflight=NOT_REQUESTED',
    'signal_trace_tool=NONE',
    'signal_trace_version=NONE',
    'signal_trace_pid=""',
    'signal_trace_pid_start_ticks=""',
    'signal_trace_boot_id=""',
    'resource_capture_status=NOT_RUN',
    'resource_capture_stop="$root/testcontainers-resource-capture.stop"',
    'resource_capture_containers="$root/testcontainers-resource-captured-container-ids"',
    'resource_capture_volumes="$root/testcontainers-resource-captured-volume-ids"',
    'resource_capture_pid=""',
    'stop_resource_capture() { if test -n "$resource_capture_pid"; then touch "$resource_capture_stop" 2>/dev/null || true; wait "$resource_capture_pid" 2>/dev/null || true; fi; }',
    'trap stop_resource_capture EXIT',
    'trap \'exit 129\' HUP',
    'trap \'exit 130\' INT',
    'trap \'exit 143\' TERM',
    'signal_trace_stop_status=NOT_REQUESTED',
    'remote_pid_start_ticks() { local pid="$1" stat_line stat_tail; stat_line="$(cat "/proc/$pid/stat" 2>/dev/null)" || return 1; stat_tail="${stat_line##*) }"; read -r -a stat_fields <<< "$stat_tail"; test "${#stat_fields[@]}" -ge 20 || return 1; printf "%s" "${stat_fields[19]}"; }',
    'if test "$signal_trace_requested" = true && test "$signal_trace_system_requested" != true; then signal_trace_status=UNAVAILABLE; if command -v strace >/dev/null 2>&1; then signal_trace_status=READY; signal_trace_tool="$(command -v strace)"; signal_trace_version="$(strace --version | head -n 1)"; signal_trace_version="${signal_trace_version##* }"; fi; fi',
    ...remoteProcessInventoryScript().split('\n'),
    'printf "REMOTE_PROCESS_INVENTORY_PREFLIGHT=%s\\n" "$process_inventory_status"',
    'container_query_status=PASS',
    'if ! docker ps -aq --filter label=org.testcontainers=true | sort > "$root/before-container-ids"; then container_query_status=FAIL; fi',
    'volume_query_status=PASS',
    'if ! docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/before-volume-ids"; then volume_query_status=FAIL; fi',
    'printf "REMOTE_TESTCONTAINERS_CONTAINER_QUERY=%s\\n" "$container_query_status"',
    'printf "REMOTE_TESTCONTAINERS_VOLUME_QUERY=%s\\n" "$volume_query_status"',
    'if test "$container_query_status" != PASS || test "$volume_query_status" != PASS; then printf "REMOTE_TESTCONTAINERS_QUERY_FAILURE=true\\n"; exit 70; fi',
    'if test "$signal_trace_system_requested" = true; then',
    '  signal_trace_tool=linux-tracefs-signal-generate',
    '  signal_trace_version="$(uname -r 2>/dev/null || printf unavailable)"',
    '  signal_trace_status=UNAVAILABLE',
    '  signal_trace_boot_id="$(cat /proc/sys/kernel/random/boot_id 2>/dev/null || true)"',
    '  rm -f -- "$results/process-signal-trace.ready" "$results/process-signal-trace.status" "$results/process-signal-trace-launch.log"',
    '  bash "$workspace/scripts/test/remote-signal-trace.sh" "$root" "$results" > "$results/process-signal-trace-launch.log" 2>&1 &',
    '  signal_trace_pid=$!',
    '  signal_trace_identity_deadline=$((SECONDS + 2))',
    '  while (( SECONDS < signal_trace_identity_deadline )); do signal_trace_pid_start_ticks="$(remote_pid_start_ticks "$signal_trace_pid" 2>/dev/null || true)"; test -n "$signal_trace_pid_start_ticks" && break; kill -0 "$signal_trace_pid" 2>/dev/null || break; sleep 0.05; done',
    '  signal_trace_deadline=$((SECONDS + 8))',
    '  while (( SECONDS < signal_trace_deadline )); do',
    '    if test -f "$results/process-signal-trace.ready" && grep -qx READY "$results/process-signal-trace.ready"; then signal_trace_status=READY; break; fi',
    '    if test -f "$results/process-signal-trace.status" && grep -q "status=UNAVAILABLE" "$results/process-signal-trace.status"; then break; fi',
    '    if ! kill -0 "$signal_trace_pid" 2>/dev/null; then break; fi',
    '    sleep 0.05',
    '  done',
    '  if test "$signal_trace_status" = READY && { test -z "$signal_trace_boot_id" || test -z "$signal_trace_pid_start_ticks"; }; then signal_trace_status=UNAVAILABLE; fi',
    '  if test "$signal_trace_status" != READY; then if test -n "$signal_trace_pid_start_ticks" && test "$(cat /proc/sys/kernel/random/boot_id 2>/dev/null || true)" = "$signal_trace_boot_id" && test "$(remote_pid_start_ticks "$signal_trace_pid" 2>/dev/null || true)" = "$signal_trace_pid_start_ticks"; then kill -TERM "$signal_trace_pid" 2>/dev/null || true; signal_trace_stop_status=STOPPED; else signal_trace_stop_status=IDENTITY_UNVERIFIED; fi; wait "$signal_trace_pid" 2>/dev/null || true; fi',
    'fi',
    'signal_trace_preflight="$signal_trace_status"',
    'printf "REMOTE_SIGNAL_TRACE_PREFLIGHT=%s\\n" "$signal_trace_preflight"',
    'rm -f -- "$resource_capture_stop" "$resource_capture_containers" "$resource_capture_volumes" "$root/testcontainers-resource-capture.failure"',
    ': > "$resource_capture_containers"; : > "$resource_capture_volumes"',
    'capture_testcontainers_resources() {',
    '  while test ! -e "$resource_capture_stop"; do',
    '    if ! container_snapshot="$(docker ps -aq --filter label=org.testcontainers=true | sort -u)"; then printf "CONTAINER_QUERY\\n" >> "$root/testcontainers-resource-capture.failure"; else while IFS= read -r resource_id; do test -n "$resource_id" || continue; if ! grep -Fxq -- "$resource_id" "$resource_capture_containers" 2>/dev/null; then printf "%s\\n" "$resource_id" >> "$resource_capture_containers"; fi; done <<< "$container_snapshot"; fi',
    '    if ! volume_snapshot="$(docker volume ls -q --filter label=org.testcontainers=true | sort -u)"; then printf "VOLUME_QUERY\\n" >> "$root/testcontainers-resource-capture.failure"; else while IFS= read -r volume_name; do test -n "$volume_name" || continue; if ! grep -Fxq -- "$volume_name" "$resource_capture_volumes" 2>/dev/null; then printf "%s\\n" "$volume_name" >> "$resource_capture_volumes"; fi; done <<< "$volume_snapshot"; fi',
    '    sleep 0.5',
    '  done',
    '}',
    'capture_testcontainers_resources & resource_capture_pid=$!',
    'set +e',
    '(',
    '  set -euo pipefail',
    '  cd "$workspace"',
    '  export GRADLE_USER_HOME="$cache"',
    '  export V2S_TESTCONTAINERS_EXECUTION_PLANE=remote',
    `  export V2S_TESTCONTAINERS_REMOTE_HOST=${quote(remoteHost)}`,
    '  export TESTCONTAINERS_RYUK_DISABLED=true',
    '  export V2S_GRADLE_HOME="$gradle"',
    ...acceptanceEnvironment.map(line => `  ${line}`),
    ...mutationLines,
    '  if test "$signal_trace_requested" = true && test "$signal_trace_status" != READY; then printf "REMOTE_SIGNAL_TRACE_PREFLIGHT=UNAVAILABLE\\n"; exit 79; fi',
    '  if test "$process_inventory_status" != CAPTURED; then printf "REMOTE_PROCESS_INVENTORY_PREFLIGHT=FAIL\\n"; exit 78; fi',
    // The managed artifact is the sole durable diagnostic after the remote
    // workspace is reclaimed. Keep the causal test stack in that artifact;
    // Gradle's default console summary otherwise reduces setup failures to a
    // class and line number, which is not enough to identify the boundary.
    ...(traceChildSignals
      ? [`  "$signal_trace_tool" -f -ttt -e trace=%process,%signal -e signal=SIGTERM -o "$signal_trace_raw" "$gradle/bin/gradle" --no-daemon --rerun-tasks --stacktrace "$task" ${selectorArguments}`]
      : [`  "$gradle/bin/gradle" --no-daemon --rerun-tasks --stacktrace "$task" ${selectorArguments}`]),
    ') 2>&1 | tee "$log_file"',
    'gradle_status=${PIPESTATUS[0]}',
    'touch "$resource_capture_stop"',
    'resource_capture_wait_status=PASS; if ! wait "$resource_capture_pid"; then resource_capture_wait_status=FAIL; fi',
    'resource_capture_status=PASS; test ! -s "$root/testcontainers-resource-capture.failure" && test "$resource_capture_wait_status" = PASS || resource_capture_status=FAIL',
    'if test "$resource_capture_status" = PASS; then sort -u "$resource_capture_containers" > "$results/testcontainers-owned-container-ids"; sort -u "$resource_capture_volumes" > "$results/testcontainers-owned-volume-ids"; else : > "$results/testcontainers-owned-container-ids"; : > "$results/testcontainers-owned-volume-ids"; fi',
    'owned_container_ids=$(paste -sd, "$results/testcontainers-owned-container-ids")',
    'owned_volume_ids=$(paste -sd, "$results/testcontainers-owned-volume-ids")',
    'printf "REMOTE_TESTCONTAINERS_RESOURCE_CAPTURE=%s\\nREMOTE_TESTCONTAINERS_OWNED_CONTAINER_IDS=%s\\nREMOTE_TESTCONTAINERS_OWNED_VOLUME_IDS=%s\\n" "$resource_capture_status" "${owned_container_ids:-NONE}" "${owned_volume_ids:-NONE}"',
    'if test "$signal_trace_system_requested" = true; then',
    '  if test -n "$signal_trace_pid"; then',
    '    if kill -0 "$signal_trace_pid" 2>/dev/null; then if test -n "$signal_trace_pid_start_ticks" && test "$(cat /proc/sys/kernel/random/boot_id 2>/dev/null || true)" = "$signal_trace_boot_id" && test "$(remote_pid_start_ticks "$signal_trace_pid" 2>/dev/null || true)" = "$signal_trace_pid_start_ticks"; then kill -TERM "$signal_trace_pid" 2>/dev/null || signal_trace_stop_status=FAIL; test "$signal_trace_stop_status" = FAIL || signal_trace_stop_status=STOPPED; else signal_trace_stop_status=IDENTITY_UNVERIFIED; fi; else signal_trace_stop_status=ALREADY_EXITED; fi',
    '    wait "$signal_trace_pid" 2>/dev/null || true',
    '  fi',
    '  if test -f "$results/process-signal-trace.status" && grep -q "status=CAPTURED cleanup=PASS" "$results/process-signal-trace.status"; then signal_trace_status=CAPTURED; elif test "$signal_trace_status" != UNAVAILABLE; then signal_trace_status=FAIL; fi',
    '  if test -f "$signal_trace_file"; then',
    '    printf "remoteListenerStatus=%s stopStatus=%s pid=%s startTicks=%s bootId=%s tool=%s version=%s\\n" "$signal_trace_status" "$signal_trace_stop_status" "$signal_trace_pid" "$signal_trace_pid_start_ticks" "$signal_trace_boot_id" "$signal_trace_tool" "$signal_trace_version" >> "$signal_trace_file"',
    '    if test -f "$results/process-signal-trace.status"; then cat -- "$results/process-signal-trace.status" >> "$signal_trace_file"; fi',
    '    if test -s "$results/process-signal-trace-launch.log"; then printf "listenerLaunchDiagnosticBegin\\n" >> "$signal_trace_file"; cat -- "$results/process-signal-trace-launch.log" >> "$signal_trace_file"; printf "listenerLaunchDiagnosticEnd\\n" >> "$signal_trace_file"; fi',
    '  fi',
    'fi',
    'if test "$process_inventory_status" = CAPTURED; then if ! capture_remote_process_inventory AFTER_GRADLE; then process_inventory_status=FAIL; fi; fi',
    'process_inventory_records="$(awk -F "\\t" \'$1 == "process" { count++ } END { print count + 0 }\' "$process_inventory_file" 2>/dev/null || printf 0)"',
    'printf "REMOTE_PROCESS_INVENTORY_STATUS=%s\\n" "$process_inventory_status"',
    'printf "REMOTE_PROCESS_INVENTORY_RECORDS=%s\\n" "$process_inventory_records"',
    'if test "$signal_trace_system_requested" = true; then if test "$signal_trace_status" != CAPTURED && test "$signal_trace_status" != UNAVAILABLE; then signal_trace_status=FAIL; fi; elif test "$signal_trace_requested" = true; then if test "$signal_trace_status" = READY && test -s "$signal_trace_raw"; then signal_trace_status=CAPTURED; elif test "$signal_trace_status" != UNAVAILABLE; then signal_trace_status=FAIL; fi; { printf "runId=%s status=%s tool=%s version=%s\\n" "${root##*/}" "$signal_trace_status" "$signal_trace_tool" "$signal_trace_version"; if test -f "$signal_trace_raw"; then cat -- "$signal_trace_raw"; fi; } > "$signal_trace_file"; else printf "runId=%s status=NOT_REQUESTED\\n" "${root##*/}" > "$signal_trace_file"; fi',
    'printf "REMOTE_SIGNAL_TRACE_STATUS=%s\\n" "$signal_trace_status"',
    'printf "REMOTE_SIGNAL_TRACE_TOOL=%s\\n" "$signal_trace_tool"',
    'printf "REMOTE_SIGNAL_TRACE_VERSION=%s\\n" "$signal_trace_version"',
    'printf "REMOTE_SIGNAL_TRACE_STOP_STATUS=%s\\n" "$signal_trace_stop_status"',
    'printf "REMOTE_SIGNAL_TRACE_PID=%s\\n" "$signal_trace_pid"',
    'printf "REMOTE_SIGNAL_TRACE_START_TICKS=%s\\n" "$signal_trace_pid_start_ticks"',
    'printf "REMOTE_SIGNAL_TRACE_BOOT_ID=%s\\n" "$signal_trace_boot_id"',
    // The remote workspace is deliberately reclaimed below.  Preserve the
    // machine-readable JUnit failure detail before that happens: Gradle's
    // console summary often retains only an exception type and line number.
    'find "$workspace" -type f -path "*/build/test-results/test/*.xml" -print0 | while IFS= read -r -d "" file; do',
    '  relative="${file#"$workspace"/}"',
    '  target="$results/test-results/$relative"',
    '  mkdir -p "$(dirname "$target")"',
    '  cp "$file" "$target"',
    'done',
    'find "$workspace" -type f -name "*-effective-sql-capture-*.xml" -print0 | while IFS= read -r -d "" file; do',
    '  relative="${file#"$workspace"/}"',
    '  target="$results/sql-captures/$relative"',
    '  mkdir -p "$(dirname "$target")"',
    '  cp "$file" "$target"',
    'done',
    'classpath_report="$workspace/apps/backend/catering-business-server/build/reports/backend-acceptance/runtime-classpaths.txt"',
    'if test -f "$classpath_report"; then cp -- "$classpath_report" "$results/backend-runtime-classpaths.txt"; fi',
    'if test -f "$root/backend-acceptance/tds/tds.log"; then cp -- "$root/backend-acceptance/tds/tds.log" "$results/tds-process.log"; fi',
    'if test -f "$root/backend-acceptance/tds/process-evidence.json"; then cp -- "$root/backend-acceptance/tds/process-evidence.json" "$results/tds-process-evidence.json"; fi',
    ...terminalWireEvidenceAggregationScript().split('\n'),
    'archive_index="$results/evidence-artifacts.tsv"',
    ': > "$archive_index"',
    'archive_evidence() {',
    '  file="$1"',
    '  test -f "$file" || return 0',
    '  name="$(basename "$file")"',
    '  archive="$file.gz"',
    '  temporary_archive="$archive.$$"',
    '  rm -f -- "$temporary_archive"',
    '  if ! raw_bytes="$(wc -c < "$file" | tr -d " ")" || ! raw_sha256="$(sha256sum "$file" | awk \'{print $1}\')" || test -z "$raw_bytes" || test -z "$raw_sha256"; then',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:raw-digest\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! gzip -9c -- "$file" > "$temporary_archive"; then',
    '    rm -f -- "$temporary_archive"',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:gzip\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! mv "$temporary_archive" "$archive"; then',
    '    rm -f -- "$temporary_archive"',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:publish\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! archive_bytes="$(wc -c < "$archive" | tr -d " ")" || ! archive_sha256="$(sha256sum "$archive" | awk \'{print $1}\')" || test -z "$archive_bytes" || test -z "$archive_sha256"; then',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:archive-digest\\n" "$name"',
    '    return 1',
    '  fi',
    '  if ! printf "%s\\t%s\\t%s\\t%s\\t%s\\n" "$name" "$raw_bytes" "$raw_sha256" "$archive_bytes" "$archive_sha256" >> "$archive_index"; then',
    '    printf "REMOTE_EVIDENCE_ARCHIVE_FAILED=%s:index\\n" "$name"',
    '    return 1',
    '  fi',
    '  rm -f -- "$file"',
    '}',
    'archive_status=0',
    ...ARCHIVED_EVIDENCE_ARTIFACTS.map(name => `archive_evidence "$results/${name}" || archive_status=1`),
    'cleanup_attempts=0',
    'while :; do',
    '  cleanup_attempts=$((cleanup_attempts + 1))',
    '  after_container_query_status=PASS',
    '  if ! docker ps -aq --filter label=org.testcontainers=true | sort > "$root/after-container-ids"; then after_container_query_status=FAIL; fi',
    '  after_volume_query_status=PASS',
    '  if ! docker volume ls -q --filter label=org.testcontainers=true | sort > "$root/after-volume-ids"; then after_volume_query_status=FAIL; fi',
    '  if test "$after_container_query_status" != PASS || test "$after_volume_query_status" != PASS; then break; fi',
    '  if cmp -s "$root/before-container-ids" "$root/after-container-ids" && cmp -s "$root/before-volume-ids" "$root/after-volume-ids"; then',
    '    break',
    '  fi',
    '  if test "$cleanup_attempts" -ge 10; then',
    '    break',
    '  fi',
    '  sleep 1',
    'done',
    'printf "REMOTE_TESTCONTAINERS_AFTER_CONTAINER_QUERY=%s\\n" "$after_container_query_status"',
    'printf "REMOTE_TESTCONTAINERS_AFTER_VOLUME_QUERY=%s\\n" "$after_volume_query_status"',
    'container_cleanup=FAIL; if test "$after_container_query_status" = PASS && cmp -s "$root/before-container-ids" "$root/after-container-ids"; then container_cleanup=PASS; fi',
    'volume_cleanup=FAIL; if test "$after_volume_query_status" = PASS && cmp -s "$root/before-volume-ids" "$root/after-volume-ids"; then volume_cleanup=PASS; fi',
    'printf "REMOTE_GRADLE_STATUS=%s\\n" "$gradle_status"',
    'printf "REMOTE_TESTCONTAINERS_CLEANUP_ATTEMPTS=%s\\n" "$cleanup_attempts"',
    'printf "REMOTE_TESTCONTAINERS_CONTAINERS=%s\\n" "$container_cleanup"',
    'printf "REMOTE_TESTCONTAINERS_VOLUMES=%s\\n" "$volume_cleanup"',
    'printf "REMOTE_EVIDENCE_ARCHIVE_STATUS=%s\\n" "$archive_status"',
    'exit 0',
  );
};

const marker = (output, name) => output.match(new RegExp(`(?:^|\\n)${name}=([^\\r\\n]+)`))?.[1]?.trim();
const parseResourceIdMarker = (value, pattern) => {
  if (value === 'NONE') return [];
  if (typeof value !== 'string' || value.length === 0) return null;
  const values = value.split(',');
  return values.every(item => pattern.test(item)) && new Set(values).size === values.length ? values : null;
};

const RUNNER_MARKER_NAMES = new Set([
  'REMOTE_GRADLE_STATUS',
  'REMOTE_PROCESS_INVENTORY_PREFLIGHT',
  'REMOTE_PROCESS_INVENTORY_STATUS',
  'REMOTE_PROCESS_INVENTORY_RECORDS',
  'REMOTE_TESTCONTAINERS_CONTAINER_QUERY',
  'REMOTE_TESTCONTAINERS_VOLUME_QUERY',
  'REMOTE_TESTCONTAINERS_AFTER_CONTAINER_QUERY',
  'REMOTE_TESTCONTAINERS_AFTER_VOLUME_QUERY',
  'REMOTE_TESTCONTAINERS_CONTAINERS',
  'REMOTE_TESTCONTAINERS_VOLUMES',
  'REMOTE_TESTCONTAINERS_RESOURCE_CAPTURE',
  'REMOTE_TESTCONTAINERS_OWNED_CONTAINER_IDS',
  'REMOTE_TESTCONTAINERS_OWNED_VOLUME_IDS',
  'REMOTE_EVIDENCE_ARCHIVE_STATUS',
  'REMOTE_SIGNAL_TRACE_STATUS',
  'REMOTE_SIGNAL_TRACE_TOOL',
  'REMOTE_SIGNAL_TRACE_VERSION',
  'REMOTE_SIGNAL_TRACE_PREFLIGHT',
  'REMOTE_SIGNAL_TRACE_STOP_STATUS',
  'REMOTE_SIGNAL_TRACE_PID',
  'REMOTE_SIGNAL_TRACE_START_TICKS',
  'REMOTE_SIGNAL_TRACE_BOOT_ID',
  'R5_TEST_MUTATION_STATUS',
  'R5_TEST_MUTATION_ID',
  'R5_TEST_MUTATION_REPLACE_COUNT',
  'R5_TEST_MUTATION_SOURCE_BEFORE_SHA256',
  'R5_TEST_MUTATION_SOURCE_AFTER_SHA256',
  'R5_TEST_MUTATION_STAGING_SNAPSHOT_SHA256',
  'R5_TEST_MUTATION_FAILURE',
]);

export const parseRunnerMarkers = output => {
  const markers = {};
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=([^\r\n]*)$/);
    if (match && RUNNER_MARKER_NAMES.has(match[1])) markers[match[1]] = match[2].trim();
  }
  return Object.freeze(markers);
};

const execute = async () => {
  const invocation = validateInvocationArguments(process.argv.slice(2));
  const gradleHomeResolution = resolveGradleHome();
  validateGradleHome(
    gradleHomeResolution.path,
    typeof gradleHomeResolution.path === 'string' && existsSync(path.join(gradleHomeResolution.path, 'bin', 'gradle')),
  );
  const gradleSha256 = gradleDistributionSha256(gradleHomeResolution.path);
  const distribution = {
    path: remoteGradleDistributionPath(gradleSha256),
    sha256: gradleSha256,
    localHome: gradleHomeResolution.path,
    localHomeSource: gradleHomeResolution.source,
    status: 'PENDING',
  };
  const runId = `r5-tc-${Date.now()}-${process.pid}`;
  const remoteRoot = `/tmp/${runId}`;
  const remoteWorkspace = `${remoteRoot}/workspace`;
  const remoteResults = `${remoteRoot}/results`;
  const directory = path.join(evidence, runId);
  const backendAcceptanceRunId =
    process.env.V2S_BACKEND_ACCEPTANCE_EXECUTION === 'true' &&
    hasBackendAcceptanceSelector(invocation.extraArguments)
      ? `backend-acceptance-${runId}`
      : null;
  const backendAcceptanceOperation = canonicalBackendAcceptanceOperation(
    process.env.V2S_BACKEND_ACCEPTANCE_OPERATION ?? 'all',
    invocation.extensionScaleProof === true,
  );
  const verificationMode = process.env.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE ?? 'ACCEPTANCE';
  const tdsContractOnlyValue = process.env.V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_ONLY ?? 'false';
  if (!['true', 'false'].includes(tdsContractOnlyValue)) {
    throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_ONLY_VALUE_INVALID');
  }
  const tdsContractOnly = tdsContractOnlyValue === 'true';
  const d46FocusedValue = process.env.V2S_BACKEND_ACCEPTANCE_D46_FOCUSED ?? 'false';
  if (!['true', 'false'].includes(d46FocusedValue)) {
    throw new Error('BACKEND_ACCEPTANCE_D46_FOCUSED_VALUE_INVALID');
  }
  const d46Focused = d46FocusedValue === 'true';
  if (
    d46Focused &&
    (backendAcceptanceRunId === null ||
      verificationMode !== 'ACCEPTANCE' ||
      !invocation.extraArguments.includes(
        'com.catering.v2s.app.acceptance.BackendAcceptanceTest.terminalConnectionCompressionContracts',
      ) ||
      !invocation.extraArguments.includes(
        'com.catering.v2s.app.edge.generated.wire.TerminalActivationSecretToStringTest',
      ))
  ) {
    throw new Error('BACKEND_ACCEPTANCE_D46_FOCUSED_SCOPE_INVALID');
  }
  if (
    tdsContractOnly &&
    (backendAcceptanceRunId === null ||
      !d46Focused ||
      backendAcceptanceOperation !== 'all' ||
      verificationMode !== 'ACCEPTANCE' ||
      !invocation.extraArguments.includes(
        'com.catering.v2s.app.acceptance.BackendAcceptanceTest.terminalConnectionCompressionContracts',
      ) ||
      invocation.productionMutationId !== undefined ||
      invocation.extensionScaleProof === true)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_ONLY_SCOPE_INVALID');
  }
  const topologyPreflight = process.env.V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT === 'true';
  const tdsContractScenario = process.env.V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO ?? null;
  if (
    tdsContractScenario !== null &&
    (!isTdsContractScenarioScopeValid(tdsContractScenario, topologyPreflight) ||
      backendAcceptanceRunId === null ||
      backendAcceptanceOperation !== 'storeTerminalActivationBusinessPrecedence' ||
      verificationMode !== 'ACCEPTANCE' ||
      tdsContractOnly ||
      d46Focused ||
      invocation.productionMutationId !== undefined ||
      invocation.extensionScaleProof === true)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_SCOPE_INVALID');
  }
  const vs12DiagnosticValue = process.env.V2S_BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC ?? 'false';
  if (!['true', 'false'].includes(vs12DiagnosticValue)) {
    throw new Error('BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC_VALUE_INVALID');
  }
  const vs12Diagnostic = vs12DiagnosticValue === 'true';
  const vs8DiagnosticValue = process.env.V2S_BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC ?? 'false';
  if (!['true', 'false'].includes(vs8DiagnosticValue)) {
    throw new Error('BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC_VALUE_INVALID');
  }
  const vs8Diagnostic = vs8DiagnosticValue === 'true';
  if (vs8Diagnostic && vs12Diagnostic) {
    throw new Error('BACKEND_ACCEPTANCE_DIAGNOSTIC_MODES_MUTUALLY_EXCLUSIVE');
  }
  if (tdsContractScenario !== null && (vs12Diagnostic || vs8Diagnostic)) {
    throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_SCOPE_INVALID');
  }
  if (
    vs8Diagnostic &&
    (backendAcceptanceRunId === null ||
      backendAcceptanceOperation !== 'storeTerminalActivationBusinessPrecedence' ||
      verificationMode !== 'ACCEPTANCE' ||
      topologyPreflight ||
      invocation.extensionScaleProof === true ||
      invocation.productionMutationId !== undefined)
  ) {
    throw new Error('BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC_ARGUMENT_INVALID');
  }
  const traceChildSignalsValue = process.env.V2S_R5_TRACE_CHILD_SIGNALS ?? 'false';
  if (!['true', 'false'].includes(traceChildSignalsValue)) {
    throw new Error('R5_TRACE_CHILD_SIGNALS_VALUE_INVALID');
  }
  const traceChildSignals = traceChildSignalsValue === 'true';
  const traceSystemSignalsValue = process.env.V2S_R5_TRACE_SYSTEM_SIGNALS ?? 'false';
  if (!['true', 'false'].includes(traceSystemSignalsValue)) {
    throw new Error('R5_TRACE_SYSTEM_SIGNALS_VALUE_INVALID');
  }
  const traceSystemSignals = traceSystemSignalsValue === 'true';
  const signalTracingRequested = traceChildSignals || traceSystemSignals;
  if (traceChildSignals && traceSystemSignals) throw new Error('R5_SIGNAL_TRACE_MODES_MUTUALLY_EXCLUSIVE');
  const requestedMutation =
    invocation.productionMutationId === undefined ? null : resolveProductionMutation(invocation.productionMutationId);
  if (!BACKEND_ACCEPTANCE_VERIFICATION_MODES.includes(verificationMode)) {
    throw new Error('BACKEND_ACCEPTANCE_VERIFICATION_MODE_INVALID');
  }
  validateVs12DiagnosticScope({
    vs12Diagnostic,
    backendAcceptanceRunId,
    backendAcceptanceOperation,
    verificationMode,
    topologyPreflight,
    productionMutation: invocation.productionMutationId === undefined ? null : invocation.productionMutationId,
    extensionScaleProof: invocation.extensionScaleProof === true,
    traceSystemSignals,
  });
  if (
    topologyPreflight &&
    (backendAcceptanceRunId === null || backendAcceptanceOperation === 'all' || verificationMode !== 'ACCEPTANCE')
  ) {
    throw new Error('BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT_ARGUMENT_INVALID');
  }
  if (verificationMode === 'CALIBRATION' && (backendAcceptanceRunId === null || backendAcceptanceOperation !== 'all')) {
    throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_REQUIRES_FULL_RUN');
  }
  if (
    traceChildSignals &&
    (backendAcceptanceRunId === null || backendAcceptanceOperation !== 'all' || verificationMode !== 'CALIBRATION')
  ) {
    throw new Error('R5_TRACE_CHILD_SIGNALS_REQUIRES_FULL_CALIBRATION');
  }
  if (
    traceSystemSignals &&
    !(
      (backendAcceptanceRunId !== null && backendAcceptanceOperation === 'all' && verificationMode === 'CALIBRATION') ||
      (vs12Diagnostic &&
        backendAcceptanceRunId !== null &&
        backendAcceptanceOperation === 'storeTerminalActivationBusinessPrecedence' &&
        verificationMode === 'ACCEPTANCE')
    )
  ) {
    throw new Error('R5_TRACE_SYSTEM_SIGNALS_SCOPE_INVALID');
  }
  if (requestedMutation !== null) {
    if (backendAcceptanceRunId === null) throw new Error('PRODUCTION_MUTATION_REQUIRES_BACKEND_ACCEPTANCE');
    if (![requestedMutation.scenarioId, requestedMutation.scenarioOperation].includes(backendAcceptanceOperation)) {
      throw new Error('PRODUCTION_MUTATION_SCENARIO_REQUIRED');
    }
    if (verificationMode !== 'ACCEPTANCE') throw new Error('PRODUCTION_MUTATION_ACCEPTANCE_MODE_REQUIRED');
    if (
      requestedMutation.evidenceType === 'TDS_CONTRACT' &&
      (!topologyPreflight || backendAcceptanceOperation !== requestedMutation.scenarioOperation)
    ) {
      throw new Error('PRODUCTION_MUTATION_TOPOLOGY_PREFLIGHT_REQUIRED');
    }
  }
  const exactSetRequired =
    !tdsContractOnly && requiresFullPerformanceVerification(backendAcceptanceRunId, backendAcceptanceOperation);
  const activeBudgetRequired =
    !tdsContractOnly &&
    requiresActiveBudgetVerification(backendAcceptanceRunId, backendAcceptanceOperation, verificationMode);
  const performanceOperationRegistry = exactSetRequired ? loadPerformanceOperationRegistry({root}) : null;
  // An ACCEPTANCE all run consumes the checked-in generated budget projection.
  // Reject an identity-only or malformed projection before acquiring resources or
  // starting the remote workload; CALIBRATION/focused modes intentionally skip it.
  if (activeBudgetRequired) validateBudgetRegistry({operations: performanceOperationRegistry});
  const workload = exactSetRequired
    ? fullPerformanceWorkload({
        task: invocation.task,
        operation: backendAcceptanceOperation,
        verificationMode,
        registry: performanceOperationRegistry,
      })
    : null;
  mkdirSync(directory, {recursive: true});
  const manifestPath = path.join(directory, 'run-manifest.json');
  const manifest = {
    schemaVersion: 1,
    kind: 'r5-managed-testcontainers-run',
    runId,
    task: invocation.task,
    verificationMode,
    startedAt: now(),
    finishedAt: null,
    remote: {
      hostAlias: remoteHost,
      hostTrust: remoteHostTrust,
      root: remoteRoot,
      dependencyCache: remoteDependencyCache,
      stagingRoot: remoteWorkspace,
    },
    sourceSync: {status: 'FAIL', workspace: remoteWorkspace, stagingRoot: remoteWorkspace},
    gradleDistribution: distribution,
    logPath: `${remoteResults}/gradle.log`,
    testExecution: {status: 'NOT_RUN'},
    testcontainersResources: {
      captureStatus: 'NOT_RUN',
      capturedContainerIds: [],
      capturedVolumeNames: [],
      cleanupStatus: 'NOT_RUN',
    },
    business: backendAcceptanceRunId === null ? 'NOT_APPLICABLE' : 'NOT_RUN',
    backendAcceptance:
      backendAcceptanceRunId === null
        ? null
        : {
            runId: backendAcceptanceRunId,
            operation: backendAcceptanceOperation,
            topologyPreflight,
            tdsContractScenario,
            ...(tdsContractOnly ? {scope: 'TDS_CONTRACT_ONLY'} : {}),
          },
    productionMutation:
      requestedMutation === null
        ? null
        : {
            ...requestedMutation,
            status: 'NOT_RUN',
            verdict: 'NOT_RUN',
            business: 'NOT_RUN',
            cleanup: 'NOT_RUN',
            sourceBeforeSha256: null,
            sourceAfterSha256: null,
            stagingSnapshotHash: null,
            observed: null,
          },
    workload: workload === null ? null : workload,
    measurementEvidence: {status: 'NOT_RUN'},
    signalTrace: {
      requested: signalTracingRequested,
      status: signalTracingRequested ? 'PENDING' : 'NOT_REQUESTED',
      scope: traceSystemSignals ? 'REMOTE_HOST_SIGNAL_GENERATE' : traceChildSignals ? 'GRADLE_CHILD_TREE' : 'NONE',
      tool: null,
      version: null,
      artifact: 'process-signal-trace.log',
    },
    remoteProcessInventory: {
      status: 'PENDING',
      records: 0,
      artifact: 'remote-process-identities.tsv',
      fields: ['pid', 'ppid', 'uid', 'state', 'startTicks', 'comm', 'executable', 'bootId'],
      excludes: ['argv', 'environment', 'executablePath'],
    },
    evidenceArchive: {status: 'NOT_RUN'},
    cleanup: {
      status: 'FAIL',
      remoteProcess: 'FAIL',
      remoteWorkspace: 'FAIL',
      testcontainersContainers: 'FAIL',
      testcontainersVolumes: 'FAIL',
    },
    status: 'FAIL',
    firstFailure: null,
    failureCategory: null,
    lastKnownGood: 'RUN_INITIALIZATION',
    brokenBoundary: null,
    devLifecycle: {
      wasRunning: false,
      managedDevRunId: null,
      stop: {status: 'NOT_RUN'},
      restore: {status: 'NOT_APPLICABLE'},
      cleanup: 'NOT_APPLICABLE',
    },
  };
  const persist = () => atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  let currentBoundary = 'RUN_INITIALIZATION';
  const beginBoundary = boundary => {
    currentBoundary = boundary;
  };
  const markLastKnownGood = boundary => {
    currentBoundary = boundary;
    manifest.lastKnownGood = boundary;
  };
  const markBrokenBoundary = boundary => {
    manifest.brokenBoundary ??= boundary;
  };
  let remotePrepared = false;
  let configuredTdsCapacity = null;
  let remoteRun;
  let failure;
  let mutationPreflight;
  let backendAcceptanceResult;
  let tdsContractResult;
  let measurementEvidence;
  let devState;
  let releaseLocalRunLock;
  let interruptionSignal = null;
  const uninstallInterruptionHandlers = installInterruptionHandlers(signal => {
    interruptionSignal ??= signal;
  });
    runnerEvent('STARTED', {RUN_ID: runId, TASK: invocation.task, MODE: 'FOCUSED'});
  try {
    if (backendAcceptanceRunId !== null) configuredTdsCapacity = resolveTdsCapacityConfiguration();
    beginBoundary('LOCAL_RESOURCE_PREFLIGHT');
    releaseLocalRunLock = acquireLocalRunLock();
    devState = inspectManagedDevState();
    manifest.devLifecycle.wasRunning = devState.wasRunning;
    manifest.devLifecycle.managedDevRunId = devState.runId;
    if (devState.wasRunning) {
      const stopResult = commandResult(path.join(root, 'scripts/dev/stop'), [], {
        env: {...process.env, V2S_RUNTIME_DIR: runtime},
      });
      manifest.devLifecycle.stop = classifyManagedDevLifecycleCommand(stopResult, 'R5_DEV_STOP=PASS');
      if (manifest.devLifecycle.stop.status !== 'PASS') throw new Error('DEV_STOP_FAILED');
      manifest.devLifecycle.cleanup = 'PENDING';
    }
    if (requestedMutation !== null) {
      mutationPreflight = prepareProductionMutation({mutation: requestedMutation});
      manifest.productionMutation.sourceBeforeSha256 = mutationPreflight.sourceBeforeSha256;
      manifest.productionMutation.sourceAfterSha256 = mutationPreflight.sourceAfterSha256;
    }
    persist();
    beginBoundary('LOCAL_RESOURCE_PREFLIGHT');
    const localBudget = commandResult(path.join(root, 'scripts/env/check-runtime-resource-budget'), [
      '--profile',
      'admin-validation-with-ter',
      path.join(root, '.runtime'),
    ]);
    if (localBudget.status !== 0) throw new Error('LOCAL_MANAGED_RESOURCE_BUDGET_EXCEEDED');
    manifest.resourcePreflight = remotePreflight({
      requireTerminalWireRuntime: backendAcceptanceRunId !== null,
      tdsCapacity: configuredTdsCapacity,
    });
    beginBoundary('REMOTE_WORKSPACE_PREPARE');
    remote(
      script(
        'set -euo pipefail',
        `root=${quote(remoteRoot)}`,
        `workspace=${quote(remoteWorkspace)}`,
        `results=${quote(remoteResults)}`,
        `cache=${quote(remoteDependencyCache)}`,
        'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac',
        'case "$cache" in /tmp/catering-v2s-r5-gradle-cache) ;; *) exit 64 ;; esac',
        'mkdir -p "$workspace" "$results" "$cache"',
      ),
    );
    remotePrepared = true;
    beginBoundary('SOURCE_SYNC');
    await uploadSource(remoteWorkspace);
    if (interruptionSignal) throw new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
    manifest.sourceSync = {status: 'PASS', workspace: remoteWorkspace, stagingRoot: remoteWorkspace};
    manifest.gradleDistribution = await syncGradle({directory, remoteRoot, distribution});
    if (interruptionSignal) throw new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
    markLastKnownGood('SOURCE_SYNC');
    persist();
    beginBoundary('REMOTE_TEST_EXECUTION');
    remoteRun = await streamRemoteRun(
      runScript({
        remoteRoot,
        remoteWorkspace,
        remoteResults,
        distribution: manifest.gradleDistribution,
        invocation,
        backendAcceptanceRunId,
        backendAcceptanceOperation,
        verificationMode,
        productionMutation: requestedMutation,
        mutationPreflight,
        tdsCapacity: manifest.resourcePreflight.tdsCapacity ?? null,
        terminalWireNodePath: manifest.resourcePreflight.nodeRuntime?.nodePath ?? null,
        topologyPreflight,
        tdsContractScenario,
        traceChildSignals,
        traceSystemSignals,
        vs12Diagnostic,
        vs8Diagnostic,
        tdsContractOnly,
        d46Focused,
      }),
    );
    if (interruptionSignal) throw new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
    if (remoteRun.status !== 0)
      throw new Error(`REMOTE_RUNNER_UNAVAILABLE:${compact(remoteRun.stderrTail || remoteRun.stdoutTail)}`);
    beginBoundary('EXECUTION_EVIDENCE');
    collectArtifacts(remoteResults, directory);
    const gradleLog = readFileSync(path.join(directory, 'gradle.log'), 'utf8');
    const actualExecution = classifyGradleTestExecution(gradleLog, invocation.task);
    const testResultsDirectory = path.join(directory, 'test-results');
    const junitFailureCode = existsSync(testResultsDirectory)
      ? walkFiles(testResultsDirectory)
          .filter(file => file.endsWith('.xml'))
          .sort()
          .map(file => firstJUnitFailureCode(readFileSync(path.join(testResultsDirectory, file), 'utf8')))
          .find(Boolean) ?? null
      : null;
    const runnerMarker = name => remoteRun.markers?.[name] ?? marker(remoteRun.stdoutTail, name);
    const remoteGradleStatus = runnerMarker('REMOTE_GRADLE_STATUS');
    const resourceCaptureStatus = runnerMarker('REMOTE_TESTCONTAINERS_RESOURCE_CAPTURE');
    const capturedContainerIds = parseResourceIdMarker(
      runnerMarker('REMOTE_TESTCONTAINERS_OWNED_CONTAINER_IDS'),
      /^[a-f0-9]{12,64}$/i,
    );
    const capturedVolumeNames = parseResourceIdMarker(
      runnerMarker('REMOTE_TESTCONTAINERS_OWNED_VOLUME_IDS'),
      /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/,
    );
    const resourceCaptureValid =
      resourceCaptureStatus === 'PASS' && capturedContainerIds !== null && capturedVolumeNames !== null;
    manifest.testcontainersResources = {
      captureStatus: resourceCaptureValid ? 'PASS' : 'FAIL',
      capturedAt: resourceCaptureValid ? now() : null,
      capturedContainerIds: capturedContainerIds ?? [],
      capturedVolumeNames: capturedVolumeNames ?? [],
      cleanupStatus: 'PENDING',
    };
    const containerQueryStatus = runnerMarker('REMOTE_TESTCONTAINERS_CONTAINER_QUERY');
    const volumeQueryStatus = runnerMarker('REMOTE_TESTCONTAINERS_VOLUME_QUERY');
    const afterContainerQueryStatus = runnerMarker('REMOTE_TESTCONTAINERS_AFTER_CONTAINER_QUERY');
    const afterVolumeQueryStatus = runnerMarker('REMOTE_TESTCONTAINERS_AFTER_VOLUME_QUERY');
    const containers = runnerMarker('REMOTE_TESTCONTAINERS_CONTAINERS');
    const volumes = runnerMarker('REMOTE_TESTCONTAINERS_VOLUMES');
    const archiveStatus = runnerMarker('REMOTE_EVIDENCE_ARCHIVE_STATUS');
    const signalTraceStatus = runnerMarker('REMOTE_SIGNAL_TRACE_STATUS');
    const signalTraceTool = runnerMarker('REMOTE_SIGNAL_TRACE_TOOL');
    const signalTraceVersion = runnerMarker('REMOTE_SIGNAL_TRACE_VERSION');
    const signalTracePreflight = runnerMarker('REMOTE_SIGNAL_TRACE_PREFLIGHT');
    const signalTraceStopStatus = runnerMarker('REMOTE_SIGNAL_TRACE_STOP_STATUS');
    const signalTracePid = runnerMarker('REMOTE_SIGNAL_TRACE_PID');
    const signalTraceStartTicks = runnerMarker('REMOTE_SIGNAL_TRACE_START_TICKS');
    const signalTraceBootId = runnerMarker('REMOTE_SIGNAL_TRACE_BOOT_ID');
    manifest.signalTrace = {
      requested: signalTracingRequested,
      status: signalTracingRequested ? (signalTraceStatus ?? 'FAIL') : 'NOT_REQUESTED',
      scope: traceSystemSignals ? 'REMOTE_HOST_SIGNAL_GENERATE' : traceChildSignals ? 'GRADLE_CHILD_TREE' : 'NONE',
      tool: signalTraceTool ?? null,
      version: signalTraceVersion ?? null,
      preflight: signalTracePreflight ?? (signalTracingRequested ? 'UNAVAILABLE' : 'NOT_REQUESTED'),
      stopStatus: signalTraceStopStatus ?? (traceSystemSignals ? 'UNAVAILABLE' : 'NOT_APPLICABLE'),
      processIdentity:
        traceSystemSignals && signalTracePid && signalTraceStartTicks && signalTraceBootId
          ? {host: remoteHost, pid: signalTracePid, startTicks: signalTraceStartTicks, bootId: signalTraceBootId}
          : null,
      artifact: 'process-signal-trace.log',
    };
    const processInventoryStatus = runnerMarker('REMOTE_PROCESS_INVENTORY_STATUS');
    const processInventoryPreflight = runnerMarker('REMOTE_PROCESS_INVENTORY_PREFLIGHT');
    const processInventoryRecords = runnerMarker('REMOTE_PROCESS_INVENTORY_RECORDS');
    const parsedProcessInventoryRecords = Number.parseInt(processInventoryRecords ?? '', 10);
    manifest.remoteProcessInventory = {
      ...manifest.remoteProcessInventory,
      status:
        processInventoryStatus === 'CAPTURED' && Number.isSafeInteger(parsedProcessInventoryRecords)
          ? 'CAPTURED'
          : 'FAIL',
      records: Number.isSafeInteger(parsedProcessInventoryRecords) ? parsedProcessInventoryRecords : 0,
      preflight: processInventoryPreflight === 'CAPTURED' ? 'PASS' : 'FAIL',
      capturedAt: now(),
    };
    const gradleFailureCode = classifyRemoteGradleFailure(gradleLog, junitFailureCode);
    const executionPass =
      actualExecution.status === 'PASS' &&
      remoteGradleStatus === '0' &&
      resourceCaptureValid &&
      manifest.remoteProcessInventory.status === 'CAPTURED' &&
      (!signalTracingRequested || manifest.signalTrace.status === 'CAPTURED') &&
      (!traceSystemSignals || manifest.signalTrace.stopStatus === 'STOPPED');
    const executionFailure =
      !resourceCaptureValid
        ? 'REMOTE_TESTCONTAINERS_RESOURCE_CAPTURE_FAILED'
        : processInventoryPreflight !== 'CAPTURED'
        ? 'REMOTE_PROCESS_INVENTORY_PREFLIGHT_FAILED'
        : remoteGradleStatus !== undefined && remoteGradleStatus !== '0'
        ? (gradleFailureCode ?? 'GRADLE_TEST_FAILURE_DETAILS_UNAVAILABLE')
        : manifest.remoteProcessInventory.status !== 'CAPTURED'
          ? 'REMOTE_PROCESS_INVENTORY_FAILED'
          : signalTracingRequested && manifest.signalTrace.status !== 'CAPTURED'
            ? 'REMOTE_SIGNAL_TRACE_FAILED'
            : traceSystemSignals && manifest.signalTrace.stopStatus !== 'STOPPED'
              ? 'REMOTE_SIGNAL_TRACE_CLEANUP_FAILED'
            : (actualExecution.reason ?? 'REMOTE_GRADLE_STATUS_UNAVAILABLE');
    manifest.testExecution = {
      ...actualExecution,
      status: executionPass ? 'PASS' : 'FAIL',
      ...(executionPass ? {} : {reason: executionFailure}),
      remoteGradleStatus: remoteGradleStatus ?? 'UNAVAILABLE',
      ...(requestedMutation !== null ? {expectedFailure: true} : {}),
    };
    // Preserve the first real execution failure for expected-mutation runs as
    // well.  A pre-test gate (for example the CP-05 budget gate) can fail before
    // the acceptance process creates any archived artifacts; later artifact
    // handling must not replace that boundary with an artifact-missing error.
    if (!executionPass) {
      manifest.firstFailure ??= executionFailure;
      manifest.failureCategory ??= executionFailure;
      markBrokenBoundary('REMOTE_TEST_EXECUTION');
    } else {
      markLastKnownGood('REMOTE_TEST_EXECUTION');
    }
    manifest.cleanup = {
      status: remoteResourceCleanupStatus({
        remoteGradleStatus,
        containerQueryStatus,
        volumeQueryStatus,
        afterContainerQueryStatus,
        afterVolumeQueryStatus,
        containerCleanup: containers,
        volumeCleanup: volumes,
      }),
      remoteProcess: remoteGradleStatus !== undefined ? 'PASS' : 'FAIL',
      remoteWorkspace: 'PENDING',
      testcontainersContainers: containers === 'PASS' ? 'PASS' : 'FAIL',
      testcontainersVolumes: volumes === 'PASS' ? 'PASS' : 'FAIL',
      testcontainersContainerQuery: containerQueryStatus === 'PASS' && afterContainerQueryStatus === 'PASS' ? 'PASS' : 'FAIL',
      testcontainersVolumeQuery: volumeQueryStatus === 'PASS' && afterVolumeQueryStatus === 'PASS' ? 'PASS' : 'FAIL',
    };
    if (requestedMutation !== null) {
      const mutationStatus = runnerMarker('R5_TEST_MUTATION_STATUS');
      const mutationId = runnerMarker('R5_TEST_MUTATION_ID');
      const observedReplaceCount = runnerMarker('R5_TEST_MUTATION_REPLACE_COUNT');
      const sourceBeforeSha256 = runnerMarker('R5_TEST_MUTATION_SOURCE_BEFORE_SHA256');
      const sourceAfterSha256 = runnerMarker('R5_TEST_MUTATION_SOURCE_AFTER_SHA256');
      const stagingSnapshotHash = runnerMarker('R5_TEST_MUTATION_STAGING_SNAPSHOT_SHA256');
      manifest.productionMutation.status = mutationStatus === 'PASS' ? 'PASS' : 'FAIL';
      manifest.productionMutation.observedReplaceCount = observedReplaceCount ?? null;
      manifest.productionMutation.sourceBeforeSha256 = sourceBeforeSha256 ?? null;
      manifest.productionMutation.sourceAfterSha256 = sourceAfterSha256 ?? null;
      manifest.productionMutation.stagingSnapshotHash = stagingSnapshotHash ?? null;
      if (mutationStatus !== 'PASS') throw new Error(`PRODUCTION_MUTATION_NOT_APPLIED:${runnerMarker('R5_TEST_MUTATION_FAILURE') ?? 'UNKNOWN'}`);
      if (
        mutationId !== requestedMutation.id ||
        observedReplaceCount !== String(requestedMutation.replaceCount) ||
        sourceBeforeSha256 !== mutationPreflight.sourceBeforeSha256 ||
        sourceAfterSha256 !== mutationPreflight.sourceAfterSha256 ||
        !/^[a-f0-9]{64}$/.test(stagingSnapshotHash ?? '')
      ) {
        throw new Error('PRODUCTION_MUTATION_RECEIPT_MISMATCH');
      }
      if (executionPass) throw new Error('PRODUCTION_MUTATION_NOT_CAUGHT');
    }
    const acceptanceArtifactsAvailable = hasArchivedEvidenceIndexEntries(directory);
    if (requestedMutation !== null && !executionPass && !acceptanceArtifactsAvailable) {
      throw new Error(executionFailure);
    }
    beginBoundary('BUSINESS_EVIDENCE');
    const requiresAcceptanceArtifacts =
      (!tdsContractOnly && requiresBackendAcceptanceEvidence(backendAcceptanceRunId, executionPass)) ||
      (requestedMutation !== null && acceptanceArtifactsAvailable);
    const requiresTdsContractOnlyArtifacts = tdsContractOnly && executionPass;
    if (requiresAcceptanceArtifacts || requiresTdsContractOnlyArtifacts) {
      const archiveRows = parseEvidenceArchiveIndex(
        readFileSync(path.join(directory, 'evidence-artifacts.tsv'), 'utf8'),
      );
      const requiredArtifacts = tdsContractOnly
        ? TDS_CONTRACT_ONLY_EVIDENCE_ARTIFACTS
        : ARCHIVED_EVIDENCE_ARTIFACTS;
      for (const name of requiredArtifacts) {
        readEvidenceArtifact(directory, name, {requireArchive: true});
        if (existsSync(path.join(directory, name))) throw new Error(`EVIDENCE_ARTIFACT_RAW_PRESENT:${name}`);
      }
      manifest.evidenceArchive = {
        status: 'PASS',
        indexPath: path.relative(root, path.join(directory, 'evidence-artifacts.tsv')),
        artifacts: archiveRows.map(row => ({
          name: row.name,
          rawBytes: row.rawBytes,
          rawSha256: row.rawSha256,
          archiveBytes: row.archiveBytes,
          archiveSha256: row.archiveSha256,
        })),
      };
      tdsContractResult = parseTdsContractResult(
        readEvidenceArtifact(directory, 'tds-contract-result.jsonl', {requireArchive: true}),
      );
      if (tdsContractScenario !== null) {
        const selectedRows = tdsContractResult.rows.filter(row => row.operation === tdsContractScenario);
        if (selectedRows.length !== 1 || selectedRows[0].contract !== 'PASS' || selectedRows[0].status !== 'PASS') {
          throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_RESULT_MISMATCH');
        }
        manifest.backendAcceptance.tdsContractScenarioResult = 'PASS';
      }
      const tdsProcessEvidence = parseTdsProcessEvidence({
        processEvidence: readEvidenceArtifact(directory, 'tds-process-evidence.json', {requireArchive: true}),
        processLog: readEvidenceArtifact(directory, 'tds-process.log', {requireArchive: true}),
        expectedRunId: backendAcceptanceRunId,
      });
      manifest.backendAcceptance.tdsContract = tdsContractResult.summary.directFailures === 0 ? 'PASS' : 'FAIL';
      manifest.backendAcceptance.tdsContractScenarios = tdsContractResult.summary;
      manifest.backendAcceptance.tdsProcess = tdsProcessEvidence;
      if (tdsContractOnly) {
        manifest.business = 'NOT_APPLICABLE';
      } else {
        backendAcceptanceResult = parseBackendAcceptanceResult(
          readEvidenceArtifact(directory, 'backend-acceptance-result.jsonl', {requireArchive: true}),
        );
        manifest.business = backendAcceptanceResult.summary.directFailures === 0 ? 'PASS' : 'FAIL';
        if (manifest.business === 'PASS') markLastKnownGood('BUSINESS_EVIDENCE');
      }
    }
    if (!executionPass && requestedMutation === null) throw new Error(executionFailure);
    if (remoteGradleStatus !== '0' && requestedMutation === null) throw new Error(executionFailure);
    if (archiveStatus !== '0') throw new Error('REMOTE_EVIDENCE_ARCHIVE_FAILED');
    if (manifest.cleanup.status !== 'PASS') throw new Error('REMOTE_TESTCONTAINERS_RESOURCE_NOT_RECLAIMED');
    if (backendAcceptanceRunId !== null && !tdsContractOnly) {
      if (backendAcceptanceResult?.summary.stubOnly > 0) throw new Error('BACKEND_ACCEPTANCE_STUB_BUSINESS_NOT_ALLOWED');
      if (requiresBackendAcceptanceTdsContract(backendAcceptanceRunId, requestedMutation?.evidenceType)) {
        if (manifest.backendAcceptance?.tdsContract !== 'PASS') {
          throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_FAILED');
        }
      }
      if (requestedMutation === null && backendAcceptanceResult?.summary.directFailures > 0) {
        throw new Error('BACKEND_ACCEPTANCE_SCENARIO_FAILURE');
      }
    }
    if (
      backendAcceptanceRunId !== null &&
      tdsContractOnly &&
      manifest.backendAcceptance?.tdsContract !== 'PASS'
    ) {
      throw new Error('BACKEND_ACCEPTANCE_TDS_CONTRACT_FAILED');
    }
    if (backendAcceptanceRunId !== null && !tdsContractOnly) {
      beginBoundary('MEASUREMENT_EVIDENCE');
      measurementEvidence = parseHttpRequestEvents(
        readEvidenceArtifact(directory, 'http-request-events.jsonl', {requireArchive: true}),
        backendAcceptanceRunId,
      );
      assertUnclassifiedSqlRatio(measurementEvidence);
      if (requestedMutation !== null) {
        assertNoObservationErrors(measurementEvidence.rows);
        manifest.productionMutation.observed = verifyProductionMutationOutcome({
          mutation: requestedMutation,
          backendAcceptanceResult,
          tdsContractResult,
          httpEvents: measurementEvidence.rows,
          runId: backendAcceptanceRunId,
        });
        manifest.productionMutation.verdict = 'PASS';
        manifest.productionMutation.business =
          requestedMutation.evidenceType === 'TDS_CONTRACT' ? 'PASS' : 'FAIL';
      }
      const performanceEvidence = activeBudgetRequired
        ? verifyFullBackendAcceptancePerformance(performanceOperationRegistry, measurementEvidence.rows)
        : exactSetRequired
          ? verifyFullBackendAcceptanceCalibration(performanceOperationRegistry, measurementEvidence.rows)
          : null;
      const operationSet = performanceEvidence?.operationSet ?? null;
      const budgetEvidence = performanceEvidence?.budgetEvidence ?? null;
      const connectionBudgetEvidence = performanceEvidence?.connectionBudgetEvidence ?? null;
      const normalSampleMatrix = performanceEvidence?.normalSampleMatrix ?? null;
      const normalSampleMatrixPath = normalSampleMatrix ? path.join(directory, 'normal-sample-matrix.json') : null;
      if (normalSampleMatrixPath)
        writeFileSync(normalSampleMatrixPath, `${JSON.stringify(normalSampleMatrix, null, 2)}\n`);
      manifest.measurementEvidence = {
        status: 'PASS',
        verificationMode,
        ...measurementEvidence.summary,
        ...(operationSet ? {operationSet} : {}),
        ...(budgetEvidence ? {budgetEvidence} : {}),
        ...(verificationMode === 'CALIBRATION' ? {calibrationEvidence: {status: 'PASS'}} : {}),
        ...(connectionBudgetEvidence ? {connectionBudgetEvidence} : {}),
        ...(normalSampleMatrix
          ? {
              normalSampleMatrix: {
                expected: normalSampleMatrix.expected,
                observed: normalSampleMatrix.observed,
                path: path.relative(root, normalSampleMatrixPath),
              },
            }
          : {}),
      };
      markLastKnownGood('MEASUREMENT_EVIDENCE');
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    recordRemotePreflightFailure(manifest, failure, {remotePrepared});
    manifest.firstFailure ??= failure.message;
    manifest.failureCategory ??= manifest.firstFailure;
    markBrokenBoundary(currentBoundary);
  } finally {
    if (interruptionSignal && !failure) {
      failure = new Error(`HARNESS_INTERRUPTED:${interruptionSignal}`);
      manifest.firstFailure ??= failure.message;
      manifest.failureCategory ??= manifest.firstFailure;
      markBrokenBoundary(currentBoundary);
    }
    if (remotePrepared) {
      if (!existsSync(path.join(directory, 'gradle.log'))) {
        try {
          collectArtifacts(remoteResults, directory);
        } catch (collectionError) {
          manifest.artifactCollection = {status: 'FAIL', reason: compact(collectionError.message)};
        }
      }
      beginBoundary('REMOTE_WORKSPACE_CLEANUP');
      manifest.cleanup.remoteWorkspace = cleanupRemoteWorkspace(remoteRoot);
      manifest.testcontainersResources.cleanupStatus =
        manifest.cleanup.testcontainersContainers === 'PASS' && manifest.cleanup.testcontainersVolumes === 'PASS'
          ? 'PASS'
          : 'FAIL';
      if (manifest.cleanup.remoteWorkspace === 'PASS' && manifest.brokenBoundary === null) {
        markLastKnownGood('REMOTE_WORKSPACE_CLEANUP');
      }
    }
    if (manifest.cleanup.remoteWorkspace !== 'PASS') {
      manifest.cleanup.status = 'FAIL';
      if (!failure) {
        failure = new Error('REMOTE_WORKSPACE_CLEANUP_FAILED');
        manifest.firstFailure ??= failure.message;
        manifest.failureCategory ??= manifest.firstFailure;
        markBrokenBoundary('REMOTE_WORKSPACE_CLEANUP');
      }
    }
    if (devState?.wasRunning) {
      if (!failure && manifest.testExecution.status === 'PASS' && manifest.cleanup.status === 'PASS') {
        beginBoundary('DEV_RESTORE');
        const startResult = commandResult(path.join(root, 'scripts/dev/start'), [], {
          env: {...process.env, V2S_RUNTIME_DIR: runtime},
        });
        manifest.devLifecycle.restore = classifyManagedDevLifecycleCommand(startResult, 'R5_DEV_START=PASS');
        if (manifest.devLifecycle.restore.status === 'PASS') manifest.devLifecycle.cleanup = 'PASS';
        else {
          manifest.devLifecycle.cleanup = 'FAIL';
          failure = new Error('DEV_RESTART_FAILED');
          manifest.firstFailure ??= failure.message;
          manifest.failureCategory ??= manifest.firstFailure;
          markBrokenBoundary('DEV_RESTORE');
        }
      } else {
        manifest.devLifecycle.restore = {status: 'NOT_RUN', reason: 'TEST_NOT_PASS'};
        manifest.devLifecycle.cleanup = 'NOT_RUN';
      }
    }
    manifest.finishedAt = now();
    try {
      if (releaseLocalRunLock) releaseLocalRunLock();
    } catch (releaseError) {
      failure = releaseError instanceof Error ? releaseError : new Error(String(releaseError));
      manifest.firstFailure ??= failure.message;
      manifest.failureCategory ??= manifest.firstFailure;
      markBrokenBoundary('LOCAL_RUN_LOCK_RELEASE');
    } finally {
      uninstallInterruptionHandlers();
    }
    if (manifest.productionMutation !== null) {
      manifest.productionMutation.cleanup = manifest.cleanup.status === 'PASS' ? 'PASS' : 'FAIL';
    }
    const executionAccepted =
      requestedMutation === null
        ? manifest.testExecution.status === 'PASS'
        : manifest.testExecution.status === 'FAIL' && manifest.productionMutation?.verdict === 'PASS';
    const candidateStatus = !failure && executionAccepted && manifest.cleanup.status === 'PASS' ? 'PASS' : 'FAIL';
    manifest.status = candidateStatus;
    if (candidateStatus === 'PASS') markLastKnownGood('CLEANUP');
    if (candidateStatus === 'PASS') {
      try {
        parseAndValidateRunManifest(manifest);
      } catch (validationError) {
        failure = validationError instanceof Error ? validationError : new Error(String(validationError));
        manifest.firstFailure ??= failure.message;
        manifest.failureCategory ??= manifest.firstFailure;
        markBrokenBoundary('MANIFEST_VALIDATION');
        manifest.status = 'FAIL';
      }
    }
    persist();
  }
  if (manifest.status === 'PASS') {
    if (backendAcceptanceResult) {
      for (const row of backendAcceptanceResult.rows) {
        process.stdout.write(
          `BACKEND_ACCEPTANCE_RESULT SCENARIO=${row.operation} MODULE=${row.module} CONTRACT=${row.contract} BUSINESS=${row.business} DB_OPERATIONS=${row.dbOperations}\n`,
        );
      }
      process.stdout.write(
        `BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=${backendAcceptanceResult.summary.discovered} SELECTED=${backendAcceptanceResult.summary.selected} HTTP_SUCCESS=${backendAcceptanceResult.summary.httpSuccess} REAL_BUSINESS_ASSERTIONS=${backendAcceptanceResult.summary.realBusinessAssertions} STUB_ONLY=${backendAcceptanceResult.summary.stubOnly} DIRECT_FAILURES=${backendAcceptanceResult.summary.directFailures}\n`,
      );
    }
    if (manifest.backendAcceptance?.tdsContractScenarios) {
      process.stdout.write(
        `BACKEND_ACCEPTANCE_TDS_CONTRACT_SUMMARY DISCOVERED=${manifest.backendAcceptance.tdsContractScenarios.discovered} PASS=${manifest.backendAcceptance.tdsContractScenarios.contractPass} FAIL=${manifest.backendAcceptance.tdsContractScenarios.directFailures}\n`,
      );
    }
    if (manifest.productionMutation !== null) {
      const observed = manifest.productionMutation.observed;
      process.stdout.write(
        `BACKEND_ACCEPTANCE_MUTATION_RESULT MUTATION_ID=${manifest.productionMutation.id} OPERATION=${observed.operationId} SCENARIO=${observed.scenarioId} POINTER=${manifest.productionMutation.pointer} HTTP=${observed.httpStatus} CONTRACT=${observed.tdsContract ?? 'PASS'} BUSINESS=${manifest.productionMutation.business} FAILURE_CATEGORY=${observed.failureCategory} VERDICT=${manifest.productionMutation.verdict} REPLACE_COUNT=${manifest.productionMutation.observedReplaceCount} SOURCE_BEFORE_SHA256=${manifest.productionMutation.sourceBeforeSha256} SOURCE_AFTER_SHA256=${manifest.productionMutation.sourceAfterSha256} STAGING_SNAPSHOT_SHA256=${manifest.productionMutation.stagingSnapshotHash} CLEANUP=${manifest.productionMutation.cleanup}\n`,
      );
    }
    if (measurementEvidence) {
      process.stdout.write(
        `BACKEND_PERFORMANCE_MEASUREMENT DISCOVERED=${measurementEvidence.summary.discovered} SQL_OPERATIONS=${measurementEvidence.summary.sqlOperations} UNCLASSIFIED_SQL=${measurementEvidence.summary.unclassifiedSqlOperations} UNCLASSIFIED_SQL_RATIO=${measurementEvidence.summary.unclassifiedSqlRatio}\n`,
      );
      if (manifest.measurementEvidence.operationSet) {
        process.stdout.write(
          `BACKEND_PERFORMANCE_OPERATION_SET EXPECTED=${manifest.measurementEvidence.operationSet.expected} OBSERVED=${manifest.measurementEvidence.operationSet.observed} MISSING=${manifest.measurementEvidence.operationSet.missing.length} EXTRA=${manifest.measurementEvidence.operationSet.extra.length} DRIFT=${manifest.measurementEvidence.operationSet.drift.length}\n`,
        );
      }
    }
    process.stdout.write(
      `R5_REMOTE_TESTCONTAINERS=PASS; TASK=${invocation.task}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=${manifest.business}; MUTATION_VERDICT=${manifest.productionMutation?.verdict ?? 'NOT_APPLICABLE'}; RESOURCE_CLEANUP=PASS\n`,
    );
  } else {
    process.stderr.write(
      `R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(failure?.message || manifest.firstFailure || 'TEST_OR_RESOURCE_CLEANUP_FAILED')}; FAILURE_CATEGORY=${compact(manifest.failureCategory || 'UNCLASSIFIED')}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=${manifest.business}; MUTATION_VERDICT=${manifest.productionMutation?.verdict ?? 'NOT_APPLICABLE'}; RESOURCE_CLEANUP=${manifest.cleanup.status}\n`,
    );
    process.exitCode = 2;
  }
  runnerEvent('FINISHED', {
    RUN_ID: runId,
    TASK: invocation.task,
    STATUS: manifest.status,
    EVIDENCE: path.relative(root, directory),
  });
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain && process.argv[2] === '--cleanup-run-manifest') {
  try {
    if (process.argv.length !== 4) throw new Error('CLEANUP_RECOVERY_MANIFEST_REQUIRED');
    const recovery = recoverRemoteWorkspaceCleanup({manifestPath: process.argv[3]});
    process.stdout.write(
      `R5_TESTCONTAINERS_CLEANUP_RECOVERY=${recovery.cleanup.status}; RUN_ID=${recovery.runId}; EVIDENCE=${path.relative(root, recovery.recoveryPath)}; BUSINESS=${recovery.business}; REMOTE_ROOT_ABSENT=${recovery.cleanup.remoteRootAbsent}\n`,
    );
    if (recovery.cleanup.status !== 'PASS') process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`R5_TESTCONTAINERS_CLEANUP_RECOVERY=FAIL; REASON=${compact(error.message)}\n`);
    process.exitCode = 2;
  }
} else if (isMain)
  execute().catch(error => {
    process.stderr.write(`R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(error.message)}\n`);
    process.exitCode = 2;
  });
