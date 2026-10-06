import {describe, expect, it, vi} from 'vitest';
import {createJourneyFailureDiagnostics} from '../src/journeyFailureDiagnostics.js';

describe('journey failure diagnostics', () => {
  it('reports the current step, request identity, and whitelisted push metadata without payloads', () => {
    const listener = vi.fn();
    const line = vi.fn();
    const diagnostics = createJourneyFailureDiagnostics({
      server: {onMessage: (_sessionId: string, next: (message: never) => void) => {
        listener.mockImplementation(next);
        return () => undefined;
      }} as never,
      sessionId: 'session-1',
      write: line,
    });

    diagnostics.markStep('kernel.feature.sample-staff-session.login');
    diagnostics.requestStarted('request-1');
    listener({
      type: 'event',
      body: {
        requestId: 'request-1',
        sequence: 2,
        event: {kind: 'actor.started', commandId: 'command-1', actorKey: 'sample.actor', payload: 'secret-payload'},
        value: {phone: '01012345678', passcode: '1111'},
      },
    });
    diagnostics.report(new Error('TERMINAL_AUTOMATION_SELECTOR_FAILED raw-sensitive-value'));

    const report = line.mock.calls[0]?.[0] as string;
    expect(report).toContain('TERMINAL_AUTOMATION_JOURNEY_FAILURE');
    expect(report).toContain('kernel.feature.sample-staff-session.login');
    expect(report).toContain('request-1');
    expect(report).toContain('actor.started');
    expect(report).toContain('NOT_SAVED_REDACTION_UNAVAILABLE');
    expect(report).not.toContain('secret-payload');
    expect(report).not.toContain('01012345678');
    expect(report).not.toContain('1111');
    expect(report).not.toContain('raw-sensitive-value');
    diagnostics.close();
  });

  it('removes a request from the pending context after its terminal result', () => {
    const line = vi.fn();
    const diagnostics = createJourneyFailureDiagnostics({
      server: {onMessage: () => () => undefined} as never,
      sessionId: 'session-1',
      write: line,
    });
    diagnostics.requestStarted('request-1');
    diagnostics.requestFinished('request-1');
    diagnostics.report(new Error('TERMINAL_AUTOMATION_FAILED'));
    expect(line.mock.calls[0]?.[0]).toContain('"inProgressRequestIds":[]');
    diagnostics.close();
  });

  it('records actual selector push metadata without serializing the selector value', () => {
    const listener = vi.fn();
    const line = vi.fn();
    const diagnostics = createJourneyFailureDiagnostics({
      server: {onMessage: (_sessionId: string, next: (message: never) => void) => {
        listener.mockImplementation(next);
        return () => undefined;
      }} as never,
      sessionId: 'session-1',
      write: line,
    });

    listener({
      type: 'event',
      body: {
        subscriptionId: 'sub-1',
        sequence: 7,
        valueState: 'JSON',
        value: {phone: '01012345678', memberName: 'sensitive'},
      },
    });
    diagnostics.report(new Error('TERMINAL_AUTOMATION_SELECTOR_FAILED'));

    const report = line.mock.calls[0]?.[0] as string;
    expect(report).toContain('"subscriptionId":"sub-1"');
    expect(report).toContain('"sequence":7');
    expect(report).toContain('"selectorValueState":"JSON"');
    expect(report).not.toContain('01012345678');
    expect(report).not.toContain('sensitive');
    diagnostics.close();
  });
});
