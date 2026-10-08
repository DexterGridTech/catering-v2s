import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {androidAutomationBuildIdentity} from '../src/androidBuild.ts';
import {
  cleanupFailedAndroidRunReverses,
  cleanupFailedAndroidRunPackage,
  parseAndroidReverseList,
  resolveFailedAndroidRunCleanupTarget,
} from '../src/androidCleanupRecovery.ts';

const runId = 'c64953f5-b15c-4a77-b26a-8686f6031017';

const writeSourceManifest = (root: string, overrides: Record<string, unknown> = {}): void => {
  const directory = path.join(root, '.runtime/terminal-automation', runId);
  mkdirSync(directory, {recursive: true});
  writeFileSync(
    path.join(directory, 'run-manifest.json'),
    JSON.stringify({
      kind: 'terminal-automation-run-manifest',
      runId,
      cleanup: 'FAIL',
      androidPackageId: androidAutomationBuildIdentity(runId, 'console').packageId,
      processes: [{pid: 999_991, startToken: 'old-run-process'}],
      execution: {
        phase: 'update',
        platform: 'android',
        shape: 'mobile',
        case: 'update.offline-assets',
        sample: 'console',
        deviceSerial: 'emulator-5560',
      },
      ...overrides,
    }),
  );
  writeFileSync(path.join(directory, 'events.jsonl'), '');
  writeFileSync(path.join(directory, 'runner.log'), '');
};

