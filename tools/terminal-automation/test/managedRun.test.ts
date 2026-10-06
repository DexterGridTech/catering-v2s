import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {createManagedRun, persistManagedRun} from '../src/managedRun.js';

const roots: string[] = [];
const execution = Object.freeze({phase: 'journey', platform: 'web', shape: 'mobile', case: 'normal', age: 'empty'});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});
});

describe('createManagedRun', () => {
  it('writes a private manifest below the repository runtime root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(root, execution, 'run-1');
    const file = path.join(root, '.runtime/terminal-automation/run-1/run-manifest.json');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(manifest);
    expect(manifest.kind).toBe('terminal-automation-run-manifest');
    expect(manifest.owner.pid).toBe(process.pid);
    expect(manifest.owner.pgid).toBeGreaterThan(0);
    expect(manifest.owner.startToken.length).toBeGreaterThan(0);
    expect(manifest.processes).toEqual([manifest.owner]);
  });

  it('rejects a runtime symlink that escapes the repository', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const outside = mkdtempSync(path.join(tmpdir(), 'terminal-automation-outside-'));
    roots.push(outside);
    symlinkSync(outside, path.join(root, '.runtime'));
    expect(() => createManagedRun(root, execution, 'run-1')).toThrow('TERMINAL_AUTOMATION_RUNTIME_ROOT_INVALID');
  });

  it('rejects a run-root symlink before creating anything outside the repository runtime', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const outside = mkdtempSync(path.join(tmpdir(), 'terminal-automation-outside-'));
    roots.push(outside);
    mkdirSync(path.join(root, '.runtime'));
    symlinkSync(outside, path.join(root, '.runtime/terminal-automation'));

    expect(() => createManagedRun(root, execution, 'run-1')).toThrow('TERMINAL_AUTOMATION_RUN_ROOT_INVALID');
    expect(readdirSync(outside)).toEqual([]);
  });

  it('rejects a pre-existing run identity symlink instead of following it', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const outside = mkdtempSync(path.join(tmpdir(), 'terminal-automation-outside-'));
    roots.push(outside);
    mkdirSync(path.join(root, '.runtime/terminal-automation'), {recursive: true});
    symlinkSync(outside, path.join(root, '.runtime/terminal-automation/run-1'));

    expect(() => createManagedRun(root, execution, 'run-1')).toThrow('TERMINAL_AUTOMATION_RUN_IDENTITY_ALREADY_EXISTS');
    expect(readdirSync(outside)).toEqual([]);
    expect(existsSync(path.join(outside, 'run-manifest.json'))).toBe(false);
  });

  it('rejects unsafe run identities before creating files', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    mkdirSync(path.join(root, '.runtime'));
    expect(() => createManagedRun(root, execution, '../escape')).toThrow('TERMINAL_AUTOMATION_RUN_ID_INVALID');
  });

  it('atomically persists stage, business, cleanup, and first failure changes', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(root, execution, 'run-1');
    const next = Object.freeze({
      ...manifest,
      stage: 'FINISHED',
      business: 'FAIL' as const,
      cleanup: 'PASS' as const,
      firstFailure: 'JOURNEY_ASSERTION_FAILED',
    });
    persistManagedRun(root, next);

    const saved = JSON.parse(
      readFileSync(path.join(root, '.runtime/terminal-automation/run-1/run-manifest.json'), 'utf8'),
    );
    expect(saved).toMatchObject({
      stage: 'FINISHED',
      business: 'FAIL',
      cleanup: 'PASS',
      firstFailure: 'JOURNEY_ASSERTION_FAILED',
    });
    expect(Date.parse(saved.updatedAt)).toBeGreaterThanOrEqual(Date.parse(manifest.updatedAt));
  });

  it('does not overwrite a manifest symlink outside the run root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const outside = mkdtempSync(path.join(tmpdir(), 'terminal-automation-outside-'));
    roots.push(outside);
    const manifest = createManagedRun(root, execution, 'run-1');
    const outsideManifest = path.join(outside, 'run-manifest.json');
    writeFileSync(outsideManifest, 'outside sentinel');
    const runManifestPath = path.join(root, '.runtime/terminal-automation/run-1/run-manifest.json');
    unlinkSync(runManifestPath);
    symlinkSync(outsideManifest, runManifestPath);

    expect(() => persistManagedRun(root, manifest)).toThrow('TERMINAL_AUTOMATION_MANIFEST_PATH_INVALID');
    expect(readFileSync(outsideManifest, 'utf8')).toBe('outside sentinel');
  });
});
