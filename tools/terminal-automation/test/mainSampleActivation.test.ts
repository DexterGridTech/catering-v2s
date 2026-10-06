import {describe, expect, it, vi} from 'vitest';
import {ensureMainSampleActivated} from '../src/mainSampleActivation.js';
import type {TerminalAutomationFixtureApi} from '../src/driver.js';

const identity = Object.freeze({
  seedKey: 'term-front' as const,
  terminalRef: 'terminal-ref',
  storeRef: 'store-ref',
  deviceId: 'device-1',
  bindingGeneration: 1,
});

describe('ensureMainSampleActivated', () => {
  it('checks the seed identity before a dual journey', async () => {
    const ensureActivated = vi.fn(async () => identity);
    const fixtures: TerminalAutomationFixtureApi = {ensureActivated};

    await expect(ensureMainSampleActivated(fixtures, {shape: 'dual', deviceId: 'device-1', runId: 'run-1'})).resolves.toBe(
      identity,
    );
    expect(ensureActivated).toHaveBeenCalledExactlyOnceWith({shape: 'dual', deviceId: 'device-1', runId: 'run-1'});
  });

  it('fails closed on a different seed or device identity', async () => {
    const fixtures: TerminalAutomationFixtureApi = {ensureActivated: async () => identity};

    await expect(ensureMainSampleActivated(fixtures, {shape: 'mobile', deviceId: 'device-1', runId: 'run-1'})).rejects.toThrow(
      'TERMINAL_AUTOMATION_ACTIVATION_FIXTURE_IDENTITY_MISMATCH',
    );
    await expect(ensureMainSampleActivated(fixtures, {shape: 'dual', deviceId: 'device-2', runId: 'run-1'})).rejects.toThrow(
      'TERMINAL_AUTOMATION_ACTIVATION_FIXTURE_IDENTITY_MISMATCH',
    );
  });

  it('rejects a runner without the shared managed fixture', async () => {
    await expect(
      ensureMainSampleActivated(undefined, {shape: 'dual', deviceId: 'device-1', runId: 'run-1'}),
    ).rejects.toThrow('TERMINAL_AUTOMATION_FIXTURE_API_MISSING');
  });
});
