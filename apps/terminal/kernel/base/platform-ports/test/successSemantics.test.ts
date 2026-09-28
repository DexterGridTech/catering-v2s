import {describe, expect, it} from 'vitest';

import {
  unavailableAppControlPort,
  type AppControlPort,
  type NoOutput,
  type PortActionResult,
} from '@catering-v2s/kernel-base-platform-ports';
import {createRequestId, nowTimestampMs} from '@catering-v2s/kernel-base-contracts';

const noOutput: NoOutput = {completed: true};

describe('S: explicit action terminal semantics', () => {
  it('keeps accepted reset distinct from succeeded until the successor signal exists', async () => {
    let signalSuccess!: () => void;
    const successorSignal = new Promise<void>(resolve => {
      signalSuccess = resolve;
    });
    const fakeState: {terminalState: 'pending' | 'succeeded'} = {terminalState: 'pending'};
    const resetRuntime: AppControlPort['resetRuntime'] = async input => ({
      status: 'accepted',
      requestId: input.requestId,
      acceptedAt: nowTimestampMs(),
      terminalObservation: 'SUCCESSOR_RUNTIME_STARTED',
    });
    const observedResetRuntime: AppControlPort['resetRuntime'] = async input => {
      void successorSignal.then(() => {
        fakeState.terminalState = 'succeeded';
      });
      return resetRuntime(input);
    };
    const port: AppControlPort = {...unavailableAppControlPort, resetRuntime: observedResetRuntime};
    const requestId = createRequestId();
    const result = await port.resetRuntime({requestId, timeoutMs: 100});
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.requestId).toBe(requestId);
      expect(result.terminalObservation).toBe('SUCCESSOR_RUNTIME_STARTED');
      expect(fakeState.terminalState).toBe('pending');
    }
    await Promise.resolve();
    expect(fakeState.terminalState).toBe('pending');
    signalSuccess();
    await successorSignal;
    await Promise.resolve();
    expect(fakeState.terminalState).toBe('succeeded');
  });

  it('only returns succeeded after an observable state change and preserves timeout', async () => {
    let enabled = false;
    const setFullscreen: AppControlPort['setFullscreen'] = async input => {
      enabled = input.enabled;
      return {status: 'succeeded', value: {enabled}, completedAt: nowTimestampMs()};
    };
    const port: AppControlPort = {...unavailableAppControlPort, setFullscreen};
    const success = await port.setFullscreen({containerKey: 'primary', enabled: true, timeoutMs: 100});
    expect(enabled).toBe(true);
    expect(success).toMatchObject({status: 'succeeded', value: {enabled: true}});

    const timeoutPort: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input => {
        const fakeElapsedMs = input.timeoutMs + 1;
        if (fakeElapsedMs > input.timeoutMs) {
          return {
            status: 'timed-out',
            port: 'appControl',
            capability: 'resetRuntime',
            timeoutMs: input.timeoutMs,
          };
        }
        return {status: 'succeeded', value: noOutput, completedAt: nowTimestampMs()};
      },
    };
    const timedOut: PortActionResult<NoOutput, 'SUCCESSOR_RUNTIME_STARTED'> = await timeoutPort.resetRuntime({
      requestId: createRequestId(),
      timeoutMs: 100,
    });
    expect(timedOut.status).toBe('timed-out');
    if (timedOut.status === 'timed-out') {
      expect(timedOut.timeoutMs).toBe(100);
      expect(timedOut.status).not.toBe('failed');
      expect(timedOut.status).not.toBe('unavailable');
    }
  });
});
