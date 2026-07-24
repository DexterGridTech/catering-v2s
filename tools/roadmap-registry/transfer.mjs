#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const siblingAllV2 = path.resolve(repoRoot, '..', 'catering-all-v2');
const paths = {
  registry: 'doc/platform/roadmap-program-registry.json',
  roadmap: 'doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md',
  receipt: 'doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json',
  adoptedSnapshot: 'doc/evidence/platform/2026-07-24-v2s-roadmap-adopted-snapshot.md',
  heritage: 'doc/heritage/registry.json',
  implementationClosure: 'doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json',
};

class TransferError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new TransferError(code, message);
}

function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail('JSON_INVALID', `${file}: ${error.message}`);
  }
}

function assertFile(root, relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) fail('FILE_MISSING', relative);
  return file;
}

function registryEntry(root) {
  const registry = readJson(assertFile(root, paths.registry));
  if (registry?.schemaVersion !== 1 || registry?.kind !== 'roadmap-program-registry') fail('REGISTRY_INVALID');
  const matches = registry.programs?.filter((item) => item.programId === 'V2S_W0_W4_EXECUTION') ?? [];
  if (matches.length !== 1) fail('PROGRAM_OWNER_COUNT_INVALID');
  if (registry.programs.some((item) => item.programId === 'AI_FIRST_FOUNDATION')) fail('OLD_PROGRAM_STATE_FORBIDDEN');
  return { registry, entry: matches[0] };
}

function verifyHeritage(root, expectedHash) {
  const file = assertFile(root, paths.heritage);
  if (shaFile(file) !== expectedHash) fail('HERITAGE_HASH_MISMATCH');
  const heritage = readJson(file);
  if (!Array.isArray(heritage.repositories) || heritage.repositories.length !== 4) fail('HERITAGE_REPOSITORIES_INVALID');
  for (const item of heritage.repositories) {
    if (item.writeBack !== false || item.runtimeFallback !== false || item.buildFallback !== false) fail('HERITAGE_WRITE_OR_FALLBACK');
  }
}

function verifyCommon(root, receipt) {
  if (receipt?.schemaVersion !== 1 || receipt?.kind !== 'roadmap-control-plane-transfer') fail('RECEIPT_HEADER_INVALID');
  if (receipt.programId !== 'V2S_W0_W4_EXECUTION') fail('PROGRAM_ID_MISMATCH');
  if (receipt.source?.repository !== 'catering-all-v2' || receipt.source?.path !== paths.roadmap) fail('SOURCE_IDENTITY_INVALID');
  if (receipt.target?.repository !== 'catering-v2s' || receipt.target?.path !== paths.roadmap) fail('TARGET_IDENTITY_INVALID');
  if (receipt.target?.adoptedSnapshotPath !== paths.adoptedSnapshot) fail('TARGET_SNAPSHOT_IDENTITY_INVALID');
  if (receipt.target.gitHead !== '5b083504f6687ca6be832171c79a4e1234078937') fail('TARGET_BASELINE_HEAD_INVALID');
  if (receipt.target.worktree !== 'DIRTY_R1_AUTHORIZED_UNCOMMITTED') fail('TARGET_WORKTREE_HONESTY_INVALID');
  if (receipt.business !== 'PASS' || receipt.cleanup !== 'PASS' || receipt.activeManagedResources !== 0) fail('BUSINESS_OR_CLEANUP_INVALID');
  if ('transferredAt' in receipt) fail('TRANSFERRED_AT_FORBIDDEN_IN_CANDIDATE');
  const sourceFile = assertFile(siblingAllV2, receipt.source.path);
  if (shaFile(sourceFile) !== receipt.source.preparedSha256) fail('SOURCE_PREPARED_HASH_MISMATCH');
  const implementationFile = assertFile(root, receipt.implementationClosure.path);
  if (shaFile(implementationFile) !== receipt.implementationClosure.sha256) fail('IMPLEMENTATION_CLOSURE_HASH_MISMATCH');
  verifyHeritage(root, receipt.heritageRegistry.sha256);
  const snapshotFile = assertFile(root, receipt.target.adoptedSnapshotPath);
  if (shaFile(snapshotFile) !== receipt.target.adoptedSha256) fail('ADOPTED_SNAPSHOT_HASH_MISMATCH');
}

