#!/usr/bin/env node

import crypto from 'node:crypto';

export const REMOTE_JAVA_CONTROL_KIND = 'r5-dev-remote-java-control';
export const REMOTE_TDS_CONTROL_KIND = 'r5-dev-remote-tds-control';
export const REMOTE_RESOURCE_SNAPSHOT_KIND = 'r5-dev-remote-resource-snapshot';
const remoteRootPattern = /^\/tmp\/r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

export const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex');

export function remoteDevRootFor(runId, pid = process.pid) {
  if (!/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(String(runId)) || !Number.isInteger(pid) || pid < 1) {
    throw new Error('R5_REMOTE_JAVA_RUN_ID_INVALID');
  }
  return `/tmp/${runId}`;
}

export function isOwnedRemoteDevRoot(value) {
  return typeof value === 'string' && remoteRootPattern.test(value);
}

export function validateRemoteJavaControl(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || value.kind !== REMOTE_JAVA_CONTROL_KIND) {
    throw new Error('R5_REMOTE_JAVA_CONTROL_INVALID');
  }
  if (!/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(value.runId) || !isOwnedRemoteDevRoot(value.remoteRoot)) {
    throw new Error('R5_REMOTE_JAVA_CONTROL_ROOT_INVALID');
  }
  if (!Number.isInteger(value.pid) || value.pid < 1 || !Number.isInteger(value.pgid) || value.pgid < 1) {
    throw new Error('R5_REMOTE_JAVA_CONTROL_PID_INVALID');
  }
  if (!/^[0-9a-f-]{16,128}$/i.test(value.bootId) || !Number.isInteger(value.processStartTicks) || value.processStartTicks < 1) {
    throw new Error('R5_REMOTE_JAVA_CONTROL_KERNEL_IDENTITY_INVALID');
  }
  if (!sha256Pattern.test(value.commandSha256)) throw new Error('R5_REMOTE_JAVA_CONTROL_COMMAND_DIGEST_INVALID');
  if (value.httpPort !== undefined && (!Number.isInteger(value.httpPort) || value.httpPort < 1024 || value.httpPort > 65535)) {
    throw new Error('R5_REMOTE_JAVA_CONTROL_HTTP_PORT_INVALID');
  }
  for (const field of ['logPath', 'phasePath']) {
    if (typeof value[field] !== 'string' || !value[field].startsWith(`${value.remoteRoot}/`)) {
      throw new Error(`R5_REMOTE_JAVA_CONTROL_${field.toUpperCase()}_INVALID`);
    }
  }
  if (!['STARTING', 'READY', 'STOPPING', 'STOPPED', 'FAILED'].includes(value.phase)) {
    throw new Error('R5_REMOTE_JAVA_CONTROL_PHASE_INVALID');
  }
  return value;
}

export function validateRemoteTdsControl(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || value.kind !== REMOTE_TDS_CONTROL_KIND) {
    throw new Error('R5_REMOTE_TDS_CONTROL_INVALID');
  }
  if (!/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(value.runId) || !isOwnedRemoteDevRoot(value.remoteRoot)) {
    throw new Error('R5_REMOTE_TDS_CONTROL_ROOT_INVALID');
  }
  if (!Number.isInteger(value.pid) || value.pid < 1 || !Number.isInteger(value.pgid) || value.pgid < 1) {
    throw new Error('R5_REMOTE_TDS_CONTROL_PID_INVALID');
  }
  if (!/^[0-9a-f-]{16,128}$/i.test(value.bootId) || !Number.isInteger(value.processStartTicks) || value.processStartTicks < 1) {
    throw new Error('R5_REMOTE_TDS_CONTROL_KERNEL_IDENTITY_INVALID');
  }
  if (!sha256Pattern.test(value.commandSha256)) throw new Error('R5_REMOTE_TDS_CONTROL_COMMAND_DIGEST_INVALID');
  if (!Number.isInteger(value.websocketPort) || value.websocketPort < 1024 || value.websocketPort > 65535) {
    throw new Error('R5_REMOTE_TDS_CONTROL_WEBSOCKET_PORT_INVALID');
  }
  if (!Number.isInteger(value.rssBudgetMiB) || value.rssBudgetMiB < 1 || value.rssBudgetMiB > 2147483647) {
    throw new Error('R5_REMOTE_TDS_CONTROL_RSS_BUDGET_INVALID');
  }
  for (const field of ['controlPath', 'logPath', 'phasePath']) {
    if (typeof value[field] !== 'string' || !value[field].startsWith(`${value.remoteRoot}/`)) {
      throw new Error(`R5_REMOTE_TDS_CONTROL_${field.toUpperCase()}_INVALID`);
    }
  }
  if (!['STARTING', 'READY', 'STOPPING', 'STOPPED', 'FAILED'].includes(value.phase)) {
    throw new Error('R5_REMOTE_TDS_CONTROL_PHASE_INVALID');
  }
  return value;
}

