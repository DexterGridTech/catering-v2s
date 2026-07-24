#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

class RegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message = code) {
  throw new RegistryError(code, message);
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail('REGISTRY_JSON_INVALID', error.message);
  }
}

function validate(registry, root) {
  if (registry?.schemaVersion !== 1 || registry?.kind !== 'roadmap-program-registry' || !Array.isArray(registry.programs)) {
    fail('REGISTRY_HEADER_INVALID');
  }
  const programIds = new Set();
  const roadmapIds = new Set();
  const batchIds = new Set();
  for (const item of registry.programs) {
    const keys = Object.keys(item).sort().join(',');
    const expected = ['activationState', 'authorizationOwnerPath', 'batchIds', 'programId', 'programKind', 'roadmapId', 'roadmapPath', 'stateOwnerPath'].sort().join(',');
    if (keys !== expected) fail('PROGRAM_SHAPE_INVALID');
    if (!['PREPARED_NON_AUTHORITATIVE', 'ACTIVE'].includes(item.activationState)) fail('ACTIVATION_STATE_INVALID');
    if (item.programKind !== 'SUCCESSOR_EXECUTION') fail('PROGRAM_KIND_INVALID');
    if (programIds.has(item.programId)) fail('DUPLICATE_PROGRAM_ID');
    if (roadmapIds.has(item.roadmapId)) fail('DUPLICATE_ROADMAP_ID');
    programIds.add(item.programId);
    roadmapIds.add(item.roadmapId);
    if (item.roadmapPath !== item.stateOwnerPath || item.roadmapPath !== item.authorizationOwnerPath) fail('OWNER_PATH_MISMATCH');
    if (!Array.isArray(item.batchIds)) fail('BATCH_IDS_INVALID');
    for (const id of item.batchIds) {
      if (batchIds.has(id)) fail('DUPLICATE_BATCH_ID');
      batchIds.add(id);
    }
    const target = path.resolve(root, item.roadmapPath);
    if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target)) fail('ROADMAP_NOT_FOUND');
    const text = fs.readFileSync(target, 'utf8');
    for (const marker of [
      `roadmapId: ${item.roadmapId}`,
      `programId: ${item.programId}`,
      `kind: ${item.programKind}`,
      'stateOwner: self',
      'authorizationOwner: self',
    ]) {
      if (!text.includes(marker)) fail('ROADMAP_IDENTITY_MISMATCH', marker);
    }
  }
  if (registry.programs.some((item) => item.programId === 'AI_FIRST_FOUNDATION')) fail('OLD_PROGRAM_STATE_FORBIDDEN');
  return registry;
}

function resolve(registry, programId) {
  const matches = registry.programs.filter((item) => item.programId === programId && item.activationState === 'ACTIVE');
  if (matches.length === 0) fail('NO_ACTIVE_PROGRAM');
  if (matches.length !== 1) fail('AMBIGUOUS_ACTIVE_PROGRAM');
  return matches[0];
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-roadmap-registry-'));
  try {
    fs.mkdirSync(path.join(root, 'doc'), { recursive: true });
    fs.writeFileSync(path.join(root, 'doc', 'r.md'), 'roadmapId: r\nprogramId: P\nkind: SUCCESSOR_EXECUTION\nstateOwner: self\nauthorizationOwner: self\n');
    const base = {
      schemaVersion: 1,
      kind: 'roadmap-program-registry',
      programs: [{
        programId: 'P',
        roadmapId: 'r',
        programKind: 'SUCCESSOR_EXECUTION',
        activationState: 'PREPARED_NON_AUTHORITATIVE',
        roadmapPath: 'doc/r.md',
        stateOwnerPath: 'doc/r.md',
        authorizationOwnerPath: 'doc/r.md',
        batchIds: [],
      }],
    };
    validate(base, root);
    try { resolve(base, 'P'); fail('PREPARED_RESOLVED_UNEXPECTEDLY'); } catch (error) {
      if (error.code !== 'NO_ACTIVE_PROGRAM') throw error;
    }
    const active = structuredClone(base);
    active.programs[0].activationState = 'ACTIVE';
    if (resolve(validate(active, root), 'P').roadmapId !== 'r') fail('ACTIVE_CONTROL_FAILED');
    const duplicate = structuredClone(active);
    duplicate.programs.push(structuredClone(active.programs[0]));
    try { validate(duplicate, root); fail('DUPLICATE_UNEXPECTEDLY_PASSED'); } catch (error) {
      if (error.code !== 'DUPLICATE_PROGRAM_ID') throw error;
    }
    const old = structuredClone(active);
    old.programs[0].programId = 'AI_FIRST_FOUNDATION';
    fs.writeFileSync(path.join(root, 'doc', 'r.md'), 'roadmapId: r\nprogramId: AI_FIRST_FOUNDATION\nkind: SUCCESSOR_EXECUTION\nstateOwner: self\nauthorizationOwner: self\n');
    try { validate(old, root); fail('OLD_PROGRAM_UNEXPECTEDLY_PASSED'); } catch (error) {
      if (error.code !== 'OLD_PROGRAM_STATE_FORBIDDEN') throw error;
    }
    console.log('ROADMAP_PROGRAM_REGISTRY_SELF_TEST=PASS');
    console.log('PREPARED_NON_AUTHORITATIVE_RED=PASS');
    console.log('DUPLICATE_OWNER_RED=PASS');
    console.log('OLD_PROGRAM_RED=PASS');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'self-test') return selfTest();
  const fileIndex = args.indexOf('--registry');
  const file = fileIndex >= 0 ? path.resolve(process.cwd(), args[fileIndex + 1]) : path.join(repoRoot, 'doc/platform/roadmap-program-registry.json');
  const root = fileIndex >= 0 ? process.cwd() : repoRoot;
  const registry = validate(loadJson(file), root);
  if (command === 'check') {
    console.log('ROADMAP_PROGRAM_REGISTRY=PASS');
    console.log(`PROGRAMS=${registry.programs.length}`);
    return;
  }
  if (command === 'resolve') {
    const programIndex = args.indexOf('--program');
    if (programIndex < 0) fail('PROGRAM_ID_REQUIRED');
    const item = resolve(registry, args[programIndex + 1]);
    console.log('ROADMAP_RESOLVE=PASS');
    console.log(`PROGRAM_ID=${item.programId}`);
    console.log(`ROADMAP_PATH=${item.roadmapPath}`);
    return;
  }
  fail('USAGE', 'usage: core.mjs check|resolve|self-test');
}

try {
  main();
} catch (error) {
  console.error('ROADMAP_PROGRAM_REGISTRY=FAIL');
  console.error(`REASON=${error.code ?? 'UNEXPECTED'}`);
  if (error.message && error.message !== error.code) console.error(`DETAIL=${error.message}`);
  process.exit(1);
}
