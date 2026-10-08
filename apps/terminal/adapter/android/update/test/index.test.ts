import {beforeEach, describe, expect, it, vi} from 'vitest';
import {requireNativeModule} from 'expo-modules-core';
import type {
  PrepareUpdateArtifactInput,
  TerminalUpdateArtifact,
  UpdateAction,
  UpdateFacts,
} from '@catering-v2s/kernel-base-platform-ports';
import {createAndroidUpdatePort} from '../src/index.js';

const native = vi.hoisted(() => ({
  readFacts: vi.fn(),
  prepareArtifact: vi.fn(),
  applyPrepared: vi.fn(),
  readAction: vi.fn(),
  confirmBoot: vi.fn(),
  releasePrepared: vi.fn(),
}));

vi.mock('expo-modules-core', () => ({requireNativeModule: vi.fn(() => native)}));

describe('createAndroidUpdatePort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.readFacts.mockResolvedValue({actual: null} satisfies Partial<UpdateFacts>);
    native.prepareArtifact.mockResolvedValue({preparedId: 'prepared'});
    native.applyPrepared.mockResolvedValue({} satisfies Partial<UpdateAction>);
    native.readAction.mockResolvedValue(null);
    native.confirmBoot.mockResolvedValue({} satisfies Partial<UpdateAction>);
    native.releasePrepared.mockResolvedValue({released: true});
  });

  it('maps each update port call to the positional Expo AsyncFunction contract', async () => {
    const port = createAndroidUpdatePort();
    const facts = await port.readFacts({timeoutMs: 10_000});
    expect(facts.status).toBe('succeeded');
    expect(requireNativeModule).toHaveBeenCalledWith('TerminalUpdate');
    expect(native.readFacts).toHaveBeenCalledWith();

    const artifact = {
      schemaVersion: 1,
      platform: 'android',
      applicationId: 'com.example.terminal',
      nativeVersion: '1.0.1',
      nativeBuildNumber: 2,
      bundleVersion: '1.0.1',
      runtimeVersion: '1',
      entry: 'assets/index.android.bundle',
      files: [],
      publicationId: 'publication-2',
    } as unknown as TerminalUpdateArtifact;
    const prepareInput: PrepareUpdateArtifactInput = {
      timeoutMs: 120_000,
      sourceRef: 'full-2',
      expectedSha256: 'a'.repeat(64),
      artifact,
      sourcePath: '/full.apk',
      network: {
        addresses: [{addressName: 'business', baseUrl: 'http://127.0.0.1:28080/api/'}],
        proxy: {protocol: 'http', host: 'proxy.example', port: 8080, username: 'user', password: 'secret'},
      },
      kind: 'full',
    };
    const prepared = await port.prepareArtifact(prepareInput);
    expect(prepared.status).toBe('succeeded');
    expect(native.prepareArtifact).toHaveBeenCalledWith(
      'http://127.0.0.1:28080/full.apk',
      120_000,
      'a'.repeat(64),
      JSON.stringify(artifact),
      'full',
      prepareInput.network.proxy,
    );

    const action: UpdateAction = {
      taskId: 'task-1',
      actionId: 'action-1',
      state: 'unknown',
      reason: null,
      publicationId: 'publication-2',
      bootId: null,
    };
    native.applyPrepared.mockResolvedValue(action);
    await port.applyPrepared({
      timeoutMs: 120_000,
      taskId: 'task-1',
      actionId: 'action-1',
      preparedId: 'prepared',
      kind: 'full',
    });
    expect(native.applyPrepared).toHaveBeenCalledWith('task-1', 'action-1', 'prepared', 'full');

    native.readAction.mockResolvedValue(action);
    await port.readAction({timeoutMs: 10_000, taskId: 'task-1', actionId: 'action-1'});
    expect(native.readAction).toHaveBeenCalledWith('task-1', 'action-1');

    native.confirmBoot.mockResolvedValue(action);
    await port.confirmBoot({timeoutMs: 60_000, bootToken: 'boot-token', publicationId: 'publication-2'});
    expect(native.confirmBoot).toHaveBeenCalledWith('boot-token', 'publication-2');

    await port.releasePrepared({timeoutMs: 10_000, preparedId: 'prepared'});
    expect(native.releasePrepared).toHaveBeenCalledWith('prepared');
  });

  it('passes null for an absent optional native proxy argument', async () => {
    const port = createAndroidUpdatePort();
    const input = {
      timeoutMs: 10_000,
      sourceRef: 'hot-1',
      expectedSha256: 'b'.repeat(64),
      artifact: {applicationId: 'com.example.terminal'} as TerminalUpdateArtifact,
      sourcePath: '/hot.zip',
      network: {addresses: [{addressName: 'business', baseUrl: 'http://127.0.0.1:28080/'}]},
      kind: 'hot',
    } as PrepareUpdateArtifactInput;

    await port.prepareArtifact(input);

    expect(native.prepareArtifact).toHaveBeenCalledWith(
      'http://127.0.0.1:28080/hot.zip',
      10_000,
      'b'.repeat(64),
      JSON.stringify(input.artifact),
      'hot',
      null,
    );
  });

  it('preserves an allowlisted native failure code without exposing the native message', async () => {
    native.readFacts.mockRejectedValueOnce(new Error('TERMINAL_UPDATE_APK_SIGNER_MISMATCH'));
    const result = await createAndroidUpdatePort().readFacts({timeoutMs: 10_000});

    expect(result).toMatchObject({
      status: 'failed',
      capability: 'readFacts',
      error: {
        code: 'TERMINAL_UPDATE_APK_SIGNER_MISMATCH',
        message: 'native update operation failed',
        retryable: true,
      },
    });
    expect(result.status === 'failed' && result.error.message).toBe('native update operation failed');
  });

  it('maps non-stable native rejection details to the generic safe failure', async () => {
    native.readFacts.mockRejectedValueOnce(new Error('failed for secret-bearing input'));
    const result = await createAndroidUpdatePort().readFacts({timeoutMs: 10_000});

    expect(result).toMatchObject({
      status: 'failed',
      error: {code: 'NATIVE_UPDATE_OPERATION_FAILED', message: 'native update operation failed'},
    });
    expect(JSON.stringify(result)).not.toContain('secret-bearing input');
  });
});