export function validateRemoteResourceSnapshot(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || value.kind !== REMOTE_RESOURCE_SNAPSHOT_KIND) {
    throw new Error('R5_REMOTE_RESOURCE_SNAPSHOT_INVALID');
  }
  if (typeof value.host !== 'string' || !/^[a-z0-9._-]{3,128}$/i.test(value.host)
    || typeof value.bootId !== 'string' || !/^[0-9a-f-]{16,128}$/i.test(value.bootId)
    || !isOwnedRemoteDevRoot(value.remoteRoot)) {
    throw new Error('R5_REMOTE_RESOURCE_IDENTITY_INVALID');
  }
  if (!Number.isInteger(value.javaMajor) || value.javaMajor < 17
    || !Number.isInteger(value.cpuCount) || value.cpuCount < 2
    || !Number.isInteger(value.memoryAvailableMiB) || value.memoryAvailableMiB < 512
    || !Number.isInteger(value.tmpAvailableMiB) || value.tmpAvailableMiB < 2048
    || value.remoteRootAbsent !== true) {
    throw new Error('R5_REMOTE_RESOURCE_CAPACITY_INVALID');
  }
  if (typeof value.observedAt !== 'string' || Number.isNaN(Date.parse(value.observedAt))) {
    throw new Error('R5_REMOTE_RESOURCE_TIMESTAMP_INVALID');
  }
  return value;
}

export function remoteIdentityMatches(expected, actual) {
  try {
    validateRemoteJavaControl(expected);
    if (!actual || typeof actual !== 'object') return false;
    return expected.remoteRoot === actual.remoteRoot
      && expected.pid === actual.pid
      && expected.pgid === actual.pgid
      && expected.bootId === actual.bootId
      && expected.processStartTicks === actual.processStartTicks
      && expected.commandSha256 === actual.commandSha256;
  } catch {
    return false;
  }
}

export function remoteTdsIdentityMatches(expected, actual) {
  try {
    validateRemoteTdsControl(expected);
    if (!actual || typeof actual !== 'object') return false;
    return expected.remoteRoot === actual.remoteRoot
      && expected.pid === actual.pid
      && expected.pgid === actual.pgid
      && expected.bootId === actual.bootId
      && expected.processStartTicks === actual.processStartTicks
      && expected.commandSha256 === actual.commandSha256
      && expected.websocketPort === actual.websocketPort
      && expected.rssBudgetMiB === actual.rssBudgetMiB;
  } catch {
    return false;
  }
}

