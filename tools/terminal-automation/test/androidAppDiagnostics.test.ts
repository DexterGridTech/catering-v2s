import {describe, expect, it} from 'vitest';
import {
  collectAndroidRuntimeFailureDiagnostics,
  projectAndroidAutomationConnectionLog,
  projectAndroidAutomationSelectorFailureLog,
  projectAndroidTransportFailureLog,
} from '../src/androidAppDiagnostics.js';

describe('Android transport failure diagnostics', () => {
  it('retains safe error and cause codes while omitting arbitrary message and URL data', () => {
    const line = `W/ReactNativeJS (123): ${JSON.stringify({
      category: 'transport.connection',
      event: 'transport.connection.connect-candidate-failed',
      level: 'warn',
      data: {
        addressName: 'haproxy-entry-one',
        revision: 4,
        connectionToken: 8,
        errorName: 'Error',
        errorCode: 'ECONNREFUSED',
        causeName: 'Error',
        causeCode: 'EHOSTUNREACH',
        message: 'https://user:secret@example.invalid/private',
      },
    })}`;

    const projected = projectAndroidTransportFailureLog(line);

    expect(projected).toMatchObject({
      event: 'transport.connection.connect-candidate-failed',
      addressName: 'haproxy-entry-one',
      configRevision: '4',
      connectionToken: 8,
      transportErrorName: 'Error',
      transportErrorCode: 'ECONNREFUSED',
      transportCauseName: 'Error',
      transportCauseCode: 'EHOSTUNREACH',
    });
    expect(JSON.stringify(projected)).not.toContain('secret');
    expect(JSON.stringify(projected)).not.toContain('example.invalid');
  });
});

describe('Android automation connection diagnostics', () => {
  it('retains close code and session identity without retaining address or arbitrary data', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'automation.connection',
      event: 'connection.closed',
      level: 'info',
      data: {
        address: 'ws://user:secret@example.invalid/private',
        sessionId: 'runtime-session-123',
        code: 1006,
        reason: 'arbitrary server text',
      },
    })}`;

    expect(projectAndroidAutomationConnectionLog(line)).toEqual({
      category: 'automation.connection',
      event: 'connection.closed',
      level: 'info',
      sessionId: 'runtime-session-123',
      closeCode: 1006,
    });
    expect(collectAndroidRuntimeFailureDiagnostics(line)).not.toContain('secret');
    expect(collectAndroidRuntimeFailureDiagnostics(line)).not.toContain('example.invalid');
  });

  it('retains the bounded send-window failure marker and a safe close reason code', () => {
    const lines = [
      `W/ReactNativeJS (123): ${JSON.stringify({
        category: 'automation.connection',
        event: 'outbound.window.limit',
        level: 'warn',
        data: {
          sessionId: 'runtime-session-123',
          address: 'ws://secret.example.invalid',
          reason: 'UNACKNOWLEDGED_WINDOW_FULL',
          limitBytes: 1_048_576,
          messageBytes: 900_000,
          pendingBytes: 800_000,
          pendingMessages: 4,
          messageType: 'event',
          pendingMessageType: 'event',
          messageIdFamily: 'runtime-event',
          pendingMessageIdFamily: 'runtime-event',
        },
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'automation.connection',
        event: 'connection.closed',
        level: 'info',
        data: {sessionId: 'runtime-session-123', code: 1000, reasonCode: 'WINDOW_LIMIT'},
      })}`,
    ].join('\n');

    const projected = collectAndroidRuntimeFailureDiagnostics(lines);

    expect(projected).toContain('"event":"outbound.window.limit"');
    expect(projected).toContain('"limitReason":"UNACKNOWLEDGED_WINDOW_FULL"');
    expect(projected).toContain('"limitBytes":1048576');
    expect(projected).toContain('"messageBytes":900000');
    expect(projected).toContain('"pendingBytes":800000');
    expect(projected).toContain('"pendingMessages":4');
    expect(projected).toContain('"messageType":"event"');
    expect(projected).toContain('"pendingMessageIdFamily":"runtime-event"');
    expect(projected).toContain('"reasonCode":"WINDOW_LIMIT"');
    expect(projected).not.toContain('secret.example.invalid');
  });
});

describe('Android automation selector diagnostics', () => {
  it('retains selector failure phase and budget without selector arguments or values', () => {
    const line = `W/ReactNativeJS (123): ${JSON.stringify({
      category: 'automation.selector',
      event: 'selector.evaluation.failed',
      level: 'warn',
      data: {
        selectorName: 'kernel.base.runtime.selectRequestExecutionCandidates',
        failureCode: 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED',
        phase: 'json-validation',
        elapsedMs: 9.25,
        budgetMs: 8,
        argsTuple: ['sensitive-value'],
        selectorValue: 'private-payload',
      },
    })}`;

    const projected = projectAndroidAutomationSelectorFailureLog(line);

    expect(projected).toMatchObject({
      category: 'automation.selector',
      event: 'selector.evaluation.failed',
      selectorName: 'kernel.base.runtime.selectRequestExecutionCandidates',
      failureCode: 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED',
      phase: 'json-validation',
      elapsedMs: 9.25,
      budgetMs: 8,
    });
    expect(JSON.stringify(projected)).not.toContain('sensitive-value');
    expect(JSON.stringify(projected)).not.toContain('private-payload');
  });
});