function verifyPrepared(root) {
  const { entry } = registryEntry(root);
  if (entry.activationState !== 'PREPARED_NON_AUTHORITATIVE') fail('PREPARED_REGISTRY_STATE_INVALID');
  const roadmap = fs.readFileSync(assertFile(root, paths.roadmap), 'utf8').split('## 1. 目标结果')[0];
  for (const marker of ['CURRENT_STEP=R1', 'CURRENT_STATUS=EVIDENCE_READY', 'V2S_SESSION_ENTRY_READY=false']) {
    if (!roadmap.includes(marker)) fail('PREPARED_ROADMAP_STATE_INVALID', marker);
  }
  if (roadmap.includes('R1_STATUS=GO')) fail('PREPARED_FALSE_GO');
  const receipt = readJson(assertFile(root, paths.receipt));
  if (receipt.phase !== 'PREPARED') fail('PREPARED_RECEIPT_PHASE_INVALID');
  verifyCommon(root, receipt);
  console.log('ROADMAP_CONTROL_PLANE_TRANSFER_PREPARE=PASS');
}

function verifyCandidate(candidateRoot, currentRoot = repoRoot) {
  const current = registryEntry(currentRoot);
  if (current.entry.activationState !== 'PREPARED_NON_AUTHORITATIVE') fail('CURRENT_REGISTRY_NOT_PREPARED');
  const { entry } = registryEntry(candidateRoot);
  if (entry.activationState !== 'ACTIVE') fail('CANDIDATE_REGISTRY_NOT_ACTIVE');
  const receipt = readJson(assertFile(candidateRoot, paths.receipt));
  if (receipt.phase !== 'CANDIDATE_VERIFIED') fail('CANDIDATE_RECEIPT_PHASE_INVALID');
  verifyCommon(candidateRoot, receipt);
  const roadmapFile = assertFile(candidateRoot, paths.roadmap);
  const registryFile = assertFile(candidateRoot, paths.registry);
  if (shaFile(roadmapFile) !== receipt.target.adoptedSha256) fail('TARGET_ADOPTED_HASH_MISMATCH');
  if (shaFile(registryFile) !== receipt.expectedActiveRegistryHash) fail('EXPECTED_ACTIVE_REGISTRY_HASH_MISMATCH');
  const roadmap = fs.readFileSync(roadmapFile, 'utf8').split('## 1. 目标结果')[0];
  for (const marker of [
    'LAST_CLOSED_STEP=R1',
    'CURRENT_STEP=R2',
    'CURRENT_STATUS=IN_REVIEW',
    'R1_STATUS=GO',
    'V2S_SESSION_ENTRY_READY=true',
  ]) {
    if (!roadmap.includes(marker)) fail('CANDIDATE_CONTINUITY_INVALID', marker);
  }
  console.log('ROADMAP_CONTROL_PLANE_TRANSFER_CANDIDATE=PASS');
}

