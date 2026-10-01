import {closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync, fsyncSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {canonicalStartToken} from './managed-process-tree.mjs';

const lockKind = 'terminal-client-dev-acceptance-lock';

function processStartToken(pid, spawnSyncImpl = spawnSync) {
  const result = spawnSyncImpl('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  return result.status === 0 && result.stdout.trim() ? canonicalStartToken(result.stdout) : null;
}

function readLockSnapshot(lockPath) {
  const before = lstatSync(lockPath);
  if (!before.isFile()) throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_NOT_FILE');
  const raw = readFileSync(lockPath, 'utf8');
  const after = lstatSync(lockPath);
  if (before.dev !== after.dev || before.ino !== after.ino) throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_REPLACED');
  let owner;
  try {
    owner = JSON.parse(raw);
  } catch {
    throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_INVALID');
  }
  if (owner.schemaVersion !== 1 || owner.kind !== lockKind ||
      !/^ter-client-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(owner.runId ?? '') ||
      !Number.isInteger(owner.pid) || owner.pid < 1 || typeof owner.startToken !== 'string' || !owner.startToken.trim()) {
    throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_INVALID');
  }
  return {before, raw, owner};
}

function ownerIsAlive(owner, {kill = process.kill, startTokenForPid = processStartToken} = {}) {
  try {
    kill(owner.pid, 0);
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code !== 'EPERM') throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_PROCESS_PROBE_FAILED');
  }
  const observedStartToken = canonicalStartToken(startTokenForPid(owner.pid));
  if (!observedStartToken) throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_IDENTITY_UNAVAILABLE');
  return observedStartToken === canonicalStartToken(owner.startToken);
}

function removeVerifiedStaleLock(lockPath, {kill, startTokenForPid} = {}) {
  const snapshot = readLockSnapshot(lockPath);
  if (ownerIsAlive(snapshot.owner, {kill, startTokenForPid})) return false;
  const current = readLockSnapshot(lockPath);
  if (current.raw !== snapshot.raw || current.before.dev !== snapshot.before.dev || current.before.ino !== snapshot.before.ino) {
    throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_REPLACED');
  }
  if (ownerIsAlive(current.owner, {kill, startTokenForPid})) return false;
  unlinkSync(lockPath);
  return true;
}

export function assertNoActiveTerminalClientAcceptance({
  lockPath,
  kill = process.kill,
  startTokenForPid = processStartToken,
} = {}) {
  if (!lockPath) throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_PATH_REQUIRED');
  if (!existsSync(lockPath)) return Object.freeze({status: 'NOT_ACTIVE'});
  const snapshot = readLockSnapshot(lockPath);
  if (ownerIsAlive(snapshot.owner, {kill, startTokenForPid})) {
    throw new Error(`TERMINAL_CLIENT_ACCEPTANCE_ACTIVE:${snapshot.owner.runId}`);
  }
  removeVerifiedStaleLock(lockPath, {kill, startTokenForPid});
  return Object.freeze({status: 'STALE_LOCK_RECLAIMED', runId: snapshot.owner.runId});
}

export function acquireTerminalClientDevAcceptanceLock(lockPath, {
  runId,
  pid = process.pid,
  startToken = processStartToken(pid),
  kill = process.kill,
  startTokenForPid = processStartToken,
} = {}) {
  if (typeof lockPath !== 'string' || !lockPath ||
      !/^ter-client-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(runId ?? '') ||
      !Number.isInteger(pid) || pid < 1 || !canonicalStartToken(startToken)) {
    throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_OWNER_INVALID');
  }
  mkdirSync(path.dirname(lockPath), {recursive: true, mode: 0o700});
  const owner = Object.freeze({schemaVersion: 1, kind: lockKind, runId, pid, startToken: canonicalStartToken(startToken)});
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const snapshot = readLockSnapshot(lockPath);
    if (ownerIsAlive(snapshot.owner, {kill, startTokenForPid})) {
      throw new Error(`TERMINAL_CLIENT_ACCEPTANCE_ACTIVE:${snapshot.owner.runId}`);
    }
    if (!removeVerifiedStaleLock(lockPath, {kill, startTokenForPid})) {
      throw new Error(`TERMINAL_CLIENT_ACCEPTANCE_ACTIVE:${snapshot.owner.runId}`);
    }
    try {
      descriptor = openSync(lockPath, 'wx', 0o600);
    } catch (retryError) {
      if (retryError?.code === 'EEXIST') throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_ACQUIRE_RACE');
      throw retryError;
    }
  }
  const serialized = `${JSON.stringify(owner)}\n`;
  writeSync(descriptor, serialized);
  fsyncSync(descriptor);
  const opened = fstatSync(descriptor);
  let released = false;
  return Object.freeze({
    owner,
    release() {
      if (released) return;
      const current = readLockSnapshot(lockPath);
      if (current.before.dev !== opened.dev || current.before.ino !== opened.ino || current.raw !== serialized) {
        throw new Error('TERMINAL_CLIENT_ACCEPTANCE_LOCK_OWNERSHIP_CHANGED');
      }
      closeSync(descriptor);
      unlinkSync(lockPath);
      released = true;
    },
  });
}
