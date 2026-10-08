import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  cleanupManagedRunArtifacts,
  cleanupRunOwnedDirectoryLink,
  assertNoAndroidIntermediateOutputs,
  isManagedDevHttpBaseUrl,
  parseAutomationRunArguments,
  resolveAutomationSuite,
  createAndroidDeviceCleanupTracker,
  selectManagedTerminalBrowserOrigin,
  updateRequiresManagedDev,
  updateCaseImplemented,
  updateScenarioAssertionsObserved,
} from '../src/runner.ts';
import journeyConfig from '../vitest.journeys.config.ts';
import unitConfig from '../vitest.config.ts';

describe('Vitest execution boundary', () => {
  it('keeps unmanaged package tests separate from driver-selected journeys', () => {
    expect(unitConfig.test?.include).toEqual(['test/**/*.test.ts']);
    expect(journeyConfig.test?.include).toEqual(['journeys/**/*.test.ts']);
  });
});

describe('managed Android cleanup result', () => {
  it('keeps stdout and stderr marker fragments separate and fails on a split cleanup marker', () => {
    const cleanup = createAndroidDeviceCleanupTracker();
    cleanup.accept('stdout', 'TERMINAL_AUTOMATION_DEVICE_');
    cleanup.accept('stderr', 'ordinary Vitest output');
    cleanup.accept('stdout', 'CLEANUP_FAILED:ANDROID_REVERSE');
    expect(cleanup.finish()).toBe('FAIL');
  });

  it('requires an explicit device cleanup completion signal and leaves interruption unknown', () => {
    const interrupted = createAndroidDeviceCleanupTracker();
    expect(interrupted.finish()).toBe('UNKNOWN');

    const completed = createAndroidDeviceCleanupTracker();
    completed.accept('stdout', 'TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
    expect(completed.finish()).toBe('PASS');
  });

  it('lets any device cleanup failure override a completion signal', () => {
    const cleanup = createAndroidDeviceCleanupTracker();
    cleanup.accept('stdout', 'TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
    cleanup.accept('stderr', 'TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:REVERSE');
    expect(cleanup.finish()).toBe('FAIL');
  });
});

describe('run-owned generated artifact cleanup', () => {
  it('fails cleanup when Android Gradle intermediates remain outside the run directory', () => {
    const terminalRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-android-output-audit-'));
    try {
      const escapedOutput = path.join(terminalRoot, 'node_modules/example/android/.cxx');
      mkdirSync(escapedOutput, {recursive: true});
      expect(() => assertNoAndroidIntermediateOutputs(terminalRoot)).toThrow(
        'TERMINAL_AUTOMATION_ANDROID_INTERMEDIATE_OUTSIDE_RUN',
      );
      rmSync(escapedOutput, {recursive: true});
      expect(() => assertNoAndroidIntermediateOutputs(terminalRoot)).not.toThrow();
    } finally {
      rmSync(terminalRoot, {recursive: true, force: true});
    }
  });

  it('fails cleanup when an Android build or native staging path is a symlink', () => {
    const terminalRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-android-output-link-audit-'));
    const external = mkdtempSync(path.join(os.tmpdir(), 'ter-android-output-link-target-'));
    try {
      const androidRoot = path.join(terminalRoot, 'application/android/sample-terminal/android/app');
      const linkPath = path.join(androidRoot, '.cxx');
      mkdirSync(androidRoot, {recursive: true});
      writeFileSync(path.join(external, 'sentinel'), 'keep');
      symlinkSync(external, linkPath, 'dir');
      expect(() => assertNoAndroidIntermediateOutputs(terminalRoot)).toThrow(
        'TERMINAL_AUTOMATION_ANDROID_INTERMEDIATE_OUTSIDE_RUN',
      );
      expect(readFileSync(path.join(external, 'sentinel'), 'utf8')).toBe('keep');
    } finally {
      rmSync(terminalRoot, {recursive: true, force: true});
      rmSync(external, {recursive: true, force: true});
    }
  });

  it('detects stale regular Android build directories before a managed artifact run', () => {
    const terminalRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-android-stale-build-audit-'));
    try {
      const appBuild = path.join(terminalRoot, 'application/android/sample-terminal/android/build');
      const dependencyBuild = path.join(terminalRoot, 'node_modules/example/android/build');
      mkdirSync(appBuild, {recursive: true});
      mkdirSync(dependencyBuild, {recursive: true});
      writeFileSync(path.join(appBuild, 'generated.json'), '{}');
      writeFileSync(path.join(dependencyBuild, 'generated.java'), 'class Generated {}');

      expect(() => assertNoAndroidIntermediateOutputs(terminalRoot)).toThrow(
        'TERMINAL_AUTOMATION_ANDROID_INTERMEDIATE_OUTSIDE_RUN',
      );
      expect(existsSync(path.join(appBuild, 'generated.json'))).toBe(true);
      expect(existsSync(path.join(dependencyBuild, 'generated.java'))).toBe(true);
    } finally {
      rmSync(terminalRoot, {recursive: true, force: true});
    }
  });

  it('removes only the temporary Gradle settings link targeting this run root', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-gradle-build-link-'));
    try {
      const runRoot = path.join(temporaryRoot, 'run');
      const expectedTarget = path.join(runRoot, 'android-build/sample-terminal/root');
      const linkPath = path.join(temporaryRoot, 'app/android/build');
      mkdirSync(expectedTarget, {recursive: true});
      mkdirSync(path.dirname(linkPath), {recursive: true});
      symlinkSync(expectedTarget, linkPath, 'dir');
      expect(cleanupRunOwnedDirectoryLink(linkPath, expectedTarget)).toBe(true);
      expect(existsSync(linkPath)).toBe(false);
    } finally {
      rmSync(temporaryRoot, {recursive: true, force: true});
    }
  });

  it('fails closed and preserves a Gradle link that targets another run or owner', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-gradle-build-link-owner-'));
    try {
      const otherOwner = path.join(temporaryRoot, 'other-owner');
      const linkPath = path.join(temporaryRoot, 'app/android/build');
      mkdirSync(otherOwner, {recursive: true});
      mkdirSync(path.dirname(linkPath), {recursive: true});
      writeFileSync(path.join(otherOwner, 'sentinel'), 'keep');
      symlinkSync(otherOwner, linkPath, 'dir');
      expect(() =>
        cleanupRunOwnedDirectoryLink(linkPath, path.join(temporaryRoot, 'run/android-build/sample-terminal/root')),
      ).toThrow('TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_LINK_TARGET_MISMATCH');
      expect(readFileSync(path.join(otherOwner, 'sentinel'), 'utf8')).toBe('keep');
      expect(existsSync(linkPath)).toBe(true);
    } finally {
      rmSync(temporaryRoot, {recursive: true, force: true});
    }
  });

  it('removes build trees and bulky update outputs while retaining compact artifact reports', () => {
    const runDirectory = mkdtempSync(path.join(os.tmpdir(), 'ter-artifact-cleanup-'));
    const terminalRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-artifact-source-root-'));
    try {
      const apk = path.join(runDirectory, 'update/sample-terminal/sample-terminal.apk');
      const fullApk = path.join(runDirectory, 'update/sample-terminal/sample-terminal-full.apk');
      const zip = path.join(runDirectory, 'update/sample-terminal/sample-terminal-hot.zip');
      const metadata = path.join(runDirectory, 'update/sample-terminal/install.json');
      const bundle = path.join(runDirectory, 'android-build/sample-terminal/assets/index.android.bundle');
      mkdirSync(path.dirname(apk), {recursive: true});
      mkdirSync(path.dirname(bundle), {recursive: true});
      writeFileSync(apk, Buffer.alloc(1024));
      writeFileSync(fullApk, Buffer.alloc(2048));
      writeFileSync(zip, Buffer.alloc(512));
      writeFileSync(metadata, '{"publicationId":"kept"}');
      writeFileSync(bundle, Buffer.alloc(256));
      const result = cleanupManagedRunArtifacts(runDirectory, true, terminalRoot);
      expect(result.removedBytes).toBe(3840);
      expect(result.removed).toContain('android-build');
      expect(readFileSync(metadata, 'utf8')).toBe('{"publicationId":"kept"}');
      expect(existsSync(apk)).toBe(false);
      expect(existsSync(fullApk)).toBe(false);
      expect(existsSync(zip)).toBe(false);
      expect(existsSync(bundle)).toBe(false);
    } finally {
      rmSync(runDirectory, {recursive: true, force: true});
      rmSync(terminalRoot, {recursive: true, force: true});
    }
  });

  it('removes only Android library build links registered to the current run', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-artifact-module-link-'));
    const canonicalTemporaryRoot = realpathSync(temporaryRoot);
    const runDirectory = path.join(canonicalTemporaryRoot, 'run');
    const terminalRoot = path.join(canonicalTemporaryRoot, 'terminal');
    const moduleAndroidDirectory = path.join(terminalRoot, 'node_modules', 'fixture-module', 'android');
    const runBuildDirectory = path.join(runDirectory, 'android-build', 'sample-terminal');
    const moduleBuildDirectory = path.join(runBuildDirectory, 'projects', 'fixture-module');
    const linkPath = path.join(moduleAndroidDirectory, 'build');
    try {
      mkdirSync(moduleBuildDirectory, {recursive: true});
      mkdirSync(moduleAndroidDirectory, {recursive: true});
      mkdirSync(runBuildDirectory, {recursive: true});
      symlinkSync(moduleBuildDirectory, linkPath, 'dir');
      writeFileSync(
        path.join(runBuildDirectory, 'temporary-source-build-links.json'),
        JSON.stringify([{path: linkPath, target: moduleBuildDirectory}]),
      );
      writeFileSync(path.join(moduleBuildDirectory, 'generated.java'), 'owned');

      const result = cleanupManagedRunArtifacts(runDirectory, true, terminalRoot);

      expect(
        result.removed.some(removedPath => removedPath.endsWith('node_modules/fixture-module/android/build')),
      ).toBe(true);
      expect(existsSync(linkPath)).toBe(false);
      expect(existsSync(path.join(runBuildDirectory, 'temporary-source-build-links.json'))).toBe(false);
      expect(() => assertNoAndroidIntermediateOutputs(terminalRoot)).not.toThrow();
    } finally {
      rmSync(temporaryRoot, {recursive: true, force: true});
    }
  });

  it('does not remove unregistered Android build links and reports them as leftovers', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-artifact-unregistered-link-'));
    const terminalRoot = path.join(temporaryRoot, 'terminal');
    const moduleAndroidDirectory = path.join(terminalRoot, 'node_modules', 'unknown-module', 'android');
    const outsideRun = path.join(temporaryRoot, 'other-run');
    const linkPath = path.join(moduleAndroidDirectory, 'build');
    try {
      mkdirSync(moduleAndroidDirectory, {recursive: true});
      mkdirSync(outsideRun, {recursive: true});
      symlinkSync(outsideRun, linkPath, 'dir');
      expect(() => cleanupManagedRunArtifacts(temporaryRoot, true, terminalRoot)).toThrow(
        'TERMINAL_AUTOMATION_ANDROID_INTERMEDIATE_OUTSIDE_RUN',
      );
      expect(existsSync(linkPath)).toBe(true);
    } finally {
      rmSync(temporaryRoot, {recursive: true, force: true});
    }
  });

  it('fails closed on a symlink at an owned artifact path', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'ter-artifact-cleanup-link-'));
    const runDirectory = path.join(temporaryRoot, 'run');
    const external = path.join(temporaryRoot, 'external');
    try {
      mkdirSync(runDirectory);
      mkdirSync(external);
      writeFileSync(path.join(external, 'sentinel'), 'outside-run');
      symlinkSync(external, path.join(runDirectory, 'android-build'));
      expect(() => cleanupManagedRunArtifacts(runDirectory, false)).toThrow(
        'TERMINAL_AUTOMATION_ARTIFACT_CLEANUP_SYMLINK_FORBIDDEN',
      );
      expect(readFileSync(path.join(external, 'sentinel'), 'utf8')).toBe('outside-run');
    } finally {
      rmSync(temporaryRoot, {recursive: true, force: true});
    }
  });
});