export function remoteJavaSelfTest() {
  const runId = `r5-dev-${Date.now()}-${process.pid}-${crypto.randomUUID()}`;
  const control = {
    schemaVersion: 1,
    kind: REMOTE_JAVA_CONTROL_KIND,
    runId,
    remoteRoot: remoteDevRootFor(runId),
    pid: 101,
    pgid: 101,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
    phase: 'READY',
    logPath: `${remoteDevRootFor(runId)}/results/business-server.log`,
    phasePath: `${remoteDevRootFor(runId)}/results/phase.jsonl`,
  };
  validateRemoteJavaControl(control);
  if (!remoteIdentityMatches(control, {...control})) throw new Error('R5_REMOTE_JAVA_SELF_TEST_VALID_IDENTITY');
  if (remoteIdentityMatches(control, {...control, bootId: 'boot-test-002'})) throw new Error('R5_REMOTE_JAVA_SELF_TEST_BOOT_ID_RED_NOT_DETECTED');
  if (remoteIdentityMatches(control, {...control, processStartTicks: 2027})) throw new Error('R5_REMOTE_JAVA_SELF_TEST_START_TICKS_RED_NOT_DETECTED');
  if (remoteIdentityMatches(control, {...control, commandSha256: 'b'.repeat(64)})) throw new Error('R5_REMOTE_JAVA_SELF_TEST_COMMAND_DIGEST_RED_NOT_DETECTED');
  if (remoteIdentityMatches(control, {...control, remoteRoot: '/tmp/unknown-root'})) throw new Error('R5_REMOTE_JAVA_SELF_TEST_ROOT_RED_NOT_DETECTED');
  const tdsControl = {
    schemaVersion: 1,
    kind: REMOTE_TDS_CONTROL_KIND,
    runId,
    remoteRoot: remoteDevRootFor(runId),
    pid: 102,
    pgid: 102,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2027,
    commandSha256: 'b'.repeat(64),
    websocketPort: 18083,
    rssBudgetMiB: 512,
    phase: 'READY',
    controlPath: `${remoteDevRootFor(runId)}/results/tds-control.json`,
    logPath: `${remoteDevRootFor(runId)}/results/tds-server.log`,
    phasePath: `${remoteDevRootFor(runId)}/results/tds-phase.jsonl`,
  };
  validateRemoteTdsControl(tdsControl);
  try {
    validateRemoteTdsControl({...tdsControl, rssBudgetMiB: undefined});
    throw new Error('R5_REMOTE_TDS_SELF_TEST_MISSING_RSS_BUDGET_NOT_DETECTED');
  } catch (error) {
    if (error.message === 'R5_REMOTE_TDS_SELF_TEST_MISSING_RSS_BUDGET_NOT_DETECTED') throw error;
    if (error.message !== 'R5_REMOTE_TDS_CONTROL_RSS_BUDGET_INVALID') throw error;
  }
  try {
    validateRemoteTdsControl({...tdsControl, rssBudgetMiB: 0});
    throw new Error('R5_REMOTE_TDS_SELF_TEST_INVALID_RSS_BUDGET_NOT_DETECTED');
  } catch (error) {
    if (error.message === 'R5_REMOTE_TDS_SELF_TEST_INVALID_RSS_BUDGET_NOT_DETECTED') throw error;
    if (error.message !== 'R5_REMOTE_TDS_CONTROL_RSS_BUDGET_INVALID') throw error;
  }
  if (!remoteTdsIdentityMatches(tdsControl, {...tdsControl})) throw new Error('R5_REMOTE_TDS_SELF_TEST_VALID_IDENTITY');
  if (remoteTdsIdentityMatches(tdsControl, {...tdsControl, websocketPort: 0})) throw new Error('R5_REMOTE_TDS_SELF_TEST_PORT_RED_NOT_DETECTED');
  if (remoteTdsIdentityMatches(tdsControl, {...tdsControl, processStartTicks: 2028})) throw new Error('R5_REMOTE_TDS_SELF_TEST_START_TICKS_RED_NOT_DETECTED');
  if (remoteTdsIdentityMatches(tdsControl, {...tdsControl, rssBudgetMiB: 513})) throw new Error('R5_REMOTE_TDS_SELF_TEST_RSS_BUDGET_RED_NOT_DETECTED');
  const resources = {
    schemaVersion: 1,
    kind: REMOTE_RESOURCE_SNAPSHOT_KIND,
    host: 'dev-host-01',
    bootId: control.bootId,
    remoteRoot: control.remoteRoot,
    javaMajor: 21,
    cpuCount: 4,
    memoryAvailableMiB: 1024,
    tmpAvailableMiB: 4096,
    remoteRootAbsent: true,
    observedAt: new Date().toISOString(),
  };
  validateRemoteResourceSnapshot(resources);
  for (const [field, value] of [['javaMajor', 16], ['cpuCount', 1], ['memoryAvailableMiB', 511], ['tmpAvailableMiB', 2047]]) {
    try { validateRemoteResourceSnapshot({...resources, [field]: value}); throw new Error(`R5_REMOTE_JAVA_SELF_TEST_RESOURCE_RED:${field}`); }
    catch (error) { if (error.message !== 'R5_REMOTE_RESOURCE_CAPACITY_INVALID') throw error; }
  }
  try { validateRemoteResourceSnapshot({...resources, remoteRootAbsent: false}); throw new Error('R5_REMOTE_JAVA_SELF_TEST_ROOT_RESIDUAL_NOT_DETECTED'); }
  catch (error) { if (error.message !== 'R5_REMOTE_RESOURCE_CAPACITY_INVALID') throw error; }
  return 'R5_REMOTE_JAVA_SELF_TEST=PASS\nRED=BOOT_ID,START_TICKS,COMMAND_DIGEST,ROOT_BOUNDARY\nTDS_RED=WS_PORT,START_TICKS,RSS_BUDGET';
}

if (process.argv[1]?.endsWith('/r5-remote-java.mjs') && process.argv[2] === '--self-test') {
  try {
    process.stdout.write(`${remoteJavaSelfTest()}\n`);
  } catch (error) {
    process.stderr.write(`${error?.message ?? 'R5_REMOTE_JAVA_SELF_TEST_FAILED'}\n`);
    process.exitCode = 2;
  }
}