describe('failed Android run cleanup recovery guard', () => {
  it('resolves only the exact failed managed run package and device', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ter-android-cleanup-'));
    try {
      writeSourceManifest(root);
      expect(resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', [])).toEqual({
        runId,
        packageId: androidAutomationBuildIdentity(runId, 'console').packageId,
        serial: 'emulator-5560',
        sample: 'console',
        shape: 'mobile',
        reverses: [],
        legacyRecoverableRemotes: [],
      });
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it('allows the managed interruption case but still rejects unregistered cases', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ter-android-cleanup-'));
    try {
      writeSourceManifest(root, {
        execution: {
          phase: 'update',
          platform: 'android',
          shape: 'dual',
          case: 'update.interruption',
          sample: 'console',
          deviceSerial: 'emulator-5560',
        },
      });
      expect(resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', []).shape).toBe('dual');
      writeSourceManifest(root, {
        execution: {
          phase: 'update',
          platform: 'android',
          shape: 'dual',
          case: 'update.unregistered',
          sample: 'console',
          deviceSerial: 'emulator-5560',
        },
      });
      expect(() => resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', [])).toThrow(
        'TERMINAL_AUTOMATION_RECOVERY_SOURCE_IDENTITY_MISMATCH',
      );
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it('rejects a different device, installed-package identity, nonfailed run, and live owner process', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ter-android-cleanup-'));
    try {
      writeSourceManifest(root);
      expect(() => resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5554', [])).toThrow(
        'TERMINAL_AUTOMATION_RECOVERY_SOURCE_IDENTITY_MISMATCH',
      );
      expect(() =>
        resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', [
          {pid: 999_991, startToken: 'old-run-process'},
        ]),
      ).toThrow('TERMINAL_AUTOMATION_RECOVERY_SOURCE_RUN_STILL_ACTIVE');
      writeSourceManifest(root, {cleanup: 'PASS'});
      expect(() => resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', [])).toThrow(
        'TERMINAL_AUTOMATION_RECOVERY_SOURCE_NOT_RECOVERABLE',
      );
      writeSourceManifest(root, {androidPackageId: 'com.example.unowned'});
      expect(() => resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', [])).toThrow(
        'TERMINAL_AUTOMATION_RECOVERY_SOURCE_IDENTITY_MISMATCH',
      );
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it('removes only the verified package and requires absent readback on the same device', async () => {
    const target = {
      runId,
      packageId: androidAutomationBuildIdentity(runId, 'console').packageId,
      serial: 'emulator-5560',
      sample: 'console' as const,
      shape: 'mobile' as const,
      reverses: [],
      legacyRecoverableRemotes: [],
    };
    const calls: string[] = [];
    let installed = true;
    await expect(
      cleanupFailedAndroidRunPackage(target, {
        deviceSerial: 'emulator-5560',
        isInstalled: async packageId => {
          calls.push(`read:${packageId}`);
          return installed;
        },
        forceStop: async packageId => {
          calls.push(`stop:${packageId}`);
        },
        uninstall: async packageId => {
          calls.push(`uninstall:${packageId}`);
          installed = false;
        },
      }),
    ).resolves.toEqual({wasInstalled: true, isAbsent: true});
    expect(calls).toEqual([
      `read:${target.packageId}`,
      `stop:${target.packageId}`,
      `uninstall:${target.packageId}`,
      `read:${target.packageId}`,
    ]);

    await expect(
      cleanupFailedAndroidRunPackage(target, {
        deviceSerial: 'emulator-5554',
        isInstalled: async () => false,
        forceStop: async () => undefined,
        uninstall: async () => undefined,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_RECOVERY_DEVICE_IDENTITY_MISMATCH');
  });

  it('parses ADB reverse rows and rejects malformed output', () => {
    expect(parseAndroidReverseList('host-17 tcp:19090 tcp:19123\nhost-17 tcp:28080 tcp:28080\n')).toEqual([
      {remote: 'tcp:19090', local: 'tcp:19123'},
      {remote: 'tcp:28080', local: 'tcp:28080'},
    ]);
    expect(() => parseAndroidReverseList('host-17 tcp:19090 tcp:70000')).toThrow(
      'TERMINAL_AUTOMATION_RECOVERY_REVERSE_LIST_INVALID',
    );
  });

  it('recovers only an inactive, source-owned driver reverse and requires device readback', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ter-android-reverse-recovery-'));
    try {
      const sourceLog = path.join(root, '.runtime/terminal-automation', runId, 'runner.log');
      writeSourceManifest(root, {
        managedDev: {runId: 'r5-dev-fixture', manifestSha256: 'a'.repeat(64)},
      });
      writeFileSync(
        sourceLog,
        `TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=ui.system.wait-button.complete\nTERMINAL_AUTOMATION_UPDATE_NATIVE_LOG run=${runId} I/TerminalUpdate( 1): event=installer-callback status=-1\n`,
      );
      const target = resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', []);
      expect(target.legacyRecoverableRemotes).toEqual(['tcp:19090', 'tcp:28080', 'tcp:28180', 'tcp:28181']);
      const mappings = [
        {remote: 'tcp:19090', local: 'tcp:19123'},
        {remote: 'tcp:28080', local: 'tcp:19124'},
        {remote: 'tcp:28180', local: 'tcp:19125'},
        {remote: 'tcp:28181', local: 'tcp:19126'},
        {remote: 'tcp:12345', local: 'tcp:12345'},
      ];
      const remove = vi.fn(async (remote: string) => {
        const index = mappings.findIndex(value => value.remote === remote);
        if (index >= 0) mappings.splice(index, 1);
      });
      await expect(
        cleanupFailedAndroidRunReverses(target, {
          deviceSerial: 'emulator-5560',
          list: async () => [...mappings],
          isLocalPortListening: async () => false,
          remove,
        }),
      ).resolves.toEqual({
        removed: ['tcp:19090', 'tcp:28080', 'tcp:28180', 'tcp:28181'],
        readback: 'ABSENT',
      });
      expect(remove).toHaveBeenCalledTimes(4);
      expect(mappings).toEqual([{remote: 'tcp:12345', local: 'tcp:12345'}]);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it('fails closed for an unowned mapping, a live local listener, or ambiguous remote rows', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ter-android-reverse-guard-'));
    try {
      writeSourceManifest(root);
      const target = resolveFailedAndroidRunCleanupTarget(root, runId, 'emulator-5560', []);
      const remove = vi.fn(async () => undefined);
      const base = {
        deviceSerial: 'emulator-5560',
        isLocalPortListening: async () => false,
        remove,
      };
      await expect(
        cleanupFailedAndroidRunReverses(target, {
          ...base,
          list: async () => [{remote: 'tcp:19090', local: 'tcp:19123'}],
        }),
      ).rejects.toThrow('TERMINAL_AUTOMATION_RECOVERY_REVERSE_OWNER_UNVERIFIED');
      await expect(
        cleanupFailedAndroidRunReverses(
          {...target, legacyRecoverableRemotes: ['tcp:19090']},
          {
            ...base,
            list: async () => [{remote: 'tcp:19090', local: 'tcp:19123'}],
            isLocalPortListening: async () => true,
          },
        ),
      ).rejects.toThrow('TERMINAL_AUTOMATION_RECOVERY_REVERSE_LOCAL_OWNER_ACTIVE');
      await expect(
        cleanupFailedAndroidRunReverses(
          {...target, legacyRecoverableRemotes: ['tcp:19090']},
          {
            ...base,
            list: async () => [
              {remote: 'tcp:19090', local: 'tcp:19123'},
              {remote: 'tcp:19090', local: 'tcp:19124'},
            ],
          },
        ),
      ).rejects.toThrow('TERMINAL_AUTOMATION_RECOVERY_REVERSE_READBACK_AMBIGUOUS');
      expect(remove).not.toHaveBeenCalled();
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
});