describe('parseAutomationRunArguments', () => {
  it('accepts a focused normal journey with an explicit age fixture', () => {
    expect(
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'normal',
        '--sample',
        'console',
        '--age',
        '37',
      ]),
    ).toEqual({
      phase: 'journey',
      platform: 'web',
      shape: 'mobile',
      case: 'normal',
      sample: 'console',
      age: '37',
    });
  });

  it('routes F-4 visual comparison to its dedicated web suite', () => {
    expect(parseAutomationRunArguments(['--phase', 'f4', '--platform', 'web', '--shape', 'mobile'])).toEqual({
      phase: 'f4',
      platform: 'web',
      shape: 'mobile',
    });
    expect(resolveAutomationSuite({phase: 'f4', platform: 'web', shape: 'mobile'})).toBe('journeys/f4Visual.test.ts');
  });

  it('accepts the wallpaper main journey without member-specific options', () => {
    expect(
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--sample',
        'wallpaper',
      ]),
    ).toEqual({phase: 'journey', platform: 'web', shape: 'mobile', sample: 'wallpaper'});
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--sample',
        'wallpaper',
        '--case',
        'normal',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_CASE_NOT_APPLICABLE');
  });

  it('routes F-4 performance work to one run-owned Android VM without requiring a peer device', () => {
    const execution = parseAutomationRunArguments([
      '--phase',
      'f4',
      '--platform',
      'android',
      '--shape',
      'dual',
      '--device-serial',
      'managed-dual-screen-01',
    ]);
    expect(execution).toEqual({
      phase: 'f4',
      platform: 'android',
      shape: 'dual',
      deviceSerial: 'managed-dual-screen-01',
    });
    expect(resolveAutomationSuite(execution)).toBe('journeys/f4Performance.android.test.ts');
  });

  it('rejects duplicate, unknown, incomplete, and inapplicable options', () => {
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--phase',
        'skill',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'normal',
        '--sample',
        'console',
        '--age',
        'empty',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_ARGUMENT_INVALID');
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'normal',
        '--age',
        'empty',
        '--typo',
        'x',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_ARGUMENT_UNKNOWN');
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--sample',
        'console',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_CASE_INVALID');
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'capabilities',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'normal',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_CASE_NOT_APPLICABLE');
  });

  it('restricts cases to compatible topologies and fixture values', () => {
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'withdraw',
        '--sample',
        'console',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_CASE_OUTSIDE_MAIN_JOURNEY');
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'journey',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'normal',
        '--sample',
        'console',
        '--age',
        '999',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_AGE_INVALID');
    expect(() => parseAutomationRunArguments(['--phase', 'skill', '--platform', 'android', '--shape', 'dual'])).toThrow(
      'TERMINAL_AUTOMATION_SKILL_SHAPE_INVALID',
    );
    expect(() =>
      parseAutomationRunArguments(['--phase', 'feasibility', '--platform', 'android', '--shape', 'dual']),
    ).toThrow('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL_REQUIRED');
    expect(
      parseAutomationRunArguments([
        '--phase',
        'feasibility',
        '--platform',
        'android',
        '--shape',
        'dual',
        '--device-serial',
        'emulator-5554',
      ]),
    ).toMatchObject({platform: 'android', deviceSerial: 'emulator-5554'});
  });
});

