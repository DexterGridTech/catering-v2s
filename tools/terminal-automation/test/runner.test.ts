import {describe, expect, it} from 'vitest';
import {
  isManagedDevHttpBaseUrl,
  parseAutomationRunArguments,
  resolveAutomationSuite,
  createAndroidDeviceCleanupTracker,
  selectManagedTerminalBrowserOrigin,
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
