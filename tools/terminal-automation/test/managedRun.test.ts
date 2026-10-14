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
import {
  attachAndroidDeviceIdentity,
  createManagedRun,
  markManagedRunCheckpoint,
  markManagedRunFailure,
  persistManagedRun,
} from '../src/managedRun.js';

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
    expect(manifest.lastKnownGood).toBeNull();
    expect(manifest.brokenBoundary).toBeNull();
  });

  it('records both explicitly named pair devices with their MASTER and SLAVE roles', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(
      root,
      Object.freeze({
        phase: 'update',
        platform: 'android',
        shape: 'mobile',
        case: 'update.pair',
        sample: 'console',
        deviceSerial: 'emulator-master',
        peerDeviceSerial: 'emulator-slave',
      }),
      'pair-run',
    );

    expect(manifest.androidDevices).toEqual([
      {serial: 'emulator-master', role: 'PAIR_MASTER_EMULATOR'},
      {serial: 'emulator-slave', role: 'PAIR_SLAVE_EMULATOR'},
    ]);
  });

  it('records remote topology and assigns its explicit device roles', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(
      root,
      Object.freeze({
        phase: 'remote',
        platform: 'android',
        shape: 'dual',
        remoteTopology: 'laptop-paired',
        case: 'remote.main',
        sample: 'console',
        deviceSerial: 'emulator-master',
        peerDeviceSerial: 'emulator-slave',
      }),
      'remote-pair-run',
    );

    expect(manifest.execution.remoteTopology).toBe('laptop-paired');
    expect(manifest.androidDevices).toEqual([
      {serial: 'emulator-master', role: 'PAIR_MASTER_EMULATOR'},
      {serial: 'emulator-slave', role: 'PAIR_SLAVE_EMULATOR'},
    ]);
    const masterIdentity = Object.freeze({
      kind: 'emulator' as const, model: 'Android VM master', product: 'sdk_phone64_arm64', device: 'emu64a', hardware: 'ranchu', qemu: '1' as const,
    });
    const peerIdentity = Object.freeze({
      kind: 'emulator' as const, model: 'Android VM peer', product: 'sdk_phone64_arm64', device: 'emu64a', hardware: 'ranchu', qemu: '1' as const,
    });
    const withMasterIdentity = attachAndroidDeviceIdentity(manifest, 'emulator-master', masterIdentity);
    const withBothIdentities = attachAndroidDeviceIdentity({...manifest, androidDevices: withMasterIdentity}, 'emulator-slave', peerIdentity);
    expect(withBothIdentities).toEqual([
      {serial: 'emulator-master', role: 'PAIR_MASTER_EMULATOR', identity: masterIdentity},
      {serial: 'emulator-slave', role: 'PAIR_SLAVE_EMULATOR', identity: peerIdentity},
    ]);
    expect(manifest.diagnostics).toBe('NOT_RUN');
  });

  it('fails closed when either explicitly paired device is not verified as an emulator', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(
      root,
      Object.freeze({
        phase: 'remote',
        platform: 'android',
        shape: 'dual',
        remoteTopology: 'laptop-paired',
        case: 'remote.main',
        sample: 'console',
        deviceSerial: 'emulator-master',
        peerDeviceSerial: 'emulator-slave',
      }),
      'remote-pair-kind-run',
    );
    const physical = Object.freeze({
      kind: 'physical' as const, model: 'phone', product: 'phone', device: 'phone', hardware: 'board', qemu: '0' as const,
    });
    const unknown = Object.freeze({
      kind: 'unknown' as const, model: 'UNKNOWN', product: 'UNKNOWN', device: 'UNKNOWN', hardware: 'UNKNOWN', qemu: 'unknown' as const,
    });

    expect(() => attachAndroidDeviceIdentity(manifest, 'emulator-master', physical)).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_PAIR_DEVICE_NOT_EMULATOR',
    );
    expect(() => attachAndroidDeviceIdentity(manifest, 'emulator-slave', unknown)).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_PAIR_DEVICE_NOT_EMULATOR',
    );
  });

  it('refuses remote manifests that lack their exact topology and device identity', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);

    expect(() => createManagedRun(root, Object.freeze({
      phase: 'remote', platform: 'android', shape: 'dual', case: 'remote.main', sample: 'console',
      deviceSerial: 'device-one',
    }), 'remote-missing-topology')).toThrow('TERMINAL_AUTOMATION_REMOTE_TOPOLOGY_IDENTITY_INVALID');
    expect(existsSync(path.join(root, '.runtime/terminal-automation/remote-missing-topology'))).toBe(false);
  });

  it('rejects pair manifests without two distinct device identities before creating a run root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);

    expect(() =>
      createManagedRun(
        root,
        Object.freeze({
          phase: 'update',
          platform: 'android',
          shape: 'mobile',
          case: 'update.pair',
          sample: 'console',
          deviceSerial: 'emulator-master',
        }),
        'pair-run',
      ),
    ).toThrow('TERMINAL_AUTOMATION_UPDATE_PAIR_DEVICE_IDENTITY_INVALID');
    expect(existsSync(path.join(root, '.runtime/terminal-automation/pair-run'))).toBe(false);
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
      ...markManagedRunFailure(markManagedRunCheckpoint(manifest, 'business'), 'JOURNEY_ASSERTION_FAILED', 'test-execution'),
      stage: 'FINISHED',
      business: 'FAIL' as const,
      cleanup: 'PASS' as const,
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
      lastKnownGood: 'business',
      brokenBoundary: 'test-execution',
    });
    expect(Date.parse(saved.updatedAt)).toBeGreaterThanOrEqual(Date.parse(manifest.updatedAt));
  });

  it('retains the last successful boundary and records the first failed boundary', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(root, execution, 'run-progress');
    const preflight = markManagedRunCheckpoint(manifest, 'resource-preflight');
    const failed = markManagedRunFailure(preflight, 'VITEST_EXIT_1', 'test-execution');
    const laterFailure = markManagedRunFailure(failed, 'CLEANUP_FAILED', 'cleanup');

    expect(laterFailure).toMatchObject({
      lastKnownGood: 'resource-preflight',
      firstFailure: 'VITEST_EXIT_1',
      brokenBoundary: 'test-execution',
    });
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

describe('managed Android device identity', () => {
  it('records the verified physical kind and corrects the mobile topology role', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(root, Object.freeze({
      phase: 'remote', platform: 'android', shape: 'mobile', remoteTopology: 'mobile-single',
      case: 'remote.main', sample: 'console', deviceSerial: 'physical-serial',
    }), 'physical-remote-run');
    const identity = Object.freeze({
      kind: 'physical' as const, model: 'Z3', product: 'D3', device: 'D3', hardware: 'mt6895', qemu: '0' as const,
    });

    expect(manifest.androidDevices).toEqual([{serial: 'physical-serial', role: 'MOBILE_UNKNOWN'}]);
    expect(attachAndroidDeviceIdentity(manifest, 'physical-serial', identity)).toEqual([
      {serial: 'physical-serial', role: 'MOBILE_PHYSICAL', identity},
    ]);
  });

  it('rejects an identity that does not match one manifest device', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-'));
    roots.push(root);
    const manifest = createManagedRun(root, Object.freeze({
      phase: 'remote', platform: 'android', shape: 'mobile', remoteTopology: 'mobile-single',
      case: 'remote.main', sample: 'console', deviceSerial: 'physical-serial',
    }), 'physical-remote-run');
    const identity = Object.freeze({
      kind: 'unknown' as const, model: 'UNKNOWN', product: 'UNKNOWN', device: 'UNKNOWN', hardware: 'UNKNOWN',
      qemu: 'unknown' as const,
    });

    expect(() => attachAndroidDeviceIdentity(manifest, 'other-serial', identity)).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_MANIFEST_DEVICE_IDENTITY_INVALID',
    );
  });
});