describe('managed DEV HTTP endpoint validation', () => {
  it('accepts the URL root path normalized by the URL parser', () => {
    expect(isManagedDevHttpBaseUrl('http://127.0.0.1:28080')).toBe(true);
    expect(isManagedDevHttpBaseUrl('http://127.0.0.1:28080/')).toBe(true);
  });

  it('rejects external, path-scoped, credentialed, and malformed endpoints', () => {
    expect(isManagedDevHttpBaseUrl('http://localhost:28080')).toBe(false);
    expect(isManagedDevHttpBaseUrl('http://127.0.0.1:28080/api')).toBe(false);
    expect(isManagedDevHttpBaseUrl('http://user:pass@127.0.0.1:28080')).toBe(false);
    expect(isManagedDevHttpBaseUrl('not a URL')).toBe(false);
  });
});

describe('managed terminal browser origin selection', () => {
  it('uses the first allowed loopback origin so Expo matches the DEV CORS allowlist', () => {
    expect(selectManagedTerminalBrowserOrigin(['http://127.0.0.1:8093', 'http://localhost:8094'])).toBe(
      'http://127.0.0.1:8093',
    );
    expect(selectManagedTerminalBrowserOrigin(['http://localhost:8094'])).toBe('http://localhost:8094');
  });

  it('rejects origins outside the managed local browser boundary', () => {
    expect(selectManagedTerminalBrowserOrigin(['https://127.0.0.1:8093'])).toBeUndefined();
    expect(selectManagedTerminalBrowserOrigin(['http://127.0.0.1:8093/path'])).toBeUndefined();
    expect(selectManagedTerminalBrowserOrigin(['http://example.com:8093'])).toBeUndefined();
    expect(selectManagedTerminalBrowserOrigin('http://127.0.0.1:8093')).toBeUndefined();
  });
});

