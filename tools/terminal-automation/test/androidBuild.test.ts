import {describe, expect, it} from 'vitest';
import {
  androidAutomationBuildFailureCode,
  androidAutomationBuildIdentity,
  androidAutomationGradleArguments,
} from '../src/androidBuild.js';

describe('Android automation build failures', () => {
  it('ignores progress markers and preserves a real build failure marker', () => {
    expect(
      androidAutomationBuildFailureCode(
        'TERMINAL_AUTOMATION_REACT_NATIVE_AUTOLINKING_STAGE_STARTED\nMetro failed\n',
        1,
      ),
    ).toBe('TERMINAL_AUTOMATION_ANDROID_BUILD_EXIT_1');
    expect(
      androidAutomationBuildFailureCode(
        'TERMINAL_AUTOMATION_REACT_NATIVE_AUTOLINKING_STAGE_STARTED\nTERMINAL_AUTOMATION_REACT_NATIVE_AUTOLINKING_STAGE_READBACK_FAILED\n',
        1,
      ),
    ).toBe('TERMINAL_AUTOMATION_REACT_NATIVE_AUTOLINKING_STAGE_READBACK_FAILED');
  });
});

describe('android automation build identity', () => {
  it('derives a collision-resistant package suffix from the managed run UUID', () => {
    expect(androidAutomationBuildIdentity('8f3588f9-71b4-462b-bdb1-5b7d241da7be')).toEqual({
      packageId: 'com.anonymous.sampleterminal.terauto241da7be',
      applicationIdSuffix: '.terauto241da7be',
    });
  });

  it('uses the wallpaper application identity with the same run-scoped suffix', () => {
    expect(androidAutomationBuildIdentity('8f3588f9-71b4-462b-bdb1-5b7d241da7be', 'wallpaper')).toEqual({
      packageId: 'com.catering.v2s.terminal.samplewallpaper.terauto241da7be',
      applicationIdSuffix: '.terauto241da7be',
    });
  });

  it('rejects a non-run identity and non-owned Gradle suffix', () => {
    expect(() => androidAutomationBuildIdentity('../../sample')).toThrow('TERMINAL_AUTOMATION_ANDROID_RUN_ID_INVALID');
    expect(() => androidAutomationGradleArguments('.other1234', '/repo/.runtime/run/android-build')).toThrow(
      'TERMINAL_AUTOMATION_APPLICATION_ID_SUFFIX_INVALID',
    );
  });

  it('uses the configured sample-terminal APK and disables cached token-bearing build outputs', () => {
    expect(androidAutomationGradleArguments('.terauto241da7be', '/repo/.runtime/run/android-build')).toEqual([
      ':app:assembleDebug',
      '--no-daemon',
      '--console=plain',
      '--no-build-cache',
      '--rerun-tasks',
      '-PterDisableNativeDevSupport=true',
      '-PterAutomationApplicationIdSuffix=.terauto241da7be',
      '-PterAutomationBuildDir=/repo/.runtime/run/android-build',
    ]);
  });

  it('builds the same run-owned sample in Android release mode when requested', () => {
    expect(androidAutomationGradleArguments('.terauto241da7be', '/repo/.runtime/run/android-build', 'release')[0]).toBe(
      ':app:assembleRelease',
    );
  });
});