function verifyActive(root) {
  const { entry } = registryEntry(root);
  if (entry.activationState !== 'ACTIVE') fail('ACTIVE_REGISTRY_STATE_INVALID');
  const receipt = readJson(assertFile(root, paths.receipt));
  if (receipt.phase !== 'CANDIDATE_VERIFIED') fail('ACTIVE_RECEIPT_PHASE_INVALID');
  verifyCommon(root, receipt);
  if (shaFile(assertFile(root, paths.registry)) !== receipt.expectedActiveRegistryHash) fail('ACTIVE_REGISTRY_HASH_MISMATCH');
  const roadmap = fs.readFileSync(assertFile(root, paths.roadmap), 'utf8').split('## 1. 目标结果')[0];
  for (const marker of ['roadmapId: v2s-w0-w4-execution', 'programId: V2S_W0_W4_EXECUTION', 'stateOwner: self', 'R1_STATUS=GO', 'V2S_SESSION_ENTRY_READY=true']) {
    if (!roadmap.includes(marker)) fail('ACTIVE_CONTINUITY_INVALID', marker);
  }
  const currentStep = roadmap.match(/^CURRENT_STEP=(R[2-6])$/mu)?.[1];
  if (!currentStep) fail('ACTIVE_CURRENT_STEP_INVALID');
  console.log('ROADMAP_CONTROL_PLANE_TRANSFER=PASS');
  console.log('ROADMAP_OWNER=doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md');
  console.log('LAST_CLOSED_STEP_AT_LEAST=R1');
  console.log(`CURRENT_STEP=${currentStep}`);
}

function selfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-transfer-'));
  try {
    const current = path.join(temp, 'current');
    const candidate = path.join(temp, 'candidate');
    for (const root of [current, candidate]) {
      for (const relative of Object.values(paths)) fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    }
    const preparedRegistry = {
      schemaVersion: 1,
      kind: 'roadmap-program-registry',
      programs: [{
        programId: 'V2S_W0_W4_EXECUTION',
        roadmapId: 'v2s-w0-w4-execution',
        programKind: 'SUCCESSOR_EXECUTION',
        activationState: 'PREPARED_NON_AUTHORITATIVE',
        roadmapPath: paths.roadmap,
        stateOwnerPath: paths.roadmap,
        authorizationOwnerPath: paths.roadmap,
        batchIds: [],
      }],
    };
    const activeRegistry = structuredClone(preparedRegistry);
    activeRegistry.programs[0].activationState = 'ACTIVE';
    fs.writeFileSync(path.join(current, paths.registry), `${JSON.stringify(preparedRegistry, null, 2)}\n`);
    fs.writeFileSync(path.join(candidate, paths.registry), `${JSON.stringify(activeRegistry, null, 2)}\n`);
    fs.writeFileSync(path.join(current, paths.roadmap), 'CURRENT_STEP=R1\nCURRENT_STATUS=EVIDENCE_READY\nV2S_SESSION_ENTRY_READY=false\n');
    fs.writeFileSync(path.join(candidate, paths.roadmap), 'roadmapId: v2s-w0-w4-execution\nprogramId: V2S_W0_W4_EXECUTION\nstateOwner: self\nLAST_CLOSED_STEP=R1\nCURRENT_STEP=R2\nCURRENT_STATUS=IN_REVIEW\nR1_STATUS=GO\nV2S_SESSION_ENTRY_READY=true\n');
    const heritage = { repositories: Array.from({ length: 4 }, (_, index) => ({ repositoryId: `r${index}`, writeBack: false, runtimeFallback: false, buildFallback: false })) };
    const closure = { business: 'PASS', cleanup: 'PASS' };
    for (const root of [current, candidate]) {
      fs.writeFileSync(path.join(root, paths.heritage), `${JSON.stringify(heritage)}\n`);
      fs.writeFileSync(path.join(root, paths.implementationClosure), `${JSON.stringify(closure)}\n`);
    }
    // The production source hash is checked separately; these structural fixtures exercise publication states.
    const common = {
      schemaVersion: 1,
      kind: 'roadmap-control-plane-transfer',
      phase: 'CANDIDATE_VERIFIED',
      programId: 'V2S_W0_W4_EXECUTION',
      source: { repository: 'catering-all-v2', path: paths.roadmap, preparedSha256: '0'.repeat(64) },
      target: {
        repository: 'catering-v2s',
        path: paths.roadmap,
        adoptedSnapshotPath: paths.adoptedSnapshot,
        adoptedSha256: shaFile(path.join(candidate, paths.roadmap)),
        gitHead: '5b083504f6687ca6be832171c79a4e1234078937',
        worktree: 'DIRTY_R1_AUTHORIZED_UNCOMMITTED',
      },
      expectedActiveRegistryHash: shaFile(path.join(candidate, paths.registry)),
      implementationClosure: { path: paths.implementationClosure, sha256: shaFile(path.join(candidate, paths.implementationClosure)) },
      heritageRegistry: { path: paths.heritage, sha256: shaFile(path.join(candidate, paths.heritage)) },
      business: 'PASS',
      cleanup: 'PASS',
      activeManagedResources: 0,
    };
    for (const root of [current, candidate]) {
      fs.copyFileSync(path.join(candidate, paths.roadmap), path.join(root, paths.adoptedSnapshot));
    }
    fs.writeFileSync(path.join(candidate, paths.receipt), `${JSON.stringify(common, null, 2)}\n`);
    const savedSibling = common.source.preparedSha256;
    common.source.preparedSha256 = shaFile(assertFile(siblingAllV2, paths.roadmap));
    fs.writeFileSync(path.join(candidate, paths.receipt), `${JSON.stringify(common, null, 2)}\n`);
    verifyCandidate(candidate, current);
    fs.copyFileSync(path.join(candidate, paths.roadmap), path.join(current, paths.roadmap));
    fs.copyFileSync(path.join(candidate, paths.receipt), path.join(current, paths.receipt));
    try { verifyActive(current); fail('PREPARED_OWNER_UNEXPECTEDLY_ACTIVE'); } catch (error) {
      if (error.code !== 'ACTIVE_REGISTRY_STATE_INVALID') throw error;
    }
    fs.copyFileSync(path.join(candidate, paths.registry), path.join(current, paths.registry));
    verifyActive(current);
    fs.writeFileSync(path.join(current, paths.roadmap), 'roadmapId: v2s-w0-w4-execution\nprogramId: V2S_W0_W4_EXECUTION\nstateOwner: self\nLAST_CLOSED_STEP=R2\nCURRENT_STEP=R3\nR1_STATUS=GO\nV2S_SESSION_ENTRY_READY=true\n');
    verifyActive(current);
    fs.appendFileSync(path.join(current, paths.adoptedSnapshot), 'drift\n');
    try { verifyActive(current); fail('SNAPSHOT_DRIFT_UNEXPECTEDLY_PASSED'); } catch (error) {
      if (error.code !== 'ADOPTED_SNAPSHOT_HASH_MISMATCH') throw error;
    }
    fs.copyFileSync(path.join(candidate, paths.registry), path.join(current, paths.registry));
    const restored = structuredClone(preparedRegistry);
    fs.writeFileSync(path.join(current, paths.registry), `${JSON.stringify(restored, null, 2)}\n`);
    try { verifyActive(current); fail('ROLLBACK_OWNER_UNEXPECTEDLY_ACTIVE'); } catch (error) {
      if (error.code !== 'ACTIVE_REGISTRY_STATE_INVALID') throw error;
    }
    console.log('ROADMAP_CONTROL_PLANE_TRANSFER_SELF_TEST=PASS');
    console.log('PREPARED_RESOLVER_RED=PASS');
    console.log('LEGAL_R2_ADVANCE_GREEN=PASS');
    console.log('ADOPTED_SNAPSHOT_DRIFT_RED=PASS');
    console.log('REGISTRY_FIRST_ROLLBACK_RED=PASS');
    void savedSibling;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  if (args.includes('--prepare')) return verifyPrepared(repoRoot);
  const candidateIndex = args.indexOf('--candidate-root');
  if (candidateIndex >= 0) {
    const candidateRoot = path.resolve(process.cwd(), args[candidateIndex + 1]);
    return verifyCandidate(candidateRoot);
  }
  return verifyActive(repoRoot);
}

try {
  main();
} catch (error) {
  console.error('ROADMAP_CONTROL_PLANE_TRANSFER=FAIL');
  console.error(`REASON=${error.code ?? 'UNEXPECTED'}`);
  if (error.message && error.message !== error.code) console.error(`DETAIL=${error.message}`);
  process.exit(1);
}