describe('resolveAutomationSuite', () => {
  it('registers update cases in the current driver and requires DEV only for business-backed cases', () => {
    const web = parseAutomationRunArguments([
      '--phase',
      'update',
      '--platform',
      'web',
      '--shape',
      'mobile',
      '--case',
      'update.artifacts',
      '--sample',
      'console',
    ]);
    const flush = parseAutomationRunArguments([
      '--phase',
      'update',
      '--platform',
      'web',
      '--shape',
      'mobile',
      '--case',
      'update.flush',
      '--sample',
      'wallpaper',
    ]);
    const offlineAssets = parseAutomationRunArguments([
      '--phase',
      'update',
      '--platform',
      'android',
      '--shape',
      'mobile',
      '--case',
      'update.offline-assets',
      '--sample',
      'wallpaper',
      '--device-serial',
      'emulator-5560',
    ]);
    const fullHot = parseAutomationRunArguments([
      '--phase',
      'update',
      '--platform',
      'android',
      '--shape',
      'mobile',
      '--case',
      'update.full-hot',
      '--sample',
      'wallpaper',
      '--device-serial',
      'emulator-5560',
    ]);
    const bootGuard = parseAutomationRunArguments([
      '--phase',
      'update',
      '--platform',
      'android',
      '--shape',
      'mobile',
      '--case',
      'update.boot-guard',
      '--sample',
      'console',
      '--device-serial',
      'emulator-5560',
    ]);
    expect(resolveAutomationSuite(web)).toBe('journeys/update.test.ts');
    expect(updateRequiresManagedDev(web)).toBe(false);
    expect(updateRequiresManagedDev(flush)).toBe(true);
    expect(updateRequiresManagedDev(offlineAssets)).toBe(true);
    expect(updateRequiresManagedDev(fullHot)).toBe(true);
    expect(updateRequiresManagedDev(bootGuard)).toBe(true);
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'update',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'update.unknown',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_UPDATE_CASE_INVALID');
  });

  it('fails closed when a registered update case has no executable test on the selected platform', () => {
    const webBaseline = parseAutomationRunArguments([
      '--phase',
      'update',
      '--platform',
      'web',
      '--shape',
      'mobile',
      '--case',
      'update.baseline',
    ]);
    const androidArtifacts = parseAutomationRunArguments([
      '--phase',
      'update',
      '--platform',
      'android',
      '--shape',
      'mobile',
      '--case',
      'update.artifacts',
      '--device-serial',
      'managed-device-01',
    ]);
    expect(updateCaseImplemented(webBaseline)).toBe(false);
    expect(updateCaseImplemented(androidArtifacts)).toBe(false);
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'update',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'update.baseline',
      ]),
    ).not.toThrow();
    expect(
      parseAutomationRunArguments([
        '--phase',
        'update',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--case',
        'update.fixed',
      ]).case,
    ).toBe('update.fixed');
    expect(
      parseAutomationRunArguments([
        '--phase',
        'update',
        '--platform',
        'android',
        '--shape',
        'mobile',
        '--case',
        'update.full-hot',
        '--device-serial',
        'managed-device-01',
      ]).case,
    ).toBe('update.full-hot');
    expect(updateCaseImplemented({phase: 'update', platform: 'web', shape: 'mobile', case: 'update.fixed'})).toBe(true);
    expect(updateCaseImplemented({phase: 'update', platform: 'web', shape: 'mobile', case: 'update.install-result'})).toBe(true);
    expect(
      updateCaseImplemented({phase: 'update', platform: 'android', shape: 'mobile', case: 'update.full-hot'}),
    ).toBe(true);
    expect(updateCaseImplemented({phase: 'update', platform: 'android', shape: 'dual', case: 'update.full-hot'})).toBe(
      true,
    );
    expect(
      parseAutomationRunArguments([
        '--phase',
        'update',
        '--platform',
        'android',
        '--shape',
        'mobile',
        '--case',
        'update.offline-assets',
        '--device-serial',
        'managed-device-01',
      ]).case,
    ).toBe('update.offline-assets');
    expect(
      updateCaseImplemented({phase: 'update', platform: 'android', shape: 'mobile', case: 'update.offline-assets'}),
    ).toBe(true);
    expect(
      updateCaseImplemented({phase: 'update', platform: 'android', shape: 'dual', case: 'update.offline-assets'}),
    ).toBe(true);
    expect(
      updateCaseImplemented({phase: 'update', platform: 'android', shape: 'mobile', case: 'update.boot-guard'}),
    ).toBe(true);
    expect(
      updateCaseImplemented({phase: 'update', platform: 'android', shape: 'mobile', case: 'update.install-result'}),
    ).toBe(true);
    expect(updateRequiresManagedDev({phase: 'update', platform: 'android', shape: 'mobile', case: 'update.install-result'})).toBe(true);
    expect(updateRequiresManagedDev({phase: 'update', platform: 'web', shape: 'mobile', case: 'update.install-result'})).toBe(false);
    expect(
      updateCaseImplemented({phase: 'update', platform: 'android', shape: 'mobile', case: 'update.interruption'}),
    ).toBe(false);
  });

  it('fails closed when Android boot-guard final assertions were not observed', () => {
    const execution = {phase: 'update', platform: 'android', shape: 'mobile', case: 'update.boot-guard'} as const;
    expect(updateScenarioAssertionsObserved(execution, 'run-1', '')).toBe(false);
    expect(
      updateScenarioAssertionsObserved(
        execution,
        'run-1',
        'TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=update.boot-guard run=run-1\n',
      ),
    ).toBe(true);
  });

  it('routes Android feasibility to a dedicated Android suite', () => {
    expect(resolveAutomationSuite({phase: 'feasibility', platform: 'android', shape: 'dual'})).toBe(
      'journeys/geometry.android.test.ts',
    );
    expect(resolveAutomationSuite({phase: 'feasibility', platform: 'web', shape: 'dual'})).toBe(
      'journeys/geometry.test.ts',
    );
    expect(resolveAutomationSuite({phase: 'capabilities', platform: 'android', shape: 'dual'})).toBe(
      'journeys/agentCapabilities.android.test.ts',
    );
  });

  it('requires two explicit, distinct Android serials for dual-device capabilities', () => {
    const args = [
      '--phase',
      'capabilities',
      '--platform',
      'android',
      '--shape',
      'dual',
      '--device-serial',
      'emulator-5554',
    ];
    expect(() => parseAutomationRunArguments(args)).toThrow('TERMINAL_AUTOMATION_ANDROID_PEER_DEVICE_SERIAL_REQUIRED');
    expect(parseAutomationRunArguments([...args, '--peer-device-serial', 'emulator-5556'])).toMatchObject({
      deviceSerial: 'emulator-5554',
      peerDeviceSerial: 'emulator-5556',
    });
    expect(() => parseAutomationRunArguments([...args, '--peer-device-serial', 'emulator-5554'])).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIALS_MUST_DIFFER',
    );
  });

  it('routes the registered Android journey suite and still requires an explicit device serial', () => {
    const journey = parseAutomationRunArguments([
      '--phase',
      'journey',
      '--platform',
      'android',
      '--shape',
      'mobile',
      '--case',
      'normal',
      '--sample',
      'console',
      '--age',
      'empty',
      '--device-serial',
      'emulator-5554',
    ]);
    expect(resolveAutomationSuite(journey)).toBe('journeys/sampleConsole.android.test.ts');
  });

  it('routes the skill proof through the checked-in main journey without a second journey implementation', () => {
    const web = parseAutomationRunArguments([
      '--phase',
      'skill',
      '--platform',
      'web',
      '--shape',
      'mobile',
      '--sample',
      'console',
      '--case',
      'normal',
      '--age',
      'empty',
    ]);
    const android = parseAutomationRunArguments([
      '--phase',
      'skill',
      '--platform',
      'android',
      '--shape',
      'mobile',
      '--sample',
      'console',
      '--case',
      'normal',
      '--age',
      'empty',
      '--device-serial',
      'emulator-5554',
    ]);
    expect(resolveAutomationSuite(web)).toBe('journeys/skill.test.ts');
    expect(resolveAutomationSuite(android)).toBe('journeys/skill.android.test.ts');
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'skill',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--sample',
        'wallpaper',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_SKILL_SAMPLE_NOT_CONSOLE');
    expect(() =>
      parseAutomationRunArguments([
        '--phase',
        'skill',
        '--platform',
        'web',
        '--shape',
        'mobile',
        '--sample',
        'console',
        '--case',
        'normal',
        '--age',
        '37',
      ]),
    ).toThrow('TERMINAL_AUTOMATION_SKILL_AGE_MUST_BE_EMPTY');
  });
});
