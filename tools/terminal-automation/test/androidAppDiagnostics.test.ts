import {describe, expect, it} from 'vitest';
import {
  collectAndroidRuntimeFailureDiagnostics,
  projectAndroidAutomationConnectionLog,
  projectAndroidAutomationSelectorFailureLog,
  projectAndroidTerminalDataReadLog,
  projectAndroidTerminalHeartbeatLog,
  projectAndroidTerminalTopicSubscriptionLog,
  projectAndroidTransportFailureLog,
  projectAndroidTerminalUpdateReportLog,
} from '../src/androidAppDiagnostics.js';

describe('Android terminal rule chain diagnostics', () => {
  it('projects topic subscription outcomes without owner or credential identity', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.data.topic-subscription',
      event: 'terminal-topic-subscribe.persist.readback',
      level: 'info',
      data: {
        topicKey: 'TERMINAL_UPDATE_RULES',
        resultStatus: 'persisted',
        matchingSubscriptionPresent: true,
        persistedSubscriptionCount: 3,
        ownerRef: 'private-owner-ref',
        terminalRef: 'private-terminal-ref',
        credentialSecret: 'private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalTopicSubscriptionLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.data.topic-subscription',
      event: 'terminal-topic-subscribe.persist.readback',
      topicKey: 'TERMINAL_UPDATE_RULES',
      resultStatus: 'persisted',
      matchingSubscriptionPresent: true,
      persistedSubscriptionCount: 3,
    });
    expect(JSON.stringify(projected)).not.toContain('private-owner-ref');
    expect(JSON.stringify(projected)).not.toContain('private-terminal-ref');
    expect(JSON.stringify(projected)).not.toContain('private-secret');
  });

  it('projects generated HTTP read stage and classified response without request data', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.data.read',
      event: 'terminal-read-http.response',
      level: 'info',
      data: {
        operationId: 'terminalReadProjectUpdateRuleSnapshotPage',
        elapsedMs: 42,
        resultKind: 'success',
        status: 200,
        pathParameters: {projectRef: 'private-project-ref'},
        query: {collectionHash: 'private-hash'},
        Authorization: 'Terminal private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalDataReadLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.data.read',
      event: 'terminal-read-http.response',
      operationId: 'terminalReadProjectUpdateRuleSnapshotPage',
      elapsedMs: 42,
      resultKind: 'success',
      status: 200,
    });
    expect(JSON.stringify(projected)).not.toContain('private-project-ref');
    expect(JSON.stringify(projected)).not.toContain('private-hash');
    expect(JSON.stringify(projected)).not.toContain('private-secret');
  });
});

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

describe('Android terminal heartbeat diagnostics', () => {
  it('keeps PONG and local consumer outcomes while omitting arbitrary payload fields', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.connection.heartbeat',
      event: 'heartbeat-consumer-completed',
      level: 'info',
      data: {
        dispatchStatus: 'completed',
        consumerCount: 1,
        actorStatus: 'completed',
        resultStatus: 'context-not-ready',
        terminalRef: 'private-terminal-ref',
        credentialSecret: 'private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalHeartbeatLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.connection.heartbeat',
      event: 'heartbeat-consumer-completed',
      dispatchStatus: 'completed',
      consumerCount: 1,
      actorStatus: 'completed',
      resultStatus: 'context-not-ready',
    });
    expect(JSON.stringify(projected)).not.toContain('private-terminal-ref');
    expect(JSON.stringify(projected)).not.toContain('private-secret');
  });
});

describe('Android terminal update report diagnostics', () => {
  it('retains report state and reason enums without report identity or secrets', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.update.report',
      event: 'report-submit-completed',
      level: 'info',
      data: {
        resultKind: 'success',
        status: 200,
        reportSequence: 3,
        reportState: 'SUCCEEDED',
        reportReason: 'NONE',
        reportId: 'private-report-id',
        credentialSecret: 'private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalUpdateReportLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.update.report',
      event: 'report-submit-completed',
      level: 'info',
      attemptNumber: 3,
      reportState: 'SUCCEEDED',
      reportReason: 'NONE',
    });
    expect(JSON.stringify(projected)).not.toContain('private-report-id');
    expect(JSON.stringify(projected)).not.toContain('private-secret');
    expect(
      projectAndroidTerminalUpdateReportLog(line.replace('"reportReason":"NONE"', '"reportReason":"PRIVATE_REASON"')),
    ).not.toHaveProperty('reportReason');
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
