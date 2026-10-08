import {afterEach, describe, expect, it, vi} from 'vitest';
import type {FixedUpdateTarget} from '@catering-v2s/kernel-base-terminal-update';
import {createAndroidAutomationUpdateTargetSourceProvider} from '../src/automationUpdateTargetSourceProvider';

const createTarget = (runId: string, applicationId: string): FixedUpdateTarget => {
  const publicationId = 'a'.repeat(64);
  const artifact = Object.freeze({
    schemaVersion: 1 as const,
    platform: 'android' as const,
    applicationId,
    nativeVersion: '1.0.0',
    nativeBuildNumber: 1,
    bundleVersion: '1.0.0',
    runtimeVersion: '1',
    entry: 'index.android.bundle',
    files: Object.freeze([]),
    publicationId,
  });
  return Object.freeze({
    ruleRef: `automation-${runId}`,
    createdAt: 1,
    applicationId,
    full: Object.freeze({sourceRef: `full-${runId}`, expectedSha256: publicationId, artifact}),
    hot: Object.freeze({sourceRef: `hot-${runId}`, expectedSha256: publicationId, artifact}),
    strategy: Object.freeze({maxNetworkAttempts: 1, bootTimeoutMs: 60_000}),
    selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: runId}),
  });
};

describe('createAndroidAutomationUpdateTargetSourceProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is absent outside the managed automation build', () => {
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_BUILD', 'false');
    expect(createAndroidAutomationUpdateTargetSourceProvider()).toBeUndefined();
  });

  it('loads only the matching run target and resolves its opaque artifact paths', async () => {
    const runId = 'run-123';
    const applicationId = 'com.example.terminal';
    const target = createTarget(runId, applicationId);
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_BUILD', 'true');
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL', 'http://127.0.0.1:9123/update-target');
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_RUN_ID', runId);
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID', applicationId);
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_UPDATE_REVISION', 'revision-1');
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            target,
            sourcePaths: {[`full-${runId}`]: '/full.zip', [`hot-${runId}`]: '/hot.zip'},
          }),
          {status: 200},
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = createAndroidAutomationUpdateTargetSourceProvider();
    expect(provider).toBeDefined();
    expect(provider?.resolveSourcePath?.(`full-${runId}`)).toBe('/full.zip');
    expect(provider?.resolveSourcePath?.('full-other-run')).toBeNull();
    expect(await provider?.readTarget({selectedSpace: 'production', contextIdentity: runId})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await provider?.readTarget({selectedSpace: 'development', contextIdentity: runId})).toEqual(target);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9123/update-target?revision=revision-1');
  });

  it('rejects an artifact path outside the run-owned allowlist', async () => {
    const runId = 'run-123';
    const applicationId = 'com.example.terminal';
    const target = createTarget(runId, applicationId);
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_BUILD', 'true');
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL', 'http://127.0.0.1:9123/update-target');
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_RUN_ID', runId);
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID', applicationId);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              target,
              sourcePaths: {[`full-${runId}`]: '/../outside.apk', [`hot-${runId}`]: '/hot.zip'},
            }),
            {status: 200},
          ),
      ),
    );

    const provider = createAndroidAutomationUpdateTargetSourceProvider();
    expect(await provider?.readTarget({selectedSpace: 'development', contextIdentity: runId})).toBeNull();
  });

  it('rejects a descriptor that exceeds the bounded response size', async () => {
    const runId = 'run-123';
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_BUILD', 'true');
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL', 'http://127.0.0.1:9123/update-target');
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_RUN_ID', runId);
    vi.stubEnv('EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID', 'com.example.terminal');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x'.repeat(256 * 1024 + 1), {status: 200})),
    );

    const provider = createAndroidAutomationUpdateTargetSourceProvider();
    await expect(provider?.readTarget({selectedSpace: 'development', contextIdentity: runId})).rejects.toThrow(
      'TERMINAL_AUTOMATION_UPDATE_TARGET_TOO_LARGE',
    );
  });
});
