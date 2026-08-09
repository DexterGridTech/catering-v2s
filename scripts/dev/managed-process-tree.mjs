#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const sha256 = (value) => createHash('sha256').update(String(value ?? '')).digest('hex');

/** Canonical identity token shared by every local managed-process producer/consumer. */
export const canonicalStartToken = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export function parseProcessTable(output) {
  return String(output ?? '').split('\n').map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.{24})\s+(.*)$/);
    if (!match) return null;
    return {pid: Number(match[1]), ppid: Number(match[2]), pgid: Number(match[3]), startToken: canonicalStartToken(match[4]), command: match[5], commandSha256: sha256(match[5])};
  }).filter(Boolean);
}

export function readProcessTable() {
  const result = spawnSync('ps', ['-axo', 'pid=', '-o', 'ppid=', '-o', 'pgid=', '-o', 'lstart=', '-o', 'command='], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error('MANAGED_PROCESS_TREE_TABLE_UNAVAILABLE');
  return parseProcessTable(result.stdout);
}

export function snapshotProcessTree(rootIdentity, processTable = readProcessTable()) {
  const root = processTable.find((value) => value.pid === rootIdentity.pid && value.pgid === rootIdentity.pgid && value.startToken === rootIdentity.startToken);
  if (!root) return processTable.filter((value) => value.pgid === rootIdentity.pgid).map(({pid, ppid, pgid, startToken, command, commandSha256}) => ({pid, ppid, pgid, startToken, commandSha256, command, ownershipUnverified: true}));
  const owned = [root];
  const seen = new Set([root.pid]);
  for (let index = 0; index < owned.length; index += 1) {
    for (const value of processTable) if (!seen.has(value.pid) && seen.has(value.ppid) && value.pgid === root.pgid) { seen.add(value.pid); owned.push(value); }
  }
  return owned.map(({pid, ppid, pgid, startToken, command, commandSha256}) => ({pid, ppid, pgid, startToken, commandSha256, command}));
}

export function evaluateCleanupReadback(treeReadback) {
  return Array.isArray(treeReadback) && treeReadback.length === 0 && treeReadback.every((value) => value.ownershipUnverified !== true);
}

export function terminateOwnedProcessTree(rootIdentity, {waitMs = 15_000, signal = 'SIGTERM', readTable = readProcessTable, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))} = {}) {
  const initialTable = readTable();
  const rootPresent = initialTable.some((value) => value.pid === rootIdentity.pid && value.pgid === rootIdentity.pgid && value.startToken === rootIdentity.startToken);
  if (!rootPresent) return Promise.resolve({status: 'FAIL', treeReadback: snapshotProcessTree(rootIdentity, initialTable)});
  const initial = snapshotProcessTree(rootIdentity, initialTable);
  if (!initial.length) return {status: 'PASS', treeReadback: []};
  try { process.kill(-rootIdentity.pgid, signal); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
  const deadline = Date.now() + waitMs;
  let treeReadback = snapshotProcessTree(rootIdentity, readTable());
  return (async () => {
    while (treeReadback.length && Date.now() < deadline) { await sleep(250); treeReadback = snapshotProcessTree(rootIdentity, readTable()); }
    return {status: evaluateCleanupReadback(treeReadback) ? 'PASS' : 'FAIL', treeReadback};
  })();
}

function selfTest() {
  const root = {pid: 10, ppid: 1, pgid: 10, startToken: 'Mon Aug  5 10:00:00 2026'};
  const child = {pid: 11, ppid: 10, pgid: 10, startToken: 'Mon Aug  5 10:00:01 2026'};
  const table = [
    {...root, command: 'runner', commandSha256: sha256('runner')},
    {...child, command: 'bootstrap', commandSha256: sha256('bootstrap')},
  ];
  if (snapshotProcessTree(root, table).length !== 2) throw new Error('MANAGED_PROCESS_TREE_SELF_TEST_SNAPSHOT');
  const deadLeader = snapshotProcessTree({...root, startToken: 'reused-leader'}, table);
  if (evaluateCleanupReadback(deadLeader) !== false || !deadLeader.every((value) => value.ownershipUnverified === true)) throw new Error('MANAGED_PROCESS_TREE_SELF_TEST_LEADER_CHILD_RED');
  if (evaluateCleanupReadback([]) !== true) throw new Error('MANAGED_PROCESS_TREE_SELF_TEST_EMPTY');
  if (canonicalStartToken('Sun Aug  9 11:09:26 2026   ') !== 'Sun Aug 9 11:09:26 2026') throw new Error('MANAGED_PROCESS_TREE_SELF_TEST_START_TOKEN');
  process.stdout.write('MANAGED_PROCESS_TREE_SELF_TEST=PASS\nRED=LEADER_DEAD_CHILD_ALIVE_CLEANUP_FAIL\nRED_START_TOKEN_INTERNAL_SPACE_PRESERVED=PASS\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === '--self-test') selfTest();
